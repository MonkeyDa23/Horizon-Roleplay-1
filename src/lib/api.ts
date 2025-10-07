import { supabase } from './supabaseClient';
// FIX: Import MtaLogEntry type.
import type { Quiz, QuizSubmission, User, RuleCategory, Product, AuditLogEntry, MtaServerStatus, SubmissionStatus, AppConfig, MtaLogEntry, DiscordAnnouncement } from '../types';

// --- API Error Handling ---
// FIX: Add optional status property to ApiError to carry over HTTP status codes.
export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// --- Public Data Fetching ---

export const getConfig = async (): Promise<AppConfig> => {
    const { data, error } = await supabase.from('config').select('*').single();
    if (error) {
        console.error("Error fetching config, falling back to defaults.", error);
        // Return a default structure on error to prevent site crash
        return {
            COMMUNITY_NAME: 'Horizon',
            LOGO_URL: '',
            DISCORD_INVITE_URL: '',
            MTA_SERVER_URL: '',
        };
    }
    return data as AppConfig;
};

export const getMtaServerStatus = async (): Promise<MtaServerStatus> => {
  // This is a placeholder as we can't query MTA from the client.
  // This would need a serverless function proxy in a real scenario.
  const { data } = await supabase.from('config').select('COMMUNITY_NAME').single();
  return {
    name: `${data?.COMMUNITY_NAME || 'Horizon'} Roleplay`,
    players: Math.floor(Math.random() * 100),
    maxPlayers: 128,
  };
};

export const getProducts = async (): Promise<Product[]> => {
    const { data, error } = await supabase.from('products').select('*');
    if (error) throw new ApiError(error.message);
    return data.map(p => ({ ...p, nameKey: p.name_key, descriptionKey: p.description_key, imageUrl: p.image_url }));
};

export const getQuizzes = async (): Promise<Quiz[]> => {
    const { data, error } = await supabase.from('quizzes').select('*, questions:quiz_questions(*)');
    if (error) throw new ApiError(error.message);
    return data.map(q => ({ 
        ...q, 
        questions: q.questions || [],
        titleKey: q.title_key,
        descriptionKey: q.description_key,
        logoUrl: q.logo_url,
        bannerUrl: q.banner_url,
        isOpen: q.is_open,
        allowedTakeRoles: q.allowed_take_roles,
        lastOpenedAt: q.last_opened_at
    }));
};

export const getQuizById = async (id: string): Promise<Quiz> => {
    const { data, error } = await supabase.from('quizzes').select('*, questions:quiz_questions(*)').eq('id', id).single();
    if (error) throw new ApiError(error.message);
    return { 
        ...data, 
        questions: data.questions || [],
        titleKey: data.title_key,
        descriptionKey: data.description_key,
        logoUrl: data.logo_url,
        bannerUrl: data.banner_url,
        isOpen: data.is_open,
        allowedTakeRoles: data.allowed_take_roles,
        lastOpenedAt: data.last_opened_at
    };
};

export const getRules = async (): Promise<RuleCategory[]> => {
    const { data, error } = await supabase.from('rules').select('content').single();
    if (error || !data) return [];
    return (data.content as any) || [];
};


// --- User & Profile Specific ---

export const getProfileById = async (userId: string) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error && error.code !== 'PGRST116') { // Ignore "exact one row" error for non-existent profiles
        console.error("Error fetching profile", error);
    }
    return data;
};

// This function must be a serverless function due to requiring bot token. We'll mock it for now.
export const getDiscordRoles = async (userId: string): Promise<{id: string, name: string, color: number}[]> => {
    // In a real implementation, this would be an edge function call:
    // const { data, error } = await supabase.functions.invoke('get-discord-roles', { body: { userId } });
    console.warn("Using mock Discord roles. Create a 'get-discord-roles' edge function for production.");
    // Return a more detailed list for the profile page
    return [
        { id: '1', name: 'Server Booster', color: 0xf47fff },
        { id: '2', name: 'Police Department', color: 0x3498db },
        { id: '3', name: 'Emergency Medical Services', color: 0xe74c3c },
        { id: '4', name: 'Level 10+', color: 0x9b59b6 },
        { id: '5', name: 'Member', color: 0x99aab5 }
    ];
};

