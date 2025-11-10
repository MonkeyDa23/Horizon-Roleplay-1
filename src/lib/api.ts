// src/lib/api.ts
import { supabase } from './supabaseClient';
// The 'env' import is intentionally removed from API calls to prevent accidental direct-to-bot requests.
// It is still used by diagnostic pages, but not for core functionality.
import { env } from '../env';
import type { 
  AppConfig, Product, Quiz, QuizSubmission, RuleCategory, Translations, 
  User, DiscordRole, UserLookupResult,
  MtaServerStatus, AuditLogEntry, DiscordAnnouncement, RolePermission, DiscordWidget
} from '../types';

// --- BOT API HELPERS ---

// THIS IS THE ONLY PATH THE WEBSITE FRONTEND WILL EVER USE.
// All bot-related requests are sent to our own serverless function at this path.
// This function then securely forwards the request to the actual bot, solving all
// Mixed Content (http/https) browser security issues.
const PROXY_PATH = '/api/gateway';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function callBotApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // The final URL will be something like '/api/gateway/sync-user/12345'
    const url = `${PROXY_PATH}${endpoint}`;
    
    const headers = {
        'Content-Type': 'application/json',
        // Authorization is now handled by the server-side proxy for better security.
        ...options.headers,
    };
    
    try {
        const response = await fetch(url, { ...options, headers });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response from proxy.' }));
            // Provide a clearer error message for debugging.
            throw new ApiError(errorData.error || `The proxy function returned an error (status ${response.status}). Check the Vercel function logs.`, response.status);
        }
        if (response.status === 204) {
            return null as T;
        }
        return response.json();
    } catch (error) {
        if (error instanceof ApiError) {
            throw error; // Re-throw ApiError instances from the !response.ok block
        }
        // This will catch network errors (e.g., Vercel proxy is down, DNS problems)
        console.error(`[API Client] Network or other fetch error calling proxy endpoint ${endpoint}:`, error);
        throw new ApiError("Failed to communicate with the website's proxy function. This could be a deployment issue on Vercel or a network problem.", 503);
    }
}


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
export const fetchUserProfile = async (): Promise<{ user: User, syncError: string | null }> => {
  if (!supabase) throw new Error("Supabase client is not initialized.");
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) throw new ApiError(sessionError?.message || "No active session", 401);
  
  // 1. Get Discord profile from our bot via the proxy
  const discordProfile = await callBotApi<any>(`/sync-user/${session.user.user_metadata.provider_id}`, { method: 'POST' });

  // 2. Get permissions and ban status from Supabase (as bot can't access this directly)
  const { data: dbProfile, error: dbError } = await supabase.from('profiles').select('id, is_banned, ban_reason, ban_expires_at').eq('id', session.user.id).single();
  const { data: permsData, error: permsError } = await supabase.from('role_permissions').select('permissions').in('role_id', discordProfile.roles.map((r: any) => r.id));

  if (dbError && dbError.code !== 'PGRST116') throw new ApiError(dbError.message, 500);
  if (permsError) throw new ApiError(permsError.message, 500);

  const userPermissions = new Set<string>();
  if (permsData) {
      permsData.forEach(p => (p.permissions || []).forEach(perm => userPermissions.add(perm)));
  }

  // 3. Combine into the final user object
  const finalUser: User = {
      id: session.user.id,
      ...discordProfile,
      permissions: Array.from(userPermissions),
      is_banned: dbProfile?.is_banned ?? false,
      ban_reason: dbProfile?.ban_reason ?? null,
      ban_expires_at: dbProfile?.ban_expires_at ?? null,
  };

  // 4. Upsert the latest profile info back to the DB (fire-and-forget)
  supabase.from('profiles').upsert({
      id: finalUser.id, discord_id: finalUser.discordId, username: finalUser.username, avatar_url: finalUser.avatar,
      roles: finalUser.roles, highest_role: finalUser.highestRole, last_synced_at: new Date().toISOString()
  }, { onConflict: 'id' }).then(({ error }) => {
      if (error) console.error("Profile upsert failed:", error.message);
  });

  return { user: finalUser, syncError: null };
};

