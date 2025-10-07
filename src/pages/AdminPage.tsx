import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLocalization } from '../hooks/useLocalization';
import { useToast } from '../hooks/useToast';
import { useConfig } from '../hooks/useConfig';
import { 
  ApiError,
  getQuizzes, 
  saveQuiz as apiSaveQuiz,
  deleteQuiz as apiDeleteQuiz,
  getSubmissions,
  updateSubmissionStatus,
  getAuditLogs,
  getRules,
  saveRules as apiSaveRules,
  revalidateSession,
  getProducts,
  saveProduct,
  deleteProduct,
  logAdminAccess,
  resetUserSubmission,
} from '../lib/api';
// FIX: Import 'Product' type to resolve reference error.
import type { Quiz, QuizSubmission, SubmissionStatus, AuditLogEntry, RuleCategory, Rule, User, Product } from '../types';
import { useNavigate } from 'react-router-dom';
import { UserCog, Plus, Edit, Trash2, Check, X, FileText, Server, Eye, Loader2, ShieldCheck, BookCopy, Store, AlertTriangle, RefreshCw, Filter, ArrowUp, ArrowDown } from 'lucide-react';
import Modal from '../components/Modal';

type AdminTab = 'submissions' | 'quizzes' | 'rules' | 'store' | 'audit';
type SortableSubmissionKeys = keyof Pick<QuizSubmission, 'username' | 'quizTitle' | 'submittedAt' | 'status'>;


const TABS: { id: AdminTab; labelKey: string; icon: React.ElementType; superAdminOnly: boolean }[] = [
  { id: 'submissions', labelKey: 'submission_management', icon: FileText, superAdminOnly: false },
  { id: 'quizzes', labelKey: 'quiz_management', icon: Server, superAdminOnly: true },
  { id: 'rules', labelKey: 'rules_management', icon: BookCopy, superAdminOnly: true },
  { id: 'store', labelKey: 'store_management', icon: Store, superAdminOnly: true },
  { id: 'audit', labelKey: 'audit_log', icon: ShieldCheck, superAdminOnly: true },
];

const AdminPage: React.FC = () => {
  const { user, logout, updateUser, loading: authLoading } = useAuth();
  const { t } = useLocalization();
  const { showToast } = useToast();
  const { config } = useConfig();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<AdminTab>('submissions');
  
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);

  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const submissionsRef = useRef<QuizSubmission[]>([]);
  const [viewingSubmission, setViewingSubmission] = useState<QuizSubmission | null>(null);
  
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  
  const [editableRules, setEditableRules] = useState<RuleCategory[] | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [isTabLoading, setIsTabLoading] = useState(true);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const accessLoggedRef = useRef(false);

  // State for submissions panel tools
  const [currentPage, setCurrentPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<SubmissionStatus | 'all'>('all');
  const [sortConfig, setSortConfig] = useState<{ key: SortableSubmissionKeys; direction: 'asc' | 'desc' }>({ key: 'submittedAt', direction: 'desc' });
  const ITEMS_PER_PAGE = 15;


  // State for the reset submission tool
  const [resetQuizId, setResetQuizId] = useState('');
  const [resetUserId, setResetUserId] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    submissionsRef.current = submissions;
  }, [submissions]);

  // Gatekeeper effect to check authorization on page load
  useEffect(() => {
    const gateCheck = async () => {
        if (authLoading) return;

        if (!user || !user.isAdmin) {
            navigate('/');
            return;
        }

        setIsPageLoading(true);

        try {
            const freshUser = await revalidateSession(user);
            
            if (!freshUser.isAdmin) {
                showToast(t('admin_revoked'), 'error');
                updateUser(freshUser);
                navigate('/');
                return;
            }

            if (JSON.stringify(freshUser) !== JSON.stringify(user)) {
                updateUser(freshUser);
            }
            
            // Check for Super Admin privileges
            const superAdminRoles = config.SUPER_ADMIN_ROLE_IDS || [];
            const userIsSuperAdmin = freshUser.roles.some(roleId => superAdminRoles.includes(roleId));
            setIsSuperAdmin(userIsSuperAdmin);

            if (!accessLoggedRef.current) {
                await logAdminAccess(freshUser);
                accessLoggedRef.current = true;
            }

            setIsAuthorized(true);
        } catch (error) {
            console.error("Admin access check failed", error);
            if (error instanceof ApiError && (error.status === 401 || error.status === 403 || error.status === 404)) {
                showToast(t('admin_permissions_error'), "error");
                logout();
            } else {
                showToast(t('admin_session_error_warning'), "warning");
                setIsAuthorized(true); // Allow access with cached data
            }
        } finally {
            setIsPageLoading(false);
        }
    };

    gateCheck();
  }, [user, authLoading, navigate, logout, showToast, t, updateUser, config.SUPER_ADMIN_ROLE_IDS]);


  // Effect for lazy-loading data based on the active tab and polling for new submissions
  useEffect(() => {
    if (!isAuthorized || !user) return;

    let pollInterval: number | undefined;
    
    const fetchDataForTab = async (currentUser: User) => {
        setIsTabLoading(true);
        try {
            switch (activeTab) {
                case 'submissions':
                    const [fetchedSubmissions, fetchedQuizzes] = await Promise.all([getSubmissions(currentUser), getQuizzes()]);
                    setSubmissions(fetchedSubmissions);
                    setQuizzes(fetchedQuizzes);
                    break;
                case 'quizzes': if (isSuperAdmin) setQuizzes(await getQuizzes()); break;
                case 'rules': if (isSuperAdmin) setEditableRules(JSON.parse(JSON.stringify(await getRules()))); break;
                case 'store': if (isSuperAdmin) setProducts(await getProducts()); break;
                case 'audit': if (isSuperAdmin) setAuditLogs(await getAuditLogs(currentUser)); break;
            }
        } catch (error) {
            console.error(`Failed to fetch data for tab: ${activeTab}`, error);
            showToast(`Failed to load data for ${activeTab}.`, "error");
        } finally {
            setIsTabLoading(false);
        }
    };

    fetchDataForTab(user);

    if (activeTab === 'submissions') {
        pollInterval = window.setInterval(async () => {
            const currentUser = user; // Capture user at interval creation
            if (!currentUser) return;
            try {
                const latestSubmissions = await getSubmissions(currentUser);
                const currentPendingIds = new Set(submissionsRef.current.filter(s => s.status === 'pending').map(s => s.id));
                
                let newSubmissionFound = false;
                latestSubmissions.forEach(sub => {
                    if (sub.status === 'pending' && !currentPendingIds.has(sub.id)) {
                        showToast(t('new_submission_toast', { username: sub.username }), 'info');
                        newSubmissionFound = true;
                    }
                });
                
                if (newSubmissionFound || JSON.stringify(latestSubmissions) !== JSON.stringify(submissionsRef.current)) {
                    setSubmissions(latestSubmissions);
                }

            } catch (e) {
                console.error("Polling for submissions failed", e);
            }
        }, 15000); // Poll every 15 seconds
    }

    return () => {
        if (pollInterval) clearInterval(pollInterval);
    };

  }, [activeTab, isAuthorized, isSuperAdmin, showToast, user, t]);

  const refreshSubmissions = async () => {
      if (!user) return;
      setIsTabLoading(true);
      setSubmissions(await getSubmissions(user));
      setIsTabLoading(false);
  }

  const handleCreateNewQuiz = () => setEditingQuiz({ id: '', titleKey: '', descriptionKey: '', isOpen: false, questions: [{ id: `q_${Date.now()}`, textKey: '', timeLimit: 60 }], allowedTakeRoles: [] });
  const handleEditQuiz = (quiz: Quiz) => setEditingQuiz(JSON.parse(JSON.stringify(quiz)));
  const handleSaveQuiz = async () => {
    if (editingQuiz && user) {
      setIsSaving(true);
      try {
        await apiSaveQuiz(editingQuiz, user);
        setQuizzes(await getQuizzes());
        setEditingQuiz(null);
        showToast('Quiz saved successfully!', 'success');
      } catch (error) {
        showToast(`Error saving quiz: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      } finally {
        setIsSaving(false);
      }
    }
  };
   const handleDeleteQuiz = async (quizId: string) => {
    if (!user) return;
    const quizToDelete = quizzes.find(q => q.id === quizId);
    if (window.confirm(`Delete "${t(quizToDelete?.titleKey || 'this')}" quiz?`)) {
        try {
            await apiDeleteQuiz(quizId, user);
            setQuizzes(await getQuizzes());
            showToast('Quiz deleted!', 'success');
        } catch (error) {
            showToast(`Error deleting quiz: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        }
    }
  };

  const handleTakeOrder = async (submissionId: string) => { if(user) { try { await updateSubmissionStatus(submissionId, 'taken', user); refreshSubmissions(); } catch (e) { showToast(e instanceof Error ? e.message : 'Failed to take order', 'error'); } } }
  const handleDecision = async (submissionId: string, decision: 'accepted' | 'refused') => { if(user) { try { await updateSubmissionStatus(submissionId, decision, user); setViewingSubmission(null); refreshSubmissions(); } catch(e) { showToast(e instanceof Error ? e.message : 'Failed to process decision', 'error'); } } }

  const handleResetSubmission = async () => {
    if (!resetQuizId || !resetUserId || !user) {
        showToast(t('user_or_quiz_not_selected'), 'warning');
        return;
    }
    setIsResetting(true);
    try {
        await resetUserSubmission(resetQuizId, resetUserId, user);
        showToast(t('reset_submission_success', { userId: resetUserId }), 'success');
        setResetUserId('');
    } catch (error) {
        const errorMessage = error instanceof ApiError ? error.data.message : String(error);
        showToast(t('reset_submission_error') + ` (${errorMessage})`, 'error');
    } finally {
        setIsResetting(false);
    }
  };

  const handleSaveRules = async () => {
      if (editableRules && user) {
          setIsSaving(true);
          try {
              await apiSaveRules(editableRules, user);
              showToast(t('rules_updated_success'), 'success');
          } catch (error) {
              showToast(`Error saving rules: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
          } finally {
              setIsSaving(false);
          }
      }
  };

  if (isPageLoading) {
    return (
        <div className="flex flex-col gap-4 justify-center items-center h-screen w-screen">
            <Loader2 size={48} className="text-brand-cyan animate-spin" />
            <p className="text-xl text-gray-300">Verifying admin permissions...</p>
        </div>
    );
  }
  if (!user?.isAdmin) return null;

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
  
  const TabContent: React.FC<{children: React.ReactNode}> = ({ children }) => {
      if (isTabLoading) {
        return (
            <div className="flex flex-col gap-4 justify-center items-center py-20 min-h-[300px]">
                <Loader2 size={40} className="text-brand-cyan animate-spin" />
                <p className="text-gray-400 capitalize">Loading {activeTab}...</p>
            </div>
        );
      }
      return <>{children}</>;
  }

  const SubmissionsPanel = () => {
    const processedSubmissions = useMemo(() => {
        let processableSubmissions = [...submissions];

        if (filterStatus !== 'all') {
            processableSubmissions = processableSubmissions.filter(s => s.status === filterStatus);
        }

        processableSubmissions.sort((a, b) => {
            const aValue = a[sortConfig.key];
            const bValue = b[sortConfig.key];
            
            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return processableSubmissions;
    }, [submissions, filterStatus, sortConfig]);

    const totalPages = Math.ceil(processedSubmissions.length / ITEMS_PER_PAGE);
    const paginatedSubmissions = processedSubmissions.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    
    useEffect(() => {
        setCurrentPage(1);
    }, [filterStatus, sortConfig]);

    const handleSort = (key: SortableSubmissionKeys) => {
        setSortConfig(current => {
            if (current.key === key && current.direction === 'desc') {
                return { key, direction: 'asc' };
            }
            return { key, direction: 'desc' };
        });
    };
    
    const SortableHeader: React.FC<{ labelKey: string, sortKey: SortableSubmissionKeys }> = ({ labelKey, sortKey }) => {
        const isActive = sortConfig.key === sortKey;
        const Icon = sortConfig.direction === 'asc' ? ArrowUp : ArrowDown;
        return (
            <th className="p-4 cursor-pointer hover:bg-brand-light-blue/50 transition-colors" onClick={() => handleSort(sortKey)}>
                <div className="flex items-center gap-2">
                    {t(labelKey)}
                    {isActive && <Icon size={16} />}
                </div>
            </th>
        );
    };

    const getTakeButton = (submission: QuizSubmission) => {
        if (submission.status !== 'pending' || !user) return null;
        const quizForSubmission = quizzes.find(q => q.id === submission.quizId);
        const allowedRoles = quizForSubmission?.allowedTakeRoles;
        const isAllowed = !allowedRoles || allowedRoles.length === 0 || user.roles.some(userRole => allowedRoles.includes(userRole));
        
        if (!isAllowed) {
            return <div title={t('take_order_forbidden')}><button disabled className="bg-gray-600/50 text-gray-400 font-bold py-1 px-3 rounded-md text-sm cursor-not-allowed">{t('take_order_forbidden')}</button></div>
        }
        return <button onClick={() => handleTakeOrder(submission.id)} className="bg-brand-cyan/20 text-brand-cyan font-bold py-1 px-3 rounded-md hover:bg-brand-cyan/40 text-sm">{t('take_order')}</button>;
    };

    return (
        <>
        {isSuperAdmin && (
            <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50 p-6 my-6">
                <h3 className="text-xl font-bold text-brand-cyan mb-2">{t('reset_user_application')}</h3>
                <p className="text-gray-400 text-sm mb-4">{t('reset_user_application_desc')}</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <select value={resetQuizId} onChange={(e) => setResetQuizId(e.target.value)} className="md:col-span-1 bg-brand-light-blue p-2 rounded border border-gray-600 focus:ring-brand-cyan focus:border-brand-cyan">
                        <option value="">{t('select_quiz_to_reset')}</option>
                        {quizzes.map(q => <option key={q.id} value={q.id}>{t(q.titleKey)}</option>)}
                    </select>
                    <input type="text" value={resetUserId} onChange={(e) => setResetUserId(e.target.value)} placeholder={t('enter_user_id')} className="md:col-span-1 bg-brand-light-blue p-2 rounded border border-gray-600" />
                    <button onClick={handleResetSubmission} disabled={isResetting} className="md:col-span-1 bg-yellow-500/80 text-white font-bold py-2 px-6 rounded-md hover:bg-yellow-500/100 transition-colors flex items-center justify-center gap-2">
                        {isResetting ? <Loader2 className="animate-spin" /> : <RefreshCw size={18} />}
                        {t('reset_application_button')}
                    </button>
                </div>
            </div>
        )}
        <div className="flex justify-end items-center gap-3 mb-4">
            <Filter size={18} className="text-gray-400" />
            <label htmlFor="status-filter" className="sr-only">{t('filter_by_status')}</label>
            <select id="status-filter" value={filterStatus} onChange={e => setFilterStatus(e.target.value as SubmissionStatus | 'all')} className="bg-brand-light-blue p-2 rounded border border-gray-600 focus:ring-brand-cyan focus:border-brand-cyan">
                <option value="all">{t('all')}</option>
                <option value="pending">{t('status_pending')}</option>
                <option value="taken">{t('status_taken')}</option>
                <option value="accepted">{t('status_accepted')}</option>
                <option value="refused">{t('status_refused')}</option>
            </select>
        </div>
        <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead className="border-b border-brand-light-blue/50 text-gray-300">
                <tr>
                  <SortableHeader labelKey="applicant" sortKey="username" />
                  <SortableHeader labelKey="quiz_title" sortKey="quizTitle" />
                  <SortableHeader labelKey="submitted_on" sortKey="submittedAt" />
                  <SortableHeader labelKey="status" sortKey="status" />
                  <th className="p-4 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSubmissions.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-gray-400">{t('no_pending_submissions')}</td></tr>
                ) : paginatedSubmissions.map((sub) => (
                  <tr key={sub.id} className="border-b border-brand-light-blue/50 last:border-none">
                    <td className="p-4 font-semibold">{sub.username}</td>
                    <td className="p-4">{sub.quizTitle}</td>
                    <td className="p-4 text-sm text-gray-400">{new Date(sub.submittedAt).toLocaleString()}</td>
                    <td className="p-4">{renderStatusBadge(sub.status)}</td>
                    <td className="p-4 text-right">
                      <div className="inline-flex gap-4 items-center">
                        {sub.status === 'pending' && getTakeButton(sub)}
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
          {totalPages > 1 && (
            <div className="flex justify-between items-center p-4 border-t border-brand-light-blue/50">
                <span className="text-sm text-gray-400">
                    {t('page_of', { currentPage, totalPages })}
                </span>
                <div className="flex gap-2">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="bg-brand-light-blue px-3 py-1 rounded-md text-sm hover:bg-brand-cyan/20 disabled:opacity-50 disabled:cursor-not-allowed">
                        {t('previous')}
                    </button>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="bg-brand-light-blue px-3 py-1 rounded-md text-sm hover:bg-brand-cyan/20 disabled:opacity-50 disabled:cursor-not-allowed">
                        {t('next')}
                    </button>
                </div>
            </div>
          )}
        </div>
        </>
    );
  }

  const QuizzesPanel = () => (
      <div>
        <div className="flex justify-between items-center my-6">
            <h2 className="text-2xl font-bold">{t('quiz_management')}</h2>
            <button onClick={handleCreateNewQuiz} className="bg-brand-cyan text-brand-dark font-bold py-2 px-4 rounded-md hover:bg-white transition-all flex items-center gap-2">
                <Plus size={20} />
                {t('create_new_quiz')}
            </button>
        </div>
        <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50">
          <table className="w-full text-left">
            <thead className="border-b border-brand-light-blue/50 text-gray-300">
              <tr><th className="p-4">{t('quiz_title')}</th><th className="p-4">{t('status')}</th><th className="p-4 text-right">{t('actions')}</th></tr>
            </thead>
            <tbody>
              {quizzes.map((quiz, index) => (
                <tr key={quiz.id} className={`border-b border-brand-light-blue/50 ${index === quizzes.length - 1 ? 'border-none' : ''}`}>
                  <td className="p-4 font-semibold">{t(quiz.titleKey)}</td>
                  <td className="p-4"><span className={`px-3 py-1 text-sm font-bold rounded-full ${quiz.isOpen ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{quiz.isOpen ? t('open') : t('closed')}</span></td>
                  <td className="p-4 text-right"><div className="inline-flex gap-4"><button onClick={() => handleEditQuiz(quiz)} className="text-gray-300 hover:text-brand-cyan"><Edit size={20}/></button><button onClick={() => handleDeleteQuiz(quiz.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={20}/></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
  );

  const RulesPanel = () => {
    const handleCategoryChange = (categoryId: string, value: string) => {
        setEditableRules(prev => prev?.map(cat => cat.id === categoryId ? { ...cat, titleKey: value } : cat) || null);
    };
    const handleRuleChange = (categoryId: string, ruleId: string, value: string) => {
        setEditableRules(prev => prev?.map(cat => cat.id === categoryId ? { ...cat, rules: cat.rules.map(rule => rule.id === ruleId ? { ...rule, textKey: value } : rule) } : cat) || null);
    };
    const handleAddRule = (categoryId: string) => {
        const newRule: Rule = { id: `rule_${Date.now()}`, textKey: '' };
        setEditableRules(prev => prev?.map(cat => cat.id === categoryId ? { ...cat, rules: [...cat.rules, newRule] } : cat) || null);
    };
    const handleDeleteRule = (categoryId: string, ruleId: string) => {
        setEditableRules(prev => prev?.map(cat => cat.id === categoryId ? { ...cat, rules: cat.rules.filter(rule => rule.id !== ruleId) } : cat) || null);
    };
    const handleAddCategory = () => {
        const newCategory: RuleCategory = { id: `cat_${Date.now()}`, titleKey: '', rules: [] };
        setEditableRules(prev => [...(prev || []), newCategory]);
    };
    const handleDeleteCategory = (categoryId: string) => {
        if (window.confirm(t('delete_category_confirm'))) {
            setEditableRules(prev => prev?.filter(cat => cat.id !== categoryId) || null);
        }
    };
    return (
        <div>
            <div className="flex justify-between items-center my-6">
                <h2 className="text-2xl font-bold">{t('rules_management')}</h2>
                <button onClick={handleSaveRules} disabled={isSaving} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white transition-colors min-w-[9rem] flex justify-center">{isSaving ? <Loader2 className="animate-spin" /> : t('save_rules')}</button>
            </div>
            <div className="space-y-6">
                {(editableRules || []).map((category, catIndex) => (
                    <div key={category.id} className="bg-brand-dark-blue border border-brand-light-blue/50 rounded-lg p-6">
                        <div className="flex items-center gap-4 mb-4">
                            <label className="font-bold text-gray-400 text-sm flex-shrink-0">{t('category_title')}</label>
                            <input type="text" value={category.titleKey} onChange={(e) => handleCategoryChange(category.id, e.target.value)} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600 font-semibold text-lg" placeholder="e.g. rules_general_title" />
                            <button onClick={() => handleDeleteCategory(category.id)} className="text-gray-400 hover:text-red-500 p-2"><Trash2 size={20} /></button>
                        </div>
                        <div className="space-y-3 pl-6 border-l-2 border-brand-light-blue">
                            {category.rules.map((rule, ruleIndex) => (
                                <div key={rule.id} className="flex items-center gap-2">
                                    <span className="text-brand-cyan font-bold">{catIndex + 1}.{ruleIndex + 1}</span>
                                    <input type="text" value={rule.textKey} onChange={(e) => handleRuleChange(category.id, rule.id, e.target.value)} className="w-full bg-brand-dark p-2 rounded border border-gray-700" placeholder="e.g. rule_general_1" />
                                    <button onClick={() => handleDeleteRule(category.id, rule.id)} className="text-gray-500 hover:text-red-500 p-1"><X size={18} /></button>
                                </div>
                            ))}
                            <button onClick={() => handleAddRule(category.id)} className="text-brand-cyan font-semibold hover:text-white transition-colors flex items-center gap-2 text-sm pt-2">
                                <Plus size={16} />{t('add_rule')}
                            </button>
                        </div>
                    </div>
                ))}
                <button onClick={handleAddCategory} className="w-full bg-brand-dark-blue/50 border-2 border-dashed border-brand-light-blue hover:bg-brand-light-blue/50 text-gray-300 font-bold py-4 rounded-lg transition-colors flex items-center justify-center gap-2">
                    <Plus size={20} />{t('add_category')}
                </button>
            </div>
        </div>
    );
  };


  const StorePanel = () => (
    <div>
        <div className="flex justify-between items-center my-6">
            <h2 className="text-2xl font-bold">{t('store_management')}</h2>
            <button className="bg-brand-cyan text-brand-dark font-bold py-2 px-4 rounded-md hover:bg-white transition-all flex items-center gap-2">
                <Plus size={20} />
                Add New Product
            </button>
        </div>
         <p className="text-center text-gray-400 py-10">Store management UI is coming soon.</p>
    </div>
  );

  const AuditLogPanel = () => (
    <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50 mt-6">
        <div className="overflow-x-auto"><table className="w-full text-left min-w-[600px]"><thead className="border-b border-brand-light-blue/50 text-gray-300"><tr><th className="p-4">{t('log_timestamp')}</th><th className="p-4">{t('log_admin')}</th><th className="p-4">{t('log_action')}</th></tr></thead><tbody>
        {auditLogs.length === 0 ? (<tr><td colSpan={3} className="p-8 text-center text-gray-400">{t('no_logs_found')}</td></tr>) : auditLogs.map((log) => (
            <tr key={log.id} className="border-b border-brand-light-blue/50 last:border-none"><td className="p-4 text-sm text-gray-400">{new Date(log.timestamp).toLocaleString()}</td><td className="p-4 font-semibold">{log.adminUsername} <code className="text-xs text-gray-500">({log.adminId})</code></td><td className="p-4">{log.action}</td></tr>
        ))}
        </tbody></table></div>
    </div>
  );

  return (
    <div className="container mx-auto px-6 py-16">
      <div className="text-center mb-12"><div className="inline-block p-4 bg-brand-light-blue rounded-full mb-4"><UserCog className="text-brand-cyan" size={48} /></div><h1 className="text-4xl md:text-5xl font-bold mb-4">{t('page_title_admin')}</h1></div>
      <div className="max-w-6xl mx-auto">
        {!isAuthorized ? (
          <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 p-6 rounded-lg text-center">
            <AlertTriangle className="mx-auto mb-4" size={40} />
            <h2 className="text-xl font-bold mb-2">Session Warning</h2>
            <p>{t('admin_session_error_warning')}</p>
          </div>
        ) : (
          <>
          <div className="flex border-b border-brand-light-blue/50 mb-6 overflow-x-auto">
              {TABS.map((tab) => {
                  const isDisabled = tab.superAdminOnly && !isSuperAdmin;
                  if (isDisabled) return null;

                  const isActive = activeTab === tab.id;
                  const buttonClasses = `py-3 px-6 font-bold flex-shrink-0 flex items-center gap-2 transition-colors ${isActive ? 'text-brand-cyan border-b-2 border-brand-cyan' : 'text-gray-400 hover:text-brand-cyan'}`;
                  return <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={buttonClasses}><tab.icon size={18}/> {t(tab.labelKey)}</button>;
              })}
          </div>
          <TabContent>
            {activeTab === 'submissions' && <SubmissionsPanel />}
            {activeTab === 'quizzes' && isSuperAdmin && <QuizzesPanel />}
            {activeTab === 'rules' && isSuperAdmin && <RulesPanel />}
            {activeTab === 'store' && isSuperAdmin && <StorePanel />}
            {activeTab === 'audit' && isSuperAdmin && <AuditLogPanel />}
          </TabContent>
          </>
        )}
      </div>
      
      {editingQuiz && <Modal isOpen={!!editingQuiz} onClose={() => setEditingQuiz(null)} title={editingQuiz.id ? t('edit_quiz') : t('create_new_quiz')}>
        <div className="space-y-4 text-white">
             <div><label className="block mb-1 font-semibold text-gray-300">{t('quiz_title')}</label><input type="text" value={editingQuiz.titleKey} onChange={(e) => setEditingQuiz({...editingQuiz, titleKey: e.target.value})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" /></div>
             <div><label className="block mb-1 font-semibold text-gray-300">{t('quiz_handler_roles')}</label><input type="text" placeholder="e.g. 123,456" value={(editingQuiz.allowedTakeRoles || []).join(',')} onChange={(e) => setEditingQuiz({...editingQuiz, allowedTakeRoles: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" /><p className="text-xs text-gray-400 mt-1">{t('quiz_handler_roles_desc')}</p></div>
             <div className="flex items-center gap-4 pt-2">
                <label className="font-semibold text-gray-300">{t('status')}:</label>
                <button onClick={() => setEditingQuiz({...editingQuiz, isOpen: !editingQuiz.isOpen})}
                  className={`px-4 py-1 rounded-full font-bold ${editingQuiz.isOpen ? 'bg-green-500/30 text-green-300' : 'bg-red-500/30 text-red-300'}`}>
                  {editingQuiz.isOpen ? t('open') : t('closed')}
                </button>
             </div>
            <div className="flex justify-end gap-4 pt-4 border-t border-brand-light-blue/50 mt-4"><button onClick={() => setEditingQuiz(null)} disabled={isSaving} className="bg-gray-600 text-white font-bold py-2 px-6 rounded-md hover:bg-gray-500">Cancel</button><button onClick={handleSaveQuiz} disabled={isSaving} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white min-w-[8rem] flex justify-center">{isSaving ? <Loader2 className="animate-spin"/> : t('save_quiz')}</button></div>
        </div>
      </Modal>}

      {viewingSubmission && user && (
        <Modal isOpen={!!viewingSubmission} onClose={() => setViewingSubmission(null)} title={t('submission_details')}>
            <div className="space-y-4 text-gray-200">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <p><strong>{t('applicant')}:</strong> {viewingSubmission.username}</p>
                    <p><strong>{t('quiz_title')}:</strong> {viewingSubmission.quizTitle}</p>
                    <p><strong>{t('submitted_on')}:</strong> {new Date(viewingSubmission.submittedAt).toLocaleString()}</p>
                    <p><strong>{t('status')}:</strong> {renderStatusBadge(viewingSubmission.status)}</p>
                    {viewingSubmission.adminUsername && <p className="col-span-2"><strong>{t('taken_by')}:</strong> {viewingSubmission.adminUsername}</p>}
                </div>

                <div className="border-t border-brand-light-blue pt-4 mt-4">
                    <h4 className="text-lg font-bold text-brand-cyan mb-3">{t('quiz_questions')}</h4>
                    <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                        {viewingSubmission.answers.map((ans, i) => (
                            <div key={ans.questionId} className="bg-brand-dark p-4 rounded-lg border-l-4 border-brand-cyan/50">
                                <p className="font-bold text-gray-300 mb-2">{i+1}. {ans.questionText}</p>
                                <p className="text-gray-100 whitespace-pre-wrap leading-relaxed">{ans.answer}</p>
                            </div>
                        ))}
                    </div>
                </div>
                {viewingSubmission.status === 'taken' && viewingSubmission.adminId === user.id && (
                    <div className="flex justify-end gap-4 pt-6 border-t border-brand-light-blue">
                        <button onClick={() => handleDecision(viewingSubmission.id, 'refused')} className="flex items-center gap-2 bg-red-600 text-white font-bold py-2 px-5 rounded-md hover:bg-red-500 transition-colors"><X size={20}/> {t('refuse')}</button>
                        <button onClick={() => handleDecision(viewingSubmission.id, 'accepted')} className="flex items-center gap-2 bg-green-600 text-white font-bold py-2 px-5 rounded-md hover:bg-green-500 transition-colors"><Check size={20}/> {t('accept')}</button>
                    </div>
                )}
            </div>
        </Modal>
      )}

    </div>
  );
};

export default AdminPage;
