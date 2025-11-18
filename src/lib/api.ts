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

// FIX: Added sendDiscordLog function to send log messages via the bot API.
export const sendDiscordLog = async (config: AppConfig, embed: any, logType: 'admin' | 'ban' | 'submission' | 'auth' | 'admin_access', language: 'en' | 'ar'): Promise<void> => {
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
      // Auth logs go to the general admin channel.
      channelId = config.log_channel_admin;
      break;
  }

  // Use fallback channel if specific one is not set.
  if (!channelId) {
    channelId = config.audit_log_channel_id;
    if (logType !== 'auth') { // Don't mention for general auth logs in fallback
        mentionRoleId = config.mention_role_audit_log_general;
    }
  }

  if (!channelId) {
    console.warn(`[sendDiscordLog] No channel ID configured for log type "${logType}" or as a fallback. Skipping log.`);
    return;
  }

  const content = mentionRoleId ? `<@&${mentionRoleId}>` : undefined;

  try {
    await callBotApi('/notify', {
      method: 'POST',
      body: JSON.stringify({
        channelId,
        content,
        embed,
      }),
    });
  } catch (error) {
    console.error(`[sendDiscordLog] Failed to send log for type "${logType}" to channel ${channelId}:`, error);
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
// FIX: Updated return type of fetchUserProfile to include 'isNewUser'.
export const fetchUserProfile = async (): Promise<{ user: User, syncError: string | null, isNewUser: boolean }> => {
  if (!supabase) throw new Error("Supabase client is not initialized.");
  // FIX: Reverted to async getSession() for Supabase v2 compatibility.
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new ApiError(sessionError.message, 500);
  if (!session) throw new ApiError("No active session", 401);

  // 1. Get Discord profile from our bot. This is the primary source of truth for user details.
  const discordProfile = await callBotApi<any>(`/sync-user/${session.user.user_metadata.provider_id}`, { method: 'POST' });

  // 2. Fetch existing profile from DB (ban status, etc.). This might not exist for a new user.
  // We query without .single() to avoid the 406 error for new users.
  const { data: existingProfiles, error: dbError } = await supabase.from('profiles').select('id, is_banned, ban_reason, ban_expires_at').eq('id', session.user.id);
  if (dbError) throw new ApiError(dbError.message, 500);
  const existingProfile = existingProfiles?.[0] || null;
  const isNewUser = !existingProfile;

  // 3. Get permissions from Supabase based on roles from Discord profile
  const { data: permsData, error: permsError } = await supabase.from('role_permissions').select('permissions').in('role_id', discordProfile.roles.map((r: any) => r.id));
  if (permsError) throw new ApiError(permsError.message, 500);

  const userPermissions = new Set<string>();
  if (permsData) {
      permsData.forEach(p => (p.permissions || []).forEach(perm => userPermissions.add(perm)));
  }

  // 4. Combine into the final user object
  const finalUser: User = {
      id: session.user.id,
      ...discordProfile,
      permissions: Array.from(userPermissions),
      is_banned: existingProfile?.is_banned ?? false,
      ban_reason: existingProfile?.ban_reason ?? null,
      ban_expires_at: existingProfile?.ban_expires_at ?? null,
  };

  // 5. Upsert the latest profile info back to the DB
  // This will create the profile for a new user, or update it for an existing one.
  const { error: upsertError } = await supabase.from('profiles').upsert({
      id: finalUser.id, discord_id: finalUser.discordId, username: finalUser.username, avatar_url: finalUser.avatar,
      roles: finalUser.roles, highest_role: finalUser.highestRole, last_synced_at: new Date().toISOString()
  }, { onConflict: 'id' });

  if (upsertError) {
      console.error("Profile upsert failed:", upsertError.message);
  }
  
  // 6. If it was a new user, send welcome DM and log it
  if (isNewUser && !upsertError) {
      const { COMMUNITY_NAME, LOGO_URL } = await getConfig();
      const { data: translations } = await supabase.from('translations').select('key, en, ar').in('key', ['notification_welcome_title', 'notification_welcome_body']);
      const welcomeTitle = translations?.find(t => t.key === 'notification_welcome_title')?.en.replace('{communityName}', COMMUNITY_NAME) ?? `Welcome to ${COMMUNITY_NAME}!`;
      const welcomeBody = translations?.find(t => t.key === 'notification_welcome_body')?.en.replace('{username}', finalUser.username) ?? `We're happy to have you, ${finalUser.username}!`;

      const welcomeEmbed = {
          title: welcomeTitle,
          description: welcomeBody,
          color: 0x00F2EA,
          thumbnail: { url: LOGO_URL },
          footer: { text: COMMUNITY_NAME, icon_url: LOGO_URL },
          timestamp: new Date().toISOString()
      };
      
      callBotApi('/notify', { method: 'POST', body: JSON.stringify({ dmToUserId: finalUser.discordId, embed: welcomeEmbed }) })
        .catch(e => console.error("Failed to send welcome DM:", e));
      
      // Log this event
      // FIX: The supabase rpc call is thenable but does not have a .catch method.
      // Used .then() to handle potential errors in this fire-and-forget logging action.
      supabase.rpc('log_action', { 
          p_action: `New user logged in: **${finalUser.username}** (\`${finalUser.discordId}\`)`,
          p_log_type: 'auth'
      }).then(({ error: logError }) => {
        if (logError) {
            console.error("Failed to log new user event:", logError);
        }
      });
  }

  return { user: finalUser, syncError: null, isNewUser };
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
  // FIX: Replaced reduce with a for loop for broader compatibility.
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
  // This is a fire-and-forget operation, so we don't need to throw an error on failure
  await supabase.rpc('log_page_visit', { p_page_name: pageName });
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
