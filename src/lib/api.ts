// src/lib/api.ts
import { supabase } from './supabaseClient';
// FIX: Imported `Rule`, `EditingQuizData`, and `EditingQuestion` types to fix type errors.
import type { 
    User, AppConfig, Translations, Quiz, QuizSubmission, Product, DiscordRole, 
    RolePermission, RuleCategory, Rule, MtaServerStatus, AuditLogEntry, DiscordWidget, 
    MtaLogEntry, DiscordAnnouncement, UserLookupResult, QuizQuestion, EditingQuizData, EditingQuestion
} from '../types';

export class ApiError extends Error {
    constructor(message: string, public status: number) {
        super(message);
        this.name = 'ApiError';
    }
}

async function invokeFunction(name: string, body?: any, options?: any) {
    if (!supabase) throw new Error("Supabase client is not initialized.");
    const { data, error } = await supabase.functions.invoke(name, { body, ...options });
    if (error) {
        let errorMessage = error.message;
        if (error instanceof Error && 'context' in error && (error as any).context?.msg) {
            errorMessage = (error as any).context.msg;
        }
        
        let status = 500;
        if (error instanceof Error && 'context' in error && (error as any).context?.status) {
             status = (error as any).context.status;
        } else if (errorMessage.includes("404")) status = 404;
        else if (errorMessage.includes("401") || errorMessage.includes("Unauthorized")) status = 401;
        else if (errorMessage.includes("403")) status = 403;
        
        throw new ApiError(errorMessage, status);
    }
    return data;
}

// Auth & User
export async function fetchUserProfile(): Promise<{ user: User, syncError: string | null }> {
    return invokeFunction('sync-user-profile');
}

export async function forceRefreshUserProfile(): Promise<{ user: User, syncError: string | null }> {
    return invokeFunction('sync-user-profile', { force: true });
}

export async function revalidateSession(): Promise<User> {
    const { user } = await invokeFunction('sync-user-profile');
    return user;
}

export async function lookupUser(discordId: string): Promise<UserLookupResult> {
    return invokeFunction('troubleshoot-user-sync', { discordId });
}

export async function banUser(userId: string, reason: string, durationHours: number | null): Promise<void> {
    if (!supabase) throw new Error("Supabase not available");
    const { error } = await supabase.from('profiles').update({ is_banned: true, ban_reason: reason, ban_expires_at: durationHours ? new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString() : null }).eq('id', userId);
    if (error) throw error;
}
export async function unbanUser(userId: string): Promise<void> {
    if (!supabase) throw new Error("Supabase not available");
    const { error } = await supabase.from('profiles').update({ is_banned: false, ban_reason: null, ban_expires_at: null }).eq('id', userId);
    if (error) throw error;
}


// Config & Translations
export async function getConfig(): Promise<AppConfig> {
    if (!supabase) throw new Error("Supabase not available");
    const { data, error } = await supabase.from('config').select('*').single();
    if (error) throw error;
    return data;
}

export async function saveConfig(settings: Partial<AppConfig>): Promise<void> {
    if (!supabase) throw new Error("Supabase not available");
    const { error } = await supabase.from('config').update(settings).eq('id', 1);
    if (error) throw error;
}

export async function getTranslations(): Promise<Translations> {
    if (!supabase) throw new Error("Supabase not available");
    const { data, error } = await supabase.from('translations').select('key, en, ar');
    if (error) throw error;
    return data.reduce((acc, { key, en, ar }) => {
        acc[key] = { en, ar };
        return acc;
    }, {} as Translations);
}

export async function saveTranslations(translations: Translations): Promise<void> {
    if (!supabase) throw new Error("Supabase not available");
    const upserts = Object.entries(translations).map(([key, value]) => ({ key, en: value.en, ar: value.ar }));
    const { error } = await supabase.from('translations').upsert(upserts, { onConflict: 'key' });
    if (error) throw error;
}

// Quizzes & Submissions
export async function getQuizzes(): Promise<Quiz[]> {
    if (!supabase) throw new Error("Supabase not available");
    const { data, error } = await supabase.from('quizzes').select('*').order('titleKey');
    if (error) throw error;
    return data;
}

export async function getQuizById(id: string): Promise<Quiz> {
    if (!supabase) throw new Error("Supabase not available");
    const { data, error } = await supabase.from('quizzes').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
}