export const getDiscordAnnouncements = async (): Promise<DiscordAnnouncement[]> => {
    // This would be a serverless function. We'll mock it for now.
    console.warn("Using mock Discord announcements. Create a 'get-discord-announcements' edge function for production.");
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
    return [
        {
            id: '1',
            title: '🎉 Community Event: Summer Drift King!',
            content: 'Get your engines ready! This Saturday, we are hosting the annual Summer Drift King competition. Sign-ups are open now in the #events channel. Amazing prizes to be won, including exclusive custom vehicles!',
            author: {
                name: 'AdminUser',
                avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png'
            },
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
            url: '#'
        },
        {
            id: '2',
            title: '🔧 Server Maintenance & Update v2.5',
            content: 'Please be advised that the server will be down for scheduled maintenance tonight at 2 AM for approximately one hour. We will be deploying update v2.5 which includes new police vehicles, bug fixes, and performance improvements.',
            author: {
                name: 'AdminUser',
                avatarUrl: 'https://cdn.discordapp.com/embed/avatars/1.png'
            },
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), // 3 days ago
            url: '#'
        }
    ];
};

export const addSubmission = async (submission: Partial<QuizSubmission>): Promise<QuizSubmission> => {
    const { data, error } = await supabase.rpc('submit_application', {
        p_quiz_id: submission.quizId,
        p_quiz_title: submission.quizTitle,
        p_user_id: submission.userId,
        p_username: submission.username,
        p_cheat_attempts: submission.cheatAttempts,
        p_answers: submission.answers
    });

    if (error) throw new ApiError(error.message);
    return data;
};

export const getSubmissionsByUserId = async (userId: string): Promise<QuizSubmission[]> => {
    const { data, error } = await supabase.from('submissions').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw new ApiError(error.message);
    return data.map(s => ({...s, quizTitle: s.quiz_title, userId: s.user_id, submittedAt: s.created_at, updatedAt: s.updated_at}));
};

// FIX: Implement revalidateSession to get fresh user data and permissions.
export const revalidateSession = async (currentUser: User): Promise<User> => {
    const { data: { user: supabaseUser }, error } = await (supabase.auth as any).getUser();

    if (error || !supabaseUser) {
        throw new ApiError(error?.message || 'User not found', (error as any)?.status);
    }
    
    const profile = await getProfileById(supabaseUser.id);
    if (!profile) {
        throw new ApiError('User profile not found.', 404);
    }

    const { data: configData } = await supabase.from('config').select('SUPER_ADMIN_ROLE_IDS').single();
    const superAdminRoles = configData?.SUPER_ADMIN_ROLE_IDS || [];
    
    const discordRolesApi = await getDiscordRoles(supabaseUser.id);
    const discordRoles = discordRolesApi.map(r => ({
        id: r.id,
        name: r.name,
        color: `#${r.color.toString(16).padStart(6, '0')}`
    }));


    const primaryRole = discordRoles.length > 0 ? discordRoles[0] : undefined;

    return {
      id: supabaseUser.id,
      username: supabaseUser.user_metadata.full_name,
      avatar: supabaseUser.user_metadata.avatar_url,
      isAdmin: profile.is_admin,
      isSuperAdmin: profile.is_super_admin || discordRoles.some(r => superAdminRoles.includes(r.id)),
      roles: discordRoles.map(r => r.id),
      primaryRole: primaryRole,
      discordRoles: discordRoles,
    };
};


// --- Admin Functions (Requires RLS policies on Supabase) ---

// FIX: Add missing logAdminAccess function required by pages/AdminPage.tsx.
export const logAdminAccess = async (user: User): Promise<void> => {
    const { error } = await supabase.from('audit_logs').insert({
        admin_id: user.id,
        admin_username: user.username,
        action: 'Accessed Admin Panel'
    });

    if (error) {
        console.error("Failed to log admin access:", error.message);
    }
};

