import { supabase } from './supabaseClient';
// FIX: The Session type is sometimes not re-exported from the main supabase-js package. Importing directly from gotrue-js is safer.
import type { Session } from '@supabase/gotrue-js';
import type { User, Product, Quiz, QuizSubmission, SubmissionStatus, DiscordRole, DiscordAnnouncement, MtaServerStatus, AuditLogEntry, RuleCategory, AppConfig, Rule, MtaLogEntry, UserLookupResult } from '../types';

// --- API Error Handling ---
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Helper to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// A helper function to wrap fetch and handle 429 rate-limiting errors from Discord
async function fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
    let response = await fetch(url, options);

    if (response.status === 429) {
        const retryAfterHeader = response.headers.get('Retry-After');
        // The header is in seconds, might be a float. Add a small buffer (500ms).
        const retryAfterSeconds = retryAfterHeader ? parseFloat(retryAfterHeader) : 1;
        const waitMs = retryAfterSeconds * 1000 + 500;
        
        console.warn(`Rate limited by Discord. Retrying after ${waitMs}ms...`);
        await delay(waitMs);

        // Retry the request once
        response = await fetch(url, options);
    }

    return response;
}


// --- PUBLIC READ-ONLY FUNCTIONS ---

export const getConfig = async (): Promise<AppConfig> => {
  if (!supabase) throw new ApiError("Supabase not configured", 500);
  const { data, error } = await supabase.from('config').select('*').single();
  if (error) throw new ApiError(error.message, 500);
  return data as AppConfig;
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
    
    // Transform the array of objects into the required key-value structure
    const translationsObject: Record<string, { ar: string, en: string }> = {};
    for (const item of data) {
        translationsObject[item.key] = { ar: item.ar, en: item.en };
    }
    return translationsObject;
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
    
    // Prepare a payload that matches the DB schema exactly.
    const quizPayload = {
      id: quiz.id || undefined, // Let DB generate UUID for new quizzes
      titleKey: quiz.titleKey,
      descriptionKey: quiz.descriptionKey,
      questions: quiz.questions, // This is the crucial part that was missing
      isOpen: quiz.isOpen,
      allowedTakeRoles: quiz.allowedTakeRoles,
      // If we are opening a quiz, or if it's new and open, set the timestamp.
      // Otherwise, keep the old one. This is used for application seasons.
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
    // This should ideally be a single RPC call to ensure atomicity.
    // This client-side implementation is a simplification.
    
    // 1. Get all category IDs
    const categoryIds = rulesData.map(cat => cat.id);

    // 2. Delete all existing rules for these categories
    if (categoryIds.length > 0) {
        const { error: deleteError } = await supabase.from('rules').delete().in('category_id', categoryIds);
        if (deleteError) throw new ApiError(`Failed to delete old rules: ${deleteError.message}`, 500);
    }
    
    // 3. Upsert categories
    const categoriesToUpsert = rulesData.map(({ rules, ...cat }) => cat);
    if (categoriesToUpsert.length > 0) {
        const { error: catError } = await supabase.from('rule_categories').upsert(categoriesToUpsert);
        if (catError) throw new ApiError(`Failed to save rule categories: ${catError.message}`, 500);
    }

    // 4. Insert new rules
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
    const translationsData = Object.entries(translations).map(([key, value]) => ({
        key,
        ar: value.ar,
        en: value.en,
    }));

    const { error } = await supabase.rpc('update_translations', {
        translations_data: translationsData
    });

    if (error) throw new ApiError(error.message, 500);
};

export const getAuditLogs = async (): Promise<AuditLogEntry[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(100);
    if (error) throw new ApiError(error.message, 500);
    return data;
}

export const logAdminAccess = async (user: User): Promise<void> => {
    if (!supabase) return; // Gracefully fail if supabase isn't configured
    const { error } = await supabase.from('audit_logs').insert({
        action: 'Admin Panel Accessed',
        admin_id: user.id,
        admin_username: user.username,
    });
    if (error) {
        console.error("Failed to log admin access:", error);
    }
};

export const lookupDiscordUser = async (userId: string): Promise<UserLookupResult> => {
    if (!supabase) throw new ApiError("Database not configured", 500);
    const { data, error } = await supabase.functions.invoke('get-discord-user-profile', {
        body: { userId },
    });
    if (error) throw new ApiError(error.message, 500);
    return data;
}

export const updateUserPermissions = async (targetUserId: string, isAdmin: boolean, isSuperAdmin: boolean): Promise<void> => {
    if (!supabase) throw new ApiError("Database not configured", 500);
    const { error } = await supabase.rpc('update_user_permissions', {
        target_user_id: targetUserId,
        p_is_admin: isAdmin,
        p_is_super_admin: isSuperAdmin
    });
    if (error) throw new ApiError(error.message, 500);
};

// --- Caching for Discord data ---
interface DiscordMemberCacheEntry {
    timestamp: number;
    data: {
        roles: string[];
        discordRoles: DiscordRole[];
        highestRole: DiscordRole | null;
    };
}
const MEMBER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// --- AUTH & SESSION MANAGEMENT ---

export interface UserProfileResponse {
    user: User;
    syncError?: string;
}

const fetchDiscordMember = async (providerToken: string, guildId: string, userId: string): Promise<{ roles: string[], discordRoles: DiscordRole[], highestRole: DiscordRole | null }> => {
    // Check sessionStorage cache first for persistence across reloads
    const cacheKey = `discord_member_${userId}_${guildId}`;
    try {
        const cachedItem = sessionStorage.getItem(cacheKey);
        if (cachedItem) {
            const cached: DiscordMemberCacheEntry = JSON.parse(cachedItem);
            if (cached && (Date.now() - cached.timestamp < MEMBER_CACHE_TTL_MS)) {
                console.log(`[Cache HIT] Returning cached Discord member data for user ${userId}.`);
                return cached.data;
            }
        }
    } catch (e) {
        console.warn("Could not read from sessionStorage cache", e);
    }

    console.log(`[Cache MISS] Fetching fresh Discord member data for user ${userId}.`);

    if (!guildId) {
        throw new ApiError("Discord Guild ID is not configured in the database.", 500);
    }
    const memberUrl = `https://discord.com/api/v10/users/@me/guilds/${guildId}/member`;
    const memberResponse = await fetchWithRetry(memberUrl, {
        headers: { 'Authorization': `Bearer ${providerToken}` }
    });
    if (!memberResponse.ok) {
        if (memberResponse.status === 404) throw new ApiError("User not found in the configured Discord server. Please join the server and try logging in again.", 404);
        if (memberResponse.status === 403) throw new ApiError("Discord permissions missing. Please log out and log back in, ensuring you grant the 'Access your servers' permission.", 403);
        throw new ApiError(`Failed to fetch Discord member data: ${memberResponse.statusText}`, memberResponse.status);
    }
    const memberData = await memberResponse.json();
    const userRoleIds: string[] = memberData.roles || [];

    if (!supabase) {
        console.warn("Supabase client not available, skipping role detail fetch.");
        return { roles: userRoleIds, discordRoles: [], highestRole: null };
    }

    try {
        const { data: allGuildRoles, error: functionsError } = await supabase.functions.invoke('get-guild-roles', {
            body: { guildId },
        });

        if (functionsError) throw functionsError;
        
        if (!Array.isArray(allGuildRoles)) {
            console.warn("Edge function 'get-guild-roles' did not return an array.", allGuildRoles);
            return { roles: userRoleIds, discordRoles: [], highestRole: null };
        }

        const userFullRoles: DiscordRole[] = allGuildRoles
            .filter(role => userRoleIds.includes(role.id))
            .map(role => ({
                id: role.id,
                name: role.name,
                color: `#${(role.color || 0).toString(16).padStart(6, '0')}`,
                position: role.position
            }))
            .sort((a, b) => b.position - a.position);

        const highestUserRole = userFullRoles.length > 0 ? userFullRoles[0] : null;

        const result = { 
            roles: userRoleIds, 
            discordRoles: userFullRoles, 
            highestRole: highestUserRole 
        };
        
        // Update sessionStorage cache
        try {
            const cacheEntry: DiscordMemberCacheEntry = { timestamp: Date.now(), data: result };
            sessionStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
        } catch (e) {
            console.warn("Could not write to sessionStorage cache", e);
        }
        
        return result;
    } catch (error) {
        console.warn("Could not fetch full role details. This may be because the 'get-guild-roles' Edge Function is not deployed or has an error. The user will be logged in with basic permissions.", error);
        return { roles: userRoleIds, discordRoles: [], highestRole: null };
    }
};


export const fetchUserProfile = async (session: Session): Promise<UserProfileResponse> => {
    if (!supabase) throw new ApiError("Supabase not configured", 500);

    const userId = session.user.id;
    const username = session.user.user_metadata.full_name;
    const avatar = session.user.user_metadata.avatar_url;

    // Fetch the user's profile from the database. This is now the SINGLE SOURCE OF TRUTH for permissions.
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .upsert({ id: userId, updated_at: new Date().toISOString() })
      .select('is_admin, is_super_admin')
      .single();

    if (profileError) {
      console.error("Critical error: Could not read or create user profile.", profileError);
      throw new ApiError(profileError.message, 500);
    }
    
    // Permissions are taken directly from the database.
    const isAdmin = profileData.is_admin;
    const isSuperAdmin = profileData.is_super_admin;

    // Initialize Discord data as empty, to be populated by sync for display purposes only.
    let roles: string[] = [];
    let discordRoles: DiscordRole[] = [];
    let highestRole: DiscordRole | null = null;
    let syncError: string | undefined = undefined;

    // We still attempt to fetch Discord roles for display on the profile page,
    // but this process will no longer affect the user's admin status.
    try {
        const config = await getConfig();
        const providerToken = session.provider_token;

        if (providerToken) {
            console.log(`[Sync] Using provider_token for user ${userId} to fetch display roles.`);
            const memberData = await fetchDiscordMember(providerToken, config.DISCORD_GUILD_ID, userId);
            
            roles = memberData.roles;
            discordRoles = memberData.discordRoles;
            highestRole = memberData.highestRole;
        } else {
            // If there's no provider token (e.g., from an old session), we can't sync roles. This is not critical.
            console.log(`[Sync] No provider_token for user ${userId}. Skipping Discord role sync on login. Roles will not be displayed on profile page.`);
        }

        // CRITICAL CHANGE: The section that recalculated and updated permissions based on roles has been REMOVED.
        
    } catch (error) {
        // In case of any error during Discord sync (API down, user not in guild, etc.),
        // we now treat it as a non-critical warning. The user's permissions are safe.
        let warningMessage = `Could not sync Discord roles for user ${userId}. Roles will not be displayed on profile.`;
        if (error instanceof Error) {
            warningMessage += ` (Reason: ${error.message})`;
        }
        console.warn(warningMessage, error);
        syncError = error instanceof Error ? error.message : "An unknown error occurred during Discord role sync.";
        // 'roles', 'discordRoles', 'highestRole' are left empty/null.
    }
    
    const finalUser: User = {
      id: userId,
      username: username,
      avatar: avatar,
      // Use permissions directly from the database.
      isAdmin: isAdmin,
      isSuperAdmin: isSuperAdmin,
      // Include fetched Discord data for display purposes.
      discordRoles: discordRoles,
      roles: roles,
      highestRole: highestRole,
    };

    return { user: finalUser, syncError };
};


export const revalidateSession = async (): Promise<User> => {
    if (!supabase) throw new ApiError("Supabase not configured", 500);
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) throw new ApiError("No active session.", 401);
    const { user } = await fetchUserProfile(session);
    return user;
}