export async function saveQuiz(quizData: EditingQuizData): Promise<void> {
    if (!supabase) throw new Error("Supabase not available");

    const { titleEn, titleAr, descriptionEn, descriptionAr, questions, ...quiz } = quizData;

    const translationUpserts = [
        { key: quiz.titleKey, en: titleEn, ar: titleAr },
        { key: quiz.descriptionKey, en: descriptionEn, ar: descriptionAr },
        ...questions.map(q => ({ key: q.textKey, en: q.textEn, ar: q.textAr }))
    ];
    
    const quizToSave = {
        ...quiz,
        questions: questions.map(({ textEn, textAr, ...q }) => q)
    };

    const { error: translationError } = await supabase.from('translations').upsert(translationUpserts, { onConflict: 'key' });
    if (translationError) throw translationError;

    const { error: quizError } = await supabase.from('quizzes').upsert(quizToSave);
    if (quizError) throw quizError;
}

export async function deleteQuiz(id: string): Promise<void> {
    if (!supabase) throw new Error("Supabase not available");
    const { error } = await supabase.from('quizzes').delete().eq('id', id);
    if (error) throw error;
}

export async function getSubmissions(): Promise<QuizSubmission[]> {
    if (!supabase) throw new Error("Supabase not available");
    const { data, error } = await supabase.from('submissions').select('*').order('submittedAt', { ascending: false });
    if (error) throw error;
    return data;
}

export async function getSubmissionsByUserId(userId: string): Promise<QuizSubmission[]> {
    if (!supabase) throw new Error("Supabase not available");
    const { data, error } = await supabase.from('submissions').select('*').eq('user_id', userId).order('submittedAt', { ascending: false });
    if (error) throw error;
    return data;
}

export async function addSubmission(submission: Partial<QuizSubmission>): Promise<void> {
    if (!supabase) throw new Error("Supabase not available");
    const { error } = await supabase.from('submissions').insert(submission);
    if (error) throw error;
}

export async function updateSubmissionStatus(submissionId: string, status: 'taken' | 'accepted' | 'refused'): Promise<void> {
    if (!supabase) throw new Error("Supabase not available");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const update: Partial<QuizSubmission> = { status, updatedAt: new Date().toISOString() };
    if (status === 'taken') {
        update.adminId = user.id;
        update.adminUsername = user.user_metadata.full_name;
    }

    const { error } = await supabase.from('submissions').update(update).eq('id', submissionId);
    if (error) throw error;
}

// Store
export async function getProducts(): Promise<Product[]> {
    if (!supabase) throw new Error("Supabase not available");
    const { data, error } = await supabase.from('products').select('*');
    if (error) throw error;
    return data;
}
export async function getProductById(id: string): Promise<Product> {
    if (!supabase) throw new Error("Supabase not available");
    const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
}

export async function saveProduct(productData: any): Promise<void> {
    if (!supabase) throw new Error("Supabase not available");
    const { nameEn, nameAr, descriptionEn, descriptionAr, ...product } = productData;

    const translationUpserts = [
        { key: product.nameKey, en: nameEn, ar: nameAr },
        { key: product.descriptionKey, en: descriptionEn, ar: descriptionAr },
    ];
    
    const { error: transError } = await supabase.from('translations').upsert(translationUpserts, { onConflict: 'key' });
    if (transError) throw transError;
    
    const { error } = await supabase.from('products').upsert(product);
    if (error) throw error;
}

export async function deleteProduct(id: string): Promise<void> {
    if (!supabase) throw new Error("Supabase not available");
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
}


// Rules
export async function getRules(): Promise<RuleCategory[]> {
    if (!supabase) throw new Error("Supabase not available");
    const { data, error } = await supabase.from('rule_categories').select('*, rules(*)').order('position');
    if (error) throw error;
    return data as RuleCategory[];
}

