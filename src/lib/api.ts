
// src/lib/api.ts
import { supabase } from './supabaseClient';
import { env } from '../env';
import type { 
  AppConfig, Product, Quiz, QuizSubmission, RuleCategory, Translations, 
  User, DiscordRole, UserLookupResult, Invoice, InvoiceItem,
  MtaServerStatus, AuditLogEntry, DiscordAnnouncement, RolePermission, DiscordWidget, StaffMember, ProductCategory
} from '../types';

// --- BOT API HELPERS ---

export class ApiError extends Error {
  status: number;
  details?: string;
  targetUrl?: string;

  constructor(message: string, status: number, details?: string, targetUrl?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.targetUrl = targetUrl;
  }
}

async function callBotApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `/api/proxy${endpoint}`;
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    
    try {
        const response = await fetch(url, { ...options, headers });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `Error ${response.status}` }));
            let msg = errorData.error || `Proxy Error (${response.status})`;
            if (errorData.targetUrl) msg += ` (Target: ${errorData.targetUrl})`;
            throw new ApiError(msg, response.status, errorData.details, errorData.targetUrl);
        }
        if (response.status === 204) return null as T;
        return response.json();
    } catch (error) {
        if (error instanceof ApiError) throw error;
        console.error(`[API Client] Error calling proxy at ${url}:`, error);
        throw new ApiError("Failed to communicate with the application server proxy.", 503);
    }
}

// --- SMART LOGGING SYSTEM ---
// This function routes logs to Channels OR Users (DMs) based on the type.
export const sendDiscordLog = async (
    config: AppConfig, 
    embed: any, 
    logType: 'admin' | 'ban' | 'submission' | 'submission_dm' | 'auth' | 'dm' | 'finance' | 'store', 
    targetId?: string
): Promise<void> => {
  
  let finalTargetId: string | null | undefined = null;
  let targetType: 'channel' | 'user' = 'channel';
  let mentionRoleId: string | null | undefined = null;

  // 1. Route based on Type
  if (logType === 'dm' || logType === 'submission_dm') {
      if (!targetId) {
          console.warn("[sendDiscordLog] DM requested but no targetId provided.");
          return;
      }
      finalTargetId = targetId;
      targetType = 'user';
  } else {
      // Channel Routing
      switch (logType) {
        case 'admin':
          finalTargetId = config.log_channel_admin;
          mentionRoleId = config.mention_role_audit_log_admin;
          break;
        case 'ban':
          finalTargetId = config.log_channel_bans;
          mentionRoleId = config.mention_role_audit_log_bans;
          break;
        case 'submission':
          finalTargetId = config.submissions_channel_id; // Main submission channel
          mentionRoleId = config.mention_role_submissions;
          break;
        case 'auth':
          finalTargetId = config.log_channel_auth || config.log_channel_admin; 
          mentionRoleId = config.mention_role_auth;
          break;
        case 'finance':
          finalTargetId = config.log_channel_finance; 
          mentionRoleId = config.mention_role_finance;
          break;
        case 'store':
          finalTargetId = config.log_channel_store; 
          mentionRoleId = config.mention_role_store;
          break;
      }
      
      // Fallback to general audit log if specific one isn't set
      if (!finalTargetId) {
        finalTargetId = config.audit_log_channel_id;
        if (!mentionRoleId && logType !== 'auth') {
             mentionRoleId = config.mention_role_audit_log_general;
        }
      }
  }

  // 2. Validate Target
  if (!finalTargetId) {
    console.warn(`[sendDiscordLog] No target configured for log type: ${logType}`);
    return;
  }

  // 3. Database Logging (Persistence) - Only for system/admin actions, not DMs
  if (targetType === 'channel' && supabase) {
      const adminName = embed.author?.name || 'System';
      const actionText = embed.title ? `${embed.title} - ${embed.description?.substring(0, 50)}...` : (embed.description || 'Log Action');
      
      try {
          // Fire and forget DB log
          supabase.rpc('log_system_action', { 
            p_action: actionText, 
            p_log_type: logType,
            p_actor_id: null,
            p_actor_username: adminName
          });
      } catch (err) { console.error("[DB Log] Error:", err); }
  }

  // 4. Send to Bot
  const content = (targetType === 'channel' && mentionRoleId) ? `<@&${mentionRoleId}>` : undefined;

  try {
    await callBotApi('/notify', {
      method: 'POST',
      body: JSON.stringify({
        targetId: finalTargetId,
        targetType,
        content,
        embed,
      }),
    });
  } catch (error) {
    console.warn(`[sendDiscordLog] Bot delivery failed:`, (error as Error).message);
  }
};

