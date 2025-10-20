import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  saveConfig,
} from '../lib/api';
import type { Quiz, QuizSubmission, SubmissionStatus, AuditLogEntry, RuleCategory, AppConfig } from '../types';
import { useNavigate } from 'react-router-dom';
import { UserCog, Plus, Edit, Trash2, Check, X, FileText, Server, Eye, Loader2, ShieldCheck, BookCopy, Store, AlertTriangle, Paintbrush } from 'lucide-react';
import Modal from '../components/Modal';

type AdminTab = 'submissions' | 'quizzes' | 'rules' | 'store' | 'appearance' | 'audit';

const TABS: { id: AdminTab; labelKey: string; icon: React.ElementType; permission: string }[] = [
  { id: 'submissions', labelKey: 'submission_management', icon: FileText, permission: 'admin_submissions' },
  { id: 'quizzes', labelKey: 'quiz_management', icon: Server, permission: 'admin_quizzes' },
  { id: 'rules', labelKey: 'rules_management', icon: BookCopy, permission: 'admin_rules' },
  { id: 'store', labelKey: 'store_management', icon: Store, permission: 'admin_store' },
  { id: 'appearance', labelKey: 'appearance_settings', icon: Paintbrush, permission: 'admin_appearance' },
  { id: 'audit', labelKey: 'audit_log', icon: ShieldCheck, permission: 'admin_audit_log' },
];

