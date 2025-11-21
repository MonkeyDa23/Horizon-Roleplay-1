
// src/components/admin/SubmissionsPanel.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useLocalization } from '../../contexts/LocalizationContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getSubmissions, deleteSubmission, updateSubmissionStatus } from '../../lib/api';
import type { QuizSubmission, SubmissionStatus } from '../../types';
import { Eye, Loader2, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';


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
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const submissionsData = await getSubmissions();
            setSubmissions(submissionsData);
        } catch (e) {
            showToast((e as Error).message, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleDelete = async (submission: QuizSubmission) => {
        if (window.confirm(t('delete_submission_confirm', { username: submission.username, quizTitle: submission.quizTitle }))) {
            try {
                await deleteSubmission(submission.id);
                showToast(t('submission_deleted_success'), 'success');
                fetchData();
            } catch (e) {
                showToast((e as Error).message, 'error');
            }
        }
    };
    
    // Simple take order function for the list view (optional quick action)
    const handleQuickTake = async (id: string) => {
        try {
            await updateSubmissionStatus(id, 'taken');
            showToast('Order taken successfully.', 'success');
            fetchData();
        } catch (e) {
            showToast((e as Error).message, 'error');
        }
    }

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
                                            {/* Quick Take Action if Pending */}
                                            {sub.status === 'pending' && (
                                                 <button 
                                                    onClick={() => handleQuickTake(sub.id)} 
                                                    className="bg-brand-cyan/20 text-brand-cyan font-bold py-1 px-3 rounded-md text-sm transition-colors hover:bg-brand-cyan/40"
                                                >
                                                    {t('take_order')}
                                                </button>
                                            )}
                                            
                                            {sub.status === 'taken' && <span className="text-xs text-gray-400 italic">{t('taken_by')} {sub.adminUsername === user?.username ? 'You' : sub.adminUsername}</span>}
                                            
                                            <Link 
                                                to={`/admin/submissions/${sub.id}`} 
                                                className="bg-brand-light-blue p-2 rounded-md text-white hover:bg-brand-cyan hover:text-brand-dark transition-all" 
                                                title={t('view_submission')}
                                            >
                                                <Eye size={18}/> 
                                            </Link>
                                            
                                            {hasPermission('_super_admin') && (
                                                <button onClick={() => handleDelete(sub)} className="text-gray-400 hover:text-red-500" title={t('delete_submission')}><Trash2 size={20}/></button>
                                            )}
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
        </Panel>
    );
};

export default SubmissionsPanel;