export const forceRefreshUserProfile = fetchUserProfile;
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
// CONFIG & TRANSLATIONS API
// =============================================
export const getConfig = async (): Promise<AppConfig> => handleResponse(await supabase.rpc('get_config'));
export const saveConfig = async (config: Partial<AppConfig>): Promise<void> => handleResponse(await supabase.rpc('update_config', { new_config: config }));
export const getTranslations = async (): Promise<Translations> => {
    const data = await handleResponse<({ key: string; ar: string; en: string })[]>(await supabase.from('translations').select('key, ar, en'));
    const translations: Translations = {};
    for (const item of data) { translations[item.key] = { ar: item.ar, en: item.en }; }
    return translations;
};
export const saveTranslations = async (translations: Translations): Promise<void> => {
    const dataToUpsert = Object.entries(translations).map(([key, value]) => ({ key, ...value }));
    await handleResponse(await supabase.from('translations').upsert(dataToUpsert, { onConflict: 'key' }));
};

// =============================================
// STORE, QUIZZES, RULES, WIDGETS API
// =============================================
export const getProducts = async (): Promise<Product[]> => handleResponse(await supabase.from('products').select('*'));
export const getProductById = async (id: string): Promise<Product | null> => handleResponse(await supabase.from('products').select('*').eq('id', id).single());
export const saveProduct = async (data: any): Promise<Product> => handleResponse(await supabase.rpc('save_product_with_translations', { p_product_data: data }));
export const deleteProduct = async (id: string): Promise<void> => handleResponse(await supabase.rpc('delete_product', { p_product_id: id }));
export const getQuizzes = async (): Promise<Quiz[]> => handleResponse(await supabase.from('quizzes').select('*').order('created_at', { ascending: true }));
export const getQuizById = async (id: string): Promise<Quiz | null> => handleResponse(await supabase.from('quizzes').select('*').eq('id', id).single());
export const saveQuiz = async (data: any): Promise<Quiz> => handleResponse(await supabase.rpc('save_quiz_with_translations', { p_quiz_data: data }));
export const deleteQuiz = async (id: string): Promise<void> => handleResponse(await supabase.rpc('delete_quiz', { p_quiz_id: id }));
export const getRules = async (): Promise<RuleCategory[]> => handleResponse(await supabase.from('rules').select('*').order('position', { ascending: true }));
export const saveRules = async (data: any[]): Promise<void> => handleResponse(await supabase.rpc('save_rules', { p_rules_data: data }));
export const getDiscordWidgets = async (): Promise<DiscordWidget[]> => handleResponse(await supabase.from('discord_widgets').select('*').order('position', { ascending: true }));
export const saveDiscordWidgets = async (widgets: Omit<DiscordWidget, 'id'>[]): Promise<void> => handleResponse(await supabase.rpc('save_discord_widgets', { p_widgets_data: widgets }));


// =============================================
// SUBMISSIONS API (with BOT NOTIFICATIONS)
// =============================================
export const getSubmissions = async (): Promise<QuizSubmission[]> => handleResponse(await supabase.rpc('get_all_submissions'));
export const getSubmissionsByUserId = async (userId: string): Promise<QuizSubmission[]> => handleResponse(await supabase.from('submissions').select('*').eq('user_id', userId).order('submittedAt', { ascending: false }));
export const deleteSubmission = async (id: string): Promise<void> => handleResponse(await supabase.rpc('delete_submission', { p_submission_id: id }));

