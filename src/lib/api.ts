// src/lib/api.ts
import { supabase } from './supabaseClient';
import { env } from '../env';
import type { 
  AppConfig, Product, Quiz, QuizSubmission, RuleCategory, Translations, 
  User, DiscordRole, UserLookupResult,
  MtaServerStatus, AuditLogEntry, DiscordAnnouncement, RolePermission, DiscordWidget, StaffMember, ProductCategory
} from '../types';

// --- BOT API HELPERS ---

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function callBotApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // All bot API calls are now routed through the server-side proxy
    // to handle HTTPS, CORS, and keep the API key secure.
    const url = `/api/proxy${endpoint}`;
    
    const headers = {
        'Content-Type': 'application/json',
        // The 'Authorization' header with the secret API key is now added
        // by the proxy (Vite dev server or Vercel serverless function),
        // not by the client.
        ...options.headers,
    };
    
    try {
        const response = await fetch(url, { ...options, headers });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response from proxy.' }));
            throw new ApiError(errorData.error || `The application proxy returned an error (status ${response.status}). Check the bot and proxy function logs.`, response.status);
        }
        if (response.status === 204) {
            return null as T;
        }
        return response.json();
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        console.error(`[API Client] Network or other fetch error calling proxy at ${url}:`, error);
        throw new ApiError("Failed to communicate with the application server proxy. It may be offline or misconfigured.", 503);
    }
}

// FIX: Robust Logging System
// 1. Logs to Database FIRST (Reliable).
// 2. Logs to Discord SECOND (Best Effort).
export const sendDiscordLog = async (config: AppConfig, embed: any, logType: 'admin' | 'ban' | 'submission' | 'auth' | 'admin_access', language: 'en' | 'ar'): Promise<void> => {
  
  // --- 1. DATABASE LOGGING (Priority) ---
  // We extract basic info from the embed to store a textual representation in the DB.
  const adminName = embed.author?.name || 'System';
  const actionText = embed.title ? `${embed.title}: ${embed.description || ''}` : (embed.description || 'Action occurred');
  
  // Ensure supabase is available
  if (supabase) {
      try {
          // We use a fire-and-forget approach for the DB log to not block execution, 
          // but we handle the promise catch to avoid unhandled rejections.
          await supabase.rpc('log_system_action', { 
            p_action: actionText, 
            p_log_type: logType,
            p_actor_id: null, // System action or we don't have ID handy here, will use admin_username
            p_actor_username: adminName
          });
      } catch (err) {
          console.error("[DB Log] Critical error:", err);
      }
  }

  // --- 2. DISCORD LOGGING (Best Effort) ---
  let channelId: string | null | undefined = null;
  let mentionRoleId: string | null | undefined = null;

  switch (logType) {
    case 'admin':
    case 'admin_access':
      channelId = config.log_channel_admin;
      mentionRoleId = config.mention_role_audit_log_admin;
      break;
    case 'ban':
      channelId = config.log_channel_bans;
      mentionRoleId = config.mention_role_audit_log_bans;
      break;
    case 'submission':
      channelId = config.log_channel_submissions;
      mentionRoleId = config.mention_role_audit_log_submissions;
      break;
    case 'auth':
      channelId = config.log_channel_admin;
      break;
  }

  if (!channelId) {
    channelId = config.audit_log_channel_id;
    if (logType !== 'auth') { 
        mentionRoleId = config.mention_role_audit_log_general;
    }
  }

  if (!channelId) {
    // No channel configured, skip Discord part quietly.
    return;
  }

  const content = mentionRoleId ? `<@&${mentionRoleId}>` : undefined;

  try {
    // We await this, but we catch the error so it doesn't crash the calling function
    await callBotApi('/notify', {
      method: 'POST',
      body: JSON.stringify({
        channelId,
        content,
        embed,
      }),
    });
  } catch (error) {
    // Common error: Bot offline or proxy failure. 
    // Since we already logged to DB, this is not critical for data integrity.
    console.warn(`[sendDiscordLog] Could not send Discord notification for type "${logType}":`, (error as Error).message);
  }
};

export const verifyCaptcha = async (token: string): Promise<any> => {
    if (!supabase) throw new Error("Supabase client is not initialized.");
    
    const { data, error } = await supabase.functions.invoke('verify-captcha', {
        body: { token },
    });

    if (error) {
        console.error("Supabase function 'verify-captcha' invocation error:", error);
        throw new Error(error.message);
    }
    
    if (!data.success) {
         throw new Error(data.error || 'Unknown captcha verification error.');
    }
    
    return data;
};