// --- AUTH & USER PROFILE API ---
export const fetchUserProfile = async (): Promise<{ user: User, syncError: string | null, isNewUser: boolean }> => {
  if (!supabase) throw new Error("Supabase client is not initialized.");
  
  const { data, error: sessionError } = await (supabase.auth as any).getSession();
  if (sessionError) throw new ApiError(sessionError.message, 500);
  
  const session = data?.session;
  if (!session) throw new ApiError("No active session", 401);

  let discordProfile;
  let syncError = null;

  try {
      discordProfile = await callBotApi<any>(`/sync-user/${session.user.user_metadata.provider_id}`, { method: 'POST' });
  } catch (e) {
      console.error("Bot Sync Failed:", e);
      const err = e as ApiError;
      syncError = err.message;
      // Fallback
      const meta = session.user.user_metadata;
      discordProfile = {
          discordId: meta.provider_id,
          username: meta.custom_claims?.global_name || meta.full_name || 'Unknown',
          avatar: meta.avatar_url || '',
          roles: [],
          highestRole: null
      };
  }

  // Check DB for existing profile to determine if new
  const { data: existingProfiles } = await supabase.from('profiles').select('id, is_banned, ban_reason, ban_expires_at, balance, mta_serial, mta_name, mta_linked_at').eq('id', session.user.id);
  const existingProfile = existingProfiles?.[0] || null;
  const isNewUser = !existingProfile;

  // Helper to get permissions...
  const userPermissions = new Set<string>();
  if (discordProfile.roles.length > 0) {
      const { data: permsData } = await supabase.from('role_permissions').select('permissions').in('role_id', discordProfile.roles.map((r: any) => r.id));
      if (permsData) permsData.forEach(p => (p.permissions || []).forEach(perm => userPermissions.add(perm)));
  }

  const finalUser: User = {
      id: session.user.id,
      ...discordProfile,
      permissions: Array.from(userPermissions),
      is_banned: existingProfile?.is_banned ?? false,
      ban_reason: existingProfile?.ban_reason ?? null,
      ban_expires_at: existingProfile?.ban_expires_at ?? null,
      balance: existingProfile?.balance ?? 0, // Sync balance
      mta_serial: existingProfile?.mta_serial ?? null,
      mta_name: existingProfile?.mta_name ?? null,
      mta_linked_at: existingProfile?.mta_linked_at ?? null,
  };

  // Upsert Profile
  await supabase.from('profiles').upsert({
      id: finalUser.id, discord_id: finalUser.discordId, username: finalUser.username, avatar_url: finalUser.avatar,
      roles: finalUser.roles, highest_role: finalUser.highestRole, last_synced_at: new Date().toISOString()
  }, { onConflict: 'id' });

  return { user: finalUser, syncError, isNewUser };
};

export const verifyCaptcha = async (token: string): Promise<any> => {
    if (!supabase) throw new Error("Supabase client is not initialized.");
    const { data, error } = await supabase.functions.invoke('verify-captcha', { body: { token } });
    if (error || !data.success) throw new Error(data?.error || error?.message || 'Captcha failed');
    return data;
};

export const verifyAdminPassword = async (password: string): Promise<boolean> => {
    if (!supabase) return false;
    const { data } = await supabase.rpc('verify_admin_password', { p_password: password });
    return data as boolean;
};

// --- LOGGING HELPERS ---
export const logAdminPageVisit = async (pageName: string): Promise<void> => {
  if (!supabase) return;
  await supabase.rpc('log_page_visit', { p_page_name: pageName });
};

// --- FINANCIAL API ---
export const addBalance = async (targetUserId: string, amount: number, reason?: string): Promise<number> => {
    const { data, error } = await supabase!.rpc('add_user_balance', { p_target_user_id: targetUserId, p_amount: amount, p_reason: reason });
    if (error) throw new Error(error.message);
    return data as number; // Returns new balance
};

export const createInvoice = async (targetUserId: string, products: InvoiceItem[], totalAmount: number): Promise<Invoice> => {
    const { data, error } = await supabase!.rpc('create_invoice', { p_target_user_id: targetUserId, p_products: products, p_total_amount: totalAmount });
    if (error) throw new Error(error.message);
    return data as Invoice;
};

