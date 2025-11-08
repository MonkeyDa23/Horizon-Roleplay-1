// src/lib/api.ts
import { supabase } from './supabaseClient';
// FIX: Corrected import path to point to the types file within the src directory.
import type { 
  AppConfig, Product, Quiz, QuizSubmission, RuleCategory, Translations, 
  User, DiscordRole, UserLookupResult,
  MtaServerStatus, AuditLogEntry, MtaLogEntry, DiscordAnnouncement, RolePermission, DiscordWidget
} from './types';

// Custom Error class for API responses
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Helper for Supabase function invocations
const invokeFunction = async <T>(functionName: string, body?: object): Promise<T> => {
    if (!supabase) throw new Error("Supabase client is not initialized.");

    const { data, error } = await supabase.functions.invoke(functionName, { body });

    if (error) {
        // Attempt to parse a more specific error message from the response
        const errorMessage = error.context?.msg || error.message || 'An unknown function error occurred.';
        const errorStatus = error.context?.status || 500;
        console.error(`Error invoking function '${functionName}':`, error);
        throw new ApiError(errorMessage, errorStatus);
    }
    return data as T;
};


// Helper function to handle Supabase RPC/table responses
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


// =============================================
// AUTH & USER PROFILE API
// =============================================
export const fetchUserProfile = async (): Promise<{ user: User, syncError: string | null }> => {
  // The 'sync-user-profile' function is now the single source of truth for a user's complete profile.
  // It fetches Discord data and combines it with permissions/ban status from the DB.
  return invokeFunction<{ user: User, syncError: string | null }>('sync-user-profile');
};

export const forceRefreshUserProfile = async (): Promise<{ user: User, syncError: string | null }> => {
  // A force refresh simply calls the same sync function again. Caching is handled by the user's browser/session.
  return invokeFunction<{ user: User, syncError: string | null }>('sync-user-profile');
};

export const revalidateSession = async (): Promise<User> => {
  const { user } = await fetchUserProfile();
  return user;
};


export const verifyAdminPassword = async (password: string): Promise<boolean> => {
    if (!supabase) return false;
    const { data } = await supabase.rpc('verify_admin_password', { p_password: password });
    return !!data;
};


// =============================================
// CONFIG API (Remains Supabase)
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
  await handleResponse(await supabase.rpc('update_config', { new_config: config }));
};

// =============================================
// PRODUCTS, QUIZZES, SUBMISSIONS, RULES (Remain Supabase)
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
    return handleResponse<Product>(response);
};

export const deleteProduct = async (productId: string): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");
    await handleResponse(await supabase.rpc('delete_product', { p_product_id: productId }));
};

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
  return handleResponse<Quiz>(response);
};

export const deleteQuiz = async (id: string): Promise<void> => {
  if (!supabase) throw new Error("Supabase not configured");
  await handleResponse(await supabase.rpc('delete_quiz', { p_quiz_id: id }));
};

export const getSubmissions = async (): Promise<QuizSubmission[]> => {
  if (!supabase) throw new Error("Supabase not configured");
  return handleResponse(await supabase.rpc('get_all_submissions'));
};

export const getSubmissionsByUserId = async (userId: string): Promise<QuizSubmission[]> => {
    if (!supabase) throw new Error("Supabase not configured");
    const response = await supabase.from('submissions').select('*').eq('user_id', userId).order('submittedAt', { ascending: false });
    return handleResponse(response);
};

export const addSubmission = async (submission: any): Promise<QuizSubmission> => {
  if (!supabase) throw new Error("Supabase not configured");
  
  // This function now just adds the submission. The database trigger `on_audit_log_insert`
  // will automatically handle sending the Discord notification after `log_action` is called inside the RPC.
  const newSubmission = await handleResponse<QuizSubmission>(await supabase.rpc('add_submission', { submission_data: submission }));
  if (!newSubmission) {
    throw new Error("Failed to get new submission record from database.");
  }
  
  // Also send a DM receipt to the user. This is a user-facing action, not an audit log.
  invokeFunction('discord-proxy', { type: 'submission_receipt', payload: { submission: newSubmission } }).catch(err => console.warn("Failed to send 'submission_receipt' notification:", err));

  return newSubmission;
};