// --- HEALTH CHECK FUNCTIONS ---

export const testDiscordApi = async (session: Session): Promise<string> => {
    const providerToken = session.provider_token;
    if (!providerToken) throw new ApiError("Discord provider token not found.", 401);

    const config = await getConfig();
    const guildId = config.DISCORD_GUILD_ID;
    if (!guildId) throw new ApiError("Discord Guild ID is not configured in the database.", 500);

    const memberUrl = `https://discord.com/api/v10/users/@me/guilds/${guildId}/member`;
    const memberResponse = await fetchWithRetry(memberUrl, {
        headers: { 'Authorization': `Bearer ${providerToken}` }
    });
    
    if (!memberResponse.ok) {
        if (memberResponse.status === 404) {
            throw new ApiError(`You are not a member of the configured Discord server (ID: ${guildId}). Please join the server and try again.`, 404);
        }
        throw new ApiError(`Failed to fetch Discord member data. Status: ${memberResponse.status} ${memberResponse.statusText}`, memberResponse.status);
    }
    
    // If we get here, it means the API call was successful.
    return `Successfully connected to Discord and found you in the server (ID: ${guildId}).`;
};


// --- MOCKED FUNCTIONS (to be replaced by real backend/API calls if needed) ---

export const getMtaServerStatus = async (): Promise<MtaServerStatus> => {
    // This would typically hit a game server query API. We'll keep it mocked for now.
    const config = await getConfig();
    return {
        name: `${config.COMMUNITY_NAME} Roleplay`,
        players: Math.floor(Math.random() * 100),
        maxPlayers: 128,
    };
}

export const getMtaPlayerLogs = async (userId: string): Promise<MtaLogEntry[]> => {
    console.warn(`getMtaPlayerLogs is mocked for user ID: ${userId}`);
    // This is a mocked function. A real implementation would query an MTA logs database or API.
    // Returning an empty array to simulate a "no logs found" state.
    return Promise.resolve([]);
};

export const getDiscordAnnouncements = async (): Promise<DiscordAnnouncement[]> => {
    // This requires a Discord Bot and a backend. Mocking is the only client-side option.
    return [
        {
            id: '1',
            title: '🎉 Community Event: Summer Drift King!',
            content: 'Get your engines ready! This Saturday, we are hosting the annual Summer Drift King competition. Sign-ups are open now in the #events channel. Amazing prizes to be won, including exclusive custom vehicles!',
            author: {
                name: 'Community Bot',
                avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png'
            },
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
            url: '#'
        },
    ];
};