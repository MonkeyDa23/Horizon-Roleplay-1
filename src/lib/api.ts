import { supabase } from './supabaseClient';
export { supabase };
import type { 
  AppConfig, Product, Quiz, QuizSubmission, RuleCategory, Translations, 
  User, DiscordRole, UserLookupResult, Invoice, InvoiceItem,
  MtaServerStatus, AuditLogEntry, DiscordAnnouncement, RolePermission, DiscordWidget, StaffMember, ProductCategory,
  MtaAccountInfo
} from '../types';

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
        throw new ApiError("Failed to communicate with the application server proxy.", 503);
    }
}

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

  switch (logType) {
      case 'auth': category = 'AUTH'; break;
      case 'admin': case 'ban': category = 'ADMIN'; break;
      case 'store': category = 'STORE'; break;
      case 'finance': category = 'FINANCE'; break;
      case 'visit': category = 'VISITS'; break;
      case 'submission': case 'submission_dm': category = 'SUBMISSIONS'; break;
  }

  if (logType === 'dm' || logType === 'submission_dm') {
      if (!targetId && !username) return;
      finalTargetId = targetId;
      targetType = 'user';
  }

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
        embed: targetType === 'user' ? embed : undefined
      }),
    });
  } catch (error) {
    console.error('sendDiscordLog error:', error);
  }
};

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
      const err = e as ApiError;
      syncError = err.message;
      const meta = session.user.user_metadata;
      discordProfile = {
          discordId: meta.provider_id,
          username: meta.custom_claims?.global_name || meta.full_name || 'Unknown',
          avatar: meta.avatar_url || '',
          roles: [],
          highestRole: null,
          mtaLink: null
      };
  }

  // Graceful profile fetching to avoid completely breaking on RLS recursion
  let existingProfile = null;
  try {
      const { data: existingProfiles, error: fetchError } = await supabase
        .from('users')
        .select('id, is_banned, ban_reason, ban_expires_at, balance, mta_serial, mta_name, mta_linked_at, two_factor_enabled')
        .eq('id', session.user.id);
      
      if (fetchError) {
          console.warn('Error fetching user profile from DB (possible RLS issue):', fetchError.message);
      } else {
          existingProfile = existingProfiles?.[0] || null;
      }
  } catch (e) {
      console.warn('Exception fetching user profile:', e);
  }

  const isNewUser = !existingProfile;

  const userPermissions = new Set<string>();
  try {
    if (discordProfile.roles && discordProfile.roles.length > 0) {
        const { data: permsData } = await supabase.from('role_permissions').select('permissions').in('role_id', discordProfile.roles.map((r: any) => r.id));
        if (permsData) permsData.forEach(p => (p.permissions || []).forEach(perm => userPermissions.add(perm)));
        
        // --- AUTO-GRANT ADMIN IF ROLE MATCHES CONFIG ---
        const { CONFIG } = await import('../constants');
        const hasAdminRole = discordProfile.roles.some((r: any) => 
            CONFIG.ADMIN_ROLE_IDS.includes(r.id) || CONFIG.STAFF_ROLE_IDS.includes(r.id)
        );
        if (hasAdminRole) {
            userPermissions.add('_super_admin');
            userPermissions.add('admin_panel');
        }
    }
  } catch (e) {
      console.warn('Error fetching role permissions:', e);
  }

  const finalUser: User = {
      id: session.user.id,
      email: existingProfile?.email || session.user.email || `${session.user.id}@discord.nova`,
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
      two_factor_enabled: existingProfile?.two_factor_enabled ?? false,
  };

  try {
    const upsertData = {
        id: finalUser.id, 
        email: finalUser.email || `${finalUser.id}@discord.nova`,
        discord_id: finalUser.discordId, 
        username: finalUser.username, 
        avatar_url: finalUser.avatar,
        roles: finalUser.roles || [], 
        highest_role: finalUser.highestRole, 
        mta_serial: finalUser.mta_serial,
        mta_name: finalUser.mta_name,
        mta_linked_at: finalUser.mta_linked_at,
        last_synced_at: new Date().toISOString()
    };

    const { error: upsertError } = await supabase.from('users').upsert(upsertData, { onConflict: 'id' });
    if (upsertError) console.warn('Upsert user error (RLS?):', upsertError.message);
  } catch (e) {
      console.warn('Upsert user exception:', e);
  }

  return { user: finalUser, syncError, isNewUser };
};

export const verifyCaptcha = async (token: string): Promise<any> => {
    const response = await fetch('/api/auth/verify-captcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data?.error || 'Captcha failed');
    return data;
};

export const verifyAdminPassword = async (password: string): Promise<boolean> => {
    const response = await fetch('/api/auth/verify-admin-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
    });
    const data = await response.json();
    return data.success === true;
};