export const addSubmission = async (submission: any): Promise<QuizSubmission> => {
    // 1. Save to DB
    const newSubmission = await handleResponse<QuizSubmission>(await supabase.rpc('add_submission', { submission_data: submission }));
    if (!newSubmission) throw new Error("Failed to get new submission record from database.");

    // 2. Trigger notifications via Bot (fire-and-forget)
    const { submissions_channel_id, mention_role_submissions, COMMUNITY_NAME, LOGO_URL } = await getConfig();
    if (submissions_channel_id) {
        const embed = {
            author: { name: "New Submission Received", icon_url: "https://i.imgur.com/gJt1kUD.png" },
            description: `A submission from **${newSubmission.username}** for **${newSubmission.quizTitle}** is awaiting review.`,
            color: 0x00F2EA,
            fields: [{ name: "Applicant", value: newSubmission.username, inline: true }, { name: "Application", value: newSubmission.quizTitle, inline: true }],
            footer: { text: COMMUNITY_NAME, icon_url: LOGO_URL },
            timestamp: new Date(newSubmission.submittedAt).toISOString(),
        };
        callBotApi('/notify', { method: 'POST', body: JSON.stringify({ channelId: submissions_channel_id, content: mention_role_submissions ? `<@&${mention_role_submissions}>` : '', embed }) }).catch(e => console.error("Bot notification failed:", e));
    }
    
    // Send DM receipt
    const { data: translations } = await supabase.from('translations').select('key, en, ar').in('key', ['notification_submission_receipt_title', 'notification_submission_receipt_body']);
    const receiptTitle = translations?.find(t => t.key === 'notification_submission_receipt_title')?.en ?? 'Application Submitted Successfully! ✅';
    const receiptBody = translations?.find(t => t.key === 'notification_submission_receipt_body')?.en ?? 'Hey {username},\n\nWe have successfully received your application for **{quizTitle}**. Our team will review it as soon as possible.';
    
    const receiptEmbed = {
        title: receiptTitle,
        description: receiptBody.replace('{username}', newSubmission.username).replace('{quizTitle}', newSubmission.quizTitle),
        color: 0x00B2FF,
        footer: { text: COMMUNITY_NAME, icon_url: LOGO_URL },
        timestamp: new Date().toISOString()
    };
    const { data: profile } = await supabase.from('profiles').select('discord_id').eq('id', newSubmission.user_id).single();
    if(profile) callBotApi('/notify', { method: 'POST', body: JSON.stringify({ dmToUserId: profile.discord_id, embed: receiptEmbed }) }).catch(e => console.error("Bot DM receipt failed:", e));
    
    return newSubmission;
};

export const updateSubmissionStatus = async (submissionId: string, status: 'taken' | 'accepted' | 'refused', reason?: string): Promise<void> => {
    // 1. Update DB
    const updatedSubmission = await handleResponse<QuizSubmission>(await supabase.rpc('update_submission_status', { p_submission_id: submissionId, p_new_status: status, p_reason: reason || null }));
    if (!updatedSubmission) throw new Error("Failed to get updated submission record from database.");
    
    // 2. Trigger notifications via Bot
    const { log_channel_submissions, COMMUNITY_NAME, LOGO_URL } = await getConfig();
    if (log_channel_submissions) {
        const logEmbed = {
            title: `Submission Status Updated`,
            description: `Submission for **${updatedSubmission.username}** was updated to **${status.toUpperCase()}** by **${updatedSubmission.adminUsername}**.`,
            color: 0x00B2FF,
            footer: { text: COMMUNITY_NAME, icon_url: LOGO_URL },
            timestamp: new Date().toISOString()
        };
        callBotApi('/notify', { method: 'POST', body: JSON.stringify({ channelId: log_channel_submissions, embed: logEmbed }) }).catch(e => console.error("Bot log notification failed:", e));
    }

    if (status === 'accepted' || status === 'refused') {
        const isAccepted = status === 'accepted';
        const titleKey = isAccepted ? 'notification_submission_accepted_title' : 'notification_submission_refused_title';
        const bodyKey = isAccepted ? 'notification_submission_accepted_body' : 'notification_submission_refused_body';

        const { data: translations } = await supabase.from('translations').select('key, en, ar').in('key', [titleKey, bodyKey]);
        const resultTitle = translations?.find(t => t.key === titleKey)?.en ?? (isAccepted ? 'Congratulations! Your Application was Accepted! 🎉' : 'Update on Your Application');
        const resultBodyTemplate = translations?.find(t => t.key === bodyKey)?.en ?? 'There was an update on your application for {quizTitle}.';
        const resultBody = resultBodyTemplate
            .replace('{username}', updatedSubmission.username)
            .replace('{quizTitle}', updatedSubmission.quizTitle)
            .replace('{adminUsername}', updatedSubmission.adminUsername || 'Admin')
            .replace('{reason}', updatedSubmission.reason || 'No reason provided.');

        const resultEmbed = {
            title: resultTitle,
            description: resultBody,
            color: isAccepted ? 0x22C55E : 0xEF4444,
            footer: { text: COMMUNITY_NAME, icon_url: LOGO_URL },
            timestamp: new Date().toISOString()
        };
         const { data: profile } = await supabase.from('profiles').select('discord_id').eq('id', updatedSubmission.user_id).single();
        if(profile) await callBotApi('/notify', { method: 'POST', body: JSON.stringify({ dmToUserId: profile.discord_id, embed: resultEmbed }) });
    }
};

