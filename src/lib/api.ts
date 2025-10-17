import { supabase } from './supabaseClient';
import type { Session } from '@supabase/gotrue-js';
import type { User, Product, Quiz, QuizSubmission, SubmissionStatus, MtaServerStatus, AuditLogEntry, RuleCategory, AppConfig, MtaLogEntry, UserLookupResult, DiscordAnnouncement, DiscordRole, PermissionKey, RolePermission } from '../types';

// --- API Error Handling ---
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// --- User Profile Caching to prevent Rate Limiting ---
interface UserProfileCacheEntry {
  user: User;
  syncError: string | null;
  timestamp: number;
}
const CACHE_KEY = 'userProfileCache';
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

const getCachedUserProfile = (userId: string): UserProfileCacheEntry | null => {
    try {
        const cachedData = localStorage.getItem(CACHE_KEY);
        if (!cachedData) return null;

        const cache: Record<string, any> = JSON.parse(cachedData);
        const userEntry = cache[userId];

        if (userEntry && (Date.now() - userEntry.timestamp < CACHE_TTL_MS)) {
            // Re-hydrate the Set object, which is lost during JSON stringification
            userEntry.user.permissions = new Set(userEntry.user.permissions);
            return userEntry as UserProfileCacheEntry;
        }
        return null;
    } catch (error) {
        console.error("Failed to read from localStorage cache", error);
        return null;
    }
};

const setCachedUserProfile = (userId: string, data: { user: User, syncError: string | null }) => {
    try {
        const cachedData = localStorage.getItem(CACHE_KEY);
        const cache: Record<string, any> = cachedData ? JSON.parse(cachedData) : {};
        
        // Convert Set to array for JSON compatibility
        const userToCache = {
            ...data.user,
            permissions: Array.from(data.user.permissions),
        };

        cache[userId] = {
            user: userToCache, // permissions is an array here
            syncError: data.syncError,
            timestamp: Date.now(),
        };

        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
        console.error("Failed to write to localStorage cache", error);
    }
};


// --- PUBLIC READ-ONLY FUNCTIONS ---

export const getConfig = async (): Promise<AppConfig> => {
  if (!supabase) throw new ApiError("Supabase not configured", 500);
  const { data, error } = await supabase.from('config').select('*').single();
  if (error) throw new ApiError(error.message, 500);
  // SUPER_ADMIN_ROLE_IDS and HANDLER_ROLE_IDS are deprecated and no longer part of the type
  const { SUPER_ADMIN_ROLE_IDS, HANDLER_ROLE_IDS, ...rest } = data as any;
  return rest as AppConfig;
};

export const getProducts = async (): Promise<Product[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('products').select('*');
  if (error) throw new ApiError(error.message, 500);
  return data;
};

export const getQuizzes = async (): Promise<Quiz[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('quizzes').select('*');
  if (error) throw new ApiError(error.message, 500);
  return data;
};

export const getQuizById = async (id: string): Promise<Quiz | undefined> => {
  if (!supabase) return undefined;
  const { data, error } = await supabase.from('quizzes').select('*').eq('id', id).single();
  if (error) {
      if (error.code === 'PGRST116') return undefined; // Not found
      throw new ApiError(error.message, 500);
  }
  return data;
};

export const getRules = async (): Promise<RuleCategory[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('rule_categories').select(`*, rules (*)`).order('order');
    if (error) throw new ApiError(error.message, 500);
    return data;
}

export const getTranslations = async (): Promise<Record<string, { ar: string, en: string }>> => {
    if (!supabase) return {};
    const { data, error } = await supabase.from('translations').select('key, ar, en');
    if (error) throw new ApiError(error.message, 500);
    
    const translationsObject: Record<string, { ar: string, en: string }> = {};
    for (const item of data) {
        translationsObject[item.key] = { ar: item.ar, en: item.en };
    }
    return translationsObject;
};

export const getDiscordAnnouncements = async (): Promise<DiscordAnnouncement[]> => {
    console.warn('getDiscordAnnouncements is mocked and will return empty data.');
    return Promise.resolve([]);
};

// --- USER-SPECIFIC FUNCTIONS ---

export const getSubmissionsByUserId = async (userId: string): Promise<QuizSubmission[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('submissions').select('*').eq('user_id', userId);
    if (error) throw new ApiError(error.message, 500);
    return data;
}

export const addSubmission = async (submissionData: Partial<QuizSubmission>): Promise<QuizSubmission> => {
    if (!supabase) throw new ApiError("Database not configured", 500);
    const { data, error } = await supabase.from('submissions').insert([submissionData]).select().single();
    if (error) throw new ApiError(error.message, 500);
    return data;
};


// --- ADMIN FUNCTIONS ---

export const logAdminAccess = async (): Promise<void> => {
    if (!supabase) throw new ApiError("Database not configured", 500);
    const { error } = await supabase.rpc('log_admin_access');
    if (error) throw new ApiError(error.message, 500);
};