export const logAdminPageVisit = async (pageName: string): Promise<void> => {
  if (!supabase) return;
  await (supabase as any).rpc('log_page_visit', { p_page_name: pageName });
};

export const logAdminAction = async (config: AppConfig, user: User, action: string, details: string, type: 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING' = 'INFO') => {
    const embed = {
        title: `🛠️ Admin Action: ${action}`,
        description: `Admin **${user.username}** made an update.\n\n**Details:**\n${details}`,
        color: type === 'SUCCESS' ? 0x00F2EA : (type === 'ERROR' ? 0xFF4444 : 0x6366F1),
        author: { name: user.username, icon_url: user.avatar },
        timestamp: new Date().toISOString(),
        footer: { text: "Security Logging" }
    };
    return sendDiscordLog(config, embed, 'admin');
};

export const logSubmissionAction = async (
    siteName: string,
    admin: User, 
    submission: QuizSubmission, 
    action: 'NEW' | 'TAKEN' | 'ACCEPTED' | 'REFUSED', 
    reason?: string
) => {
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
                title: '📝 New Application',
                description: `**${applicantName}** sent a new application for **${quizName}**.`,
                color: 0x6366F1,
                fields: [
                    { name: 'Applicant', value: targetId ? `<@${targetId}>` : applicantName, inline: true },
                    { name: 'Rank', value: submission.user_highest_role || 'Member', inline: true },
                    ...submission.answers.map((a, i) => ({
                        name: `Question ${i + 1}: ${a.questionText}`,
                        value: a.answer.length > 1023 ? a.answer.substring(0, 1020) + '...' : a.answer,
                        inline: false
                    }))
                ],
                timestamp: new Date().toISOString()
            };
            dmEmbed = {
                title: `✅ Application Received at ${siteName}`,
                description: `Hello **${applicantName}**,\n\nYour application for **${quizName}** has been received successfully. Our staff will review it soon.\n\nThank you!`,
                color: 0x6366F1
            };
            break;

        case 'TAKEN':
            status = 'taken';
            embed = {
                title: '✋ Application Taken',
                description: `Staff **${admin.username}** took **${applicantName}**'s **${quizName}** application for review.`,
                color: 0xFFA500,
                author: { name: admin.username, icon_url: admin.avatar },
                timestamp: new Date().toISOString()
            };
            dmEmbed = {
                title: `👨‍💻 Your Application is under review at ${siteName}`,
                description: `Hello **${applicantName}**,\n\nYour application for **${quizName}** is now being reviewed by **${admin.username}**.`,
                color: 0xFFA500,
                timestamp: new Date().toISOString()
            };
            break;

        case 'ACCEPTED':
        case 'REFUSED': {
            const isAccepted = action === 'ACCEPTED';
            status = isAccepted ? 'accepted' : 'rejected';
            embed = {
                title: isAccepted ? '✅ Application Accepted' : '❌ Application Refused',
                description: `Review for **${applicantName}**'s application for **${quizName}**.`,
                color: isAccepted ? 0x00F2EA : 0xFF4444,
                fields: [
                    { name: 'Admin', value: admin.username, inline: true },
                    { name: 'Applicant', value: targetId ? `<@${targetId}>` : applicantName, inline: true },
                    { name: 'Status', value: isAccepted ? 'Accepted' : 'Refused', inline: true },
                    { name: 'Reason', value: reason || 'No reason provided', inline: false }
                ],
                timestamp: new Date().toISOString()
            };
            dmEmbed = {
                title: isAccepted ? `🎉 Congratulations! Your application at ${siteName} was accepted` : `⚠️ Sorry, your application at ${siteName} was refused`,
                description: `Hello **${applicantName}**,\n\nYour application for **${quizName}** has been reviewed.\n\n**Status:** ${isAccepted ? 'Accepted ✅' : 'Refused ❌'}\n${reason ? `**Reason:** ${reason}` : ''}\n\n${isAccepted ? 'Please proceed to the server.' : 'You can try again later.'}`,
                color: isAccepted ? 0x00F2EA : 0xFF4444
            };
            break;
        }
    }

    const config = await getConfig();
    if (embed) await sendDiscordLog(config, embed, 'submission', undefined, status, applicantName);
    if (dmEmbed && targetId) await sendDiscordLog(config, dmEmbed, 'submission_dm', targetId, status, applicantName);
    else if (dmEmbed && applicantName) await sendDiscordLog(config, dmEmbed, 'submission_dm', undefined, status, applicantName);
};