export const getSubmissions = async (): Promise<QuizSubmission[]> => {
    const { data, error } = await supabase.from('submissions_with_answers').select('*').order('created_at', { ascending: false });
    if (error) throw new ApiError(error.message);
    return data.map(s => ({
        ...s,
        quizTitle: s.quiz_title,
        userId: s.user_id,
        submittedAt: s.created_at,
        updatedAt: s.updated_at,
        adminId: s.admin_id,
        adminUsername: s.admin_username,
        cheatAttempts: s.cheat_attempts as any,
    }));
};

export const updateSubmissionStatus = async (submissionId: string, status: SubmissionStatus): Promise<QuizSubmission> => {
    const { data, error } = await supabase.rpc('update_submission_status', { p_submission_id: submissionId, p_status: status });
    if (error) throw new ApiError(error.message);
    return data;
};

export const saveQuiz = async (quiz: Quiz): Promise<Quiz> => {
    const { error } = await supabase.rpc('save_quiz_with_questions', {
      p_quiz_id: quiz.id || undefined,
      p_title_key: quiz.titleKey,
      p_description_key: quiz.descriptionKey,
      p_is_open: quiz.isOpen,
      p_logo_url: quiz.logoUrl,
      p_banner_url: quiz.bannerUrl,
      p_allowed_take_roles: quiz.allowedTakeRoles,
      p_questions: quiz.questions
    });
    if (error) throw new ApiError(error.message);
    return quiz;
};

export const deleteQuiz = async (quizId: string): Promise<void> => {
    const { error } = await supabase.from('quizzes').delete().eq('id', quizId);
    if (error) throw new ApiError(error.message);
};

export const getAuditLogs = async (): Promise<AuditLogEntry[]> => {
    const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) throw new ApiError(error.message);
    return data.map(l => ({ ...l, adminId: l.admin_id, adminUsername: l.admin_username, timestamp: l.created_at, ipAddress: l.ip_address }));
};

export const saveConfig = async (config: Partial<AppConfig>): Promise<void> => {
    const { error } = await supabase.from('config').update(config).eq('id', 1);
    if (error) throw new ApiError(error.message);
};

export const saveRules = async (rules: RuleCategory[]): Promise<void> => {
    const { error } = await supabase.from('rules').upsert({ id: 1, content: rules });
    if (error) throw new ApiError(error.message);
};

export const saveProduct = async (product: Product): Promise<Product> => {
    const { id, nameKey, descriptionKey, price, imageUrl } = product;
    const productData = { name_key: nameKey, description_key: descriptionKey, price, image_url: imageUrl };
    const { data, error } = await supabase.from('products').upsert({ id, ...productData }).select().single();
    if (error) throw new ApiError(error.message);
    return { ...(data as any), nameKey: data.name_key, descriptionKey: data.description_key, imageUrl: data.image_url };
};

export const deleteProduct = async (productId: string): Promise<void> => {
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) throw new ApiError(error.message);
};

// FIX: Add getMtaPlayerLogs function for the new MtaLogsPanel component.
export const getMtaPlayerLogs = async (userId: string): Promise<MtaLogEntry[]> => {
    // This would be a call to a serverless function or a direct query if logs are in Supabase.
    // For now, we'll return mock data.
    console.warn(`Using mock MTA logs for user ${userId}. Create a 'get-mta-logs' edge function for production.`);
    // A little delay to simulate network
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Return empty array if some specific user id is passed to simulate not found.
    if (userId === 'not_found') return [];

    return [
        { timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), text: 'Player connected.' },
        { timestamp: new Date(Date.now() - 1000 * 60 * 4).toISOString(), text: 'Player spawned.' },
        { timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(), text: 'Player was killed by another player.' },
        { timestamp: new Date(Date.now() - 1000 * 60 * 1).toISOString(), text: 'Player disconnected.' },
    ];
};