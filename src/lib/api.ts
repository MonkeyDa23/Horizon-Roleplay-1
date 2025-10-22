import { supabase } from './supabaseClient';
import type { User, Product, Quiz, QuizSubmission, SubmissionStatus, MtaServerStatus, AuditLogEntry, RuleCategory, AppConfig, MtaLogEntry, UserLookupResult, DiscordAnnouncement, DiscordRole, PermissionKey, RolePermission, Translations } from '../types';

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
    const { data, error } = await supabase.from('rule_categories').select(`*, rules (*)`).order('order').order('order', { foreignTable: 'rules' });
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
    const { error } = await supabase.rpc('save_rules', { p_rules_data: rulesData });
    if (error) throw new ApiError(error.message, 500);
}

export const saveProduct = async (product: Partial<Product>): Promise<Product> => {
    if (!supabase) throw new ApiError("Database not configured", 500);
    const { data, error } = await supabase.rpc('save_product', { p_product: product });
    if (error) throw new ApiError(error.message, 500);
    return data[0];
};

export const deleteProduct = async (productId: string): Promise<void> => {
    if (!supabase) throw new ApiError("Database not configured", 500);
    const { error } = await supabase.rpc('delete_product', { p_product_id: productId });
    if (error) throw new ApiError(error.message, 500);
};

export const saveConfig = async (config: Partial<AppConfig>): Promise<void> => {
    if (!supabase) throw new ApiError("Database not configured", 500);
    const { error } = await supabase.from('config').update(config).eq('id', 1);
    if (error) throw new ApiError(error.message, 500);
    await supabase.rpc('log_audit_action', {
        p_title: '⚙️ Site Settings Updated',
        p_description: 'The global website configuration has been changed.'
    });
}

export const saveTranslations = async (translations: Translations): Promise<void> => {
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

export const getGuildRoles = async (): Promise<DiscordRole[]> => {
    if (!supabase) throw new ApiError("Database not configured", 500);
    const { data, error } = await supabase.functions.invoke('get-guild-roles');
    if (error) throw new ApiError(error.message, 500);
    if (data.error) throw new ApiError(data.error, 500);
    return data.roles;
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

export const getSubmissionsByDiscordId = async (discordId: string): Promise<QuizSubmission[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.rpc('get_submissions_by_discord_id', { p_discord_id: discordId });
    if (error) throw new ApiError(error.message, 500);
    return data || [];
};

export const lookupUser = async (discordId: string): Promise<UserLookupResult> => {
    const profileData = await troubleshootUserSync(discordId);
    if (profileData.error) {
        throw new ApiError(profileData.error, 404);
    }
    const submissions = await getSubmissionsByDiscordId(discordId);
    return {
        id: profileData.id,
        username: profileData.username,
        avatar: profileData.avatar,
        joinedAt: profileData.joinedAt,
        roles: profileData.roles,
        submissions: submissions
    };
};

// --- AUTH & SESSION MANAGEMENT ---

export const fetchUserProfile = async (force = false): Promise<{ user: User, syncError: string | null }> => {
    if (!supabase) throw new ApiError("Supabase not configured", 500);

    const { data, error } = await supabase.functions.invoke('sync-user-profile', {
        body: { force }
    });

    if (error) {
        if (error.message.includes("User not found in Discord guild")) {
            throw new ApiError(error.message, 404);
        }
        throw new ApiError(`Failed to sync user profile: ${error.message}`, 500);
    }
    
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
    
    const { error } = await supabase.auth.refreshSession();
    
    if (error) throw new ApiError("No active session.", 401);
    
    const { user } = await fetchUserProfile();
    return user;
}


// --- HEALTHCHECK & DIAGNOSTICS ---

export const checkDiscordApiHealth = async (): Promise<any> => {
    if (!supabase) throw new ApiError("Database not configured", 500);
    const { data, error } = await supabase.functions.invoke('check-bot-health');
    if (error) {
        throw new ApiError(error.message, 500);
    }
    return data;
}

export const troubleshootUserSync = async (discordId: string): Promise<any> => {
    if (!supabase) throw new ApiError("Database not configured", 500);
    const { data, error } = await supabase.functions.invoke('troubleshoot-user-sync', {
        body: { discordId }
    });
     if (error) {
        return { error: 'Failed to invoke Supabase function.', details: error.message };
    }
    return data;
};


// --- MOCKED/FALLBACK FUNCTIONS ---
export const getDiscordAnnouncements = async (): Promise<DiscordAnnouncement[]> => {
    console.warn('getDiscordAnnouncements is mocked and returns an empty array.');
    return [];
};

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