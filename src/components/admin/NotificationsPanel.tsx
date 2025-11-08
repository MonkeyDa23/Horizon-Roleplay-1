// src/components/admin/NotificationsPanel.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useToast } from '../../hooks/useToast';
import { getTranslations, saveTranslations, testNotification, saveConfig } from '../../lib/api';
import { useConfig } from '../../hooks/useConfig';
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
    const { t } = useLocalization();
    const { showToast } = useToast();
    const { config, configLoading, refreshConfig } = useConfig();
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
        setIsSaving(true);
        try {
            await Promise.all([
                saveTranslations(allTranslations),
                saveConfig(settings)
            ]);
            await refreshConfig();
            showToast('تم حفظ إعدادات الإشعارات بنجاح!', 'success');
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
                        onChange={e => setTargetId(e.target.value)}
                        placeholder={configuredChannelId || `${t('target_id')}...`}
                        className="w-full bg-brand-light-blue p-2 rounded border border-gray-600 font-mono text-sm"
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
            <input type="text" value={value || ''} onChange={e => onChange(e.currentTarget.value)} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600 font-mono text-sm"/>
        </div>
    );

    const MessageEditor: React.FC<{ type: string; title: string; placeholders: string[] }> = ({ type, title, placeholders }) => {
        const titleKey = `notification_${type}_title`;
        const bodyKey = `notification_${type}_body`;

        return (
            <div className="bg-brand-dark p-4 rounded-lg border border-gray-700">
                <h4 className="text-lg font-bold text-white mb-3">{title}</h4>
                <div className="space-y-3">
                     <div>
                        <label className="block text-sm font-semibold text-gray-400">{t('title_ar')}</label>
                        <input type="text" dir="rtl" value={allTranslations[titleKey]?.ar || ''} onChange={e => handleTranslationChange(titleKey, 'ar', e.currentTarget.value)} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" />
                    </div>
                     <div>
                        <label className="block text-sm font-semibold text-gray-400">{t('description_ar')}</label>
                        <textarea dir="rtl" value={allTranslations[bodyKey]?.ar || ''} onChange={e => handleTranslationChange(bodyKey, 'ar', e.currentTarget.value)} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600 h-24" />
                    </div>
                </div>
                <div className="mt-3 p-2 bg-brand-dark rounded-md">
                    <p className="text-xs font-semibold text-gray-400 flex items-center gap-1"><HelpCircle size={14}/> {t('available_placeholders')}:</p>
                    <div className="flex flex-wrap gap-x-2 gap-y-1 mt-1">
                        {placeholders.map(p => <code key={p} className="text-xs text-brand-cyan bg-brand-light-blue px-1 rounded">{p}</code>)}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="animate-fade-in-up">
            <div className="flex justify-between items-center mb-6">
                <p className="text-gray-400">{t('notifications_desc')}</p>
                <button onClick={handleSave} disabled={isSaving} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white transition-colors min-w-[9rem] flex justify-center">
                    {isSaving ? <Loader2 className="animate-spin" /> : t('save_settings')}
                </button>
            </div>
            
            <div className="space-y-8">

                 <div className="bg-brand-dark-blue p-6 rounded-lg border border-brand-light-blue/50">
                    <h3 className="text-2xl font-bold text-brand-cyan mb-2">اختبار توصيل الإشعارات</h3>
                    <p className="text-gray-400 mb-6">استخدم هذه الأداة لإرسال رسائل اختبار إلى قنواتك المحددة أو إلى مستخدم معين للتأكد من أن الإشعارات تصل بشكل صحيح.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {notificationTests.map(test => <TestItem key={test.key} {...test} />)}
                    </div>
                </div>
                
                {Object.values(notificationTemplates).map(group => (
                    <div key={group.title} className="bg-brand-dark-blue p-6 rounded-lg border border-brand-light-blue/50">
                        <h3 className="text-2xl font-bold text-brand-cyan mb-1">{t(group.title)}</h3>
                        <p className="text-gray-400 mb-4">{group.description}</p>
                        <div className="space-y-4">
                            {group.messages.map(msg => <MessageEditor key={msg.type} {...msg} />)}
                        </div>
                    </div>
                ))}
                
                <div className="bg-brand-dark-blue p-6 rounded-lg border border-brand-light-blue/50">
                    <h3 className="text-2xl font-bold text-brand-cyan mb-4">إعدادات القنوات والرتب</h3>
                    <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/30 mb-6">
                        <p className="text-sm text-blue-200 mt-1">{t('channel_id_desc')}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                             <IdField labelKey="submissions_channel_id" descKey="submissions_channel_id_desc" value={settings.submissions_channel_id} onChange={v => handleConfigChange('submissions_channel_id', v)} />
                             <IdField labelKey="log_channel_submissions" descKey="log_channel_submissions_desc" value={settings.log_channel_submissions} onChange={v => handleConfigChange('log_channel_submissions', v)} />
                             <IdField labelKey="log_channel_bans" descKey="log_channel_bans_desc" value={settings.log_channel_bans} onChange={v => handleConfigChange('log_channel_bans', v)} />
                             <IdField labelKey="log_channel_admin" descKey="log_channel_admin_desc" value={settings.log_channel_admin} onChange={v => handleConfigChange('log_channel_admin', v)} />
                             <IdField labelKey="audit_log_channel_id" descKey="audit_log_channel_id_desc" value={settings.audit_log_channel_id} onChange={v => handleConfigChange('audit_log_channel_id', v)} />
                        </div>
                        <div className="space-y-6">
                             <IdField labelKey="mention_role_submissions" descKey="mention_role_submissions_desc" value={settings.mention_role_submissions} onChange={v => handleConfigChange('mention_role_submissions', v)} />
                             <IdField labelKey="mention_role_audit_log_submissions" descKey="mention_role_audit_log_submissions_desc" value={settings.mention_role_audit_log_submissions} onChange={v => handleConfigChange('mention_role_audit_log_submissions', v)} />
                             <IdField labelKey="mention_role_audit_log_bans" descKey="mention_role_audit_log_bans_desc" value={settings.mention_role_audit_log_bans} onChange={v => handleConfigChange('mention_role_audit_log_bans', v)} />
                             <IdField labelKey="mention_role_audit_log_admin" descKey="mention_role_audit_log_admin_desc" value={settings.mention_role_audit_log_admin} onChange={v => handleConfigChange('mention_role_audit_log_admin', v)} />
                             <IdField labelKey="mention_role_audit_log_general" descKey="mention_role_audit_log_general_desc" value={settings.mention_role_audit_log_general} onChange={v => handleConfigChange('mention_role_audit_log_general', v)} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotificationsPanel;