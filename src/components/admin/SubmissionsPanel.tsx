// src/components/admin/SubmissionsPanel.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { getSubmissions, updateSubmissionStatus, getQuizzes } from '../../lib/api';
import type { QuizSubmission, SubmissionStatus, Quiz } from '../../types';
import Modal from '../Modal';
import { Eye, Loader2, Check, X, ListChecks } from 'lucide-react';

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
    const { t } = useLocalization();
    const { user, hasPermission } = useAuth();
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
        } catch (e) {
            showToast((e as Error).message, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleUpdateStatus = async (id: string, status: 'taken' | 'accepted' | 'refused') => {
        try {
            await updateSubmissionStatus(id, status);
            fetchData();
            if (viewingSubmission) setViewingSubmission(null);
            showToast('Submission updated!', 'success');
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
        const { text, color } = statusMap[status];
        return <span className={`px-3 py-1 text-sm font-bold rounded-full ${color}`}>{text}</span>;
      };

    const TakeOrderButton: React.FC<{ submission: QuizSubmission }> = ({ submission }) => {
        const quizForSubmission = quizzes.find(q => q.id === submission.quizId);
        const allowedRoles = quizForSubmission?.allowedTakeRoles || [];
        const isAllowedByRole = user?.roles.some(userRole => allowedRoles.includes(userRole.id)) ?? false;
        
        const canTakeOrder = hasPermission('_super_admin') || isAllowedByRole;

        if (submission.status !== 'pending') return null;

        return (
            <button 
                onClick={() => handleUpdateStatus(submission.id, 'taken')} 
                disabled={!canTakeOrder}
                title={!canTakeOrder ? t('take_order_forbidden') : t('take_order')}
                className="bg-brand-cyan/20 text-brand-cyan font-bold py-1 px-3 rounded-md text-sm transition-colors enabled:hover:bg-brand-cyan/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:text-gray-400 disabled:bg-gray-500/20"
            >
                {t('take_order')}
            </button>
        );
    };

    return (
        <Panel isLoading={isLoading} loadingText={t('loading_submissions', {})}>
            <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[700px]">
                        <thead className="border-b border-brand-light-blue/50 text-gray-300 bg-brand-light-blue/30">
                            <tr>
                                <th className="p-4">{t('applicant')}</th>
                                <th className="p-4">{t('highest_role')}</th>
                                <th className="p-4">{t('application_type')}</th>
                                <th className="p-4">{t('submitted_on')}</th>
                                <th className="p-4">{t('status')}</th>
                                <th className="p-4 text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {submissions.length > 0 ? submissions.map((sub) => (
                                <tr key={sub.id} className="border-b border-brand-light-blue/50 last:border-none hover:bg-brand-light-blue/20 transition-colors">
                                    <td className="p-4 font-semibold text-white">{sub.username}</td>
                                    <td className="p-4 text-sm text-gray-400">{sub.user_highest_role || t('member')}</td>
                                    <td className="p-4 text-gray-300">{sub.quizTitle}</td>
                                    <td className="p-4 text-sm text-gray-400">{new Date(sub.submittedAt).toLocaleString()}</td>
                                    <td className="p-4">{renderStatusBadge(sub.status)}</td>
                                    <td className="p-4 text-right">
                                        <div className="inline-flex gap-4 items-center">
                                            <TakeOrderButton submission={sub} />
                                            {sub.status === 'taken' && <span className="text-xs text-gray-400 italic">{t('taken_by')} {sub.adminUsername === user?.username ? 'You' : sub.adminUsername}</span>}
                                            <button onClick={() => setViewingSubmission(sub)} className="text-gray-300 hover:text-brand-cyan" title={t('view_submission')}><Eye size={20}/></button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-400">{t('no_pending_submissions')}</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {viewingSubmission && user && <Modal isOpen={!!viewingSubmission} onClose={() => setViewingSubmission(null)} title={t('submission_details')}>
                <div className="space-y-4 text-gray-200">
                    <p><strong>{t('applicant')}:</strong> {viewingSubmission.username}</p>
                    <p><strong>{t('application_type')}:</strong> {viewingSubmission.quizTitle}</p>
                    <p><strong>{t('submitted_on')}:</strong> {new Date(viewingSubmission.submittedAt).toLocaleString()}</p>
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
                             <h4 className="text-lg font-bold text-red-400 mb-2 flex items-center gap-2"><ListChecks /> {t('cheat_attempts_report')}</h4>
                             <ul className="text-sm space-y-1">
                                {viewingSubmission.cheatAttempts.map((attempt, i) => (
                                    <li key={i}>- {attempt.method} at {new Date(attempt.timestamp).toLocaleTimeString()}</li>
                                ))}
                             </ul>
                        </div>
                    )}
                    {(hasPermission('_super_admin') || (viewingSubmission.status === 'taken' && viewingSubmission.adminId === user.id)) && (
                        <div className="flex justify-end gap-4 pt-6 border-t border-brand-light-blue">
                            <button onClick={() => handleUpdateStatus(viewingSubmission.id, 'refused')} className="flex items-center gap-2 bg-red-600 text-white font-bold py-2 px-5 rounded-md hover:bg-red-500 transition-colors"><X size={20}/> {t('refuse')}</button>
                            <button onClick={() => handleUpdateStatus(viewingSubmission.id, 'accepted')} className="flex items-center gap-2 bg-green-600 text-white font-bold py-2 px-5 rounded-md hover:bg-green-500 transition-colors"><Check size={20}/> {t('accept')}</button>
                        </div>
                    )}
                </div>
            </Modal>}
        </Panel>
    );
};

export default SubmissionsPanel;