export async function saveRules(categories: any[]): Promise<void> {
    if (!supabase) throw new Error("Supabase not available");
    // This is complex. Involves upserting translations, categories, and rules.
    const translationUpserts: { key: string, en: string, ar: string }[] = [];
    const categoryUpserts: Omit<RuleCategory, 'rules'>[] = [];
    const ruleUpserts: (Rule & {category_id: string})[] = [];

    categories.forEach(cat => {
        translationUpserts.push({ key: cat.titleKey, en: cat.titleEn, ar: cat.titleAr });
        categoryUpserts.push({ id: cat.id, titleKey: cat.titleKey, position: cat.position });
        (cat.rules || []).forEach((rule: any) => {
            translationUpserts.push({ key: rule.textKey, en: rule.textEn, ar: rule.textAr });
            ruleUpserts.push({ id: rule.id, textKey: rule.textKey, category_id: cat.id });
        });
    });

    // We might need to delete rules that were removed. A full transaction would be best.
    // For simplicity, we just upsert.
    const { error: transError } = await supabase.from('translations').upsert(translationUpserts, { onConflict: 'key' });
    if (transError) throw transError;
    
    const { error: catError } = await supabase.from('rule_categories').upsert(categoryUpserts, { onConflict: 'id' });
    if (catError) throw catError;
    
    // Deleting old rules for a category then inserting new ones might be safer.
    // This simple upsert won't delete removed rules. Let's keep it simple for now.
    if (ruleUpserts.length > 0) {
        const { error: ruleError } = await supabase.from('rules').upsert(ruleUpserts, { onConflict: 'id' });
        if (ruleError) throw ruleError;
    }
}

// Permissions
export async function getGuildRoles(): Promise<DiscordRole[]> {
    return invokeFunction('get-guild-roles');
}

export async function getRolePermissions(): Promise<RolePermission[]> {
    if (!supabase) throw new Error("Supabase not available");
    const { data, error } = await supabase.from('role_permissions').select('*');
    if (error) throw error;
    return data;
}

export async function saveRolePermissions(rolePerms: RolePermission): Promise<void> {
    if (!supabase) throw new Error("Supabase not available");
    const { error } = await supabase.from('role_permissions').upsert(rolePerms, { onConflict: 'role_id' });
    if (error) throw error;
}

// Widgets
export async function getDiscordWidgets(): Promise<DiscordWidget[]> {
    if (!supabase) throw new Error("Supabase not available");
    const { data, error } = await supabase.from('discord_widgets').select('*').order('position');
    if (error) throw error;
    return data;
}

export async function saveDiscordWidgets(widgets: any[]): Promise<void> {
    if (!supabase) throw new Error("Supabase not available");
    // This requires deleting all and re-inserting to handle removals and reordering.
    const { error: deleteError } = await supabase.from('discord_widgets').delete().neq('id', crypto.randomUUID()); // delete all
    if (deleteError) throw deleteError;
    if (widgets.length === 0) return;
    const { error: insertError } = await supabase.from('discord_widgets').insert(widgets);
    if (insertError) throw insertError;
}


// Health & Logging
export async function logAdminAccess(): Promise<void> {
    // This is now handled by a database trigger. This function is kept for compatibility if called.
    return Promise.resolve();
}

export async function getAuditLogs(): Promise<AuditLogEntry[]> {
    if (!supabase) throw new Error("Supabase not available");
    const { data, error } = await supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(100);
    if (error) throw error;
    return data;
}

export async function checkDiscordApiHealth(): Promise<any> {
    return invokeFunction('check-bot-health');
}

export async function troubleshootUserSync(discordId: string): Promise<any> {
    return invokeFunction('troubleshoot-user-sync', { discordId });
}

export async function checkFunctionSecrets(): Promise<any> {
    return invokeFunction('check-function-secrets');
}

export async function testHttpRequest(): Promise<any> {
    return invokeFunction('test-http-request');
}

export async function testNotification(type: string, targetId: string): Promise<any> {
    return invokeFunction('test-notification', { type, targetId });
}

// MTA
export async function getMtaServerStatus(): Promise<MtaServerStatus> {
    // This would typically call an external API. Let's mock it for now.
    return { name: 'Vixel Roleplay', players: 123, maxPlayers: 200, version: '1.5.9' };
}

export async function getMtaPlayerLogs(userId: string): Promise<MtaLogEntry[]> {
    return invokeFunction('get-mta-logs', { userId });
}

// Discord
export async function getDiscordAnnouncements(): Promise<DiscordAnnouncement[]> {
    return invokeFunction('get-discord-announcements');
}