export const getSubmissions = async (): Promise<QuizSubmission[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('submissions').select('*').order('submittedAt', { ascending: false });
    if (error) throw new ApiError(error.message, 500);
    return data;
}

export const updateSubmissionStatus = async (submissionId: string, status: SubmissionStatus): Promise<void> => {
    if (!supabase) throw new ApiError("Database not configured", 500);
    const { error } = await supabase.rpc('update_submission_status', {
        p_submission_id: submissionId,
        p_status: status
    });
    if (error) throw new ApiError(error.message, 500);
}

export const saveQuiz = async (quiz: Quiz): Promise<Quiz> => {
    if (!supabase) throw new ApiError("Database not configured", 500);
    const quizPayload = {
      id: quiz.id || undefined,
      titleKey: quiz.titleKey,
      descriptionKey: quiz.descriptionKey,
      questions: quiz.questions,
      isOpen: quiz.isOpen,
      allowedTakeRoles: quiz.allowedTakeRoles,
      lastOpenedAt: quiz.isOpen ? new Date().toISOString() : quiz.lastOpenedAt,
      logoUrl: quiz.logoUrl,
      bannerUrl: quiz.bannerUrl,
    };
    const { data, error } = await supabase.from('quizzes').upsert(quizPayload).select().single();
    if (error) throw new ApiError(error.message, 500);
    return data;
}

export const deleteQuiz = async (quizId: string): Promise<void> => {
    if (!supabase) throw new ApiError("Database not configured", 500);
    const { error } = await supabase.from('quizzes').delete().eq('id', quizId);
    if (error) throw new ApiError(error.message, 500);
}

export const saveRules = async (rulesData: RuleCategory[]): Promise<void> => {
    if (!supabase) throw new ApiError("Database not configured", 500);
    const categoryIds = rulesData.map(cat => cat.id);
    if (categoryIds.length > 0) {
        const { error: deleteError } = await supabase.from('rules').delete().in('category_id', categoryIds);
        if (deleteError) throw new ApiError(`Failed to delete old rules: ${deleteError.message}`, 500);
    }
    const categoriesToUpsert = rulesData.map(({ rules, ...cat }) => cat);
    if (categoriesToUpsert.length > 0) {
        const { error: catError } = await supabase.from('rule_categories').upsert(categoriesToUpsert);
        if (catError) throw new ApiError(`Failed to save rule categories: ${catError.message}`, 500);
    }
    const allRules = rulesData.flatMap(cat => cat.rules.map(rule => ({ ...rule, category_id: cat.id })));
    if (allRules.length > 0) {
        const { error: ruleError } = await supabase.from('rules').insert(allRules);
        if (ruleError) throw new ApiError(`Failed to save new rules: ${ruleError.message}`, 500);
    }
}

export const saveProduct = async (product: Product): Promise<Product> => {
    if (!supabase) throw new ApiError("Database not configured", 500);
    const { data, error } = await supabase.from('products').upsert(product).select().single();
    if (error) throw new ApiError(error.message, 500);
    return data;
};

export const deleteProduct = async (productId: string): Promise<void> => {
    if (!supabase) throw new ApiError("Database not configured", 500);
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) throw new ApiError(error.message, 500);
};

export const saveConfig = async (config: Partial<AppConfig>): Promise<void> => {
    if (!supabase) throw new ApiError("Database not configured", 500);
    const { error } = await supabase.from('config').update(config).eq('id', 1);
    if (error) throw new ApiError(error.message, 500);
}

export const saveTranslations = async (translations: Record<string, { ar: string; en: string }>): Promise<void> => {
    if (!supabase) throw new ApiError("Database not configured", 500);
    const translationsData = Object.entries(translations).map(([key, value]) => ({ key, ar: value.ar, en: value.en }));
    const { error } = await supabase.rpc('update_translations', { translations_data: translationsData });
    if (error) throw new ApiError(error.message, 500);
};

export const getAuditLogs = async (): Promise<AuditLogEntry[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(100);
    if (error) throw new ApiError(error.message, 500);
    return data;
}

export const lookupDiscordUser = async (userId: string): Promise<UserLookupResult> => {
    if (!supabase) throw new ApiError("Database not configured", 500);
    const { data, error } = await supabase.functions.invoke('get-discord-user-profile', { body: { userId } });
    if (error) throw new ApiError(error.message, 500);
    return data;
}

export const getGuildRoles = async (): Promise<DiscordRole[]> => {
    if (!supabase) throw new ApiError("Database not configured", 500);
    const { data, error } = await supabase.functions.invoke('get-guild-roles');
    if (error) throw new ApiError(error.message, 500);
    return data;
};

export const getRolePermissions = async (roleId: string): Promise<RolePermission | null> => {
    if (!supabase) throw new ApiError("Database not configured", 500);
    const { data, error } = await supabase.from('role_permissions').select('*').eq('role_id', roleId).maybeSingle();
    if (error) throw new ApiError(error.message, 500);
    return data;
};

