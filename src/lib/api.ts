import { supabase } from './supabaseClient';
import type { Quiz, QuizSubmission, User, RuleCategory, Product, AuditLogEntry, MtaServerStatus, SubmissionStatus, AppConfig } from '../types';

// --- API Error Handling ---
// FIX: Export the ApiError class so it can be used in other files.
export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
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
    // For now, return a mock response.
    console.warn("Using mock Discord roles. Create a 'get-discord-roles' edge function for production.");
    return [
        { id: '1', name: 'Server Booster', color: 0xf47fff },
        { id: '2', name: 'Member', color: 0xffffff }
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
    return data.map(s => ({...s, quizTitle: s.quiz_title, userId: s.user_id, submittedAt: s.created_at}));
};


// --- Admin Functions (Requires RLS policies on Supabase) ---

export const getSubmissions = async (): Promise<QuizSubmission[]> => {
    const { data, error } = await supabase.from('submissions_with_answers').select('*').order('created_at', { ascending: false });
    if (error) throw new ApiError(error.message);
    return data.map(s => ({
        ...s,
        quizTitle: s.quiz_title,
        userId: s.user_id,
        submittedAt: s.created_at,
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

// FIX: Add missing saveRules function
export const saveRules = async (rules: RuleCategory[]): Promise<void> => {
    const { error } = await supabase.from('rules').upsert({ id: 1, content: rules });
    if (error) throw new ApiError(error.message);
};

// FIX: Add missing saveProduct function
export const saveProduct = async (product: Product): Promise<Product> => {
    const { id, nameKey, descriptionKey, price, imageUrl } = product;
    const productData = { name_key: nameKey, description_key: descriptionKey, price, image_url: imageUrl };
    const { data, error } = await supabase.from('products').upsert({ id, ...productData }).select().single();
    if (error) throw new ApiError(error.message);
    return { ...(data as any), nameKey: data.name_key, descriptionKey: data.description_key, imageUrl: data.image_url };
};

// FIX: Add missing deleteProduct function
export const deleteProduct = async (productId: string): Promise<void> => {
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) throw new ApiError(error.message);
};

// FIX: Add missing revalidateSession function (mocked)
export const revalidateSession = async (user: User): Promise<User> => {
    // This would invoke a Supabase Edge Function that securely uses the Discord Bot Token
    // to get fresh role data from Discord.
    // For now, we'll return the user as is, assuming no changes, to fix compilation.
    console.warn("Using mock revalidateSession. Create an edge function for production.");
    return user;
};

// FIX: Add missing logAdminAccess function (mocked)
export const logAdminAccess = async (user: User): Promise<void> => {
    // In a real app this would be an RPC call or handled by the server on protected routes.
    // For now, we will mock it since it's from the old admin page.
    console.log(`Admin access by ${user.username} logged.`);
    return Promise.resolve();
};
