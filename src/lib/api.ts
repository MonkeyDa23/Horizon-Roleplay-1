import { supabase } from './supabaseClient';
import type { Session } from '@supabase/supabase-js';
import type { User, Product, Quiz, QuizSubmission, SubmissionStatus, DiscordRole, DiscordAnnouncement, MtaServerStatus, AuditLogEntry, RuleCategory, AppConfig, Rule, MtaLogEntry } from '../types';

// --- API Error Handling ---
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
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
    const { data, error } = await supabase.from('submissions').select('*').order('submitted_at', { ascending: false });
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
    const { id, questions, ...quizData } = quiz;
    const { data, error } = await supabase.from('quizzes').upsert({ id: id || undefined, ...quizData }).select().single();
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

// --- AUTH & SESSION MANAGEMENT ---

const fetchDiscordMember = async (providerToken: string, guildId: string): Promise<{ roles: string[], discordRoles: DiscordRole[], highestRole: DiscordRole | null }> => {
    if (!guildId) {
        throw new ApiError("Discord Guild ID is not configured in the database.", 500);
    }
    const memberUrl = `https://discord.com/api/users/@me/guilds/${guildId}/member`;
    const memberResponse = await fetch(memberUrl, {
        headers: { 'Authorization': `Bearer ${providerToken}` }
    });
    if (!memberResponse.ok) {
        if (memberResponse.status === 404) throw new ApiError("User not found in the configured Discord server. Please join the server and try logging in again.", 404);
        throw new ApiError(`Failed to fetch Discord member data: ${memberResponse.statusText}`, memberResponse.status);
    }
    const memberData = await memberResponse.json();
    const userRoleIds: string[] = memberData.roles || [];

    // The following logic assumes a Supabase Edge Function named 'get-guild-roles'
    // has been deployed. This function should accept a 'guildId' and use a Discord Bot
    // token to fetch all roles for that guild, returning them as an array.
    // This is necessary because fetching all guild roles requires bot permissions,
    // which cannot be done with a user's OAuth token on the client-side.
    if (!supabase) {
        console.warn("Supabase client not available, skipping role detail fetch.");
        return { roles: userRoleIds, discordRoles: [], highestRole: null };
    }

    try {
        const { data: functionResponse, error: functionsError } = await supabase.functions.invoke('get-guild-roles', {
            body: { guildId },
        });

        if (functionsError) throw functionsError;
        
        // The edge function is expected to return an object like { roles: [...] }
        const allGuildRoles: { id: string; name: string; color: number; position: number; }[] = functionResponse.roles;

        if (!Array.isArray(allGuildRoles)) {
            console.warn("Edge function 'get-guild-roles' did not return a 'roles' array.", functionResponse);
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

        return { 
            roles: userRoleIds, 
            discordRoles: userFullRoles, 
            highestRole: highestUserRole 
        };
    } catch (error) {
        console.warn("Could not fetch full role details. This may be because the 'get-guild-roles' Edge Function is not deployed or has an error. The user will be logged in with basic permissions.", error);
        return { roles: userRoleIds, discordRoles: [], highestRole: null };
    }
};


export const fetchUserProfile = async (session: Session): Promise<User> => {
    if (!supabase) throw new ApiError("Supabase not configured", 500);

    // Step 1: Get basic user info from session.
    const userId = session.user.id;
    const username = session.user.user_metadata.full_name;
    const avatar = session.user.user_metadata.avatar_url;

    // Step 2: Ensure a profile exists and get its current state. THIS IS THE CRITICAL PATH.
    // This upsert will create a profile with default values if it's a new user.
    // We then select it to get the user's last known permissions.
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .upsert({ id: userId, updated_at: new Date().toISOString() })
      .select('is_admin, is_super_admin')
      .single();

    // If this fails, the login cannot proceed. It's a fundamental DB issue.
    if (profileError) {
      console.error("Critical error: Could not read or create user profile.", profileError);
      throw new ApiError(profileError.message, 500);
    }

    // At this point, login is guaranteed to succeed. The user will be logged in
    // with their permissions as stored in our database.

    // Step 3: (BEST EFFORT) Try to sync roles from Discord.
    // This can fail without breaking the login.
    let roles: string[] = [];
    let discordRoles: DiscordRole[] = [];
    let highestRole: DiscordRole | null = null;
    let isAdmin = profileData.is_admin;
    let isSuperAdmin = profileData.is_super_admin;
    
    try {
        const providerToken = session.provider_token;
        if (!providerToken) throw new Error("Discord provider token not found in session.");

        const config = await getConfig();
        const memberData = await fetchDiscordMember(providerToken, config.DISCORD_GUILD_ID);
        
        roles = memberData.roles;
        discordRoles = memberData.discordRoles;
        highestRole = memberData.highestRole;

        // Calculate fresh permissions
        const superAdminRoles = config.SUPER_ADMIN_ROLE_IDS || [];
        const handlerRoles = config.HANDLER_ROLE_IDS || [];
        const freshIsSuperAdmin = roles.some(roleId => superAdminRoles.includes(roleId));
        const freshIsHandler = roles.some(roleId => handlerRoles.includes(roleId));
        const freshIsAdmin = freshIsSuperAdmin || freshIsHandler;

        // If permissions have changed, update the DB.
        if (freshIsAdmin !== isAdmin || freshIsSuperAdmin !== isSuperAdmin) {
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ is_admin: freshIsAdmin, is_super_admin: freshIsSuperAdmin })
              .eq('id', userId);
            
            if (updateError) {
                // Log the error but don't fail the whole login. The user will just have stale permissions
                // until the next successful sync.
                console.warn("Failed to update user permissions in DB after a successful role sync.", updateError);
            } else {
                // Update the variables we're about to return.
                isAdmin = freshIsAdmin;
                isSuperAdmin = freshIsSuperAdmin;
            }
        }

    } catch (error) {
        console.warn("Could not sync Discord roles during login. The user will be logged in with their existing permissions. This is non-critical.", error);
    }
    
    // Step 4: Return the complete User object.
    return {
      id: userId,
      username: username,
      avatar: avatar,
      isAdmin: isAdmin,
      isSuperAdmin: isSuperAdmin,
      discordRoles: discordRoles,
      roles: roles,
      highestRole: highestRole,
    };
};

export const revalidateSession = async (): Promise<User> => {
    if (!supabase) throw new ApiError("Supabase not configured", 500);
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) throw new ApiError("No active session.", 401);
    // Re-running the full profile fetch also re-syncs the roles
    return fetchUserProfile(session);
}


// --- HEALTH CHECK FUNCTIONS ---

export const testDiscordApi = async (session: Session): Promise<string> => {
    const providerToken = session.provider_token;
    if (!providerToken) throw new ApiError("Discord provider token not found.", 401);

    const config = await getConfig();
    const guildId = config.DISCORD_GUILD_ID;
    if (!guildId) throw new ApiError("Discord Guild ID is not configured in the database.", 500);

    const memberUrl = `https://discord.com/api/users/@me/guilds/${guildId}/member`;
    const memberResponse = await fetch(memberUrl, {
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