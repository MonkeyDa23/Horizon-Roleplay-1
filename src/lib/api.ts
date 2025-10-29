// src/lib/api.ts
import { supabase } from './supabaseClient';
import type { 
  AppConfig, Product, Quiz, QuizSubmission, RuleCategory, Translations, 
  User, PermissionKey, DiscordRole, UserLookupResult,
  MtaServerStatus, AuditLogEntry, MtaLogEntry, DiscordAnnouncement, RolePermission
} from '../types';

// Custom Error class for API responses
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Helper function to handle Supabase responses
const handleResponse = <T>(response: { data: T | null; error: any; status: number; statusText: string }): T => {
  if (response.error) {
    console.error('Supabase API Error:', response.error);
    throw new ApiError(response.error.message, response.status);
  }
  if (response.data === null) {
      // This case handles successful calls that return no data, e.g., a GET for a non-existent ID.
      // For rpc calls that return void, this is also the expected path.
      if (response.status >= 200 && response.status < 300) {
          return null as T;
      }
      throw new ApiError('No data returned from API', response.status);
  }
  return response.data;
};

// Helper function for invoking Supabase Edge Functions
const invokeFunction = async <T>(functionName: string, body?: object, headers?: { [key: string]: string }): Promise<T> => {
    if (!supabase) throw new ApiError("Supabase not configured", 500);

    const { data: { session } } = await supabase.auth.getSession();
    const defaultHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
        ...headers,
    };
    
    const { data, error } = await supabase.functions.invoke(functionName, {
        body: body ? JSON.stringify(body) : undefined,
        headers: defaultHeaders,
    });

    if (error) {
        console.error(`Supabase Function Error (${functionName}):`, error);
        // Attempt to extract status from context if available, otherwise default to 500
        const status = (error as any)?.context?.status ?? 500;
        throw new ApiError(error.message, status);
    }
    
    return data as T;
};

// =============================================
// AUTH & USER PROFILE API
// =============================================
export const fetchUserProfile = async (): Promise<{ user: User, syncError: string | null }> => {
  return invokeFunction<{ user: User, syncError: string | null }>('sync-user-profile');
};

export const forceRefreshUserProfile = async (): Promise<{ user: User, syncError: string | null }> => {
  return invokeFunction<{ user: User, syncError: string | null }>('sync-user-profile', { force: true });
};

export const revalidateSession = async (force: boolean = false): Promise<User> => {
  const body = force ? { force: true } : undefined;
  const { user } = await invokeFunction<{ user: User, syncError: string | null }>('sync-user-profile', body);
  return user;
};


// =============================================
// CONFIG API
// =============================================
export const getConfig = async (): Promise<AppConfig> => {
  if (!supabase) throw new Error("Supabase not configured");
  const response = await supabase.rpc('get_config');

  // Manually handle the response for this critical function to ensure a non-null return or a throw.
  if (response.error) {
    console.error('Supabase API Error in getConfig:', response.error);
    throw new ApiError(response.error.message, response.status);
  }

  if (response.data === null) {
    throw new ApiError("Configuration data not found in the database. Please ensure the database schema has been run correctly.", 404);
  }

  return response.data;
};

export const saveConfig = async (config: Partial<AppConfig>): Promise<void> => {
  if (!supabase) throw new Error("Supabase not configured");
  return handleResponse(await supabase.rpc('update_config', { new_config: config }));
};

// =============================================
// PRODUCTS API
// =============================================
export const getProducts = async (): Promise<Product[]> => {
  if (!supabase) throw new Error("Supabase not configured");
  return handleResponse(await supabase.from('products').select('*'));
};

export const saveProduct = async (productData: any): Promise<Product> => {
    if (!supabase) throw new Error("Supabase not configured");
    const response = await supabase.rpc('save_product_with_translations', { p_product_data: productData });
    return handleResponse(response);
};

export const deleteProduct = async (productId: string): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");
    // Logging is handled by a database trigger on delete
    return handleResponse(await supabase.from('products').delete().eq('id', productId));
};

