
// src/components/admin/NotificationsPanel.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useLocalization } from '../../contexts/LocalizationContext';
import { useToast } from '../../contexts/ToastContext';
import { getTranslations, saveTranslations, testNotification, saveConfig, sendDiscordLog } from '../../lib/api';
import { useConfig } from '../../contexts/ConfigContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import type { Translations, AppConfig } from '../../types';
import { Loader2, HelpCircle, Send } from 'lucide-react';

const notificationTemplates = {
    submissionUser: {
        title: 'notification_group_submission_user',
        description: 'تُرسل كرسالة خاصة للمستخدم عندما تتغير حالة تقديمه.',
        messages: [
            { type: 'submission_receipt', title: 'إيصال استلام التقديم', placeholders: ['{username}', '{quizTitle}'] },
            { type: 'submission_accepted', title: 'قبول التقديم', placeholders: ['{username}', '{quizTitle}', '{adminUsername}', '{reason}'] },
            { type: 'submission_refused', title: 'رفض التقديم', placeholders: ['{username}', '{quizTitle}', '{adminUsername}', '{reason}'] }
        ]
    },
};

const notificationTests: { key: string; label: string; desc: string; targetType: 'channel' | 'user', configKey?: keyof AppConfig }[] = [
    { key: 'new_submission', label: 'إشعار تقديم جديد', desc: 'يُرسل إلى قناة التقديمات الجديدة.', targetType: 'channel', configKey: 'submissions_channel_id' },
    { key: 'submission_result', label: 'رسالة نتيجة التقديم', desc: 'رسالة خاصة تُرسل للمستخدم عند قبول أو رفض تقديمه.', targetType: 'user' },
    { key: 'audit_log_submissions', label: 'سجل التقديمات', desc: 'يُرسل إلى قناة سجلات التقديمات عند تغيير حالة طلب.', targetType: 'channel', configKey: 'log_channel_submissions' },
    { key: 'audit_log_bans', label: 'سجل الحظر', desc: 'يُرسل إلى قناة سجلات الحظر عند حظر أو فك حظر مستخدم.', targetType: 'channel', configKey: 'log_channel_bans' },
    { key: 'audit_log_admin', label: 'سجل الإدارة', desc: 'يُرسل إلى قناة سجلات الإدارة عند تغيير الإعدادات.', targetType: 'channel', configKey: 'log_channel_admin' },
    { key: 'audit_log_general', label: 'السجل العام (الاحتياطي)', desc: 'يُرسل إلى قناة السجلات العامة الاحتياطية.', targetType: 'channel', configKey: 'audit_log_channel_id' },
];

