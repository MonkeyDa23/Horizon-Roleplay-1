/**
 * Florida Roleplay - Official Website API Client
 * Copyright (c) 2024 Florida Roleplay. All rights reserved.
 */

import { supabase } from './supabaseClient';
import type { 
  AppConfig, Product, Quiz, QuizSubmission, RuleCategory, Translations, 
  User, DiscordRole, UserLookupResult, Invoice, InvoiceItem,
  MtaServerStatus, AuditLogEntry, DiscordAnnouncement, RolePermission, DiscordWidget, StaffMember, ProductCategory,
  MtaAccountInfo
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
export const sendDiscordLog = async (
    config: AppConfig, 
    embed: any, 
    logType: 'admin' | 'ban' | 'submission' | 'submission_dm' | 'auth' | 'dm' | 'finance' | 'store' | 'visit', 
    targetId?: string,
    status?: string,
    username?: string
): Promise<void> => {
  
  let finalTargetId: string | null | undefined = null;
  let targetType: 'channel' | 'user' = 'channel';
  let category: 'MTA' | 'COMMANDS' | 'AUTH' | 'ADMIN' | 'STORE' | 'VISITS' | 'FINANCE' | 'SUBMISSIONS' | null = null;
  const type: 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING' = logType === 'ban' ? 'ERROR' : (logType === 'store' ? 'SUCCESS' : 'INFO');

  // Map logType to Bot Categories
  switch (logType) {
      case 'auth': category = 'AUTH'; break;
      case 'admin': case 'ban': category = 'ADMIN'; break;
      case 'store': category = 'STORE'; break;
      case 'finance': category = 'FINANCE'; break;
      case 'visit': category = 'VISITS'; break;
      case 'submission': case 'submission_dm': category = 'SUBMISSIONS'; break;
  }

  if (logType === 'dm' || logType === 'submission_dm') {
      // If targetId is missing, we still want to try sending if username is provided
      if (!targetId && !username) return;
      finalTargetId = targetId;
      targetType = 'user';
  }

  // 4. Send to Bot
  try {
    await callBotApi('/notify', {
      method: 'POST',
      body: JSON.stringify({
        targetId: finalTargetId,
        targetType,
        category,
        title: embed.title,
        description: embed.description,
        type,
        status,
        username,
        fields: embed.fields || [],
        embed: targetType === 'user' ? embed : undefined // Only send full embed for DMs
      }),
    });
  } catch (error) {
    console.warn(`[sendDiscordLog] Bot delivery failed:`, (error as Error).message);
  }
};

// --- AUTH & USER PROFILE API ---
export const fetchUserProfile = async (): Promise<{ user: User, syncError: string | null, isNewUser: boolean }> => {
  if (!supabase) throw new Error("Supabase client is not initialized.");
  
  const { data, error: sessionError } = await supabase.auth.getSession();
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
      balance: existingProfile?.balance ?? 0,
      mta_serial: discordProfile.mtaLink?.serial ?? existingProfile?.mta_serial ?? null,
      mta_name: discordProfile.mtaLink?.name ?? existingProfile?.mta_name ?? null,
      mta_linked_at: (discordProfile.mtaLink && !existingProfile?.mta_linked_at) 
        ? new Date().toISOString() 
        : (existingProfile?.mta_linked_at ?? null),
  };

  // Upsert Profile
  await supabase.from('profiles').upsert({
      id: finalUser.id, 
      discord_id: finalUser.discordId, 
      username: finalUser.username, 
      avatar_url: finalUser.avatar,
      roles: finalUser.roles, 
      highest_role: finalUser.highestRole, 
      mta_serial: finalUser.mta_serial,
      mta_name: finalUser.mta_name,
      mta_linked_at: finalUser.mta_linked_at,
      last_synced_at: new Date().toISOString()
  }, { onConflict: 'id' });

  return { user: finalUser, syncError, isNewUser };
};

export const verifyCaptcha = async (token: string): Promise<any> => {
    if (!supabase) throw new Error("Supabase client is not initialized.");
    const { data, error } = await (supabase as any).functions.invoke('verify-captcha', { body: { token } });
    if (error || !data.success) throw new Error(data?.error || error?.message || 'Captcha failed');
    return data;
};

export const verifyAdminPassword = async (password: string): Promise<boolean> => {
    if (!supabase) return false;
    const { data } = await (supabase as any).rpc('verify_admin_password', { p_password: password });
    return data as boolean;
};

// --- LOGGING HELPERS ---
export const logAdminPageVisit = async (pageName: string): Promise<void> => {
  if (!supabase) return;
  await (supabase as any).rpc('log_page_visit', { p_page_name: pageName });
};