// =============================================
// PERMISSIONS & ROLES API
// =============================================
export const getGuildRoles = async (): Promise<DiscordRole[]> => callBotApi<DiscordRole[]>('/guild-roles');
export const getRolePermissions = async (): Promise<RolePermission[]> => handleResponse(await supabase.from('role_permissions').select('*'));
export const saveRolePermissions = async (rolePermission: RolePermission): Promise<void> => handleResponse(await supabase.rpc('save_role_permissions', { p_role_id: rolePermission.role_id, p_permissions: rolePermission.permissions }));

// =============================================
// ADMIN & AUDIT LOG API
// =============================================
export const getAuditLogs = async (): Promise<AuditLogEntry[]> => handleResponse(await supabase.from('audit_log').select('*').order('timestamp', { ascending: false }).limit(100));
export const logAdminPageVisit = async (pageName: string): Promise<void> => handleResponse(await supabase.rpc('log_page_visit', { p_page_name: pageName }));

export const banUser = async (targetUserId: string, reason: string, durationHours: number | null): Promise<void> => handleResponse(await supabase.rpc('ban_user', { p_target_user_id: targetUserId, p_reason: reason, p_duration_hours: durationHours }));
export const unbanUser = async (targetUserId: string): Promise<void> => handleResponse(await supabase.rpc('unban_user', { p_target_user_id: targetUserId }));

export const testNotification = async (type: string, targetId: string): Promise<any> => {
    const { COMMUNITY_NAME, LOGO_URL } = await getConfig();
    const embed = {
        title: `Test Notification: ${type}`,
        description: `This is a test notification sent to target ID \`${targetId}\`. If you see this, the connection is working.`,
        color: 0x00F2EA,
        footer: { text: COMMUNITY_NAME, icon_url: LOGO_URL },
        timestamp: new Date().toISOString(),
    };
    
    const body: { embed: any, dmToUserId?: string, channelId?: string } = { embed };
    if (type === 'submission_result') { // Special case for DM test
        body.dmToUserId = targetId;
    } else {
        body.channelId = targetId;
    }
    
    return callBotApi('/notify', { method: 'POST', body: JSON.stringify(body) });
};


// =============================================
// MISC & HEALTH CHECK API
// =============================================
export const lookupUser = async (discordId: string): Promise<UserLookupResult> => callBotApi<UserLookupResult>(`/sync-user/${discordId}`, { method: 'POST' });
export const checkDiscordApiHealth = async (): Promise<any> => callBotApi('/health');
export const getMtaServerStatus = async (): Promise<MtaServerStatus> => {
    return new Promise(resolve => setTimeout(() => resolve({ name: "Vixel Roleplay", players: Math.floor(Math.random() * 100), maxPlayers: 150, version: "1.6" }), 1000));
};
export const getDiscordAnnouncements = async (): Promise<DiscordAnnouncement[]> => Promise.resolve([]);