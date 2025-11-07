// src/lib/api.ts
import { supabase } from './supabaseClient';
import type { 
  AppConfig, Product, Quiz, QuizSubmission, RuleCategory, Translations, 
  User, PermissionKey, DiscordRole, UserLookupResult,
  MtaServerStatus, AuditLogEntry, MtaLogEntry, DiscordAnnouncement, RolePermission, DiscordWidget
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
        
        let errorMessage = error.message;
        const status = (error as any)?.context?.status ?? 500;

        try {
            const functionErrorBody = (error as any).context;
            if (functionErrorBody && typeof functionErrorBody === 'object') {
                if ('error' in functionErrorBody && typeof functionErrorBody.error === 'string') {
                    errorMessage = functionErrorBody.error;
                    if ('details' in functionErrorBody && typeof functionErrorBody.details === 'string') {
                        errorMessage += ` (Details: ${functionErrorBody.details})`;
                    }
                }
            } else if (typeof functionErrorBody === 'string' && functionErrorBody.trim() !== '') {
                errorMessage = functionErrorBody;
            }
        } catch (e) { console.warn("Could not parse detailed error from function context.", e); }

        throw new ApiError(errorMessage, status);
    }
    
    return data as T;
};

// NEW: Central notification function
const sendNotification = (type: string, payload: object) => {
    if (!supabase) return;
    supabase.functions.invoke('send-notification', { body: { type, payload } })
        .catch(err => console.error(`Failed to send notification of type '${type}':`, err));
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

// NEW: For admin password gate
export const verifyAdminPassword = async (password: string): Promise<boolean> => {
    if (!supabase) return false;
    const { data } = await supabase.rpc('verify_admin_password', { p_password: password });
    return !!data;
};


// =============================================
// CONFIG API
// =============================================
export const getConfig = async (): Promise<AppConfig> => {
  if (!supabase) throw new Error("Supabase not configured");
  const response = await supabase.rpc('get_config');

  if (response.error) {
    console.error('Supabase API Error in getConfig:', response.error);
    throw new ApiError(response.error.message, response.status);
  }

  if (response.data === null) {
    throw new ApiError("Configuration data not found. Please ensure the database schema has been run correctly.", 404);
  }

  return response.data;
};

export const saveConfig = async (config: Partial<AppConfig>): Promise<void> => {
  if (!supabase) throw new Error("Supabase not configured");
  // FIX: Awaited handleResponse without assigning to a variable for a void function.
  await handleResponse(await supabase.rpc('update_config', { new_config: config }));
  sendNotification('log_action', { log_type: 'admin', action: 'Updated system configuration.' });
};

// =============================================
// PRODUCTS API
// =============================================
export const getProducts = async (): Promise<Product[]> => {
  if (!supabase) throw new Error("Supabase not configured");
  return handleResponse(await supabase.from('products').select('*'));
};

export const getProductById = async (id: string): Promise<Product | null> => {
  if (!supabase) throw new Error("Supabase not configured");
  return handleResponse(await supabase.from('products').select('*').eq('id', id).single());
};

export const saveProduct = async (productData: any): Promise<Product> => {
    if (!supabase) throw new Error("Supabase not configured");
    const response = await supabase.rpc('save_product_with_translations', { p_product_data: productData });
    // FIX: Specified the expected return type for handleResponse.
    const result = handleResponse<Product>(response);
    sendNotification('log_action', { log_type: 'admin', action: `Saved product: ${productData.nameEn}` });
    return result;
};

export const deleteProduct = async (productId: string): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");
    // FIX: Awaited handleResponse without assigning to a variable for a void function.
    await handleResponse(await supabase.rpc('delete_product', { p_product_id: productId }));
    sendNotification('log_action', { log_type: 'admin', action: `Deleted product ID: ${productId}` });
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
  // FIX: Specified the expected return type for handleResponse.
  const result = handleResponse<Quiz>(response);
  sendNotification('log_action', { log_type: 'admin', action: `Saved quiz: ${quizData.titleEn}` });
  return result;
};

export const deleteQuiz = async (id: string): Promise<void> => {
  if (!supabase) throw new Error("Supabase not configured");
  // FIX: Awaited handleResponse without assigning to a variable for a void function.
  await handleResponse(await supabase.rpc('delete_quiz', { p_quiz_id: id }));
  sendNotification('log_action', { log_type: 'admin', action: `Deleted quiz ID: ${id}` });
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
  // FIX: Specified the expected return type for handleResponse.
  const newSubmission = await handleResponse<QuizSubmission>(await supabase.rpc('add_submission', { submission_data: submission }));
  
  // Send notifications after successful DB insert
  sendNotification('new_submission', { submission: newSubmission });
  sendNotification('submission_receipt', { submission: newSubmission });

  return newSubmission;
};

export const updateSubmissionStatus = async (submissionId: string, status: 'taken' | 'accepted' | 'refused', reason?: string): Promise<void> => {
  if (!supabase) throw new Error("Supabase not configured");
  
  const params = { p_submission_id: submissionId, p_new_status: status, p_reason: reason || null };
  // FIX: Awaited handleResponse without assigning to a variable for a void function.
  await handleResponse(await supabase.rpc('update_submission_status', params));

  // Send notifications after successful DB update
  sendNotification('log_action', { log_type: 'submissions', action: `Updated submission ${submissionId} to ${status}.` });
  if (status === 'accepted' || status === 'refused') {
      sendNotification('submission_result', { submissionId, status, reason });
  }
};

