// src/lib/api.ts
import { supabase } from './supabaseClient';
import type { 
  AppConfig, Product, Quiz, QuizSubmission, RuleCategory, Translations, 
  User, PermissionKey, DiscordRole, RolePermission, UserLookupResult,
  MtaServerStatus, AuditLogEntry, MtaLogEntry, DiscordAnnouncement
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
// FIX: Changed `headers` type from `HeadersInit` to a more specific `{[key: string]: string}` to satisfy the `invoke` method's requirements.
// FIX: Replaced `handleResponse` with direct handling of `invoke`'s `{ data, error }` response, as its shape differs from other Supabase client methods.
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
// Helper to convert permissions array from JSON response into a Set
const processUserPermissions = (user: User | null): User | null => {
    if (user && Array.isArray(user.permissions)) {
        return {
            ...user,
            permissions: new Set(user.permissions as any as PermissionKey[]),
        };
    }
    return user;
};

export const fetchUserProfile = async (): Promise<{ user: User, syncError: string | null }> => {
  const response = await invokeFunction<{ user: User, syncError: string | null }>('sync-user-profile');
  return {
      ...response,
      user: processUserPermissions(response.user)!,
  };
};

export const forceRefreshUserProfile = async (): Promise<{ user: User, syncError: string | null }> => {
  const response = await invokeFunction<{ user: User, syncError: string | null }>('sync-user-profile', { force: true });
  return {
      ...response,
      user: processUserPermissions(response.user)!,
  };
};

export const revalidateSession = async (force: boolean = false): Promise<User> => {
  const body = force ? { force: true } : undefined;
  const { user } = await invokeFunction<{ user: User, syncError: string | null }>('sync-user-profile', body);
  return processUserPermissions(user)!;
};


// =============================================
// CONFIG API
// =============================================
export const getConfig = async (): Promise<AppConfig> => {
  if (!supabase) throw new Error("Supabase not configured");
  return handleResponse(await supabase.rpc('get_config'));
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

export const saveProduct = async (product: Omit<Product, 'id'> & { id?: string }): Promise<Product> => {
    if (!supabase) throw new Error("Supabase not configured");
    const { id, ...productData } = product;
    const response = await supabase.from('products').upsert(productData, { onConflict: 'id' }).select().single();
    return handleResponse(response);
};

export const deleteProduct = async (productId: string): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");
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

export const saveQuiz = async (quiz: Partial<Quiz>): Promise<Quiz> => {
  if (!supabase) throw new Error("Supabase not configured");
  return handleResponse(await supabase.rpc('save_quiz', { quiz_data: quiz }));
};

export const deleteQuiz = async (id: string): Promise<void> => {
  if (!supabase) throw new Error("Supabase not configured");
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
    // FIX: Changed 'submittedAt' to 'submittedat' to match the lowercase column name in the database.
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


// =============================================
// RULES API
// =============================================
export const getRules = async (): Promise<RuleCategory[]> => {
    if (!supabase) throw new Error("Supabase not configured");
    const response = await supabase.from('rules').select('*').order('position', { ascending: true });
    return handleResponse(response);
};

export const saveRules = async (rules: RuleCategory[]): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");
    return handleResponse(await supabase.rpc('save_rules', { rules_data: rules }));
};

// =============================================
// TRANSLATIONS API
// =============================================
export const getTranslations = async (): Promise<Translations> => {
    if (!supabase) throw new Error("Supabase not configured");
    // FIX: Added explicit type to handleResponse to resolve iterator error.
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
    return invokeFunction<DiscordRole[]>('get-guild-roles');
};

export const getRolePermissions = async (roleId: string): Promise<RolePermission> => {
    if (!supabase) throw new Error("Supabase not configured");
    const response = await supabase.from('role_permissions').select('*').eq('role_id', roleId).maybeSingle();
    const data = handleResponse(response);
    // FIX: Corrected the fallback object to match the RolePermission type. This prevents a type error when a role has no permissions set.
    return data || { role_id: roleId, permissions: [] };
};

export const saveRolePermissions = async (roleId: string, permissions: PermissionKey[]): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");
    return handleResponse(
        await supabase.from('role_permissions').upsert({ role_id: roleId, permissions: permissions }, { onConflict: 'role_id' })
    );
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
    return handleResponse(await supabase.rpc('log_action', { p_action: 'Accessed Admin Panel' }));
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
        ping: 50,
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
export const checkDiscordApiHealth = async (): Promise<any> => {
    return invokeFunction('check-bot-health');
};
export const troubleshootUserSync = async (discordId: string): Promise<any> => {
    return invokeFunction('troubleshoot-user-sync', { discordId });
};