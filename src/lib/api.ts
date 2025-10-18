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

export const fetchUserProfile = async (force = false): Promise<{ user: User, syncError: string | null }> => {
    if (!supabase) throw new ApiError("Supabase not configured", 500);

    // The new `sync-user-profile` edge function handles all caching and syncing logic
    // to prevent Discord API rate limiting. It gets the user from the session's JWT.
    const { data, error } = await supabase.functions.invoke('sync-user-profile', {
        body: { force }
    });

    if (error) {
        // The function will throw specific errors we can catch.
        if (error.message.includes("User not found in Discord guild")) {
            // This specific error tells the AuthContext to log the user out.
            throw new ApiError(error.message, 404);
        }
        // For other errors, we throw a generic one.
        throw new ApiError(`Failed to sync user profile: ${error.message}`, 500);
    }
    
    // The function returns the exact structure we need, but permissions need to be
    // converted from an array back into a Set.
    if (data.user && data.user.permissions) {
        data.user.permissions = new Set(data.user.permissions);
    }

    return data as { user: User, syncError: string | null };
};

export const forceRefreshUserProfile = async (): Promise<{ user: User, syncError: string | null }> => {
    return fetchUserProfile(true);
};

export const revalidateSession = async (): Promise<User> => {
    if (!supabase) throw new ApiError("Supabase not configured", 500);
    
    // Refreshing the session gets a new JWT, which is important.
    const { error } = await supabase.auth.refreshSession();
    
    if (error) throw new ApiError("No active session.", 401);
    
    // After refreshing, fetch the profile, which will trigger a sync if needed.
    const { user } = await fetchUserProfile();
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