export const saveRolePermissions = async (roleId: string, permissions: PermissionKey[]): Promise<void> => {
    if (!supabase) throw new ApiError("Database not configured", 500);
    const { error } = await supabase.rpc('save_role_permissions', { p_role_id: roleId, p_permissions: permissions });
    if (error) throw new ApiError(error.message, 500);
};


// --- AUTH & SESSION MANAGEMENT ---

export const fetchUserProfile = async (session: Session): Promise<{ user: User, syncError: string | null }> => {
    if (!supabase) throw new ApiError("Supabase not configured", 500);
    
    // --- Caching Logic ---
    const userId = session.user.id;
    const cachedData = getCachedUserProfile(userId);
    if (cachedData) {
        return { user: cachedData.user, syncError: cachedData.syncError };
    }
    // --- End Caching Logic ---

    const { data: config, error: configError } = await supabase.from('config').select('DISCORD_GUILD_ID').single();
    if (configError) throw new ApiError(`Failed to fetch guild config: ${configError.message}`, 500);

    const guildId = config.DISCORD_GUILD_ID;
    const providerToken = session.provider_token;
    let syncError: string | null = null;
    let roles: string[] = [];
    let highestRole: { id: string; name: string; color: number } | null = null;

    if (providerToken && guildId) {
        try {
            const memberUrl = `https://discord.com/api/v10/users/@me/guilds/${guildId}/member`;
            const memberResponse = await fetch(memberUrl, { headers: { 'Authorization': `Bearer ${providerToken}` } });

            if (!memberResponse.ok) {
                syncError = memberResponse.status === 404
                    ? 'User not found in Discord server. Permissions may be limited.'
                    : `Failed to sync Discord roles (HTTP ${memberResponse.status}).`;
            } else {
                const memberData = await memberResponse.json();
                roles = memberData.roles || [];
                
                // Update the user's metadata in Supabase Auth to include their roles.
                // This makes the roles available in the JWT for RLS policies.
                const { error: updateError } = await supabase.auth.updateUser({ data: { roles } });
                if (updateError) console.error("Failed to update user metadata with roles:", updateError);

                if (roles.length > 0) {
                    const guildRoles = await getGuildRoles();
                    const userRolesDetails = guildRoles.filter(role => roles.includes(role.id)).sort((a, b) => b.position - a.position);
                    if (userRolesDetails.length > 0) {
                        const topRole = userRolesDetails[0];
                        highestRole = { id: topRole.id, name: topRole.name, color: topRole.color };
                    }
                }
            }
        } catch (e) {
            syncError = e instanceof Error ? e.message : "An error occurred while syncing Discord roles.";
        }
    } else {
        syncError = "Discord Guild ID not configured or provider token missing. Roles cannot be synced.";
    }

    // Calculate final permissions
    let finalPermissions = new Set<PermissionKey>();
    if (roles.length > 0) {
        const { data: perms, error: permsError } = await supabase.from('role_permissions').select('permissions').in('role_id', roles);
        if (permsError) {
            console.error("Failed to fetch role permissions:", permsError);
            syncError = (syncError ? syncError + " " : "") + "Could not fetch permissions from database.";
        } else if (perms) {
            perms.forEach(p => {
                p.permissions.forEach(key => finalPermissions.add(key as PermissionKey));
            });
        }
    }

    const finalUser: User = {
      id: session.user.id,
      username: session.user.user_metadata.full_name,
      avatar: session.user.user_metadata.avatar_url,
      roles,
      highestRole,
      permissions: finalPermissions,
    };

    const result = { user: finalUser, syncError };

    // Store the fresh data in the cross-tab cache before returning
    setCachedUserProfile(userId, result);

    return result;
};


export const revalidateSession = async (): Promise<User> => {
    if (!supabase) throw new ApiError("Supabase not configured", 500);
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) throw new ApiError("No active session.", 401);
    const { user } = await fetchUserProfile(session);
    return user;
}


// --- HEALTH CHECK FUNCTIONS ---
// ... (omitted for brevity, no changes needed)

// --- MOCKED FUNCTIONS ---
// ... (omitted for brevity, no changes needed)
export const getMtaServerStatus = async (): Promise<MtaServerStatus> => {
    const config = await getConfig();
    return {
        name: `${config.COMMUNITY_NAME} Roleplay`,
        players: Math.floor(Math.random() * 100),
        maxPlayers: 128,
    };
}
export const getMtaPlayerLogs = async (userId: string): Promise<MtaLogEntry[]> => {
    console.warn(`getMtaPlayerLogs is mocked for user ID: ${userId}`);
    return Promise.resolve([]);
};
export const testDiscordApi = async (session: Session): Promise<string> => { return "Test not implemented for RBAC yet."}