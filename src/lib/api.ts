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

/**
 * Fetches Discord member data using the user's provider token.
 * WARNING: This makes a client-side API call to Discord, exposing the user's
 * access token in network requests. For production, this logic should be moved
 * to a secure backend (e.g., a Supabase Edge Function) that uses a bot token.
 */
const fetchDiscordMember = async (providerToken: string, guildId: string): Promise<{ roles: string[], discordRoles: DiscordRole[] }> => {
    if (!guildId) {
        throw new ApiError("Discord Guild ID is not configured in the database.", 500);
    }
    const url = `https://discord.com/api/users/@me/guilds/${guildId}/member`;
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${providerToken}` }
    });
    if (!response.ok) {
        if (response.status === 404) throw new ApiError("User not found in Discord server.", 404);
        throw new ApiError(`Failed to fetch Discord member data: ${response.statusText}`, response.status);
    }
    const memberData = await response.json();

    // Fetch all guild roles to get color/name info
    // This part would ideally be cached in a real app
    const guildRolesResponse = await fetch(`https://discord.com/api/guilds/${guildId}/roles`, {
      headers: { 'Authorization': `Bearer ${providerToken}` }
    });
    const allGuildRoles = await guildRolesResponse.json() as { id: string; name: string; color: number }[];
    const rolesMap = new Map(allGuildRoles.map((r) => [r.id, { name: r.name, color: `#${r.color.toString(16).padStart(6, '0')}` }]));

    const discordRoles: DiscordRole[] = memberData.roles.map((roleId: string) => ({
        id: roleId,
        name: rolesMap.get(roleId)?.name || 'Unknown Role',
        color: rolesMap.get(roleId)?.color || '#99aab5',
    }));

    return { roles: memberData.roles, discordRoles };
};


export const fetchUserProfile = async (session: Session): Promise<User> => {
    if (!supabase) throw new ApiError("Supabase not configured", 500);

    const providerToken = session.provider_token;
    if (!providerToken) throw new ApiError("Discord provider token not found.", 401);

    const config = await getConfig();
    const { roles, discordRoles } = await fetchDiscordMember(providerToken, config.DISCORD_GUILD_ID);
    
    const superAdminRoles = config.SUPER_ADMIN_ROLE_IDS || [];
    const handlerRoles = config.HANDLER_ROLE_IDS || [];

    const isSuperAdmin = roles.some(roleId => superAdminRoles.includes(roleId));
    const isHandler = roles.some(roleId => handlerRoles.includes(roleId));
    const isAdmin = isSuperAdmin || isHandler;

    // Check for an existing profile and update it if needed
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_admin, is_super_admin')
        .eq('id', session.user.id)
        .single();
    
    if (profileError && profileError.code !== 'PGRST116') throw new ApiError(profileError.message, 500);

    // If profile exists and permissions mismatch, update them
    if (profile && (profile.is_super_admin !== isSuperAdmin || profile.is_admin !== isAdmin)) {
        await supabase
            .from('profiles')
            .update({ is_super_admin: isSuperAdmin, is_admin: isAdmin })
            .eq('id', session.user.id);
    }
    
    return {
      id: session.user.id,
      username: session.user.user_metadata.full_name,
      avatar: session.user.user_metadata.avatar_url,
      isAdmin: isAdmin,
      isSuperAdmin: isSuperAdmin,
      discordRoles: discordRoles,
      roles: roles,
    };
};

export const revalidateSession = async (): Promise<User> => {
    if (!supabase) throw new ApiError("Supabase not configured", 500);
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) throw new ApiError("No active session.", 401);
    return fetchUserProfile(session);
}


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