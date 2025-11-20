// src/pages/SubmissionDetailPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLocalization } from '../contexts/LocalizationContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getSubmissionById, updateSubmissionStatus, checkDiscordApiHealth } from '../lib/api';
import type { QuizSubmission } from '../types';
import { Loader2, Check, X, ArrowLeft, User, Calendar, Shield, AlertTriangle, ListChecks } from 'lucide-react';
import SEO from '../components/SEO';
import Modal from '../components/Modal';
import { useConfig } from '../contexts/ConfigContext';

const SubmissionDetailPage: React.FC = () => {
    const { submissionId } = useParams<{ submissionId: string }>();
    const { t } = useLocalization();
    const { user, hasPermission } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const { config } = useConfig();
    
    const [submission, setSubmission] = useState<QuizSubmission | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [decisionReason, setDecisionReason] = useState('');
    const [notificationWarning, setNotificationWarning] = useState<{ status: 'accepted' | 'refused'; reason?: string } | null>(null);

    const fetchSubmission = useCallback(async () => {
        if (!submissionId) return;
        setIsLoading(true);
        try {
            const data = await getSubmissionById(submissionId);
            setSubmission(data);
            
            // If current user hasn't taken it and it's pending, auto-take it if they have permission
            // Optional feature: We can enable this later if requested.
            // if (data.status === 'pending') handleTakeOrder(data.id);

        } catch (error) {
            showToast('Failed to load submission.', 'error');
            navigate('/admin');
        } finally {
            setIsLoading(false);
        }
    }, [submissionId, navigate, showToast]);

    useEffect(() => {
        if (!user) return;
        if (!hasPermission('admin_submissions')) {
            navigate('/');
            return;
        }
        fetchSubmission();
    }, [fetchSubmission, user, hasPermission, navigate]);

    const proceedWithUpdate = async (status: 'accepted' | 'refused' | 'taken', reason?: string) => {
        if (!submission) return;
        setIsProcessing(true);
        try {
            const updatedSub = await updateSubmissionStatus(submission.id, status, reason);
            setSubmission(updatedSub);
            setNotificationWarning(null);
            showToast(`Submission ${status}!`, 'success');
            if (status !== 'taken') {
                navigate('/admin'); // Go back to list after decision
            }
        } catch (e) {
            showToast((e as Error).message, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDecision = async (status: 'accepted' | 'refused') => {
        try {
            // Best effort check for bot
            await checkDiscordApiHealth();
            await proceedWithUpdate(status, decisionReason);
        } catch (error) {
            // If bot check fails, warn the admin but allow proceeding
            setNotificationWarning({ status, reason: decisionReason });
        }
    };

    const handleTakeOrder = async () => {
        await proceedWithUpdate('taken');
    };

    if (isLoading) {
        return (
            <div className="flex flex-col gap-4 justify-center items-center h-screen w-full">
                <Loader2 size={48} className="text-brand-cyan animate-spin" />
                <p className="text-gray-400">{t('loading_submissions')}</p>
            </div>
        );
    }

    if (!submission) return null;

    return (
        <>
            <SEO title={`${t('submission_details')} - ${submission.username}`} noIndex={true} description="Review Application"/>
            
            <div className="min-h-screen bg-brand-dark pb-24">
                {/* Header / Sticky Bar */}
                <div className="sticky top-0 z-40 bg-brand-dark/90 backdrop-blur-md border-b border-brand-light-blue/30 py-4 px-6 shadow-lg">
                    <div className="container mx-auto max-w-5xl flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <Link to="/admin" className="text-gray-400 hover:text-white transition-colors">
                                <ArrowLeft size={24} />
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold text-white">{submission.username}</h1>
                                <p className="text-sm text-brand-cyan">{submission.quizTitle}</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                             {submission.status === 'pending' ? (
                                <button 
                                    onClick={handleTakeOrder}
                                    disabled={isProcessing}
                                    className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white transition-all disabled:opacity-50"
                                >
                                    {isProcessing ? <Loader2 className="animate-spin" /> : t('take_order')}
                                </button>
                            ) : (submission.status === 'taken') ? (
                                <span className="text-brand-cyan font-bold border border-brand-cyan px-4 py-2 rounded bg-brand-cyan/10">
                                    IN REVIEW
                                </span>
                            ) : (
                                <span className={`font-bold border px-4 py-2 rounded ${submission.status === 'accepted' ? 'text-green-400 border-green-500 bg-green-500/10' : 'text-red-400 border-red-500 bg-red-500/10'}`}>
                                    {submission.status.toUpperCase()}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="container mx-auto max-w-5xl px-6 py-8 space-y-8">
                    
                    {/* Applicant Info Card */}
                    <div className="glass-panel p-6 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                        <div className="flex gap-4 items-center">
                            <div className="w-16 h-16 rounded-full bg-brand-light-blue flex items-center justify-center">
                                <User size={32} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white">{submission.username}</h2>
                                <p className="text-gray-400 flex items-center gap-2"><Shield size={14}/> Role: {submission.user_highest_role || t('member')}</p>
                                <p className="text-gray-400 flex items-center gap-2"><Calendar size={14}/> Submitted: {new Date(submission.submittedAt).toLocaleString()}</p>
                            </div>
                        </div>
                        
                        {submission.cheatAttempts && submission.cheatAttempts.length > 0 ? (
                             <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg max-w-md w-full">
                                <h3 className="text-red-400 font-bold flex items-center gap-2 mb-2"><AlertTriangle size={18} /> {t('cheat_attempts_detected')}</h3>
                                <ul className="text-sm text-red-300 space-y-1 max-h-32 overflow-y-auto">
                                    {submission.cheatAttempts.map((attempt, i) => (
                                        <li key={i}>- {attempt.method} ({new Date(attempt.timestamp).toLocaleTimeString()})</li>
                                    ))}
                                </ul>
                            </div>
                        ) : (
                             <div className="bg-green-500/10 border border-green-500/30 p-3 rounded-lg flex items-center gap-2 text-green-400">
                                <ListChecks size={20} />
                                <span>{t('no_cheat_attempts')}</span>
                            </div>
                        )}
                    </div>

                    {/* Questions & Answers */}
                    <div className="space-y-6">
                        {submission.answers.map((item, index) => (
                            <div key={index} className="glass-panel p-6 animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                                <div className="flex justify-between items-start mb-3">
                                    <h3 className="text-lg font-bold text-brand-cyan">{index + 1}. {item.questionText}</h3>
                                    <span className="text-xs text-gray-500 font-mono whitespace-nowrap ml-2">Time: {item.timeTaken}s</span>
                                </div>
                                <div className="bg-brand-dark/50 p-4 rounded-md border border-gray-700/50">
                                    <p className="text-gray-200 whitespace-pre-wrap text-lg leading-relaxed">{item.answer}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Action Area (Only for Taken/Admin) */}
                    {(hasPermission('_super_admin') || (submission.status === 'taken' && submission.adminId === user?.id)) && (
                        <div className="glass-panel p-8 sticky bottom-6 border-t-4 border-brand-cyan shadow-2xl shadow-black/50">
                            <h3 className="text-xl font-bold text-white mb-4">Make Decision</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-gray-400 mb-2 font-semibold">{t('reason')} (Optional for User Notification)</label>
                                    <textarea 
                                        value={decisionReason}
                                        onChange={(e) => setDecisionReason(e.target.value)}
                                        placeholder="Write a reason for acceptance or refusal..."
                                        className="vixel-input min-h-[100px]"
                                    />
                                </div>
                                <div className="flex gap-4 pt-2">
                                    <button 
                                        onClick={() => handleDecision('refused')} 
                                        disabled={isProcessing}
                                        className="flex-1 bg-red-600/80 text-white font-bold py-4 px-6 rounded-lg hover:bg-red-600 transition-all flex justify-center items-center gap-2 text-lg"
                                    >
                                        {isProcessing ? <Loader2 className="animate-spin" /> : <><X size={24}/> {t('refuse')}</>}
                                    </button>
                                    <button 
                                        onClick={() => handleDecision('accepted')} 
                                        disabled={isProcessing}
                                        className="flex-1 bg-green-600/80 text-white font-bold py-4 px-6 rounded-lg hover:bg-green-600 transition-all flex justify-center items-center gap-2 text-lg"
                                    >
                                        {isProcessing ? <Loader2 className="animate-spin" /> : <><Check size={24}/> {t('accept')}</>}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            {notificationWarning && (
                <Modal isOpen={!!notificationWarning} onClose={() => setNotificationWarning(null)} title={t('notification_check_failed_title')}>
                     <div className="text-center">
                        <AlertTriangle className="mx-auto text-yellow-400" size={48} />
                        <p className="text-gray-300 mt-4 mb-6">{t('notification_check_failed_body')}</p>
                        <Link to="/health-check" className="text-brand-cyan underline hover:text-white mb-6 block">{t('go_to_health_check')}</Link>

                        <div className="flex justify-center gap-4">
                            <button onClick={() => setNotificationWarning(null)} className="bg-gray-600 text-white font-bold py-2 px-6 rounded-md hover:bg-gray-500">{t('cancel')}</button>
                            <button 
                                onClick={() => proceedWithUpdate(notificationWarning.status, notificationWarning.reason)}
                                className="bg-yellow-600 text-white font-bold py-2 px-6 rounded-md hover:bg-yellow-500"
                            >
                                {t('proceed_anyway')}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </>
    );
};

export default SubmissionDetailPage;