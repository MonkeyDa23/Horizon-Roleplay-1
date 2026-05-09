/**
 * Nova Roleplay - Official Website
 * Admin Notifications & Discord IDs Panel
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useLocalization } from '../../contexts/LocalizationContext';
import { useToast } from '../../contexts/ToastContext';
import { getTranslations, saveTranslations, testNotification, saveConfig, sendDiscordLog } from '../../lib/api';
import { useConfig } from '../../contexts/ConfigContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { usePersistentState } from '../../hooks/usePersistentState';
import type { Translations, AppConfig } from '../../types';
import { Loader2, HelpCircle, Send, AlertCircle, BellRing, Save, Hash, Users, MessageSquare, Terminal, RefreshCw, Smartphone } from 'lucide-react';

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
    { key: 'finance', label: 'السجل المالي', desc: 'يُرسل إلى قناة المالية عند إضافة رصيد أو فاتورة.', targetType: 'channel', configKey: 'log_channel_finance' },
    { key: 'store', label: 'سجل المتجر', desc: 'يُرسل إلى قناة المتجر عند شراء عضو لمنتج.', targetType: 'channel', configKey: 'log_channel_store' },
];

const NotificationsPanel: React.FC = () => {
    const { t, language, dir } = useLocalization();
    const isArabic = language === 'ar';
    const { showToast } = useToast();
    const { config, configLoading, refreshConfig, branding } = useConfig();
    const { user } = useAuth();
    
    const [allTranslations, setAllTranslations] = usePersistentState<Translations>('vixel_admin_notifs_trans_draft', {});
    const [settings, setSettings] = usePersistentState<Partial<AppConfig>>('vixel_admin_notifs_settings_draft', {});
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!configLoading && Object.keys(settings).length === 0) {
            setSettings(config);
        }
    }, [config, configLoading, setSettings, settings]);

    const fetchTranslations = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getTranslations();
            setAllTranslations(prev => Object.keys(prev).length > 0 ? prev : data);
        } catch (error) {
            showToast('Failed to load notification templates.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showToast, setAllTranslations]);

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
            
            localStorage.removeItem('vixel_admin_notifs_trans_draft');
            localStorage.removeItem('vixel_admin_notifs_settings_draft');
            
            await refreshConfig();
            showToast('تم حفظ إعدادات الإشعارات بنجاح!', 'success');

            const action = `Admin ${user.username} updated Notification Settings.`;
            supabase.rpc('log_admin_action', { p_action: action, p_log_type: 'admin' });

            const embed = {
                title: t('log_settings_updated_title'),
                description: t('log_notifications_updated_desc', { adminUsername: user.username }),
                color: 0x5865F2,
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
        
        const configuredChannelId = configKey ? (settings as any)[configKey] as string | null : null;

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
            <div className="bg-white/5 p-6 rounded-[32px] border border-white/5 space-y-4 hover:border-white/10 transition-all shadow-xl group">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h4 className="font-black text-white text-lg uppercase tracking-tight">{label}</h4>
                    <p className="text-[10px] text-text-secondary font-black opacity-40 uppercase tracking-widest">{desc}</p>
                  </div>
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-white/20 group-hover:text-white/40 transition-colors">
                    {targetType === 'channel' ? <Hash size={24} /> : <Users size={24} />}
                  </div>
                </div>

                {configuredChannelId && (
                  <div className="bg-black/20 px-4 py-2 rounded-xl flex items-center gap-3">
                    <Terminal size={14} className="text-brand-cyan opacity-40" />
                    <code className="text-xs font-mono text-text-secondary opacity-60 truncate">Active ID: {configuredChannelId}</code>
                  </div>
                )}
                
                <div className="flex gap-3">
                    <input 
                        type="text" 
                        value={targetId}
                        onChange={e => setTargetId(e.currentTarget.value)}
                        placeholder={configuredChannelId || `${t('target_id')}...`}
                        className="flex-grow bg-white/5 border border-white/10 rounded-2xl py-3 px-5 text-sm font-mono text-white focus:outline-none focus:border-white/20 transition-all shadow-inner"
                    />
                    <button 
                        onClick={handleSendTest} 
                        disabled={isTesting} 
                        className="bg-white/5 text-white border border-white/10 font-bold p-3 rounded-2xl hover:bg-white/10 hover:border-white/20 w-16 flex justify-center items-center transition-all active:scale-95 disabled:opacity-30"
                    >
                        {isTesting ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} className={isArabic ? 'rotate-180' : ''} />}
                    </button>
                </div>
            </div>
        );
    };

    const IdField = ({ labelKey, descKey, value, onChange, icon: Icon }: { labelKey: string, descKey: string, value: string | null | undefined, onChange: (val: string) => void, icon: any }) => (
        <div className="space-y-4 group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-text-secondary group-hover:text-brand-cyan transition-colors">
                <Icon size={20} />
              </div>
              <div>
                <label className="block text-sm font-black text-white uppercase tracking-tight">{t(labelKey)}</label>
                <p className="text-[10px] text-text-secondary font-black opacity-30 uppercase tracking-widening">{t(descKey)}</p>
              </div>
            </div>
            <input 
              type="text" 
              value={value || ''} 
              onChange={(e) => onChange(e.currentTarget.value)} 
              placeholder="81234567890..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 font-mono text-sm text-white focus:outline-none focus:border-white/20 transition-all shadow-inner" 
            />
        </div>
    );

    if (isLoading || configLoading) {
        return <div className="flex justify-center items-center py-20"><Loader2 size={64} className="animate-spin opacity-20" style={{ color: branding.primaryColor }} /></div>;
    }
    
    return (
        <div className="space-y-10 animate-fade-in-up md:px-4" dir={dir}>
            {/* Header / Save Action */}
            <div className="bg-white/[0.02] border border-white/5 p-8 rounded-[40px] flex flex-col md:flex-row gap-8 items-center justify-between shadow-2xl backdrop-blur-xl">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-3xl flex items-center justify-center border border-blue-500/10 shadow-inner">
                        <BellRing className="text-blue-500" size={32} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-white">Notifications</h2>
                        <div className="text-text-secondary text-[10px] uppercase font-black tracking-widest mt-1 opacity-40">System Alerts & Discord Webhooks</div>
                    </div>
                </div>

                <div className="flex gap-4">
                  <button 
                      onClick={fetchTranslations} 
                      className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl text-text-secondary transition-all active:scale-95 border border-white/5"
                  >
                      <RefreshCw size={28} className={isLoading ? 'animate-spin' : ''} />
                  </button>
                  <button 
                      onClick={handleSave} 
                      disabled={isSaving} 
                      style={{ backgroundColor: branding.primaryColor }}
                      className="text-brand-dark font-black py-4 px-10 rounded-2xl hover:scale-105 transition-all shadow-xl min-w-[12rem] flex justify-center disabled:opacity-30 disabled:grayscale active:scale-95"
                  >
                      {isSaving ? <Loader2 className="animate-spin" size={28} /> : (
                        <div className="flex items-center gap-3">
                          <Save size={28} />
                          {t('save_settings')}
                        </div>
                      )}
                  </button>
                </div>
            </div>

            {/* Warning Area */}
            <div className="bg-blue-500/5 border border-blue-500/10 p-6 rounded-3xl flex items-center gap-4 text-blue-200">
                <AlertCircle className="flex-shrink-0" size={24} />
                <p className="text-sm font-black opacity-80">{t('notifs_draft_hint') || 'القوالب والإعدادات تحفظ كمسودة حتى الضغط على زر الحفظ النهائي.'}</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
                {/* Templates Area */}
                <div className="xl:col-span-12 2xl:col-span-8 space-y-10">
                    {/* Message Templates */}
                    {Object.values(notificationTemplates).map(group => (
                        <div key={group.title} className="bg-white/[0.02] p-10 rounded-[48px] border border-white/5 shadow-2xl space-y-10">
                            <h3 className="text-3xl font-black text-white flex items-center gap-4 uppercase tracking-tight">
                              <MessageSquare size={32} style={{ color: branding.primaryColor }} />
                              {t(group.title)}
                            </h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {group.messages.map(msg => (
                                    <div key={msg.type} className="bg-white/[0.03] p-8 rounded-[40px] border border-white/5 hover:border-white/10 transition-all shadow-xl space-y-6">
                                        <div className="flex justify-between items-start gap-4 mb-2">
                                          <h4 className="font-black text-white text-xl uppercase tracking-tight leading-none">{msg.title}</h4>
                                          <div className="p-2 bg-white/5 rounded-xl text-text-secondary">
                                            <Smartphone size={20} />
                                          </div>
                                        </div>

                                        <div className="p-4 bg-black/20 rounded-2xl border border-white/5 text-[10px] text-text-secondary font-mono leading-relaxed opacity-60">
                                            <span className="font-black text-brand-cyan opacity-100 mr-2 uppercase tracking-widest">{t('tokens')}:</span>
                                            {msg.placeholders.join(' ')}
                                        </div>

                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                              <p className="text-[10px] font-black text-text-secondary uppercase opacity-30 tracking-widest px-2">Arabic Title</p>
                                              <input
                                                  type="text"
                                                  value={allTranslations[`notification_${msg.type}_title`]?.ar || ''}
                                                  onChange={(e) => handleTranslationChange(`notification_${msg.type}_title`, 'ar', e.target.value)}
                                                  placeholder="العنوان (بالعربية)"
                                                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-5 text-sm text-white focus:outline-none focus:border-white/20 transition-all shadow-inner text-right font-arabic"
                                                  dir="rtl"
                                              />
                                            </div>
                                            <div className="space-y-2">
                                              <p className="text-[10px] font-black text-text-secondary uppercase opacity-30 tracking-widest px-2">Arabic Body</p>
                                              <textarea
                                                  value={allTranslations[`notification_${msg.type}_body`]?.ar || ''}
                                                  onChange={(e) => handleTranslationChange(`notification_${msg.type}_body`, 'ar', e.target.value)}
                                                  placeholder="محتوى الرسالة..."
                                                  rows={4}
                                                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm text-white focus:outline-none focus:border-white/20 transition-all shadow-inner text-right font-arabic resize-none"
                                                  dir="rtl"
                                              />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    
                    {/* Testing Section */}
                    <div className="bg-white/[0.02] p-10 rounded-[48px] border border-white/5 shadow-2xl space-y-8">
                        <h3 className="text-3xl font-black text-white flex items-center gap-4 uppercase tracking-tight">
                          <Terminal size={32} style={{ color: branding.primaryColor }} />
                          {t('test_notifications')}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {notificationTests.map(item => <TestItem key={item.key} {...item} />)}
                        </div>
                    </div>
                </div>

                {/* IDs Area */}
                <div className="xl:col-span-12 2xl:col-span-4 space-y-10">
                    <div className="bg-white/[0.02] p-10 rounded-[48px] border border-white/5 shadow-2xl space-y-10 backdrop-blur-3xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 blur-[100px] opacity-10 rounded-full" style={{ backgroundColor: branding.primaryColor }}></div>
                        
                        <h3 className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-4">
                          <Hash size={32} style={{ color: branding.primaryColor }} />
                          Discord Channels
                        </h3>
                        
                        <div className="bg-blue-500/5 p-6 rounded-3xl border border-blue-500/10 flex items-start gap-4">
                            <HelpCircle size={28} className="text-blue-400 mt-1 flex-shrink-0 opacity-40" />
                            <p className="text-xs text-blue-200/60 font-black leading-relaxed">{t('channel_id_desc') || 'أدخل معرفات القنوات (Channel IDs) ليتمكن البوت من إرسال السجلات والإشعارات إليها.'}</p>
                        </div>

                        <div className="space-y-8">
                            <IdField labelKey="submissions_channel" descKey="submissions_channel_id_desc" value={settings.submissions_channel_id} onChange={e => handleConfigChange('submissions_channel_id', e)} icon={MessageSquare} />
                            <IdField labelKey="finance_logs" descKey="log_channel_finance_desc" value={settings.log_channel_finance} onChange={e => handleConfigChange('log_channel_finance', e)} icon={Hash} />
                            <IdField labelKey="store_logs" descKey="log_channel_store_desc" value={settings.log_channel_store} onChange={e => handleConfigChange('log_channel_store', e)} icon={Hash} />
                            <IdField labelKey="ban_logs" descKey="log_channel_bans_desc" value={settings.log_channel_bans} onChange={e => handleConfigChange('log_channel_bans', e)} icon={Hash} />
                            <IdField labelKey="admin_logs" descKey="log_channel_admin_desc" value={settings.log_channel_admin} onChange={e => handleConfigChange('log_channel_admin', e)} icon={Hash} />
                            <IdField labelKey="auth_logs" descKey="log_channel_auth_desc" value={settings.log_channel_auth} onChange={e => handleConfigChange('log_channel_auth', e)} icon={Hash} />
                            
                            <div className="pt-10 border-t border-white/5 space-y-10">
                                <h4 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-4">
                                  <Users size={32} style={{ color: branding.primaryColor }} />
                                  Mention Roles
                                </h4>
                                <div className="space-y-8">
                                    <IdField labelKey="mention_submissions" descKey="mention_role_submissions_desc" value={settings.mention_role_submissions} onChange={e => handleConfigChange('mention_role_submissions', e)} icon={Users} />
                                    <IdField labelKey="mention_finance" descKey="mention_role_finance_desc" value={settings.mention_role_finance} onChange={e => handleConfigChange('mention_role_finance', e)} icon={Users} />
                                    <IdField labelKey="mention_store" descKey="mention_role_store_desc" value={settings.mention_role_store} onChange={e => handleConfigChange('mention_role_store', e)} icon={Users} />
                                    <IdField labelKey="mention_bans" descKey="mention_role_audit_log_bans_desc" value={settings.mention_role_audit_log_bans} onChange={e => handleConfigChange('mention_role_audit_log_bans', e)} icon={Users} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotificationsPanel;