export const updateSubmissionStatus = async (submissionId: string, status: 'taken' | 'accepted' | 'refused', reason?: string): Promise<void> => {
  if (!supabase) throw new Error("Supabase not configured");
  
  // This RPC call now logs the action, which triggers the audit log notification automatically.
  const rpcResponse = await supabase.rpc('update_submission_status', { p_submission_id: submissionId, p_new_status: status, p_reason: reason || null });
  const updatedSubmission = handleResponse<QuizSubmission>(rpcResponse);
  
  if (!updatedSubmission) {
      throw new Error("Failed to get updated submission record from database.");
  }

  // If accepted or refused, send a direct message to the user.
  if (status === 'accepted' || status === 'refused') {
    try {
      await invokeFunction('discord-proxy', { type: 'submission_result', payload: { submission: updatedSubmission } });
    } catch (notificationError) {
      console.warn("Submission status updated, but sending result DM failed:", notificationError);
      // We throw the error so the UI can show the warning modal.
      throw notificationError;
    }
  }
};

export const deleteSubmission = async (submissionId: string): Promise<void> => {
  if (!supabase) throw new Error("Supabase not configured");
  await handleResponse(await supabase.rpc('delete_submission', { p_submission_id: submissionId }));
};

export const getRules = async (): Promise<RuleCategory[]> => {
    if (!supabase) throw new Error("Supabase not configured");
    const response = await supabase.from('rules').select('*').order('position', { ascending: true });
    return handleResponse(response);
};

export const saveRules = async (rulesData: any[]): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");
    await handleResponse(await supabase.rpc('save_rules', { p_rules_data: rulesData }));
};

export const getDiscordWidgets = async (): Promise<DiscordWidget[]> => {
    if (!supabase) throw new Error("Supabase not configured");
    const response = await supabase.from('discord_widgets').select('*').order('position', { ascending: true });
    return handleResponse(response);
};

export const saveDiscordWidgets = async (widgets: Omit<DiscordWidget, 'id'>[]): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");
    await handleResponse(await supabase.rpc('save_discord_widgets', { p_widgets_data: widgets }));
};

export const getTranslations = async (): Promise<Translations> => {
    if (!supabase) throw new Error("Supabase not configured");
    const data = await handleResponse<({ key: string; ar: string; en: string })[]>(await supabase.from('translations').select('key, ar, en'));
    const translations: Translations = {};
    for (const item of data) {
        translations[item.key] = { ar: item.ar, en: item.en };
    }
    return translations;
};

export const saveTranslations = async (translations: Translations): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");
    const dataToUpsert = Object.entries(translations).map(([key, value]) => ({ key, ...value }));
    await handleResponse(await supabase.from('translations').upsert(dataToUpsert, { onConflict: 'key' }));
};

// =============================================
// PERMISSIONS & ROLES (Now via Edge Function)
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
    await handleResponse(await supabase.rpc('save_role_permissions', { p_role_id: rolePermission.role_id, p_permissions: rolePermission.permissions }));
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
    await handleResponse(await supabase.rpc('log_page_visit', { p_page_name: pageName }));
};

export const lookupUser = async (discordId: string): Promise<UserLookupResult> => {
  return invokeFunction<UserLookupResult>('troubleshoot-user-sync', { discordId });
};

export const banUser = async (targetUserId: string, reason: string, durationHours: number | null): Promise<void> => {
  if (!supabase) throw new Error("Supabase not configured");
  await handleResponse(await supabase.rpc('ban_user', { p_target_user_id: targetUserId, p_reason: reason, p_duration_hours: durationHours }));
};

export const unbanUser = async (targetUserId: string): Promise<void> => {
  if (!supabase) throw new Error("Supabase not configured");
  await handleResponse(await supabase.rpc('unban_user', { p_target_user_id: targetUserId }));
};

export const testNotification = async (type: string, targetId: string): Promise<any> => {
    return invokeFunction('discord-proxy', { type: `test_${type}`, payload: { targetId } });
};

// =============================================
// EXTERNAL & MISC API (MTA can remain as is)
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

// =============================================
// HEALTH CHECK API
// =============================================
export const testHttpRequest = async (): Promise<any> => {
    if (!supabase) throw new Error("Supabase not configured");
    return handleResponse(await supabase.rpc('test_http_request'));
};

export const checkDiscordApiHealth = async (): Promise<any> => {
    return invokeFunction('check-bot-health');
};

export const troubleshootUserSync = async (discordId: string): Promise<any> => {
    return invokeFunction('troubleshoot-user-sync', { discordId });
};