// --- SUPABASE HELPER ---
const handleResponse = <T>(response: { data: T | null; error: any; status: number; statusText: string }): T => {
  if (response.error) {
    console.error('Supabase API Error:', response.error);
    throw new ApiError(response.error.message, response.status);
  }
  return response.data as T;
};

// =============================================
// AUTH & USER PROFILE API
// =============================================
export const fetchUserProfile = async (): Promise<{ user: User, syncError: string | null, isNewUser: boolean }> => {
  if (!supabase) throw new Error("Supabase client is not initialized.");
  
  const { data, error: sessionError } = await (supabase.auth as any).getSession();
  if (sessionError) throw new ApiError(sessionError.message, 500);
  
  const session = data?.session;
  if (!session) throw new ApiError("No active session", 401);

  let discordProfile;
  let syncError = null;

  // Try to fetch from Discord Bot
  try {
      discordProfile = await callBotApi<any>(`/sync-user/${session.user.user_metadata.provider_id}`, { method: 'POST' });
  } catch (e) {
      console.error("Bot Sync Failed, falling back to session metadata:", e);
      syncError = (e as Error).message;
      // Fallback: Construct basic profile from Supabase session metadata if bot is down
      const meta = session.user.user_metadata;
      discordProfile = {
          discordId: meta.provider_id,
          username: meta.custom_claims?.global_name || meta.full_name || 'Unknown',
          avatar: meta.avatar_url || '',
          roles: [], // Cannot get roles without bot
          highestRole: null
      };
  }

  // Fetch existing profile from DB
  const { data: existingProfiles, error: dbError } = await supabase.from('profiles').select('id, is_banned, ban_reason, ban_expires_at').eq('id', session.user.id);
  if (dbError) throw new ApiError(dbError.message, 500);
  const existingProfile = existingProfiles?.[0] || null;
  const isNewUser = !existingProfile;

  // Get permissions
  let userPermissions = new Set<string>();
  if (discordProfile.roles.length > 0) {
      const { data: permsData } = await supabase.from('role_permissions').select('permissions').in('role_id', discordProfile.roles.map((r: any) => r.id));
      if (permsData) {
          permsData.forEach(p => (p.permissions || []).forEach(perm => userPermissions.add(perm)));
      }
  }

  const finalUser: User = {
      id: session.user.id,
      ...discordProfile,
      permissions: Array.from(userPermissions),
      is_banned: existingProfile?.is_banned ?? false,
      ban_reason: existingProfile?.ban_reason ?? null,
      ban_expires_at: existingProfile?.ban_expires_at ?? null,
  };

  const { error: upsertError } = await supabase.from('profiles').upsert({
      id: finalUser.id, discord_id: finalUser.discordId, username: finalUser.username, avatar_url: finalUser.avatar,
      roles: finalUser.roles, highest_role: finalUser.highestRole, last_synced_at: new Date().toISOString()
  }, { onConflict: 'id' });

  if (upsertError) console.error("Profile upsert failed:", upsertError.message);
  
  if (isNewUser && !upsertError && !syncError) {
      // Try to log new user event
      const { COMMUNITY_NAME, LOGO_URL } = await getConfig();
      const embed = {
          title: '✨ New User Registered',
          description: `User **${finalUser.username}** (\`${finalUser.discordId}\`) logged in for the first time.`,
          color: 0x22C55E,
          timestamp: new Date().toISOString()
      };
      sendDiscordLog({ ...await getConfig() }, embed, 'auth', 'en');
  }

  return { user: finalUser, syncError, isNewUser };
};

export const forceRefreshUserProfile = fetchUserProfile;
export const revalidateSession = async (): Promise<User> => {
  const { user } = await fetchUserProfile();
  return user;
};
export const verifyAdminPassword = async (password: string): Promise<boolean> => {
    if (!supabase) return false;
    const { data } = await supabase.rpc('verify_admin_password', { p_password: password });
    return data as boolean;
};