export const getUserInvoices = async (userId: string): Promise<Invoice[]> => {
    const { data, error } = await supabase!.from('invoices').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    return data as Invoice[];
};

export const processPurchase = async (amount: number, details: string): Promise<boolean> => {
    const { data, error } = await supabase!.rpc('process_purchase', { p_amount: amount, p_details: details });
    if (error) throw new Error(error.message);
    return data as boolean;
};

// ... [Rest of the CRUD functions remain the same but imported types might have changed] ...

export const getConfig = async (): Promise<AppConfig> => {
  if (!supabase) throw new Error("Supabase client not initialized.");
  const { data } = await supabase.rpc('get_config');
  return data as AppConfig;
};

export const saveConfig = async (configData: Partial<AppConfig>): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.rpc('update_config', { new_config: configData });
    if (error) throw new ApiError(error.message, 500);
};

export const getTranslations = async (): Promise<Translations> => {
  if (!supabase) return {};
  const { data } = await supabase.from('translations').select('key, en, ar');
  const translations: Translations = {};
  data?.forEach((item: any) => translations[item.key] = { en: item.en, ar: item.ar });
  return translations;
};

export const saveTranslations = async (translations: Translations): Promise<void> => {
    if (!supabase) return;
    const upsertData = Object.entries(translations).map(([key, value]) => ({ key, en: value.en, ar: value.ar }));
    await supabase.from('translations').upsert(upsertData, { onConflict: 'key' });
};

export const getQuizzes = async (): Promise<Quiz[]> => {
    if (!supabase) return [];
    const response = await supabase.from('quizzes').select('*');
    return response.data as Quiz[];
};

export const saveQuiz = async (quizData: any): Promise<Quiz> => {
    if (!supabase) throw new Error("Supabase client not initialized.");
    const { data, error } = await supabase.rpc('save_quiz_with_translations', { p_quiz_data: quizData });
    if (error) throw new ApiError(error.message, 500);
    return data;
};

export const deleteQuiz = async (id: string): Promise<void> => {
    if (!supabase) return;
    await supabase.rpc('delete_quiz', { p_quiz_id: id });
};

export const getProducts = async (): Promise<Product[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('products').select('*');
    return data as Product[];
};
export const getProductCategories = async (): Promise<ProductCategory[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('product_categories').select('*').order('position');
    return data as ProductCategory[];
};
export const saveProduct = async (productData: any): Promise<Product> => {
    const { data, error } = await supabase!.rpc('save_product_with_translations', { p_product_data: productData });
    if(error) throw error; return data;
};
export const deleteProduct = async (id: string) => { await supabase!.rpc('delete_product', { p_product_id: id }); };
export const saveProductCategories = async (cats: any[]) => { await supabase!.rpc('save_product_categories', { p_categories_data: cats }); };

export const getRules = async (): Promise<RuleCategory[]> => {
    const { data } = await supabase!.from('rules').select('*').order('position');
    return data as RuleCategory[];
};
export const saveRules = async (rules: any[]) => { await supabase!.rpc('save_rules', { p_rules_data: rules }); };

export const getDiscordWidgets = async (): Promise<DiscordWidget[]> => {
    const { data } = await supabase!.from('discord_widgets').select('*');
    return data as DiscordWidget[];
};
export const saveDiscordWidgets = async (widgets: any[]) => { await supabase!.rpc('save_discord_widgets', { p_widgets_data: widgets }); };

export const getStaff = async (): Promise<StaffMember[]> => {
    const { data } = await supabase!.rpc('get_staff');
    return data as StaffMember[];
};
export const saveStaff = async (staff: any[]) => { await supabase!.rpc('save_staff', { p_staff_data: staff }); };

export const getGuildRoles = () => callBotApi<DiscordRole[]>('/guild-roles');
export const getRolePermissions = async (): Promise<RolePermission[]> => {
    const { data } = await supabase!.from('role_permissions').select('*');
    return data as RolePermission[];
};
export const saveRolePermissions = async (data: RolePermission) => {
    await supabase!.rpc('save_role_permissions', { p_role_id: data.role_id, p_permissions: data.permissions });
};

