/**
 * Nova Roleplay - Official Website
 * Submission Detail Page
 * Copyright (c) 2024 Nova Roleplay. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLocalization } from '../contexts/LocalizationContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getSubmissionById, updateSubmissionStatus, logSubmissionAction } from '../lib/api';
import type { QuizSubmission } from '../types';
import { Loader2, Check, X, ArrowLeft, User, Calendar, Shield, AlertTriangle, ListChecks } from 'lucide-react';
import SEO from '../components/SEO';
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

    const fetchSubmission = useCallback(async () => {
        if (!submissionId) return;
        setIsLoading(true);
        try {
            const data = await getSubmissionById(submissionId);
            setSubmission(data);
        } catch (error) {
            showToast('فشل تحميل التقديم.', 'error');
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

    const handleDecision = async (status: 'accepted' | 'refused') => {
        if (!submission || !user) return;
        setIsProcessing(true);
        
        try {
            // 1. Update Database
            const updatedSub = await updateSubmissionStatus(submission.id, status, decisionReason);
            setSubmission(updatedSub);
            
            // 2. Log Action (Public & DM)
            await logSubmissionAction(
                config, 
                user, 
                submission, 
                status === 'accepted' ? 'ACCEPTED' : 'REFUSED', 
                decisionReason
            );

            showToast(`تم ${status === 'accepted' ? 'قبول' : 'رفض'} التقديم وإرسال السجلات.`, 'success');
            navigate('/admin');

        } catch (e) {
            showToast((e as Error).message, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleTakeOrder = async () => {
        if (!submission) return;
        setIsProcessing(true);
        try {
            await updateSubmissionStatus(submission.id, 'taken');
            showToast('تم استلام الطلب.', 'success');
            
            // Log that admin took the ticket & Send DM
            await logSubmissionAction(config, user, submission, 'TAKEN');

            fetchSubmission();
        } catch (e) {
            showToast((e as Error).message, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    if (isLoading) return <div className="flex justify-center items-center h-screen"><Loader2 size={48} className="text-brand-cyan animate-spin" /></div>;
    if (!submission) return null;

    return (
        <>
            <SEO title={`مراجعة: ${submission.username}`} noIndex={true} description="Admin Panel"/>
            <div className="min-h-screen bg-brand-dark pb-24 relative">
                <div className="sticky top-0 z-40 bg-brand-dark/90 backdrop-blur-md border-b border-brand-light-blue/30 py-4 px-6 shadow-lg">
                    <div className="container mx-auto max-w-6xl flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <Link to="/admin?tab=submissions" className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full"><ArrowLeft size={24} /></Link>
                            <div>
                                <h1 className="text-xl font-bold text-white">{submission.username}</h1>
                                <p className="text-sm text-brand-cyan">{submission.quizTitle}</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                             {submission.status === 'pending' ? (
                                <button onClick={handleTakeOrder} disabled={isProcessing} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white transition-all disabled:opacity-50 flex items-center gap-2">
                                    {isProcessing ? <Loader2 className="animate-spin" size={20}/> : t('take_order')}
                                </button>
                            ) : (
                                <span className={`font-bold border px-4 py-2 rounded ${submission.status === 'accepted' ? 'text-green-400 border-green-500 bg-green-500/10' : submission.status === 'refused' ? 'text-red-400 border-red-500 bg-red-500/10' : 'text-brand-cyan border-brand-cyan bg-brand-cyan/10'}`}>
                                    {submission.status.toUpperCase()}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="container mx-auto max-w-6xl px-6 py-8 space-y-8">
                    <div className="glass-panel p-8 flex flex-col md:flex-row gap-8 justify-between items-start md:items-center">
                        <div className="flex gap-6 items-center">
                            <div className="w-20 h-20 rounded-full bg-brand-light-blue flex items-center justify-center border-2 border-brand-cyan/30">
                                <User size={40} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-bold text-white mb-2">{submission.username}</h2>
                                <div className="flex flex-wrap gap-4 text-sm">
                                    <p className="text-gray-400 flex items-center gap-2 bg-brand-dark/50 px-3 py-1 rounded-full"><Shield size={14}/> الرتبة: {submission.user_highest_role || t('member')}</p>
                                    <p className="text-gray-400 flex items-center gap-2 bg-brand-dark/50 px-3 py-1 rounded-full"><Calendar size={14}/> {new Date(submission.submittedAt).toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                        
                        {submission.cheatAttempts && submission.cheatAttempts.length > 0 ? (
                             <div className="bg-red-500/10 border border-red-500/30 p-5 rounded-lg max-w-md w-full">
                                <h3 className="text-red-400 font-bold flex items-center gap-2 mb-3 text-lg"><AlertTriangle size={20} /> {t('cheat_attempt_detected')}</h3>
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

                    <div className="space-y-8">
                        <h3 className="text-2xl font-bold text-white border-b border-gray-700 pb-4">الإجابات</h3>
                        {submission.answers.map((item, index) => (
                            <div key={index} className="glass-panel p-0 overflow-hidden animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                                <div className="bg-brand-light-blue/10 p-4 border-b border-brand-light-blue/20 flex justify-between items-center">
                                    <h4 className="text-lg font-bold text-brand-cyan">سؤال {index + 1}</h4>
                                    <span className="text-xs text-gray-500 font-mono bg-brand-dark px-2 py-1 rounded">الوقت المستغرق: {item.timeTaken}s</span>
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

                    {(hasPermission('_super_admin') || (submission.status === 'taken' && submission.adminId === user?.id)) && (
                        <div className="glass-panel p-6 sticky bottom-6 border-t-4 border-brand-cyan shadow-2xl shadow-black/80 z-30 mt-12">
                            <div className="flex flex-col md:flex-row gap-6 items-start">
                                <div className="flex-grow w-full">
                                    <label className="block text-gray-300 mb-2 font-bold text-sm uppercase tracking-wider">{t('reason')} (سيتم إرساله للمستخدم)</label>
                                    <textarea value={decisionReason} onChange={(e) => setDecisionReason(e.target.value)} placeholder="اكتب سبب القبول أو الرفض هنا..." className="nova-input min-h-[80px] !bg-brand-dark" />
                                </div>
                                <div className="flex md:flex-col gap-3 w-full md:w-auto pt-7 md:pt-0 min-w-[200px]">
                                    <button onClick={() => handleDecision('accepted')} disabled={isProcessing} className="flex-1 bg-green-600/90 text-white font-bold py-4 px-6 rounded-lg hover:bg-green-500 transition-all flex justify-center items-center gap-2 text-lg shadow-lg">
                                        {isProcessing ? <Loader2 className="animate-spin" /> : <><Check size={24}/> {t('accept')}</>}
                                    </button>
                                    <button onClick={() => handleDecision('refused')} disabled={isProcessing} className="flex-1 bg-red-600/90 text-white font-bold py-4 px-6 rounded-lg hover:bg-red-500 transition-all flex justify-center items-center gap-2 text-lg shadow-lg">
                                        {isProcessing ? <Loader2 className="animate-spin" /> : <><X size={24}/> {t('refuse')}</>}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default SubmissionDetailPage;
