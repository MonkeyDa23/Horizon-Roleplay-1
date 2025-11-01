// src/components/admin/SubmissionsPanel.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useLocalization } from '../../hooks/useLocalization';
import { useToast } from '../../hooks/useToast';
import { getSubmissions, updateSubmissionStatus, getQuizzes } from '../../lib/api';
import type { Quiz, QuizSubmission, SubmissionStatus } from '../../types';
import Modal from '../Modal';
import { Eye, Loader2, Check, X, ListChecks } from 'lucide-react';

// Panel wrapper to show loading state
const Panel: React.FC<{ children: React.ReactNode; isLoading: boolean, loadingText: string }> = ({ children, isLoading, loadingText }) => {
    if (isLoading) {
        return (
            <div className="flex flex-col gap-4 justify-center items-center py-20 min-h-[300px]">
                <Loader2 size={40} className="text-brand-cyan animate-spin" />
                <p className="text-gray-400">{loadingText}</p>
            </div>
        );
    }
    return <div className="animate-fade-in-up">{children}</div>;
}

const SubmissionsPanel: React.FC = () => {
    const { user, hasPermission } = useAuth();
    const { t } = useLocalization();
    const { showToast } = useToast();
    const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewingSubmission, setViewingSubmission] = useState<QuizSubmission | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [submissionsData, quizzesData] = await Promise.all([getSubmissions(), getQuizzes()]);
            setSubmissions(submissionsData);
            setQuizzes(quizzesData);
        } catch (error) {
            showToast('Failed to load submissions.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleTakeOrder = async (submissionId: string) => {
        try {
            await updateSubmissionStatus(submissionId, 'taken');
            fetchData(); // Refresh data
        } catch (e) {
            showToast((e as Error).message, 'error');
        }
    };

    const handleDecision = async (submissionId: string, decision: 'accepted' | 'refused') => {
        try {
            await updateSubmissionStatus(submissionId, decision);
            setViewingSubmission(null);
            fetchData(); // Refresh data
        } catch (e) {
            showToast((e as Error).message, 'error');
        }
    };

    const renderStatusBadge = (status: SubmissionStatus) => {
        const statusMap = {
            pending: { text: t('status_pending'), color: 'bg-yellow-500/20 text-yellow-400' },
            taken: { text: t('status_taken'), color: 'bg-blue-500/20 text-blue-400' },
            accepted: { text: t('status_accepted'), color: 'bg-green-500/20 text-green-400' },
            refused: { text: t('status_refused'), color: 'bg-red-500/20 text-red-400' },
        };
        const { text, color } = statusMap[status] || { text: status, color: 'bg-gray-500/20 text-gray-400' };
        return <span className={`px-3 py-1 text-sm font-bold rounded-full ${color}`}>{text}</span>;
    };

    const getTakeButton = (submission: QuizSubmission) => {
        if (submission.status !== 'pending' || !user) return null;
        const quiz = quizzes.find(q => q.id === submission.quizId);
        const allowedRoles = quiz?.allowedTakeRoles || [];
        const isAllowed = hasPermission('_super_admin') || allowedRoles.length === 0 || user.roles.some(role => allowedRoles.includes(role.id));
        
        if (!isAllowed) {
            return <div title={t('take_order_forbidden')}><button disabled className="bg-gray-600/50 text-gray-400 font-bold py-1 px-3 rounded-md text-sm cursor-not-allowed">{t('take_order')}</button></div>
        }
        return <button onClick={() => handleTakeOrder(submission.id)} className="bg-brand-cyan/20 text-brand-cyan font-bold py-1 px-3 rounded-md hover:bg-brand-cyan/40 text-sm">{t('take_order')}</button>;
    };

    return (
        <Panel isLoading={isLoading} loadingText={t('loading_submissions')}>
             <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[600px]">
                        <thead className="border-b border-brand-light-blue/50 text-gray-300 bg-brand-light-blue/30">
                            <tr>
                                <th className="p-4">{t('applicant')}</th>
                                <th className="p-4">{t('quiz_title')}</th>
                                <th className="p-4">{t('submitted_on')}</th>
                                <th className="p-4">{t('status')}</th>
                                <th className="p-4 text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {submissions.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-gray-400">{t('no_pending_submissions')}</td></tr>
                            ) : submissions.map(sub => (
                                <tr key={sub.id} className="border-b border-brand-light-blue/50 last:border-none hover:bg-brand-light-blue/20 transition-colors">
                                    <td className="p-4 font-semibold text-white">{sub.username}</td>
                                    <td className="p-4">{sub.quizTitle}</td>
                                    <td className="p-4 text-sm text-gray-400">{new Date(sub.submittedAt).toLocaleDateString()}</td>
                                    <td className="p-4">{renderStatusBadge(sub.status)}</td>
                                    <td className="p-4 text-right">
                                        <div className="inline-flex gap-4 items-center">
                                            {getTakeButton(sub)}
                                            {sub.status === 'taken' && (
                                                <span className="text-xs text-gray-400 italic">{t('taken_by')} {sub.adminUsername === user?.username ? 'You' : sub.adminUsername}</span>
                                            )}
                                            <button onClick={() => setViewingSubmission(sub)} className="text-gray-300 hover:text-brand-cyan" title={t('view_submission')}><Eye size={20}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            {viewingSubmission && user && (
                <Modal isOpen={!!viewingSubmission} onClose={() => setViewingSubmission(null)} title={t('submission_details')}>
                    <div className="space-y-4 text-gray-200">
                        <p><strong>{t('applicant')}:</strong> {viewingSubmission.username}</p>
                        <p><strong>{t('quiz_title')}:</strong> {viewingSubmission.quizTitle}</p>
                        <p><strong>{t('submitted_on')}:</strong> {new Date(viewingSubmission.submittedAt).toLocaleString()}</p>
                        <p><strong>{t('status')}:</strong> {renderStatusBadge(viewingSubmission.status)}</p>
                        {viewingSubmission.adminUsername && <p><strong>{t('taken_by')}:</strong> {viewingSubmission.adminUsername}</p>}
                        <div className="border-t border-brand-light-blue pt-4 mt-4">
                            <h4 className="text-lg font-bold text-brand-cyan mb-2">{t('quiz_questions')}</h4>
                            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                                {viewingSubmission.answers.map((ans, i) => (
                                    <div key={ans.questionId}>
                                        <p className="font-semibold text-gray-300">{i+1}. {ans.questionText}</p>
                                        <p className="bg-brand-dark p-2 rounded mt-1 text-gray-200 whitespace-pre-wrap">{ans.answer}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {viewingSubmission.cheatAttempts && viewingSubmission.cheatAttempts.length > 0 && (
                            <div className="border-t border-brand-light-blue pt-4 mt-4">
                                <h4 className="text-lg font-bold text-red-400 mb-2 flex items-center gap-2">
                                <ListChecks /> {t('cheat_attempts_report')}
                                </h4>
                                <ul className="text-sm space-y-1 bg-brand-dark p-3 rounded-md">
                                {viewingSubmission.cheatAttempts.map((attempt, i) => (
                                    <li key={i}>- {attempt.method} at {new Date(attempt.timestamp).toLocaleTimeString()}</li>
                                ))}
                                </ul>
                            </div>
                        )}
                        {viewingSubmission.status === 'taken' && (hasPermission('_super_admin') || viewingSubmission.adminId === user.id) && (
                            <div className="flex justify-end gap-4 pt-6 border-t border-brand-light-blue">
                                <button onClick={() => handleDecision(viewingSubmission.id, 'refused')} className="flex items-center gap-2 bg-red-600 text-white font-bold py-2 px-5 rounded-md hover:bg-red-500"><X size={20}/> {t('refuse')}</button>
                                <button onClick={() => handleDecision(viewingSubmission.id, 'accepted')} className="flex items-center gap-2 bg-green-600 text-white font-bold py-2 px-5 rounded-md hover:bg-green-500"><Check size={20}/> {t('accept')}</button>
                            </div>
                        )}
                    </div>
                </Modal>
            )}
        </Panel>
    );
};

export default SubmissionsPanel;