// =============================================
// QUIZZES API
// =============================================
export const getQuizzes = async (): Promise<Quiz[]> => {
  if (!supabase) throw new Error("Supabase not configured");
  return handleResponse(await supabase.from('quizzes').select('*').order('created_at', { ascending: true }));
};

export const getQuizById = async (id: string): Promise<Quiz | null> => {
  if (!supabase) throw new Error("Supabase not configured");
  return handleResponse(await supabase.from('quizzes').select('*').eq('id', id).single());
};

export const saveQuiz = async (quizData: any): Promise<Quiz> => {
  if (!supabase) throw new Error("Supabase not configured");
  const response = await supabase.rpc('save_quiz_with_translations', { p_quiz_data: quizData });
  return handleResponse(response);
};

export const deleteQuiz = async (id: string): Promise<void> => {
  if (!supabase) throw new Error("Supabase not configured");
  // Logging is handled by a database trigger on delete
  return handleResponse(await supabase.from('quizzes').delete().eq('id', id));
};


// =============================================
// SUBMISSIONS API
// =============================================
export const getSubmissions = async (): Promise<QuizSubmission[]> => {
  if (!supabase) throw new Error("Supabase not configured");
  return handleResponse(await supabase.rpc('get_all_submissions'));
};

export const getSubmissionsByUserId = async (userId: string): Promise<QuizSubmission[]> => {
    if (!supabase) throw new Error("Supabase not configured");
    const response = await supabase.from('submissions').select('*').eq('user_id', userId).order('submittedAt', { ascending: false });
    return handleResponse(response);
};

export const addSubmission = async (submission: Omit<QuizSubmission, 'id' | 'status'>): Promise<QuizSubmission> => {
  if (!supabase) throw new Error("Supabase not configured");
  return handleResponse(await supabase.rpc('add_submission', { submission_data: submission }));
};

export const updateSubmissionStatus = async (submissionId: string, status: 'taken' | 'accepted' | 'refused'): Promise<void> => {
  if (!supabase) throw new Error("Supabase not configured");
  return handleResponse(await supabase.rpc('update_submission_status', { p_submission_id: submissionId, p_new_status: status }));
};

export const deleteSubmission = async (submissionId: string): Promise<void> => {
  if (!supabase) throw new Error("Supabase not configured");
  return handleResponse(await supabase.rpc('delete_submission', { p_submission_id: submissionId }));
};


// =============================================
// RULES API
// =============================================
export const getRules = async (): Promise<RuleCategory[]> => {
    if (!supabase) throw new Error("Supabase not configured");
    const response = await supabase.from('rules').select('*').order('position', { ascending: true });
    return handleResponse(response);
};

export const saveRules = async (rulesData: any[]): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");
    return handleResponse(await supabase.rpc('save_rules', { p_rules_data: rulesData }));
};

// =============================================
// TRANSLATIONS API
// =============================================
export const getTranslations = async (): Promise<Translations> => {
    if (!supabase) throw new Error("Supabase not configured");
    const data = await handleResponse<Array<{ key: string; ar: string; en: string }>>(await supabase.from('translations').select('key, ar, en'));
    const translations: Translations = {};
    for (const item of data) {
        translations[item.key] = { ar: item.ar, en: item.en };
    }
    return translations;
};

export const saveTranslations = async (translations: Translations): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");
    const dataToUpsert = Object.entries(translations).map(([key, value]) => ({ key, ...value }));
    return handleResponse(await supabase.from('translations').upsert(dataToUpsert, { onConflict: 'key' }));
};