export const logAdminAction = async (config: AppConfig, user: User, action: string, details: string, type: 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING' = 'INFO') => {
    const embed = {
        title: `🛠️ إجراء إداري: ${action}`,
        description: `قام المسؤول **${user.username}** بإجراء تعديل.\n\n**التفاصيل:**\n${details}`,
        color: type === 'SUCCESS' ? 0x00F2EA : (type === 'ERROR' ? 0xFF4444 : 0x6366F1),
        author: { name: user.username, icon_url: user.avatar },
        timestamp: new Date().toISOString(),
        footer: { text: "نظام مراقبة الإدارة" }
    };
    return sendDiscordLog(config, embed, 'admin');
};

export const logSubmissionAction = async (
    config: AppConfig, 
    admin: User, 
    submission: QuizSubmission, 
    action: 'NEW' | 'TAKEN' | 'ACCEPTED' | 'REFUSED', 
    reason?: string
) => {
    // Ensure we have a Discord ID for DMs. 
    // If submission.discord_id is missing, we might not be able to send a DM.
    const targetId = submission.discord_id;
    const applicantName = submission.username;
    const quizName = submission.quizTitle;

    let embed: any;
    let dmEmbed: any;
    let status: string | undefined;

    switch (action) {
        case 'NEW':
            status = 'received';
            embed = {
                title: '📝 تقديم جديد',
                description: `قام **${applicantName}** بإرسال تقديم جديد على **${quizName}**.`,
                color: 0x6366F1,
                fields: [
                    { name: 'صاحب التقديم', value: targetId ? `<@${targetId}>` : applicantName, inline: true },
                    { name: 'الرتبة', value: submission.user_highest_role || 'عضو', inline: true },
                    ...submission.answers.map((a, i) => ({
                        name: `سؤال ${i + 1}: ${a.questionText}`,
                        value: a.answer.length > 1024 ? a.answer.substring(0, 1021) + '...' : a.answer,
                        inline: false
                    }))
                ],
                timestamp: new Date().toISOString()
            };
            dmEmbed = {
                title: `✅ تم إرسال تقديمك بنجاح في ${config.COMMUNITY_NAME}`,
                description: `مرحباً **${applicantName}**،\n\nلقد تم استلام تقديمك لـ **${quizName}** بنجاح. سيتم مراجعته من قبل الإدارة قريباً.\n\nشكراً لك!`,
                color: 0x6366F1,
                thumbnail: { url: config.LOGO_URL }
            };
            break;

        case 'TAKEN':
            status = 'taken';
            embed = {
                title: '✋ استلام تقديم',
                description: `قام المشرف **${admin.username}** باستلام تقديم **${quizName}** الخاص بـ **${applicantName}** للمراجعة.`,
                color: 0xFFA500,
                author: { name: admin.username, icon_url: admin.avatar },
                timestamp: new Date().toISOString()
            };
            dmEmbed = {
                title: `👨‍💻 تم استلام طلبك في ${config.COMMUNITY_NAME}`,
                description: `مرحباً **${applicantName}**،\n\nتم استلام تقديمك لـ **${quizName}** وهو الآن قيد المراجعة من قبل المشرف **${admin.username}**.`,
                color: 0xFFA500,
                timestamp: new Date().toISOString()
            };
            break;

        case 'ACCEPTED':
        case 'REFUSED': {
            const isAccepted = action === 'ACCEPTED';
            status = isAccepted ? 'accepted' : 'rejected';
            embed = {
                title: isAccepted ? '✅ قبول تقديم' : '❌ رفض تقديم',
                description: `تمت مراجعة تقديم **${applicantName}** على **${quizName}**.`,
                color: isAccepted ? 0x00F2EA : 0xFF4444,
                fields: [
                    { name: 'المسؤول', value: admin.username, inline: true },
                    { name: 'صاحب التقديم', value: targetId ? `<@${targetId}>` : applicantName, inline: true },
                    { name: 'الحالة', value: isAccepted ? 'مقبول' : 'مرفوض', inline: true },
                    { name: 'السبب', value: reason || 'لا يوجد سبب محدد', inline: false }
                ],
                timestamp: new Date().toISOString()
            };
            dmEmbed = {
                title: isAccepted ? `🎉 تهانينا! تم قبول تقديمك في ${config.COMMUNITY_NAME}` : `⚠️ نعتذر، تم رفض تقديمك في ${config.COMMUNITY_NAME}`,
                description: `مرحباً **${applicantName}**،\n\nتمت مراجعة طلبك بخصوص **${quizName}**.\n\n**الحالة:** ${isAccepted ? 'مقبول ✅' : 'مرفوض ❌'}\n${reason ? `**السبب:** ${reason}` : ''}\n\n${isAccepted ? 'يرجى التوجه للسيرفر للمتابعة.' : 'يمكنك المحاولة مرة أخرى لاحقاً.'}`,
                color: isAccepted ? 0x00F2EA : 0xFF4444,
                thumbnail: { url: config.LOGO_URL }
            };
            break;
        }
    }

    if (embed) await sendDiscordLog(config, embed, 'submission', undefined, status, applicantName);
    if (dmEmbed && targetId) await sendDiscordLog(config, dmEmbed, 'submission_dm', targetId, status, applicantName);
    else if (dmEmbed && applicantName) await sendDiscordLog(config, dmEmbed, 'submission_dm', undefined, status, applicantName);
};