export const logFinanceAction = async (config: AppConfig, admin: User, target: { id: string, name: string }, amount: number, action: 'Add Balance' | 'Invoice Created', reason?: string) => {
    const embed = {
        title: action === 'Add Balance' ? '💰 Balance Added' : '🧾 Invoice Created',
        description: `Financial operation for user **${target.name}**.`,
        color: 0x2ECC71,
        fields: [
            { name: 'Admin', value: admin.username, inline: true },
            { name: 'Target', value: `<@${target.id}>`, inline: true },
            { name: 'Amount', value: `$${amount.toLocaleString()}`, inline: true },
            { name: 'Reason', value: reason || 'Not specified', inline: false }
        ],
        timestamp: new Date().toISOString()
    };
    
    await sendDiscordLog(config, embed, 'finance');
    
    const dmEmbed = {
        title: action === 'Add Balance' ? '💸 Balance Added' : '📑 New Invoice Issued',
        description: `Hello **${target.name}**,\n\n${action === 'Add Balance' ? `**$${amount.toLocaleString()}** has been successfully added to your balance.` : `A new invoice has been issued for **$${amount.toLocaleString()}**.`}\n\n**Reason:** ${reason || 'Not specified'}`,
        color: 0x2ECC71
    };
    await sendDiscordLog(config, dmEmbed, 'dm', target.id);
};

export const addBalance = async (targetUserId: string, amount: number, reason?: string): Promise<number> => {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data, error } = await (supabase as any).rpc('add_user_balance', { p_target_user_id: targetUserId, p_amount: amount, p_reason: reason });
    if (error) throw new Error(error.message);
    return data as number;
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
    return (data as Invoice[]) || [];
};

export const processPurchase = async (amount: number, details: string): Promise<boolean> => {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data, error } = await (supabase as any).rpc('process_purchase', { p_amount: amount, p_details: details });
    if (error) throw new Error(error.message);
    return data as boolean;
};

export const getConfig = async (): Promise<AppConfig> => {
  if (!supabase) return {} as AppConfig;
  try {
    const { data, error } = await supabase.rpc('get_config');
    if (error) {
       console.warn('getConfig rpc error (safe to ignore if setup not complete):', error.message);
       return {} as AppConfig;
    }
    return (data as AppConfig) || {} as AppConfig;
  } catch (e) {
    return {} as AppConfig;
  }
};

export const saveConfig = async (configData: Partial<AppConfig>): Promise<void> => {
    if (!supabase) return;
    const { error } = await (supabase as any).rpc('update_config', { new_config: configData });
    if (error) throw new ApiError(error.message, 500);
};

export const getTranslations = async (): Promise<Translations> => {
  if (!supabase) return {};
  try {
    const { data, error } = await supabase.from('translations').select('key, en, ar');
    if (error) {
        console.warn('getTranslations error:', error.message);
        return {};
    }
    const translations: Translations = {};
    data?.forEach((item: any) => {
        if (item.key) translations[item.key] = { en: item.en || '', ar: item.ar || '' };
    });
    return translations;
  } catch (e) {
    console.error('getTranslations exception:', e);
    return {};
  }
};

export const saveTranslations = async (translations: Translations): Promise<any> => {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch('/api/admin/translations/save', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ translations })
    });
    
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to save translations');
    return result;
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
    try {
        const { data } = await supabase.from('products').select('*').order('sort_order', { ascending: true });
        return (data as Product[]) || [];
    } catch (e) {
        return [];
    }
};
export const getProductCategories = async (): Promise<ProductCategory[]> => {
    if (!supabase) return [];
    try {
        const { data, error } = await supabase.from('categories').select('*').order('sort_order', { ascending: true });
        if (error) {
            console.warn('getProductCategories fallback:', error.message);
            // Try without order as a last resort
            const { data: simpleData } = await supabase.from('categories').select('*');
            return (simpleData as ProductCategory[]) || [];
        }
        return (data as ProductCategory[]) || [];
    } catch (e) {
        return [];
    }
};
export const saveProduct = async (productData: any): Promise<Product> => {
    const { data, error } = await supabase!.rpc('save_product_with_translations', { p_product_data: productData });
    if(error) throw error; return data;
};
export const deleteProduct = async (id: string) => { await supabase!.rpc('delete_product', { p_product_id: id }); };
export const saveProductCategories = async (cats: any[]) => { await supabase!.rpc('save_product_categories', { p_categories_data: cats }); };

export const getRules = async (): Promise<RuleCategory[]> => {
    if (!supabase) return [];
    try {
        const { data, error } = await supabase.from('rules').select('*').order('position', { ascending: true });
        if (error) {
            console.warn('getRules fallback:', error.message);
            const { data: simpleData } = await supabase.from('rules').select('*');
            return (simpleData as RuleCategory[]) || [];
        }
        return (data as RuleCategory[]) || [];
    } catch (e) {
        return [];
    }
};
export const saveRules = async (rules: any[]) => { await supabase!.rpc('save_rules', { p_rules_data: rules }); };