const AdminPage: React.FC = () => {
  const { user, logout, updateUser, loading: authLoading, hasPermission } = useAuth();
  const { t } = useLocalization();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<AdminTab>('submissions');
  
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);

  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [viewingSubmission, setViewingSubmission] = useState<QuizSubmission | null>(null);
  
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  
  const [editableRules, setEditableRules] = useState<RuleCategory[] | null>(null);

  const [products, setProducts] = useState<any[]>([]);

  const [isTabLoading, setIsTabLoading] = useState(true);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const accessLoggedRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const gateCheck = async () => {
        if (authLoading) return;

        if (!user || !hasPermission('admin_panel')) {
            navigate('/');
            return;
        }

        setIsPageLoading(true);

        try {
            const freshUser = await revalidateSession();
            
            if (!freshUser.permissions.has('admin_panel')) {
                showToast(t('admin_revoked'), 'error');
                updateUser(freshUser);
                navigate('/');
                return;
            }

            if (JSON.stringify(freshUser) !== JSON.stringify(user)) {
                updateUser(freshUser);
            }
            
            if (!accessLoggedRef.current) {
                await logAdminAccess();
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
  }, [user, authLoading, navigate, logout, showToast, t, updateUser, hasPermission]);


  useEffect(() => {
    if (!isAuthorized || !user) return;

    const fetchDataForTab = async () => {
        setIsTabLoading(true);
        try {
            const currentTabPermission = TABS.find(t => t.id === activeTab)?.permission;
            if (currentTabPermission && !hasPermission(currentTabPermission as any)) {
                const firstAllowedTab = TABS.find(t => hasPermission(t.permission as any));
                setActiveTab(firstAllowedTab?.id || 'submissions');
                return;
            }

            switch (activeTab) {
                case 'submissions': if (hasPermission('admin_submissions')) setSubmissions(await getSubmissions()); break;
                case 'quizzes': if (hasPermission('admin_quizzes')) setQuizzes(await getQuizzes()); break;
                case 'rules': if (hasPermission('admin_rules')) setEditableRules(JSON.parse(JSON.stringify(await getRules()))); break;
                case 'store': if (hasPermission('admin_store')) setProducts(await getProducts()); break;
                case 'appearance': /* No data to fetch, handled by ConfigContext */ break;
                case 'audit': if (hasPermission('admin_audit_log')) setAuditLogs(await getAuditLogs()); break;
            }
        } catch (error) {
            console.error(`Failed to fetch data for tab: ${activeTab}`, error);
            showToast(`Failed to load data for ${activeTab}.`, "error");
        } finally {
            setIsTabLoading(false);
        }
    };

    fetchDataForTab();
  }, [activeTab, isAuthorized, showToast, user, hasPermission]);

  const refreshSubmissions = useCallback(async () => {
      if (!user) return;
      setIsTabLoading(true);
      setSubmissions(await getSubmissions());
      setIsTabLoading(false);
  }, [user]);

  const handleCreateNewQuiz = () => setEditingQuiz({ id: '', titleKey: '', descriptionKey: '', isOpen: false, questions: [{ id: `q_${Date.now()}`, textKey: '', timeLimit: 60 }], allowedTakeRoles: [] });
  const handleEditQuiz = (quiz: Quiz) => setEditingQuiz(JSON.parse(JSON.stringify(quiz)));
  const handleSaveQuiz = async () => {
    if (editingQuiz && user) {
      setIsSaving(true);
      try {
        await apiSaveQuiz(editingQuiz);
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
            await apiDeleteQuiz(quizId);
            setQuizzes(await getQuizzes());
            showToast('Quiz deleted!', 'success');
        } catch (error) {
            showToast(`Error deleting quiz: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        }
    }
  };

  const handleTakeOrder = async (submissionId: string) => { if(user) { try { await updateSubmissionStatus(submissionId, 'taken'); refreshSubmissions(); } catch (e) { showToast(e instanceof Error ? e.message : 'Failed to take order', 'error'); } } };
  const handleDecision = async (submissionId: string, decision: 'accepted' | 'refused') => { if(user) { try { await updateSubmissionStatus(submissionId, decision); setViewingSubmission(null); refreshSubmissions(); } catch(e) { showToast(e instanceof Error ? e.message : 'Failed to process decision', 'error'); } } };

  const handleSaveRules = async () => {
      if (editableRules && user) {
          setIsSaving(true);
          try {
              await apiSaveRules(editableRules);
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
  if (!hasPermission('admin_panel')) return null;

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
      if (submission.status !== 'pending' || !user) return null;

      const quizForSubmission = quizzes.find(q => q.id === submission.quizId);
      const allowedRoles = quizForSubmission?.allowedTakeRoles;

      const isAllowed = !allowedRoles || allowedRoles.length === 0 || user.roles.some(userRole => allowedRoles.includes(userRole.id));
      
      if (!isAllowed) {
          return <div title={t('take_order_forbidden')}><button disabled className="bg-gray-600/50 text-gray-400 font-bold py-1 px-3 rounded-md text-sm cursor-not-allowed">{t('take_order_forbidden')}</button></div>
      }

      return <button onClick={() => handleTakeOrder(submission.id)} className="bg-brand-cyan/20 text-brand-cyan font-bold py-1 px-3 rounded-md hover:bg-brand-cyan/40 text-sm">{t('take_order')}</button>;
  };
  
  const TabContent: React.FC<{children: React.ReactNode}> = ({ children }) => {
      if (isTabLoading && activeTab !== 'appearance') {
        return (
            <div className="flex flex-col gap-4 justify-center items-center py-20 min-h-[300px]">
                <Loader2 size={40} className="text-brand-cyan animate-spin" />
                <p className="text-gray-400 capitalize">Loading {activeTab}...</p>
            </div>
        );
      }
      return <>{children}</>;
  }
  
  const visibleTabs = TABS.filter(tab => hasPermission(tab.permission as any));

  const SubmissionsPanel = () => (
    <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50 mt-6">
      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[600px]">
          <thead className="border-b border-brand-light-blue/50 text-gray-300">
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
            ) : submissions.map((sub, index) => (
              <tr key={sub.id} className={`border-b border-brand-light-blue/50 ${index === submissions.length - 1 ? 'border-none' : ''}`}>
                <td className="p-4 font-semibold">{sub.username}</td>
                <td className="p-4">{sub.quizTitle}</td>
                <td className="p-4 text-sm text-gray-400">{new Date(sub.submittedAt).toLocaleDateString()}</td>
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
    </div>
  );

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

  const RulesPanel = () => (
    <div>
        <div className="flex justify-between items-center my-6">
            <h2 className="text-2xl font-bold">{t('rules_management')}</h2>
            <button onClick={handleSaveRules} disabled={isSaving} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white transition-colors min-w-[9rem] flex justify-center">{isSaving ? <Loader2 className="animate-spin" /> : t('save_rules')}</button>
        </div>
        <p className="text-center text-gray-400 py-10">Rules management UI is coming soon.</p>
    </div>
  );

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
            <tr key={log.id} className="border-b border-brand-light-blue/50 last:border-none"><td className="p-4 text-sm text-gray-400">{new Date(log.timestamp).toLocaleString()}</td><td className="p-4 font-semibold">{log.admin_username} <code className="text-xs text-gray-500">({log.admin_id})</code></td><td className="p-4">{log.action}</td></tr>
        ))}
        </tbody></table></div>
    </div>
  );
  
  const AppearancePanel = () => {
    const { config, configLoading, refreshConfig } = useConfig();
    const [localConfig, setLocalConfig] = useState<AppConfig | null>(null);
    const [isSaving, setIsSaving] = useState(false);
  
    useEffect(() => {
      if (config) setLocalConfig(JSON.parse(JSON.stringify(config)));
    }, [config]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!localConfig) return;
      const { name, value, type } = e.target;
      const isCheckbox = type === 'checkbox';
      setLocalConfig({ ...localConfig, [name]: isCheckbox ? (e.target as HTMLInputElement).checked : value });
    };
  
    const handleSave = async () => {
      if (!localConfig) return;
      setIsSaving(true);
      try {
        await saveConfig(localConfig);
        await refreshConfig();
        showToast(t('config_updated_success'), 'success');
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Failed to save settings', 'error');
      } finally {
        setIsSaving(false);
      }
    };

    const ConfigInput: React.FC<{name: keyof AppConfig; labelKey: string; descKey?: string;}> = ({ name, labelKey, descKey }) => (
        <div>
            <label htmlFor={name} className="block mb-1 font-semibold text-gray-300">{t(labelKey)}</label>
            <input
                type="text"
                id={name}
                name={name}
                value={String(localConfig?.[name] ?? '')}
                onChange={handleChange}
                className="w-full bg-brand-light-blue p-2 rounded border border-gray-600 focus:ring-brand-cyan focus:border-brand-cyan"
            />
            {descKey && <p className="text-xs text-gray-400 mt-1">{t(descKey)}</p>}
        </div>
    );
  
    if (configLoading || !localConfig) {
      return ( <div className="flex justify-center items-center py-20"> <Loader2 size={40} className="text-brand-cyan animate-spin" /> </div> );
    }
  
    return (
      <div className="mt-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">{t('appearance_settings')}</h2>
          <button onClick={handleSave} disabled={isSaving} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white transition-colors min-w-[9rem] flex justify-center">
            {isSaving ? <Loader2 className="animate-spin" /> : t('save_settings')}
          </button>
        </div>
        <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50 p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <ConfigInput name="COMMUNITY_NAME" labelKey="community_name" />
            <ConfigInput name="LOGO_URL" labelKey="logo_url" />
            <ConfigInput name="BACKGROUND_IMAGE_URL" labelKey="background_image_url" descKey="background_image_url_desc" />
            <ConfigInput name="DISCORD_GUILD_ID" labelKey="discord_guild_id" descKey="discord_guild_id_desc" />
            <ConfigInput name="SUBMISSIONS_CHANNEL_ID" labelKey="submissions_webhook_url" descKey="submissions_webhook_url_desc" />
            <ConfigInput name="AUDIT_LOG_CHANNEL_ID" labelKey="audit_log_webhook_url" descKey="audit_log_webhook_url_desc" />
        </div>
      </div>
    );
  };

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
              {visibleTabs.map((tab) => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`py-3 px-6 font-bold flex-shrink-0 flex items-center gap-2 transition-colors ${activeTab === tab.id ? 'text-brand-cyan border-b-2 border-brand-cyan' : 'text-gray-400 hover:text-brand-cyan'}`}><tab.icon size={18}/> {t(tab.labelKey)}</button>
              ))}
          </div>
          <TabContent>
            {activeTab === 'submissions' && hasPermission('admin_submissions') && <SubmissionsPanel />}
            {activeTab === 'quizzes' && hasPermission('admin_quizzes') && <QuizzesPanel />}
            {activeTab === 'rules' && hasPermission('admin_rules') && <RulesPanel />}
            {activeTab === 'store' && hasPermission('admin_store') && <StorePanel />}
            {activeTab === 'appearance' && hasPermission('admin_appearance') && <AppearancePanel />}
            {activeTab === 'audit' && hasPermission('admin_audit_log') && <AuditLogPanel />}
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