// =============================================
// STORE API
// =============================================
export const getProducts = async (): Promise<Product[]> => {
  if (!supabase) return [];
  const response = await supabase.from('products').select('*');
  return handleResponse(response);
};
export const getProductById = async (id: string): Promise<Product> => {
  if (!supabase) throw new Error("Supabase client not initialized.");
  const response = await supabase.from('products').select('*').eq('id', id).single();
  return handleResponse(response);
};
export const saveProduct = async (productData: any): Promise<Product> => {
  if (!supabase) throw new Error("Supabase client not initialized.");
  const { data, error } = await supabase.rpc('save_product_with_translations', { p_product_data: productData });
  if (error) throw new ApiError(error.message, 500);
  return data;
};
export const deleteProduct = async (id: string): Promise<void> => {
  if (!supabase) return;
  const { error } = await supabase.rpc('delete_product', { p_product_id: id });
  if (error) throw new ApiError(error.message, 500);
};

export const getProductCategories = async (): Promise<ProductCategory[]> => {
  if (!supabase) return [];
  const response = await supabase.from('product_categories').select('*').order('position');
  return handleResponse(response);
};

export const getProductsWithCategories = async (): Promise<ProductCategory[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.rpc('get_products_with_categories');
    if (error) {
        console.error('Supabase RPC Error (get_products_with_categories):', error);
        throw new ApiError(error.message, 500);
    }
    return data as ProductCategory[];
};

export const saveProductCategories = async (categories: any[]): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.rpc('save_product_categories', { p_categories_data: categories });
    if (error) throw new ApiError(error.message, 500);
};


// =============================================
// RULES & CONFIG API
// =============================================
export const getRules = async (): Promise<RuleCategory[]> => {
  if (!supabase) return [];
  const response = await supabase.from('rules').select('*').order('position');
  return handleResponse(response);
};
export const saveRules = async (rules: any[]): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.rpc('save_rules', { p_rules_data: rules });
    if (error) throw new ApiError(error.message, 500);
};
export const getConfig = async (): Promise<AppConfig> => {
  if (!supabase) throw new Error("Supabase client not initialized.");
  const { data, error } = await supabase.rpc('get_config');
  if (error) throw new ApiError(error.message, 500);
  return data as AppConfig;
};
export const saveConfig = async (configData: Partial<AppConfig>): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.rpc('update_config', { new_config: configData });
    if (error) throw new ApiError(error.message, 500);
};

// =============================================
// QUIZ & SUBMISSIONS API
// =============================================
export const getQuizzes = async (): Promise<Quiz[]> => {
  if (!supabase) return [];
  const response = await supabase.from('quizzes').select('*');
  return handleResponse(response);
};
export const getQuizById = async (id: string): Promise<Quiz> => {
  if (!supabase) throw new Error("Supabase client not initialized.");
  const response = await supabase.from('quizzes').select('*').eq('id', id).single();
  return handleResponse(response);
};
export const addSubmission = async (submissionData: any): Promise<QuizSubmission> => {
  if (!supabase) throw new Error("Supabase client not initialized.");
  const { data, error } = await supabase.rpc('add_submission', { submission_data: submissionData });
  if (error) throw new ApiError(error.message, 500);
  return data;
};
export const getSubmissions = async (): Promise<QuizSubmission[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('get_all_submissions');
  if (error) throw new ApiError(error.message, 500);
  return data;
};
export const getSubmissionById = async (id: string): Promise<QuizSubmission> => {
    if (!supabase) throw new Error("Supabase client not initialized.");
    // We use the submissions table directly, but ensure RLS allows reading it.
    // Admin policies should allow reading any submission.
    const response = await supabase.from('submissions').select('*').eq('id', id).single();
    return handleResponse(response);
};
export const getSubmissionsByUserId = async (userId: string): Promise<QuizSubmission[]> => {
  if (!supabase) return [];
  const response = await supabase.from('submissions').select('*').eq('user_id', userId).order('submittedAt', { ascending: false });
  return handleResponse(response);
};
export const updateSubmissionStatus = async (id: string, status: string, reason?: string): Promise<QuizSubmission> => {
  if (!supabase) throw new Error("Supabase client not initialized.");
  const { data, error } = await supabase.rpc('update_submission_status', { p_submission_id: id, p_new_status: status, p_reason: reason });
  if (error) throw new ApiError(error.message, 500);
  return data;
};
export const deleteSubmission = async (id: string): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.rpc('delete_submission', { p_submission_id: id });
    if (error) throw new ApiError(error.message, 500);
};
export const saveQuiz = async (quizData: any): Promise<Quiz> => {
  if (!supabase) throw new Error("Supabase client not initialized.");
  const { data, error } = await supabase.rpc('save_quiz_with_translations', { p_quiz_data: quizData });
  if (error) throw new ApiError(error.message, 500);
  return data;
};
export const deleteQuiz = async (id: string): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.rpc('delete_quiz', { p_quiz_id: id });
    if (error) throw new ApiError(error.message, 500);
};

