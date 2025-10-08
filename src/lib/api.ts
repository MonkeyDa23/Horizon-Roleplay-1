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
    
    // HACK: Fetching all guild roles to get names, colors, and positions requires a BOT token,
    // not a user OAuth token. Using the user token for the /guilds/{id}/roles endpoint
    // will fail and break the login process.
    // To fix the login, we must disable fetching full role details until a proper backend 
    // endpoint (e.g., a serverless function) can be created to handle this securely.
    // This will temporarily disable the display of the user's highest role on their profile,
    // but it is necessary to allow users to log in and create an account.
    // The `roles` array (containing only IDs) is still returned correctly, so admin/permission checks will work.
    const userRoleIds: string[] = memberData.roles || [];

    return { 
        roles: userRoleIds, 
        discordRoles: [], // Return empty array as we cannot fetch details
        highestRole: null // Return null as we cannot determine the highest role
    };
};


export const fetchUserProfile = async (session: Session): Promise<User> => {
    if (!supabase) throw new ApiError("Supabase not configured", 500);

    const providerToken = session.provider_token;
    if (!providerToken) throw new ApiError("Discord provider token not found.", 401);

    const config = await getConfig();
    const { roles, discordRoles, highestRole } = await fetchDiscordMember(providerToken, config.DISCORD_GUILD_ID);
    
    const superAdminRoles = config.SUPER_ADMIN_ROLE_IDS || [];
    const handlerRoles = config.HANDLER_ROLE_IDS || [];

    const isSuperAdmin = roles.some(roleId => superAdminRoles.includes(roleId));
    const isHandler = roles.some(roleId => handlerRoles.includes(roleId));
    const isAdmin = isSuperAdmin || isHandler;

    // Upsert the profile. This will create it if it doesn't exist, or update it if it does.
    // This is safe because isAdmin/isSuperAdmin are derived from Discord roles, not user input.
    const { data: profileData, error: upsertError } = await supabase
      .from('profiles')
      .upsert({
        id: session.user.id,
        is_admin: isAdmin,
        is_super_admin: isSuperAdmin,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (upsertError) {
      console.error("Error upserting profile:", upsertError);
      throw new ApiError(upsertError.message, 500);
    }
    
    return {
      id: session.user.id,
      username: session.user.user_metadata.full_name,
      avatar: session.user.user_metadata.avatar_url,
      isAdmin: profileData.is_admin,
      isSuperAdmin: profileData.is_super_admin,
      discordRoles: discordRoles,
      roles: roles,
      highestRole: highestRole,
    };
};

export const revalidateSession = async (): Promise<User> => {
    if (!supabase) throw new ApiError("Supabase not configured", 500);
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) throw new ApiError("No active session.", 401);
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