export const logFinanceAction = async (config: AppConfig, admin: User, target: { id: string, name: string }, amount: number, action: 'Add Balance' | 'Invoice Created', reason?: string) => {
    const embed = {
        title: action === 'Add Balance' ? '💰 إضافة رصيد' : '🧾 إنشاء فاتورة',
        description: `تم إجراء عملية مالية للمستخدم **${target.name}**.`,
        color: 0x2ECC71,
        fields: [
            { name: 'المسؤول', value: admin.username, inline: true },
            { name: 'المستهدف', value: `<@${target.id}>`, inline: true },
            { name: 'المبلغ', value: `$${amount.toLocaleString()}`, inline: true },
            { name: 'السبب', value: reason || 'غير محدد', inline: false }
        ],
        timestamp: new Date().toISOString()
    };
    
    await sendDiscordLog(config, embed, 'finance');
    
    // DM to user
    const dmEmbed = {
        title: action === 'Add Balance' ? '💸 تم إضافة رصيد لحسابك' : '📑 تم إصدار فاتورة جديدة',
        description: `مرحباً **${target.name}**،\n\n${action === 'Add Balance' ? `لقد تم إضافة **$${amount.toLocaleString()}** إلى رصيدك بنجاح.` : `لقد تم إصدار فاتورة جديدة بقيمة **$${amount.toLocaleString()}**.`}\n\n**السبب:** ${reason || 'غير محدد'}`,
        color: 0x2ECC71
    };
    await sendDiscordLog(config, dmEmbed, 'dm', target.id);
};

// --- FINANCIAL API ---
export const addBalance = async (targetUserId: string, amount: number, reason?: string): Promise<number> => {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data, error } = await (supabase as any).rpc('add_user_balance', { p_target_user_id: targetUserId, p_amount: amount, p_reason: reason });
    if (error) throw new Error(error.message);
    return data as number; // Returns new balance
};

export const createInvoice = async (targetUserId: string, products: InvoiceItem[], totalAmount: number): Promise<Invoice> => {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data, error } = await (supabase as any).rpc('create_invoice', { p_target_user_id: targetUserId, p_products: products, p_total_amount: totalAmount });
    if (error) throw new Error(error.message);
    return data as Invoice;
};

export const getUserInvoices = async (userId: string): Promise<Invoice[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('invoices').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    return data as Invoice[];
};

export const processPurchase = async (amount: number, details: string): Promise<boolean> => {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data, error } = await (supabase as any).rpc('process_purchase', { p_amount: amount, p_details: details });
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
    const { error } = await (supabase as any).rpc('update_config', { new_config: configData });
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
    const { data: { session } } = await supabase!.auth.getSession();
    const response = await fetch(`/api/mta/character/${characterId}`, {
        headers: {
            'Authorization': `Bearer ${session?.access_token}`
        }
    });
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
    const { data: { session } } = await supabase!.auth.getSession();
    // 1. Unlink from MySQL via Proxy
    const response = await fetch(`/api/mta/unlink`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ serial }),
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Error ${response.status}` }));
        throw new ApiError(errorData.error || `Failed to unlink MTA account (${response.status})`, response.status);
    }

    // 2. Clear Supabase Profile Fields
    const { data: { user: authUser } } = await supabase!.auth.getUser();
    if (authUser) {
        const { error: supabaseError } = await supabase!
            .from('profiles')
            .update({
                mta_serial: null,
                mta_name: null,
                mta_linked_at: null
            })
            .eq('id', authUser.id);
            
        if (supabaseError) {
            console.error('[API Client] Failed to clear Supabase profile during unlink:', supabaseError);
            // We don't throw here because the primary unlink (MySQL) succeeded
        }
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