// =============================================
// TRANSLATIONS API
// =============================================
export const getTranslations = async (): Promise<Translations> => {
  if (!supabase) return {};
  const { data, error } = await supabase.from('translations').select('key, en, ar');
  if (error) throw new ApiError(error.message, 500);
  const translations: Translations = {};
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    translations[item.key] = { en: item.en, ar: item.ar };
  }
  return translations;
};
export const saveTranslations = async (translations: Translations): Promise<void> => {
    if (!supabase) return;
    const upsertData = Object.entries(translations).map(([key, value]) => ({ key, en: value.en, ar: value.ar }));
    const { error } = await supabase.from('translations').upsert(upsertData, { onConflict: 'key' });
    if (error) throw new ApiError(error.message, 500);
};

// =============================================
// ADMIN & MODERATION API
// =============================================
export const lookupUser = async (discordId: string): Promise<UserLookupResult> => {
  if (!supabase) throw new Error("Supabase client not initialized.");
  const { data, error } = await supabase.rpc('lookup_user_by_discord_id', { p_discord_id: discordId });
  if (error) throw new ApiError(error.message, 500);
  return data as UserLookupResult;
};
export const banUser = async (targetUserId: string, reason: string, durationHours: number | null): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.rpc('ban_user', { p_target_user_id: targetUserId, p_reason: reason, p_duration_hours: durationHours });
    if (error) throw new ApiError(error.message, 500);
};
export const unbanUser = async (targetUserId: string): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.rpc('unban_user', { p_target_user_id: targetUserId });
    if (error) throw new ApiError(error.message, 500);
};
export const getAuditLogs = async (page = 1, limit = 50): Promise<AuditLogEntry[]> => {
  if (!supabase) return [];
  const response = await supabase.from('audit_log').select('*').order('timestamp', { ascending: false }).range((page - 1) * limit, page * limit - 1);
  return handleResponse(response);
};
export const logAdminPageVisit = async (pageName: string): Promise<void> => {
  if (!supabase) return;
  // This is a fire-and-forget operation
  await supabase.rpc('log_page_visit', { p_page_name: pageName }).then(({error}) => {
      if (error) console.warn("Log page visit failed:", error.message);
  });
};
export const getGuildRoles = (): Promise<DiscordRole[]> => callBotApi('/guild-roles');
export const getRolePermissions = async (): Promise<RolePermission[]> => {
  if (!supabase) return [];
  const response = await supabase.from('role_permissions').select('*');
  return handleResponse(response);
};
export const saveRolePermissions = async (data: RolePermission): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.rpc('save_role_permissions', { p_role_id: data.role_id, p_permissions: data.permissions });
    if (error) throw new ApiError(error.message, 500);
};
export const testNotification = (type: string, targetId: string): Promise<void> => callBotApi('/notify-test', { method: 'POST', body: JSON.stringify({ type, targetId }) });

// =============================================
// WIDGETS & STAFF API
// =============================================
export const getDiscordWidgets = async (): Promise<DiscordWidget[]> => {
    if (!supabase) return [];
    const response = await supabase.from('discord_widgets').select('*').order('position');
    return handleResponse(response);
};
export const saveDiscordWidgets = async (widgets: any[]): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.rpc('save_discord_widgets', { p_widgets_data: widgets });
    if (error) throw new ApiError(error.message, 500);
};
export const getStaff = async (): Promise<StaffMember[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.rpc('get_staff');
    if (error) throw new ApiError(error.message, 500);
    return data;
};
export const saveStaff = async (staff: any[]): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.rpc('save_staff', { p_staff_data: staff });
    if (error) throw new ApiError(error.message, 500);
};


// =============================================
// EXTERNAL & MISC API
// =============================================
export const checkDiscordApiHealth = (): Promise<any> => callBotApi('/health');
export const getMtaServerStatus = (): Promise<MtaServerStatus> => callBotApi('/mta-status');
export const getDiscordAnnouncements = (): Promise<DiscordAnnouncement[]> => callBotApi('/announcements');