export const lookupUser = async (discordId: string): Promise<UserLookupResult> => {
    const { data, error } = await supabase!.rpc('lookup_user_by_discord_id', { p_discord_id: discordId });
    if (error) throw new Error(error.message);
    return data as UserLookupResult;
};
export const banUser = async (targetUserId: string, reason: string, durationHours: number | null) => {
    await supabase!.rpc('ban_user', { p_target_user_id: targetUserId, p_reason: reason, p_duration_hours: durationHours });
};
export const unbanUser = async (targetUserId: string) => {
    await supabase!.rpc('unban_user', { p_target_user_id: targetUserId });
};
export const getAuditLogs = async () => {
    const { data } = await supabase!.from('audit_log').select('*').order('timestamp', { ascending: false }).limit(100);
    return data as AuditLogEntry[];
};

export const testNotification = (key: string, targetId: string) => callBotApi('/notify', { method: 'POST', body: JSON.stringify({ targetId, targetType: key === 'submission_result' ? 'user' : 'channel', content: 'Test Notification' }) });
export const checkDiscordApiHealth = () => callBotApi('/health');
export const getMtaServerStatus = () => callBotApi<MtaServerStatus>('/mta-status');
export const getDiscordAnnouncements = () => callBotApi<DiscordAnnouncement[]>('/announcements');

// MTA API
export const getMtaAccountInfo = async (serial: string): Promise<MtaAccountInfo> => {
    const response = await fetch(`/api/mta/account/${serial}`);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Error ${response.status}` }));
        throw new ApiError(errorData.error || `Failed to fetch MTA account info (${response.status})`, response.status);
    }
    return response.json();
};

export const getMtaCharacterDetails = async (characterId: string): Promise<any> => {
    const response = await fetch(`/api/mta/character/${characterId}`);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Error ${response.status}` }));
        throw new ApiError(errorData.error || `Failed to fetch MTA character details (${response.status})`, response.status);
    }
    return response.json();
};

export const checkMtaLinkStatus = async (serial: string): Promise<{ linked: boolean; discord: { id: string; username: string; avatar: string | null } | null }> => {
    const response = await fetch(`/api/mta/status/${serial}`);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Error ${response.status}` }));
        throw new ApiError(errorData.error || `Failed to check MTA link status (${response.status})`, response.status);
    }
    return response.json();
};

export const unlinkMtaAccount = async (serial: string): Promise<{ success: boolean }> => {
    const response = await fetch(`/api/mta/unlink`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial }),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Error ${response.status}` }));
        throw new ApiError(errorData.error || `Failed to unlink MTA account (${response.status})`, response.status);
    }
    return response.json();
};

// Submissions
export const getQuizById = async (id: string): Promise<Quiz> => {
    const { data } = await supabase!.from('quizzes').select('*').eq('id', id).single();
    return data as Quiz;
};
export const addSubmission = async (submissionData: any): Promise<QuizSubmission> => {
    const { data, error } = await supabase!.rpc('add_submission', { submission_data: submissionData });
    if(error) throw error; return data;
};
export const getSubmissions = async (): Promise<QuizSubmission[]> => {
    const { data } = await supabase!.rpc('get_all_submissions');
    return data as QuizSubmission[];
};
export const getSubmissionById = async (id: string): Promise<QuizSubmission> => {
    const { data } = await supabase!.from('submissions').select('*').eq('id', id).single();
    return data as QuizSubmission;
};
export const getSubmissionsByUserId = async (userId: string): Promise<QuizSubmission[]> => {
    const { data } = await supabase!.from('submissions').select('*').eq('user_id', userId);
    return data as QuizSubmission[];
};
export const updateSubmissionStatus = async (id: string, status: string, reason?: string): Promise<QuizSubmission> => {
    const { data, error } = await supabase!.rpc('update_submission_status', { p_submission_id: id, p_new_status: status, p_reason: reason });
    if(error) throw error; return data;
};
export const deleteSubmission = async (id: string) => {
    await supabase!.rpc('delete_submission', { p_submission_id: id });
};
export const getProductById = async (id: string): Promise<Product> => {
    const { data } = await supabase!.from('products').select('*').eq('id', id).single();
    return data as Product;
};
export const getProductsWithCategories = async () => {
    const { data } = await supabase!.rpc('get_products_with_categories');
    return data as ProductCategory[];
};
export const forceRefreshUserProfile = fetchUserProfile;
export const revalidateSession = async (): Promise<User> => { const { user } = await fetchUserProfile(); return user; };

// --- INVITE & REAL STATS API ---
export const getInviteDetails = (code: string) => callBotApi<{
    guild: { name: string; id: string; iconURL: string | null };
    memberCount: number;
    presenceCount: number;
}>(`/discord-invite/${code}`);