const NotificationsPanel: React.FC = () => {
    const { t, language } = useLocalization();
    const { showToast } = useToast();
    const { config, configLoading, refreshConfig } = useConfig();
    const { user } = useAuth();
    const [allTranslations, setAllTranslations] = useState<Translations>({});
    const [settings, setSettings] = useState<Partial<AppConfig>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!configLoading) {
            setSettings(config);
        }
    }, [config, configLoading]);

    const fetchTranslations = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getTranslations();
            setAllTranslations(data);
        } catch (error) {
            showToast('Failed to load notification templates.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchTranslations();
    }, [fetchTranslations]);

    const handleSave = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            await Promise.all([
                saveTranslations(allTranslations),
                saveConfig(settings)
            ]);
            await refreshConfig();
            showToast('تم حفظ إعدادات الإشعارات بنجاح!', 'success');

            // Log action
            const action = `Admin ${user.username} updated Notification Settings.`;
            supabase.rpc('log_admin_action', { p_action: action, p_log_type: 'admin' });

            const embed = {
                title: t('log_settings_updated_title'),
                description: t('log_notifications_updated_desc', { adminUsername: user.username }),
                color: 0xFFA500, // Orange
                author: { name: user.username, icon_url: user.avatar },
                timestamp: new Date().toISOString()
            };
            sendDiscordLog(config, embed, 'admin', language);

        } catch (error) {
            showToast((error as Error).message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleTranslationChange = (key: string, lang: 'en' | 'ar', value: string) => {
        setAllTranslations(prev => ({
            ...prev,
            [key]: { ...(prev[key] || { en: '', ar: '' }), [lang]: value }
        }));
    };
    
    const handleConfigChange = (key: keyof AppConfig, value: string) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const TestItem: React.FC<(typeof notificationTests)[0]> = ({ key, label, desc, targetType, configKey }) => {
        const [targetId, setTargetId] = useState('');
        const [isTesting, setIsTesting] = useState(false);
        // FIX: Cast config value to string | null to satisfy types for placeholder and function arguments.
        const configuredChannelId = configKey ? settings[configKey] as string | null : null;

        const handleSendTest = async () => {
            const finalTargetId = targetId || configuredChannelId;
            if (!finalTargetId) {
                showToast('الرجاء إدخال معرف الهدف أو قم بتعيينه في الإعدادات أولاً.', 'warning');
                return;
            }
            setIsTesting(true);
            try {
                await testNotification(key, finalTargetId);
                showToast(`تم إرسال إشعار اختبار "${label}" بنجاح.`, 'success');
            } catch (err) {
                showToast(`فشل إرسال الاختبار: ${(err as Error).message}`, 'error');
            } finally {
                setIsTesting(false);
            }
        };

        return (
             <div className="bg-brand-dark p-4 rounded-lg border border-gray-700">
                <h4 className="font-bold text-white">{label}</h4>
                <p className="text-sm text-gray-400">{desc}</p>
                {configuredChannelId && <p className="text-xs text-gray-500 mt-1">القناة الحالية: <code className="font-mono">{configuredChannelId}</code></p>}
                <div className="flex gap-2 mt-2">
                    <input 
                        type="text" 
                        value={targetId}
                        // FIX: Use `e.currentTarget.value` for better React event handling.
                        onChange={e => setTargetId(e.currentTarget.value)}
                        placeholder={configuredChannelId || `${t('target_id')}...`}
                        className="vixel-input !p-2 font-mono !text-sm"
                    />
                    <button onClick={handleSendTest} disabled={isTesting} className="bg-blue-600 text-white font-bold p-2 rounded-md hover:bg-blue-500 w-28 flex justify-center items-center">
                        {isTesting ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                    </button>
                </div>
            </div>
        );
    };

    if (isLoading || configLoading) {
        return <div className="flex justify-center items-center py-20"><Loader2 size={40} className="text-brand-cyan animate-spin" /></div>;
    }
    
    const IdField = ({ labelKey, descKey, value, onChange }: { labelKey: string, descKey: string, value: string | null | undefined, onChange: (val: string) => void }) => (
        <div>
            <label className="block text-md font-semibold text-white mb-1">{t(labelKey)}</label>
            <p className="text-sm text-gray-400 mb-2">{t(descKey)}</p>
            <input type="text" value={value || ''} onChange={(e) => onChange(e.currentTarget.value)} className="vixel-input !p-2 font-mono !text-sm" />
        </div>
    );

    return (
        <div className="animate-fade-in-up">
            <div className="flex justify-between items-center mb-6">
                <p className="text-gray-400">{t('notifications_desc')}</p>
                <button onClick={handleSave} disabled={isSaving} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white transition-colors min-w-[9rem] flex justify-center">
                    {isSaving ? <Loader2 className="animate-spin" /> : t('save_settings')}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="lg:col-span-1 space-y-6">
                    {/* Message Templates */}
                    {Object.values(notificationTemplates).map(group => (
                        <div key={group.title} className="bg-brand-dark-blue p-6 rounded-lg border border-brand-light-blue/50">
                            <h3 className="text-2xl font-bold text-brand-cyan border-b-2 border-brand-cyan/50 pb-2 mb-4">{t(group.title)}</h3>
                            <div className="space-y-4">
                                {group.messages.map(msg => (
                                    <div key={msg.type}>
                                        <h4 className="font-semibold text-white text-lg">{msg.title}</h4>
                                        <div className="p-2 bg-brand-dark rounded text-xs text-gray-400 mb-2 font-mono">
                                            {t('available_placeholders')}: {msg.placeholders.join(' ')}
                                        </div>
                                        <input
                                            type="text"
                                            value={allTranslations[`notification_${msg.type}_title`]?.en || ''}
                                            onChange={(e) => handleTranslationChange(`notification_${msg.type}_title`, 'en', e.target.value)}
                                            placeholder="Title (English)"
                                            className="vixel-input !p-2 mb-2"
                                        />
                                        <textarea
                                            value={allTranslations[`notification_${msg.type}_body`]?.en || ''}
                                            onChange={(e) => handleTranslationChange(`notification_${msg.type}_body`, 'en', e.target.value)}
                                            placeholder="Body (English)"
                                            rows={3}
                                            className="vixel-input !p-2"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="lg:col-span-1 space-y-6">
                    {/* Channel & Role IDs */}
                    <div className="bg-brand-dark-blue p-6 rounded-lg border border-brand-light-blue/50">
                        <h3 className="text-2xl font-bold text-brand-cyan border-b-2 border-brand-cyan/50 pb-2 mb-4">Channel & Role IDs</h3>
                        <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/30 mb-4 flex items-start gap-3">
                            <HelpCircle size={20} className="text-blue-300 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-blue-200">{t('channel_id_desc')}</p>
                        </div>
                        <div className="space-y-4">
                            <IdField labelKey="submissions_channel_id" descKey="submissions_channel_id_desc" value={settings.submissions_channel_id} onChange={e => handleConfigChange('submissions_channel_id', e)} />
                            <IdField labelKey="log_channel_submissions" descKey="log_channel_submissions_desc" value={settings.log_channel_submissions} onChange={e => handleConfigChange('log_channel_submissions', e)} />
                            <IdField labelKey="log_channel_bans" descKey="log_channel_bans_desc" value={settings.log_channel_bans} onChange={e => handleConfigChange('log_channel_bans', e)} />
                            <IdField labelKey="log_channel_admin" descKey="log_channel_admin_desc" value={settings.log_channel_admin} onChange={e => handleConfigChange('log_channel_admin', e)} />
                            <IdField labelKey="log_channel_auth" descKey="log_channel_auth_desc" value={settings.log_channel_auth} onChange={e => handleConfigChange('log_channel_auth', e)} />
                            <IdField labelKey="audit_log_channel_id" descKey="audit_log_channel_id_desc" value={settings.audit_log_channel_id} onChange={e => handleConfigChange('audit_log_channel_id', e)} />
                            
                            <div className="border-t border-gray-700 pt-4 mt-4">
                                <h4 className="text-lg font-bold text-white mb-3">Mention Roles</h4>
                                <div className="space-y-4">
                                    <IdField labelKey="mention_role_submissions" descKey="mention_role_submissions_desc" value={settings.mention_role_submissions} onChange={e => handleConfigChange('mention_role_submissions', e)} />
                                    <IdField labelKey="mention_role_audit_log_submissions" descKey="mention_role_audit_log_submissions_desc" value={settings.mention_role_audit_log_submissions} onChange={e => handleConfigChange('mention_role_audit_log_submissions', e)} />
                                    <IdField labelKey="mention_role_audit_log_bans" descKey="mention_role_audit_log_bans_desc" value={settings.mention_role_audit_log_bans} onChange={e => handleConfigChange('mention_role_audit_log_bans', e)} />
                                    <IdField labelKey="mention_role_audit_log_admin" descKey="mention_role_audit_log_admin_desc" value={settings.mention_role_audit_log_admin} onChange={e => handleConfigChange('mention_role_audit_log_admin', e)} />
                                    <IdField labelKey="mention_role_auth" descKey="mention_role_auth_desc" value={settings.mention_role_auth} onChange={e => handleConfigChange('mention_role_auth', e)} />
                                    <IdField labelKey="mention_role_audit_log_general" descKey="mention_role_audit_log_general_desc" value={settings.mention_role_audit_log_general} onChange={e => handleConfigChange('mention_role_audit_log_general', e)} />
                                </div>
                            </div>
                        </div>
                    </div>
                     {/* Testing */}
                    <div className="bg-brand-dark-blue p-6 rounded-lg border border-brand-light-blue/50">
                        <h3 className="text-2xl font-bold text-brand-cyan border-b-2 border-brand-cyan/50 pb-2 mb-4">اختبار الإشعارات</h3>
                        <div className="space-y-3">
                            {notificationTests.map(item => <TestItem key={item.key} {...item} />)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotificationsPanel;
