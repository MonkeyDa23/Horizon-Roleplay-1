// src/components/admin/NotificationsPanel.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useToast } from '../../hooks/useToast';
import { getTranslations, saveTranslations, testNotification } from '../../lib/api';
import type { Translations } from '../../types';
import { Loader2, Bell, HelpCircle } from 'lucide-react';
import Modal from '../Modal';

const notificationTemplates = {
    submissionUser: {
        title: 'Submission DMs (to User)',
        description: 'Sent as a DM to the user when their application status changes.',
        messages: [
            { type: 'submission_receipt', title: 'Submission Received', placeholders: ['{username}', '{quizTitle}'] },
            { type: 'submission_taken', title: 'Submission Under Review', placeholders: ['{username}', '{quizTitle}', '{adminUsername}'] },
            { type: 'submission_accepted', title: 'Submission Accepted', placeholders: ['{username}', '{quizTitle}', '{adminUsername}'] },
            { type: 'submission_refused', title: 'Submission Refused', placeholders: ['{username}', '{quizTitle}', '{adminUsername}'] }
        ]
    },
};

const NotificationsPanel: React.FC = () => {
    const { t } = useLocalization();
    const { showToast } = useToast();
    const [allTranslations, setAllTranslations] = useState<Translations>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [testModal, setTestModal] = useState<{ type: string, isUser: boolean } | null>(null);
    const [testTargetId, setTestTargetId] = useState('');
    const [isTesting, setIsTesting] = useState(false);

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
            await saveTranslations(allTranslations);
            showToast('Notifications saved successfully!', 'success');
        } catch (error) {
            showToast((error as Error).message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSendTest = async () => {
        if (!testModal || !testTargetId) return;
        setIsTesting(true);
        try {
            await testNotification(testModal.type, testTargetId);
            showToast('Test notification sent!', 'success');
            setTestModal(null);
            setTestTargetId('');
        } catch (err) {
            showToast(`Error: ${(err as Error).message}`, 'error');
        } finally {
            setIsTesting(false);
        }
    };

    const handleTranslationChange = (key: string, lang: 'en' | 'ar', value: string) => {
        setAllTranslations(prev => ({
            ...prev,
            [key]: { ...(prev[key] || { en: '', ar: '' }), [lang]: value }
        }));
    };

    if (isLoading) {
        return <div className="flex justify-center items-center py-20"><Loader2 size={40} className="text-brand-cyan animate-spin" /></div>;
    }

    const MessageEditor: React.FC<{ type: string; title: string; placeholders: string[] }> = ({ type, title, placeholders }) => {
        const titleKey = `notification_${type}_title`;
        const bodyKey = `notification_${type}_body`;
        const isUserTarget = true; // All notifications in this panel are DMs now

        return (
            <div className="bg-brand-dark p-4 rounded-lg border border-gray-700">
                <div className="flex justify-between items-center mb-3">
                    <h4 className="text-lg font-bold text-white">{title}</h4>
                    <button onClick={() => setTestModal({ type, isUser: isUserTarget })} className="text-sm bg-blue-500/80 text-white font-bold py-1 px-3 rounded-md hover:bg-blue-500">{t('test')}</button>
                </div>
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-semibold text-gray-400">{t('title_en')}</label>
                        <input type="text" value={allTranslations[titleKey]?.en || ''} onChange={e => handleTranslationChange(titleKey, 'en', e.target.value)} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" />
                    </div>
                     <div>
                        <label className="block text-sm font-semibold text-gray-400">{t('title_ar')}</label>
                        <input type="text" dir="rtl" value={allTranslations[titleKey]?.ar || ''} onChange={e => handleTranslationChange(titleKey, 'ar', e.target.value)} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" />
                    </div>
                     <div>
                        <label className="block text-sm font-semibold text-gray-400">{t('description_en')}</label>
                        <textarea value={allTranslations[bodyKey]?.en || ''} onChange={e => handleTranslationChange(bodyKey, 'en', e.target.value)} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600 h-24" />
                    </div>
                     <div>
                        <label className="block text-sm font-semibold text-gray-400">{t('description_ar')}</label>
                        <textarea dir="rtl" value={allTranslations[bodyKey]?.ar || ''} onChange={e => handleTranslationChange(bodyKey, 'ar', e.target.value)} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600 h-24" />
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
                {Object.values(notificationTemplates).map(group => (
                    <div key={group.title} className="bg-brand-dark-blue p-6 rounded-lg border border-brand-light-blue/50">
                        <h3 className="text-2xl font-bold text-brand-cyan mb-1">{group.title}</h3>
                        <p className="text-gray-400 mb-4">{group.description}</p>
                        <div className="space-y-4">
                            {group.messages.map(msg => <MessageEditor key={msg.type} {...msg} />)}
                        </div>
                    </div>
                ))}
            </div>

            {testModal && (
                <Modal isOpen={!!testModal} onClose={() => setTestModal(null)} title={t('test_notification')}>
                    <div className="space-y-4">
                         <div>
                            <label className="block font-semibold mb-1">{t('target_id')}</label>
                            <input type="text" value={testTargetId} onChange={e => setTestTargetId(e.target.value)} placeholder={testModal.isUser ? "Enter User ID" : "Enter Channel ID"} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" />
                        </div>
                        <div className="flex justify-end gap-4 pt-4 border-t border-brand-light-blue/50 mt-4">
                            <button onClick={() => setTestModal(null)} className="bg-gray-600 text-white font-bold py-2 px-6 rounded-md hover:bg-gray-500">Cancel</button>
                            <button onClick={handleSendTest} disabled={isTesting || !testTargetId} className="bg-blue-600 text-white font-bold py-2 px-6 rounded-md hover:bg-blue-500 disabled:opacity-50 min-w-[8rem] flex justify-center">
                                {isTesting ? <Loader2 className="animate-spin" /> : t('send_test')}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default NotificationsPanel;