export const deleteSubmission = async (submissionId: string): Promise<void> => {
  if (!supabase) throw new Error("Supabase not configured");
  // FIX: Awaited handleResponse without assigning to a variable for a void function.
  await handleResponse(await supabase.rpc('delete_submission', { p_submission_id: submissionId }));
  sendNotification('log_action', { log_type: 'submissions', action: `Deleted submission ${submissionId}.` });
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
    // FIX: Awaited handleResponse without assigning to a variable for a void function.
    await handleResponse(await supabase.rpc('save_rules', { p_rules_data: rulesData }));
    sendNotification('log_action', { log_type: 'admin', action: 'Updated server rules.' });
};

// =============================================
// DISCORD WIDGETS API
// =============================================
export const getDiscordWidgets = async (): Promise<DiscordWidget[]> => {
    if (!supabase) throw new Error("Supabase not configured");
    const response = await supabase.from('discord_widgets').select('*').order('position', { ascending: true });
    return handleResponse(response);
};

export const saveDiscordWidgets = async (widgets: Omit<DiscordWidget, 'id'>[]): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");
    // FIX: Awaited handleResponse without assigning to a variable for a void function.
    await handleResponse(await supabase.rpc('save_discord_widgets', { p_widgets_data: widgets }));
    sendNotification('log_action', { log_type: 'admin', action: 'Updated Discord widgets.' });
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
    // FIX: Awaited handleResponse without assigning to a variable for a void function.
    await handleResponse(await supabase.from('translations').upsert(dataToUpsert, { onConflict: 'key' }));
    sendNotification('log_action', { log_type: 'admin', action: 'Updated website translations.' });
};

// =============================================
// PERMISSIONS & ROLES API
// =============================================
export const getGuildRoles = async (): Promise<DiscordRole[]> => {
    return invokeFunction<DiscordRole[]>('get-guild-roles');
};

export const getRolePermissions = async (): Promise<RolePermission[]> => {
    if (!supabase) throw new Error("Supabase not configured");
    return handleResponse(await supabase.from('role_permissions').select('*'));
};

export const saveRolePermissions = async (rolePermission: RolePermission): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");
    // FIX: Awaited handleResponse without assigning to a variable for a void function.
    await handleResponse(await supabase.rpc('save_role_permissions', { p_role_id: rolePermission.role_id, p_permissions: rolePermission.permissions }));
    sendNotification('log_action', { log_type: 'admin', action: `Updated permissions for role ${rolePermission.role_id}.` });
};


// =============================================
// ADMIN & AUDIT LOG API
// =============================================
export const getAuditLogs = async (): Promise<AuditLogEntry[]> => {
  if (!supabase) throw new Error("Supabase not configured");
  return handleResponse(await supabase.from('audit_log').select('*').order('timestamp', { ascending: false }).limit(100));
};

export const logAdminPageVisit = async (pageName: string): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");
    // FIX: Awaited handleResponse without assigning to a variable for a void function.
    await handleResponse(await supabase.rpc('log_page_visit', { p_page_name: pageName }));
};

export const lookupUser = async (discordId: string): Promise<UserLookupResult> => {
  return invokeFunction<UserLookupResult>('troubleshoot-user-sync', { discordId });
};

export const banUser = async (targetUserId: string, reason: string, durationHours: number | null): Promise<void> => {
  if (!supabase) throw new Error("Supabase not configured");
  // FIX: Awaited handleResponse without assigning to a variable for a void function.
  await handleResponse(await supabase.rpc('ban_user', { p_target_user_id: targetUserId, p_reason: reason, p_duration_hours: durationHours }));
  sendNotification('log_action', { log_type: 'bans', action: `Banned user ${targetUserId}. Reason: ${reason}` });
};

export const unbanUser = async (targetUserId: string): Promise<void> => {
  if (!supabase) throw new Error("Supabase not configured");
  // FIX: Awaited handleResponse without assigning to a variable for a void function.
  await handleResponse(await supabase.rpc('unban_user', { p_target_user_id: targetUserId }));
  sendNotification('log_action', { log_type: 'bans', action: `Unbanned user ${targetUserId}.` });
};

export const testNotification = async (type: string, targetId: string): Promise<any> => {
    return invokeFunction('send-notification', { type: `test_${type}`, payload: { targetId } });
};


// =============================================
// EXTERNAL & MISC API
// =============================================
export const getMtaServerStatus = async (): Promise<MtaServerStatus> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ name: "Vixel Roleplay Server", players: Math.floor(Math.random() * 100), maxPlayers: 150, version: "1.6" });
    }, 1000);
  });
};

export const getDiscordAnnouncements = async (): Promise<DiscordAnnouncement[]> => {
  return Promise.resolve([]); 
};

export const getMtaPlayerLogs = async (userId: string): Promise<MtaLogEntry[]> => {
  console.log("Fetching MTA logs for user:", userId);
  return Promise.resolve([]);
};

// =============================================
// HEALTH CHECK API
// =============================================
export const testHttpRequest = async (): Promise<any> => {
    if (!supabase) throw new Error("Supabase not configured");
    return handleResponse(await supabase.rpc('test_http_request'));
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