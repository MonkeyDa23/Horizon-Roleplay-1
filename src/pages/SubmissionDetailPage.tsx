
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
            
            // Optional: Auto-take if pending and user has permission?
            // Keeping it manual for now as per standard workflow.

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
            if (status === 'taken') {
                showToast('Order taken successfully.', 'success');
            } else {
                showToast(`Submission ${status}!`, 'success');
                navigate('/admin'); // Return to list after final decision
            }
        } catch (e) {
            showToast((e as Error).message, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDecision = async (status: 'accepted' | 'refused') => {
        try {
            // Best effort check for bot health before deciding
            await checkDiscordApiHealth();
            await proceedWithUpdate(status, decisionReason);
        } catch (error) {
            // If bot is down, warn the admin but allow proceeding (DB logging will still work)
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
            
            <div className="min-h-screen bg-brand-dark pb-24 relative">
                {/* Sticky Header */}
                <div className="sticky top-0 z-40 bg-brand-dark/90 backdrop-blur-md border-b border-brand-light-blue/30 py-4 px-6 shadow-lg">
                    <div className="container mx-auto max-w-6xl flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <Link to="/admin" className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full">
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
                                    className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isProcessing ? <Loader2 className="animate-spin" size={20}/> : t('take_order')}
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

                <div className="container mx-auto max-w-6xl px-6 py-8 space-y-8">
                    
                    {/* Applicant Info Card */}
                    <div className="glass-panel p-8 flex flex-col md:flex-row gap-8 justify-between items-start md:items-center">
                        <div className="flex gap-6 items-center">
                            <div className="w-20 h-20 rounded-full bg-brand-light-blue flex items-center justify-center border-2 border-brand-cyan/30">
                                <User size={40} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-bold text-white mb-2">{submission.username}</h2>
                                <div className="flex flex-wrap gap-4 text-sm">
                                    <p className="text-gray-400 flex items-center gap-2 bg-brand-dark/50 px-3 py-1 rounded-full"><Shield size={14}/> Role: {submission.user_highest_role || t('member')}</p>
                                    <p className="text-gray-400 flex items-center gap-2 bg-brand-dark/50 px-3 py-1 rounded-full"><Calendar size={14}/> Submitted: {new Date(submission.submittedAt).toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                        
                        {submission.cheatAttempts && submission.cheatAttempts.length > 0 ? (
                             <div className="bg-red-500/10 border border-red-500/30 p-5 rounded-lg max-w-md w-full">
                                <h3 className="text-red-400 font-bold flex items-center gap-2 mb-3 text-lg"><AlertTriangle size={20} /> {t('cheat_attempts_detected')}</h3>
                                <ul className="text-sm text-red-300 space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                                    {submission.cheatAttempts.map((attempt, i) => (
                                        <li key={i} className="flex justify-between border-b border-red-500/20 pb-1 last:border-0">
                                            <span>{attempt.method}</span>
                                            <span className="font-mono text-xs opacity-70">{new Date(attempt.timestamp).toLocaleTimeString()}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : (
                             <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-lg flex items-center gap-3 text-green-400">
                                <ListChecks size={24} />
                                <span className="font-bold text-lg">{t('no_cheat_attempts')}</span>
                            </div>
                        )}
                    </div>

                    {/* Questions & Answers */}
                    <div className="space-y-8">
                        <h3 className="text-2xl font-bold text-white border-b border-gray-700 pb-4">Application Answers</h3>
                        {submission.answers.map((item, index) => (
                            <div key={index} className="glass-panel p-0 overflow-hidden animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                                <div className="bg-brand-light-blue/10 p-4 border-b border-brand-light-blue/20 flex justify-between items-center">
                                    <h4 className="text-lg font-bold text-brand-cyan">Question {index + 1}</h4>
                                    <span className="text-xs text-gray-500 font-mono bg-brand-dark px-2 py-1 rounded">Time: {item.timeTaken}s</span>
                                </div>
                                <div className="p-6">
                                    <p className="text-lg text-white font-medium mb-4">{item.questionText}</p>
                                    <div className="bg-brand-dark/60 p-6 rounded-lg border border-gray-700/50 min-h-[100px]">
                                        <p className="text-gray-200 whitespace-pre-wrap text-lg leading-relaxed">{item.answer}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Sticky Action Area (Only for Taken/Admin) */}
                    {(hasPermission('_super_admin') || (submission.status === 'taken' && submission.adminId === user?.id)) && (
                        <div className="glass-panel p-6 sticky bottom-6 border-t-4 border-brand-cyan shadow-2xl shadow-black/80 z-30 mt-12">
                            <div className="flex flex-col md:flex-row gap-6 items-start">
                                <div className="flex-grow w-full">
                                    <label className="block text-gray-300 mb-2 font-bold text-sm uppercase tracking-wider">{t('reason')} (Optional for Notification)</label>
                                    <textarea 
                                        value={decisionReason}
                                        onChange={(e) => setDecisionReason(e.target.value)}
                                        placeholder="Write a reason for acceptance or refusal..."
                                        className="vixel-input min-h-[80px] !bg-brand-dark"
                                    />
                                </div>
                                <div className="flex md:flex-col gap-3 w-full md:w-auto pt-7 md:pt-0 min-w-[200px]">
                                    <button 
                                        onClick={() => handleDecision('accepted')} 
                                        disabled={isProcessing}
                                        className="flex-1 bg-green-600/90 text-white font-bold py-4 px-6 rounded-lg hover:bg-green-500 transition-all flex justify-center items-center gap-2 text-lg shadow-lg hover:shadow-green-500/20 hover:-translate-y-1"
                                    >
                                        {isProcessing ? <Loader2 className="animate-spin" /> : <><Check size={24}/> {t('accept')}</>}
                                    </button>
                                    <button 
                                        onClick={() => handleDecision('refused')} 
                                        disabled={isProcessing}
                                        className="flex-1 bg-red-600/90 text-white font-bold py-4 px-6 rounded-lg hover:bg-red-500 transition-all flex justify-center items-center gap-2 text-lg shadow-lg hover:shadow-red-500/20 hover:-translate-y-1"
                                    >
                                        {isProcessing ? <Loader2 className="animate-spin" /> : <><X size={24}/> {t('refuse')}</>}
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
                        <div className="bg-yellow-500/10 p-4 rounded-full inline-block mb-4 border border-yellow-500/30">
                            <AlertTriangle className="text-yellow-400" size={40} />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Bot Connection Issue</h3>
                        <p className="text-gray-300 mb-6">{t('notification_check_failed_body')}</p>
                        
                        <div className="bg-brand-dark p-4 rounded-md mb-6 text-left text-sm text-gray-400">
                            <p><strong>Note:</strong> Proceeding will still update the database status, but the user will NOT receive a DM on Discord.</p>
                        </div>

                        <div className="flex justify-center gap-4">
                            <button onClick={() => setNotificationWarning(null)} className="bg-gray-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-500 transition-colors">{t('cancel')}</button>
                            <button 
                                onClick={() => proceedWithUpdate(notificationWarning.status, notificationWarning.reason)}
                                className="bg-yellow-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-yellow-500 transition-colors"
                            >
                                {t('proceed_anyway')}
                            </button>
                        </div>
                        <div className="mt-6 border-t border-gray-700 pt-4">
                             <Link to="/health-check" className="text-brand-cyan hover:text-white text-sm flex items-center justify-center gap-1"><Loader2 size={14} /> {t('go_to_health_check')}</Link>
                        </div>
                    </div>
                </Modal>
            )}
        </>
    );
};

export default SubmissionDetailPage;
