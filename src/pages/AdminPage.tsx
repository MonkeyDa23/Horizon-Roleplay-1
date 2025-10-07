import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLocalization } from '../hooks/useLocalization';
import { useToast } from '../hooks/useToast';
import { useConfig } from '../hooks/useConfig';
import { 
  getQuizzes, 
  saveQuiz as apiSaveQuiz,
  deleteQuiz as apiDeleteQuiz,
  getSubmissions,
  updateSubmissionStatus,
  getAuditLogs,
  getRules,
  saveRules as apiSaveRules,
  getProducts,
  saveProduct as apiSaveProduct,
  deleteProduct as apiDeleteProduct,
  saveConfig,
  getSubmissionsByUserId,
} from '../lib/api';
// FIX: Added AppConfig to the import.
import type { Quiz, QuizSubmission, SubmissionStatus, AuditLogEntry, RuleCategory, Rule, Product, AppConfig } from '../types';
import { useNavigate } from 'react-router-dom';
import { UserCog, Plus, Edit, Trash2, Check, X, FileText, Server, Eye, Loader2, ShieldCheck, BookCopy, Store, AlertTriangle, Palette, Search } from 'lucide-react';
import Modal from '../components/Modal';


type AdminTab = 'submissions' | 'quizzes' | 'rules' | 'store' | 'appearance' | 'lookup' | 'audit';

const TABS: { id: AdminTab; labelKey: string; icon: React.ElementType; superAdminOnly: boolean }[] = [
  { id: 'submissions', labelKey: 'submission_management', icon: FileText, superAdminOnly: false },
  { id: 'quizzes', labelKey: 'quiz_management', icon: Server, superAdminOnly: true },
  { id: 'lookup', labelKey: 'user_lookup', icon: Search, superAdminOnly: true },
  { id: 'rules', labelKey: 'rules_management', icon: BookCopy, superAdminOnly: true },
  { id: 'store', labelKey: 'store_management', icon: Store, superAdminOnly: true },
  { id: 'appearance', labelKey: 'appearance_settings', icon: Palette, superAdminOnly: true },
  { id: 'audit', labelKey: 'audit_log', icon: ShieldCheck, superAdminOnly: true },
];

const AdminPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLocalization();
  const { showToast } = useToast();
  const { config } = useConfig();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<AdminTab>('submissions');
  
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);

  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [viewingSubmission, setViewingSubmission] = useState<QuizSubmission | null>(null);
  
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  
  const [editableRules, setEditableRules] = useState<RuleCategory[] | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  const [editableConfig, setEditableConfig] = useState<Partial<AppConfig>>({});

  const [isTabLoading, setIsTabLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // State for User Lookup
  const [lookupUserId, setLookupUserId] = useState('');
  const [lookupResult, setLookupResult] = useState<{ submissions: QuizSubmission[], searchedId: string } | null>(null);
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user?.isAdmin) {
        navigate('/');
    }
  }, [user, authLoading, navigate]);

  // Effect for lazy-loading data based on the active tab
  useEffect(() => {
    if (!user?.isAdmin) return;
    setLookupResult(null); // Clear lookup results when changing tabs

    const fetchDataForTab = async () => {
        setIsTabLoading(true);
        try {
            switch (activeTab) {
                case 'submissions': 
                    setSubmissions(await getSubmissions());
                    if(quizzes.length === 0) setQuizzes(await getQuizzes());
                    break;
                // FIX: Use user.isSuperAdmin for authorization checks.
                case 'quizzes': if (user.isSuperAdmin) setQuizzes(await getQuizzes()); break;
                case 'lookup': break; // No initial data to load for lookup
                case 'rules': if (user.isSuperAdmin) setEditableRules(JSON.parse(JSON.stringify(await getRules()))); break;
                case 'store': if (user.isSuperAdmin) setProducts(await getProducts()); break;
                case 'appearance': if (user.isSuperAdmin) setEditableConfig({ ...config }); break;
                case 'audit': if (user.isSuperAdmin) setAuditLogs(await getAuditLogs()); break;
            }
        } catch (error) {
            console.error(`Failed to fetch data for tab: ${activeTab}`, error);
            showToast(`Failed to load data for ${activeTab}.`, "error");
        } finally {
            setIsTabLoading(false);
        }
    };

    fetchDataForTab();
  }, [activeTab, user?.isAdmin, user?.isSuperAdmin, showToast, config]);

  const refreshSubmissions = useCallback(async () => {
      setIsTabLoading(true);
      setSubmissions(await getSubmissions());
      setIsTabLoading(false);
  }, []);

  const handleSaveQuiz = async () => {
    if (editingQuiz) {
      setIsSaving(true);
      try {
        await apiSaveQuiz(editingQuiz);
        setQuizzes(await getQuizzes());
        setEditingQuiz(null);
        showToast('Quiz saved successfully!', 'success');
      } catch (error) { showToast(`Error saving quiz: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      } finally { setIsSaving(false); }
    }
  };
   const handleDeleteQuiz = async (quizId: string) => {
    const quizToDelete = quizzes.find(q => q.id === quizId);
    if (window.confirm(`Delete "${t(quizToDelete?.titleKey || 'this')}" quiz?`)) {
        try {
            await apiDeleteQuiz(quizId);
            setQuizzes(await getQuizzes());
            showToast('Quiz deleted!', 'success');
        } catch (error) { showToast(`Error deleting quiz: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error'); }
    }
  };

  const handleTakeOrder = async (submissionId: string) => { try { await updateSubmissionStatus(submissionId, 'taken'); refreshSubmissions(); } catch (e) { showToast(e instanceof Error ? e.message : 'Failed to take order', 'error'); } }
  const handleDecision = async (submissionId: string, decision: 'accepted' | 'refused') => { try { await updateSubmissionStatus(submissionId, decision); setViewingSubmission(null); refreshSubmissions(); } catch(e) { showToast(e instanceof Error ? e.message : 'Failed to process decision', 'error'); } }

  const handleSaveConfig = async () => {
    if(editableConfig) {
        setIsSaving(true);
        try {
            await saveConfig(editableConfig);
            showToast(t('config_updated_success'), 'success');
            // Force a reload to see changes like background image
            setTimeout(() => window.location.reload(), 1000);
        } catch(e) {
            showToast(`Error saving settings: ${e instanceof Error ? e.message : 'Unknown error'}`, 'error');
        } finally { setIsSaving(false); }
    }
  }

  const handleUserLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupUserId.trim()) return;
    
    setIsLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);

    try {
        const submissions = await getSubmissionsByUserId(lookupUserId.trim());
        setLookupResult({ submissions, searchedId: lookupUserId.trim() });
    } catch (error) {
        console.error("User lookup failed:", error);
        setLookupError(t('no_user_found_or_no_data'));
    } finally {
        setIsLookupLoading(false);
    }
  };

  if (authLoading || !user?.isAdmin) {
    return (
        <div className="flex flex-col gap-4 justify-center items-center h-screen w-screen">
            <Loader2 size={48} className="text-brand-cyan animate-spin" />
        </div>
    );
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

  const getTakeButton = (submission: QuizSubmission) => {
      if (submission.status !== 'pending') return null;
      const quizForSubmission = quizzes.find(q => q.id === submission.quizId);
      const allowedRoles = quizForSubmission?.allowedTakeRoles;
      // FIX: Use user.roles (string array of IDs) for permission check.
      const isAllowed = !allowedRoles || allowedRoles.length === 0 || user.roles.some(userRole => allowedRoles.includes(userRole));
      if (!isAllowed) return <div title={t('take_order_forbidden')}><button disabled className="bg-gray-600/50 text-gray-400 font-bold py-1 px-3 rounded-md text-sm cursor-not-allowed">{t('take_order_forbidden')}</button></div>
      return <button onClick={() => handleTakeOrder(submission.id)} className="bg-brand-cyan/20 text-brand-cyan font-bold py-1 px-3 rounded-md hover:bg-brand-cyan/40 text-sm">{t('take_order')}</button>;
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

  // Define Panels Here (SubmissionsPanel, QuizzesPanel, etc.)
  const SubmissionsPanel = () => (
    <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50 mt-6">
      <div className="overflow-x-auto"><table className="w-full text-left min-w-[700px]"><thead className="border-b border-brand-light-blue/50 text-gray-300"><tr><th className="p-4">{t('applicant')}</th><th className="p-4">{t('quiz_title')}</th><th className="p-4">{t('submitted_on')}</th><th className="p-4">{t('result_date')}</th><th className="p-4">{t('status')}</th><th className="p-4 text-right">{t('actions')}</th></tr></thead><tbody>
        {submissions.length === 0 ? (<tr><td colSpan={6} className="p-8 text-center text-gray-400">{t('no_pending_submissions')}</td></tr>) : submissions.map((sub, i) => (<tr key={sub.id} className={`border-b border-brand-light-blue/50 ${i === submissions.length - 1 ? 'border-none' : ''}`}><td className="p-4 font-semibold">{sub.username}</td><td className="p-4">{sub.quizTitle}</td><td className="p-4 text-sm text-gray-400">{new Date(sub.submittedAt).toLocaleDateString()}</td><td className="p-4 text-sm text-gray-400">{(sub.status === 'accepted' || sub.status === 'refused') && sub.updatedAt ? new Date(sub.updatedAt).toLocaleDateString() : 'N/A'}</td><td className="p-4">{renderStatusBadge(sub.status)}</td><td className="p-4 text-right"><div className="inline-flex gap-4 items-center">{sub.status === 'pending' && getTakeButton(sub)}{sub.status === 'taken' && (<span className="text-xs text-gray-400 italic">{t('taken_by')} {sub.adminUsername === user?.username ? 'You' : sub.adminUsername}</span>)}<button onClick={() => setViewingSubmission(sub)} className="text-gray-300 hover:text-brand-cyan" title={t('view_submission')}><Eye size={20}/></button></div></td></tr>))}
      </tbody></table></div>
    </div>
  );

  const QuizzesPanel = () => (
    <div>
      <div className="flex justify-between items-center my-6"><h2 className="text-2xl font-bold">{t('quiz_management')}</h2><button onClick={() => setEditingQuiz({ id: '', titleKey: '', descriptionKey: '', isOpen: false, questions: [], allowedTakeRoles: [] })} className="bg-brand-cyan text-brand-dark font-bold py-2 px-4 rounded-md hover:bg-white transition-all flex items-center gap-2"><Plus size={20} />{t('create_new_quiz')}</button></div>
      <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50"><table className="w-full text-left">
        <thead className="border-b border-brand-light-blue/50 text-gray-300"><tr><th className="p-4">{t('quiz_title')}</th><th className="p-4">{t('status')}</th><th className="p-4 text-right">{t('actions')}</th></tr></thead>
        <tbody>{quizzes.map((quiz, i) => (<tr key={quiz.id} className={`border-b border-brand-light-blue/50 ${i === quizzes.length - 1 ? 'border-none' : ''}`}><td className="p-4 font-semibold">{t(quiz.titleKey)}</td><td className="p-4"><span className={`px-3 py-1 text-sm font-bold rounded-full ${quiz.isOpen ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{quiz.isOpen ? t('open') : t('closed')}</span></td><td className="p-4 text-right"><div className="inline-flex gap-4"><button onClick={() => setEditingQuiz(quiz)} className="text-gray-300 hover:text-brand-cyan"><Edit size={20}/></button><button onClick={() => handleDeleteQuiz(quiz.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={20}/></button></div></td></tr>))}</tbody>
      </table></div>
    </div>
  );

  const AuditLogPanel = () => (
    <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50 mt-6"><div className="overflow-x-auto"><table className="w-full text-left min-w-[700px]"><thead className="border-b border-brand-light-blue/50 text-gray-300"><tr><th className="p-4">{t('log_timestamp')}</th><th className="p-4">{t('log_admin')}</th><th className="p-4">{t('log_action')}</th></tr></thead><tbody>
      {auditLogs.length === 0 ? (<tr><td colSpan={3} className="p-8 text-center text-gray-400">{t('no_logs_found')}</td></tr>) : auditLogs.map((log) => (<tr key={log.id} className="border-b border-brand-light-blue/50 last:border-none"><td className="p-4 text-sm text-gray-400">{new Date(log.timestamp).toLocaleString()}</td><td className="p-4 font-semibold">{log.adminUsername} <code className="text-xs text-gray-500">({log.adminId})</code></td><td className="p-4">{log.action}</td></tr>))}
    </tbody></table></div></div>
  );

  const AppearancePanel = () => (
    <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50 mt-6 p-8 space-y-6 max-w-2xl mx-auto">
        <div><label className="block mb-2 font-semibold text-gray-300">{t('community_name')}</label><input type="text" value={editableConfig.COMMUNITY_NAME || ''} onChange={(e) => setEditableConfig({...editableConfig, COMMUNITY_NAME: e.target.value})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" /></div>
        <div><label className="block mb-2 font-semibold text-gray-300">{t('logo_url')}</label><input type="text" value={editableConfig.LOGO_URL || ''} onChange={(e) => setEditableConfig({...editableConfig, LOGO_URL: e.target.value})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" /></div>
        <div><label className="block mb-2 font-semibold text-gray-300">{t('background_image_url')}</label><input type="text" value={editableConfig.BACKGROUND_IMAGE_URL || ''} onChange={(e) => setEditableConfig({...editableConfig, BACKGROUND_IMAGE_URL: e.target.value})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" /><p className="text-xs text-gray-400 mt-1">{t('background_image_url_desc')}</p></div>
        <div className="flex items-center justify-between bg-brand-light-blue/50 p-4 rounded-md">
            <label htmlFor="healthCheckToggle" className="font-semibold text-gray-300 cursor-pointer">{t('show_health_check_page')}</label>
            <div className="relative inline-block w-12 ms-3 align-middle select-none transition duration-200 ease-in">
                <input type="checkbox" name="healthCheckToggle" id="healthCheckToggle" checked={!!editableConfig.SHOW_HEALTH_CHECK} onChange={(e) => setEditableConfig({...editableConfig, SHOW_HEALTH_CHECK: e.target.checked})} className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"/>
                <label htmlFor="healthCheckToggle" className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-600 cursor-pointer"></label>
            </div>
            <style>{`.toggle-checkbox:checked { right: 0; border-color: #00f2ea; } .toggle-checkbox:checked + .toggle-label { background-color: #00f2ea; }`}</style>
        </div>
        <div className="flex justify-end pt-4"><button onClick={handleSaveConfig} disabled={isSaving} className="bg-brand-cyan text-brand-dark font-bold py-2 px-8 rounded-md hover:bg-white min-w-[9rem] flex justify-center">{isSaving ? <Loader2 className="animate-spin"/> : t('save_settings')}</button></div>
    </div>
  );

  const UserLookupPanel = () => (
    <div className="mt-6 max-w-4xl mx-auto">
      <form onSubmit={handleUserLookup} className="bg-brand-dark-blue p-6 rounded-lg border border-brand-light-blue/50 flex flex-col sm:flex-row items-center gap-4">
        <input 
          type="text"
          value={lookupUserId}
          onChange={e => setLookupUserId(e.target.value)}
          placeholder={t('enter_discord_id')}
          className="w-full bg-brand-light-blue text-white p-3 rounded-md border border-gray-600 focus:ring-2 focus:ring-brand-cyan focus:border-brand-cyan transition-colors"
        />
        <button type="submit" disabled={isLookupLoading} className="w-full sm:w-auto bg-brand-cyan text-brand-dark font-bold py-3 px-8 rounded-md hover:bg-white transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait">
          {isLookupLoading ? <Loader2 className="animate-spin" /> : <Search />}
          <span>{t('search')}</span>
        </button>
      </form>

      {isLookupLoading && <div className="flex justify-center py-10"><Loader2 size={40} className="animate-spin text-brand-cyan" /></div>}
      {lookupError && <div className="mt-6 text-center text-red-400 bg-red-500/10 p-4 rounded-lg">{lookupError}</div>}
      
      {lookupResult && (
        <div className="mt-8 space-y-8 animate-fade-in">
          <h2 className="text-2xl font-bold text-center">{t('lookup_results_for')} <code className="text-brand-cyan bg-brand-dark px-2 py-1 rounded-md">{lookupResult.searchedId}</code></h2>
          
          <div>
            <h3 className="text-2xl font-bold mb-4 flex items-center gap-3"><FileText className="text-brand-cyan" />{t('application_history')}</h3>
            <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50">
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[600px]">
                  <thead className="border-b border-brand-light-blue/50 text-gray-300">
                    <tr>
                        <th className="p-4">{t('application_type')}</th>
                        <th className="p-4">{t('submitted_on')}</th>
                        <th className="p-4">{t('result_date')}</th>
                        <th className="p-4">{t('status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lookupResult.submissions.length === 0 ? (
                      <tr><td colSpan={4} className="p-8 text-center text-gray-400">{t('no_submissions_found_for_user')}</td></tr>
                    ) : lookupResult.submissions.map(sub => (
                      <tr key={sub.id} className="border-b border-brand-light-blue/50 last:border-none">
                        <td className="p-4 font-semibold">{sub.quizTitle}</td>
                        <td className="p-4 text-sm text-gray-400">{new Date(sub.submittedAt).toLocaleDateString()}</td>
                        <td className="p-4 text-sm text-gray-400">
                            {/* FIX: Check for sub.updatedAt before rendering. */}
                            {(sub.status === 'accepted' || sub.status === 'refused') && sub.updatedAt ? new Date(sub.updatedAt).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="p-4">{renderStatusBadge(sub.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="container mx-auto px-6 py-16">
      <div className="text-center mb-12"><div className="inline-block p-4 bg-brand-light-blue rounded-full mb-4"><UserCog className="text-brand-cyan" size={48} /></div><h1 className="text-4xl md:text-5xl font-bold mb-4">{t('page_title_admin')}</h1></div>
      <div className="max-w-6xl mx-auto">
          <div className="flex border-b border-brand-light-blue/50 mb-6 overflow-x-auto">
              {TABS.map((tab) => {
                  // FIX: Use user.isSuperAdmin for authorization checks.
                  const isDisabled = tab.superAdminOnly && !user.isSuperAdmin;
                  const isActive = activeTab === tab.id;
                  const buttonClasses = `py-3 px-6 font-bold flex-shrink-0 flex items-center gap-2 transition-colors ${isDisabled ? 'text-gray-600 cursor-not-allowed' : isActive ? 'text-brand-cyan border-b-2 border-brand-cyan' : 'text-gray-400 hover:text-brand-cyan'}`;
                  const button = (<button key={tab.id} disabled={isDisabled} onClick={() => !isDisabled && setActiveTab(tab.id)} className={buttonClasses}><tab.icon size={18}/> {t(tab.labelKey)}</button>);
                  if (isDisabled) return <div key={tab.id} title="Super Admin access required">{button}</div>;
                  return button;
              })}
          </div>
          <TabContent>
            {activeTab === 'submissions' && <SubmissionsPanel />}
            {activeTab === 'quizzes' && user.isSuperAdmin && <QuizzesPanel />}
            {activeTab === 'lookup' && user.isSuperAdmin && <UserLookupPanel />}
            {activeTab === 'rules' && user.isSuperAdmin && <p className="text-center text-gray-400 py-10">{t('coming_soon')}</p>}
            {activeTab === 'store' && user.isSuperAdmin && <p className="text-center text-gray-400 py-10">{t('coming_soon')}</p>}
            {activeTab === 'appearance' && user.isSuperAdmin && <AppearancePanel />}
            {activeTab === 'audit' && user.isSuperAdmin && <AuditLogPanel />}
          </TabContent>
      </div>
    </div>
  );
};

export default AdminPage;