export const getDiscordWidgets = async (): Promise<DiscordWidget[]> => {
    const { data } = await supabase!.from('discord_widgets').select('*');
    return (data as DiscordWidget[]) || [];
};
export const saveDiscordWidgets = async (widgets: any[]) => { await supabase!.rpc('save_discord_widgets', { p_widgets_data: widgets }); };

export const getStaff = async (): Promise<StaffMember[]> => {
    const { data } = await supabase!.rpc('get_staff');
    return (data as StaffMember[]) || [];
};
export const saveStaff = async (staff: any[]) => { await supabase!.rpc('save_staff', { p_staff_data: staff }); };

export const getGuildRoles = () => callBotApi<DiscordRole[]>('/guild-roles');
export const getRolePermissions = async (): Promise<RolePermission[]> => {
    const { data } = await supabase!.from('role_permissions').select('*');
    return (data as RolePermission[]) || [];
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
    return (data as AuditLogEntry[]) || [];
};

export const testNotification = (key: string, targetId: string) => callBotApi('/notify', { method: 'POST', body: JSON.stringify({ targetId, targetType: key === 'submission_result' ? 'user' : 'channel', content: 'Test Notification' }) });
export const checkDiscordApiHealth = () => callBotApi('/health');
export const getMtaServerStatus = () => callBotApi<MtaServerStatus>('/mta-status');
export const getDiscordAnnouncements = () => callBotApi<DiscordAnnouncement[]>('/announcements');

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

    const { data: { user: authUser } } = await supabase!.auth.getUser();
    if (authUser) {
        await supabase!
            .from('users')
            .update({
                mta_serial: null,
                mta_name: null,
                mta_linked_at: null
            })
            .eq('id', authUser.id);
    }

    return response.json();
};

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
    return (data as QuizSubmission[]) || [];
};
export const getSubmissionById = async (id: string): Promise<QuizSubmission> => {
    const { data } = await supabase!.from('quiz_submissions').select('*').eq('id', id).single();
    return data as QuizSubmission;
};
export const getSubmissionsByUserId = async (userId: string): Promise<QuizSubmission[]> => {
    const { data } = await supabase!.from('quiz_submissions').select('*').eq('user_id', userId);
    return (data as QuizSubmission[]) || [];
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
export const getProductsWithCategories = async (): Promise<ProductCategory[]> => {
    try {
        if (!supabase) return [];
        // Attempt RPC first
        const { data, error } = await supabase.rpc('get_products_with_categories');
        
        if (!error && data) return (data as ProductCategory[]) || [];

        // Fallback to manual fetch if RPC fails
        const { data: categories } = await supabase.from('categories').select('*').order('sort_order', { ascending: true });
        const { data: products } = await supabase.from('products').select('*').order('sort_order', { ascending: true });

        if (!categories) return [];

        return (categories as ProductCategory[]).map(cat => ({
            ...cat,
            products: products?.filter(p => p.category_id === cat.id) || []
        }));
    } catch (e) {
        console.error('Products fetch error:', e);
        return [];
    }
};
export const enable2FA = async (secret: string, backupCodes: string[]): Promise<void> => {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch('/api/auth/2fa/enable', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ secret, backupCodes })
    });
    
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
};

export const disable2FA = async (): Promise<void> => {
    if (!supabase) throw new Error("Supabase not initialized");
    const { error } = await (supabase as any).rpc('disable_2fa');
    if (error) throw new Error(error.message);
};

export const verifyTwoFactorServer = async (code: string): Promise<boolean> => {
    if (!supabase) return false;
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ code })
    });
    
    return response.ok;
};

export const logSecurityEvent = async (eventType: string, severity: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO', details: any = {}): Promise<void> => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('security_events').insert({
        user_id: user?.id || null,
        event_type: eventType,
        severity,
        details,
        user_agent: navigator.userAgent
    });

    if (severity === 'CRITICAL' || severity === 'WARNING') {
        const config = await getConfig();
        const logChannel = config.log_channel_admin;
        if (logChannel) {
            await loginDiscordLog(
                severity === 'CRITICAL' ? 'ERROR' : 'WARNING', 
                `🛡️ Security Event: ${eventType}`,
                `User: ${user?.id || 'Unknown'}\nDetails: ${JSON.stringify(details)}`,
                'ADMIN'
            );
        }
    }
};

const loginDiscordLog = async (type: string, title: string, description: string, category: string) => {
    try {
        await fetch('/api/proxy/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, title, description, category })
        });
    } catch (e) {
        console.error('loginDiscordLog error:', e);
    }
}

export const forceRefreshUserProfile = fetchUserProfile;
export const revalidateSession = async (): Promise<User> => { const { user } = await fetchUserProfile(); return user; };

export const getInviteDetails = (code: string) => callBotApi<{
    guild: { name: string; id: string; iconURL: string | null };
    memberCount: number;
    presenceCount: number;
}>(`/discord-invite/${code}`);
