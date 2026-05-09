/**
 * Nova Roleplay - Official Website
 * Admin Submissions Panel
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocalization } from '../../contexts/LocalizationContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useConfig } from '../../contexts/ConfigContext';
import { getSubmissions, deleteSubmission, updateSubmissionStatus, logSubmissionAction } from '../../lib/api';
import type { QuizSubmission, SubmissionStatus } from '../../types';
import { Eye, Loader2, Trash2, Search, Filter, Inbox, Clock, CheckCircle2, XCircle, ChevronRight, User } from 'lucide-react';
import { Link } from 'react-router-dom';

const SubmissionsPanel: React.FC = () => {
    const { t, language, dir } = useLocalization();
    const isArabic = language === 'ar';
    const { user, hasPermission } = useAuth();
    const { config, branding } = useConfig();
    const { showToast } = useToast();
    
    const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<SubmissionStatus | 'all'>('all');

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

    const filteredSubmissions = useMemo(() => {
        return submissions.filter(sub => {
            const matchesSearch = 
                sub.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                sub.quizTitle.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesFilter = filterStatus === 'all' || sub.status === filterStatus;
            return matchesSearch && matchesFilter;
        });
    }, [submissions, searchTerm, filterStatus]);

    const handleDelete = async (submission: QuizSubmission) => {
        if (!user) return;
        if (window.confirm(t('delete_submission_confirm', { username: submission.username, quizTitle: submission.quizTitle }))) {
            try {
                await deleteSubmission(submission.id);
                showToast(t('submission_deleted_success'), 'success');
                fetchData();
                await logSubmissionAction(config, user, submission, 'DELETED', `قام المسؤول بحذف التقديم نهائياً.`);
            } catch (e) {
                showToast((e as Error).message, 'error');
            }
        }
    };
    
    const handleQuickTake = async (id: string, submission: QuizSubmission) => {
        if (!user) return;
        try {
            await updateSubmissionStatus(id, 'taken');
            showToast('Order taken successfully.', 'success');
            await logSubmissionAction(config, user, submission, 'TAKEN', `قام المسؤول باستلام التقديم للمراجعة.`);
            fetchData();
        } catch (e) {
            showToast((e as Error).message, 'error');
        }
    }

    const renderStatusBadge = (status: SubmissionStatus) => {
        const statusMap = {
          pending: { text: t('status_pending'), color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', icon: Clock },
          taken: { text: t('status_taken'), color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: Eye },
          accepted: { text: t('status_accepted'), color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', icon: CheckCircle2 },
          refused: { text: t('status_refused'), color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: XCircle },
        };
        const s = statusMap[status];
        const Icon = s.icon;
        return (
          <span className={`px-4 py-1 text-[10px] font-black rounded-full border ${s.bg} ${s.color} ${s.border} uppercase tracking-widest flex items-center gap-2 w-fit`}>
            <Icon size={12} />
            {s.text}
          </span>
        );
      };

    return (
        <div className="space-y-8 animate-fade-in-up" dir={dir}>
            {/* Header / Stats */}
            <div className="bg-white/[0.02] border border-white/5 p-8 rounded-[40px] flex flex-col md:flex-row gap-8 items-center justify-between shadow-2xl backdrop-blur-xl">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-3xl flex items-center justify-center border border-blue-500/10 shadow-inner">
                        <Inbox className="text-blue-500" size={32} />
                    </div>
                    <div>
                        <div className="text-4xl font-black text-white">{submissions.length}</div>
                        <div className="text-text-secondary text-[10px] uppercase font-black tracking-widest mt-1 opacity-40">{t('total_submissions')}</div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                    <div className="relative flex-grow min-w-[240px]">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-text-secondary opacity-40" size={20} />
                        <input 
                            type="text" 
                            placeholder={t('search_applicants') || 'Search applicants...'} 
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-sm text-white focus:outline-none focus:border-white/20 transition-all shadow-inner"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.currentTarget.value)}
                        />
                    </div>
                    <div className="relative min-w-[180px]">
                        <Filter className="absolute left-6 top-1/2 -translate-y-1/2 text-text-secondary opacity-40" size={20} />
                        <select 
                            value={filterStatus} 
                            onChange={(e) => setFilterStatus(e.target.value as SubmissionStatus | 'all')} 
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-10 text-sm text-white focus:outline-none focus:border-white/20 transition-all shadow-inner appearance-none cursor-pointer"
                        >
                            <option value="all">{t('filter_all')}</option>
                            <option value="pending">{t('filter_pending')}</option>
                            <option value="taken">{t('filter_taken')}</option>
                            <option value="accepted">{t('filter_accepted')}</option>
                            <option value="refused">{t('filter_refused')}</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Submissions List */}
            <div className="bg-white/[0.02] border border-white/5 rounded-[40px] overflow-hidden shadow-2xl backdrop-blur-3xl">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead className="sticky top-0 bg-brand-dark z-20 shadow-xl">
                            <tr className="border-b border-white/5 bg-white/[0.03]">
                                <th className="px-10 py-6 text-[10px] font-black uppercase text-text-secondary tracking-widest">{t('applicant')}</th>
                                <th className="px-10 py-6 text-[10px] font-black uppercase text-text-secondary tracking-widest">{t('application_type')}</th>
                                <th className="px-10 py-6 text-[10px] font-black uppercase text-text-secondary tracking-widest">{t('submitted_on')}</th>
                                <th className="px-10 py-6 text-[10px] font-black uppercase text-text-secondary tracking-widest">{t('status')}</th>
                                <th className="px-10 py-6 text-[10px] font-black uppercase text-text-secondary tracking-widest text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={5} className="px-10 py-10"><div className="h-12 bg-white/5 rounded-2xl"></div></td>
                                    </tr>
                                ))
                            ) : filteredSubmissions.length > 0 ? (
                                filteredSubmissions.map((sub) => (
                                    <tr key={sub.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-10 py-8">
                                            <div className="flex items-center gap-5">
                                                <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-white/20 group-hover:text-white/40 transition-colors border border-white/10">
                                                    <User size={24} />
                                                </div>
                                                <div>
                                                    <p className="text-xl font-black text-white">{sub.username}</p>
                                                    <p className="text-[10px] font-black text-text-secondary opacity-40 uppercase tracking-widest mt-0.5">{sub.user_highest_role || t('member')}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <p className="text-lg font-black text-white/80">{sub.quizTitle}</p>
                                            <p className="text-[10px] font-black text-text-secondary opacity-30 uppercase mt-1 tracking-widest">Form Submission</p>
                                        </td>
                                        <td className="px-10 py-8">
                                            <div className="text-sm font-black text-text-secondary opacity-60 flex items-center gap-2">
                                                <Clock size={14} className="opacity-40" />
                                                {new Date(sub.submittedAt).toLocaleString(isArabic ? 'ar' : 'en')}
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">{renderStatusBadge(sub.status)}</td>
                                        <td className="px-10 py-8 text-right">
                                            <div className="inline-flex gap-3 items-center">
                                                {sub.status === 'pending' && (
                                                    <button 
                                                        onClick={() => handleQuickTake(sub.id, sub)} 
                                                        className="px-5 py-3 bg-white/5 text-white border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95"
                                                    >
                                                        {t('take_order')}
                                                    </button>
                                                )}
                                                {sub.status === 'taken' && (
                                                  <div className="px-4 py-2 bg-blue-500/5 text-blue-400/50 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                                    <Loader2 size={12} className="animate-spin" />
                                                    {sub.adminUsername === user?.username ? t('reviewing_by_you') : `${t('reviewing_by')} ${sub.adminUsername}`}
                                                  </div>
                                                )}
                                                <Link 
                                                    to={`/admin/submissions/${sub.id}`} 
                                                    className="w-12 h-12 flex items-center justify-center bg-white/5 border border-white/10 rounded-2xl text-text-secondary hover:text-white hover:bg-white/10 transition-all group/btn" 
                                                    title={t('view_submission')}
                                                >
                                                    <Eye size={24} className="group-hover/btn:scale-110 transition-transform" /> 
                                                </Link>
                                                {hasPermission('_super_admin') && (
                                                    <button 
                                                        onClick={() => handleDelete(sub)} 
                                                        className="w-12 h-12 flex items-center justify-center bg-red-500/5 border border-red-500/10 rounded-2xl text-red-500/40 hover:text-red-500 hover:bg-red-500/10 transition-all" 
                                                        title={t('delete_submission')}
                                                    >
                                                        <Trash2 size={24} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-10 py-32 text-center text-text-secondary">
                                      <div className="flex flex-col items-center gap-8">
                                        <Inbox size={100} className="opacity-5" />
                                        <p className="text-3xl font-black opacity-20">{t('no_submissions_found')}</p>
                                      </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SubmissionsPanel;
