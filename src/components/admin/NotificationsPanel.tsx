// src/components/admin/NotificationsPanel.tsx
import React, { useState, useEffect } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useToast } from '../../hooks/useToast';
import { useConfig } from '../../hooks/useConfig';
import { saveConfig, testChannelWebhook, testDm } from '../../lib/api';
import { Loader2 } from 'lucide-react';
import Modal from '../Modal';

const NotificationsPanel: React.FC = () => {
    const { t } = useLocalization();
    const { showToast } = useToast();
    const { config, configLoading, refreshConfig } = useConfig();
    const [settings, setSettings] = useState({
        SUBMISSION_WEBHOOK_URL: '',
        AUDIT_LOG_WEBHOOK_URL: ''
    });
    const [isSaving, setIsSaving] = useState(false);
    const [isDmTestModalOpen, setDmTestModalOpen] = useState(false);
    const [testTargetId, setTestTargetId] = useState('');
    const [isTesting, setIsTesting] = useState(false);

    useEffect(() => {
        if (!configLoading) {
            setSettings({
                SUBMISSION_WEBHOOK_URL: config.SUBMISSION_WEBHOOK_URL || '',
                AUDIT_LOG_WEBHOOK_URL: config.AUDIT_LOG_WEBHOOK_URL || '',
            });
        }
    }, [config, configLoading]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await saveConfig(settings);
            await refreshConfig();
            showToast('Notification settings saved!', 'success');
        } catch (error) {
            showToast((error as Error).message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSendDmTest = async () => {
        if (!testTargetId) return;
        setIsTesting(true);
        try {
            await testDm(testTargetId);
            showToast('Test DM sent!', 'success');
            setDmTestModalOpen(false);
            setTestTargetId('');
        } catch (err) {
            showToast(`Error: ${(err as Error).message}`, 'error');
        } finally {
            setIsTesting(false);
        }
    };

    const handleSendWebhookTest = async (type: 'submission' | 'audit') => {
        setIsTesting(true);
        try {
            await testChannelWebhook(type);
            showToast(`Test ${type} webhook sent!`, 'success');
        } catch(err) {
             showToast(`Error: ${(err as Error).message}`, 'error');
        } finally {
            setIsTesting(false);
        }
    }
    
    if (configLoading) {
        return <div className="flex justify-center items-center py-20"><Loader2 size={40} className="text-brand-cyan animate-spin" /></div>;
    }

    const InputField = ({ labelKey, descKey, value, onChange, placeholder }: { labelKey: string, descKey: string, value: string | null, onChange: (val: string) => void, placeholder?: string }) => (
        <div>
            <label className="block text-lg font-semibold text-white mb-1">{t(labelKey)}</label>
            <p className="text-sm text-gray-400 mb-2">{t(descKey)}</p>
            <input 
                type="text"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-brand-light-blue p-2 rounded border border-gray-600 focus:ring-brand-cyan focus:border-brand-cyan"
            />
        </div>
    );

    return (
        <div className="animate-fade-in-up">
             <div className="flex justify-end items-center mb-6">
                 <button onClick={handleSave} disabled={isSaving} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white transition-colors min-w-[9rem] flex justify-center">
                    {isSaving ? <Loader2 className="animate-spin" /> : t('save_settings')}
                </button>
            </div>
            <div className="bg-brand-dark-blue p-8 rounded-lg border border-brand-light-blue/50 space-y-12">
                
                <div>
                    <h3 className="text-2xl font-bold text-brand-cyan border-b-2 border-brand-cyan/50 pb-2 mb-6">{t('webhook_notifications')}</h3>
                    <p className="text-gray-300 mb-6">{t('webhook_notifications_desc')}</p>
                    <div className="space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="flex-grow">
                                <InputField 
                                    labelKey="submission_webhook_url"
                                    descKey="submission_webhook_url_desc"
                                    value={settings.SUBMISSION_WEBHOOK_URL}
                                    onChange={val => setSettings(p => ({...p, SUBMISSION_WEBHOOK_URL: val}))}
                                    placeholder="https://discord.com/api/webhooks/..."
                                />
                            </div>
                            <button onClick={() => handleSendWebhookTest('submission')} disabled={isTesting} className="mt-12 bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-500 disabled:opacity-60 h-fit">
                                {isTesting ? <Loader2 className="animate-spin" /> : t('test')}
                            </button>
                        </div>
                         <div className="flex items-start gap-4">
                            <div className="flex-grow">
                                <InputField 
                                    labelKey="audit_log_webhook_url"
                                    descKey="audit_log_webhook_url_desc"
                                    value={settings.AUDIT_LOG_WEBHOOK_URL}
                                    onChange={val => setSettings(p => ({...p, AUDIT_LOG_WEBHOOK_URL: val}))}
                                    placeholder="https://discord.com/api/webhooks/..."
                                />
                            </div>
                            <button onClick={() => handleSendWebhookTest('audit')} disabled={isTesting} className="mt-12 bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-500 disabled:opacity-60 h-fit">
                                {isTesting ? <Loader2 className="animate-spin" /> : t('test')}
                            </button>
                        </div>
                    </div>
                </div>

                <div>
                    <h3 className="text-2xl font-bold text-brand-cyan border-b-2 border-brand-cyan/50 pb-2 mb-6">{t('bot_notifications')}</h3>
                    <p className="text-gray-300 mb-6">{t('bot_notifications_desc')}</p>
                     <button onClick={() => setDmTestModalOpen(true)} className="bg-blue-600 text-white font-bold py-2 px-6 rounded-md hover:bg-blue-500">
                        {t('send_test_dm')}
                    </button>
                </div>
            </div>

            <Modal isOpen={isDmTestModalOpen} onClose={() => setDmTestModalOpen(false)} title={t('test_dm_modal_title')}>
                <div className="space-y-4">
                    <div>
                        <label className="block font-semibold mb-1">{t('target_id')}</label>
                        <p className="text-sm text-gray-400 mb-2">{t('test_dm_modal_desc')}</p>
                        <input type="text" value={testTargetId} onChange={e => setTestTargetId(e.target.value)} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" />
                    </div>
                     <div className="flex justify-end gap-4 pt-4 border-t border-brand-light-blue/50 mt-4">
                        <button onClick={() => setDmTestModalOpen(false)} className="bg-gray-600 text-white font-bold py-2 px-6 rounded-md hover:bg-gray-500">{t('cancel')}</button>
                        <button onClick={handleSendDmTest} disabled={isTesting || !testTargetId} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white disabled:opacity-50 min-w-[8rem] flex justify-center">
                            {isTesting ? <Loader2 className="animate-spin"/> : t('send_test')}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default NotificationsPanel;