// =============================================
// PERMISSIONS & ROLES API
// =============================================
export const getGuildRoles = async (): Promise<DiscordRole[]> => {
    try {
        const response = await invokeFunction<DiscordRole[] | { error: string }>('get-guild-roles');
        
        if (Array.isArray(response)) {
            return response;
        }
        
        if (response && typeof response === 'object' && 'error' in response && typeof (response as any).error === 'string') {
            throw new ApiError((response as {error: string}).error, 500);
        }
        
        // This will now catch more malformed responses
        throw new ApiError("Invalid or unexpected response format from get-guild-roles function.", 500);

    } catch (error) {
        // Re-throw ApiErrors, wrap others
        if (error instanceof ApiError) {
            throw error;
        }
        console.error("Caught unexpected error in getGuildRoles:", error);
        throw new ApiError((error as Error).message || 'An unknown error occurred while fetching roles.', 500);
    }
};

export const getRolePermissions = async (): Promise<RolePermission[]> => {
    if (!supabase) throw new Error("Supabase not configured");
    return handleResponse(await supabase.from('role_permissions').select('*'));
};

export const saveRolePermissions = async (rolePermission: RolePermission): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");
    return handleResponse(await supabase.rpc('save_role_permissions', { p_role_id: rolePermission.role_id, p_permissions: rolePermission.permissions }));
};


// =============================================
// ADMIN & AUDIT LOG API
// =============================================
export const getAuditLogs = async (): Promise<AuditLogEntry[]> => {
  if (!supabase) throw new Error("Supabase not configured");
  return handleResponse(await supabase.from('audit_log').select('*').order('timestamp', { ascending: false }).limit(100));
};

export const logAdminAccess = async (): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");
    return handleResponse(await supabase.rpc('log_action', { p_action: '🔑 دخل إلى لوحة التحكم', p_log_type: 'admin' }));
};

export const logAdminPageVisit = async (pageName: string): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");
    return handleResponse(await supabase.rpc('log_page_visit', { p_page_name: pageName }));
};

export const lookupUser = async (discordId: string): Promise<UserLookupResult> => {
  return invokeFunction<UserLookupResult>('troubleshoot-user-sync', { discordId });
};

export const banUser = async (targetUserId: string, reason: string, durationHours: number | null): Promise<void> => {
  if (!supabase) throw new Error("Supabase not configured");
  return handleResponse(await supabase.rpc('ban_user', { p_target_user_id: targetUserId, p_reason: reason, p_duration_hours: durationHours }));
};

export const unbanUser = async (targetUserId: string): Promise<void> => {
  if (!supabase) throw new Error("Supabase not configured");
  return handleResponse(await supabase.rpc('unban_user', { p_target_user_id: targetUserId }));
};


// =============================================
// EXTERNAL & MISC API
// =============================================
export const getMtaServerStatus = async (): Promise<MtaServerStatus> => {
  // This is a placeholder as it requires a specific MTA-to-JSON API endpoint
  // which is outside the scope of this project.
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        name: "Vixel Roleplay Server",
        players: Math.floor(Math.random() * 100),
        maxPlayers: 150,
        ping: Math.floor(Math.random() * 50) + 10,
        version: "1.6"
      });
    }, 1000);
  });
};

export const getDiscordAnnouncements = async (): Promise<DiscordAnnouncement[]> => {
  // This would require a bot endpoint to fetch messages from a specific channel.
  // Returning mock data for now.
  return Promise.resolve([]); 
};

export const getMtaPlayerLogs = async (userId: string): Promise<MtaLogEntry[]> => {
  // This is a placeholder for a feature that would require integration
  // with an MTA server's logging system.
  console.log("Fetching MTA logs for user:", userId);
  return Promise.resolve([]);
};

// =============================================
// HEALTH CHECK API
// =============================================
export const runPgNetTest = async (): Promise<string> => {
    if (!supabase) throw new Error("Supabase not configured");
    const { data, error } = await supabase.rpc('test_pg_net');
    if (error) throw error;
    return data;
};

export const checkFunctionSecrets = async (): Promise<any> => {
    return invokeFunction('check-function-secrets');
};

export const checkDiscordApiHealth = async (): Promise<any> => {
    return invokeFunction('check-bot-health');
};
export const troubleshootUserSync = async (discordId: string): Promise<any> => {
    return invokeFunction('troubleshoot-user-sync', { discordId });
};
