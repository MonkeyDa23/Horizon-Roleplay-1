import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  getGuildRoles,
  getRolePermissions,
  saveRolePermissions,
  logAdminAccess,
  getTranslations,
  saveTranslations as apiSaveTranslations,
  lookupUser,
} from '../lib/api';
import type { Quiz, QuizSubmission, SubmissionStatus, AuditLogEntry, RuleCategory, AppConfig, DiscordRole, PermissionKey, RolePermission, Product, Rule, Translations, UserLookupResult } from '../types';
import { useNavigate } from 'react-router-dom';
import { UserCog, Plus, Edit, Trash2, Check, X, FileText, Server, Eye, Loader2, ShieldCheck, BookCopy, Store, AlertTriangle, Paintbrush, Languages, UserSearch, LockKeyhole, ListChecks, ExternalLink, GripVertical, PlusCircle, Trash, Search } from 'lucide-react';
import Modal from '../components/Modal';
import { PERMISSIONS } from '../lib/permissions';
import { supabase } from '../lib/supabaseClient';
import { useTranslations } from '../hooks/useTranslations';

type AdminTab = 'submissions' | 'quizzes' | 'rules' | 'store' | 'appearance' | 'translations' | 'permissions' | 'audit' | 'lookup';

const TABS: { id: AdminTab; labelKey: string; icon: React.ElementType; permission: PermissionKey }[] = [
  { id: 'submissions', labelKey: 'submission_management', icon: FileText, permission: 'admin_submissions' },
  { id: 'quizzes', labelKey: 'quiz_management', icon: Server, permission: 'admin_quizzes' },
  { id: 'rules', labelKey: 'rules_management', icon: BookCopy, permission: 'admin_rules' },
  { id: 'store', labelKey: 'store_management', icon: Store, permission: 'admin_store' },
  { id: 'appearance', labelKey: 'appearance_settings', icon: Paintbrush, permission: 'admin_appearance' },
  { id: 'translations', labelKey: 'translations_management', icon: Languages, permission: 'admin_translations' },
  { id: 'permissions', labelKey: 'permissions_management', icon: LockKeyhole, permission: 'admin_permissions' },
  { id: 'lookup', labelKey: 'user_lookup', icon: UserSearch, permission: 'admin_lookup' },
  { id: 'audit', labelKey: 'audit_log', icon: ShieldCheck, permission: 'admin_audit_log' },
];

const AdminPage: React.FC = () => {
  const { user, loading: authLoading, hasPermission } = useAuth();
  const { t } = useLocalization();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<AdminTab>('submissions');
  const [isTabLoading, setIsTabLoading] = useState(true);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const accessLoggedRef = useRef(false);

  // State for each tab
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [viewingSubmission, setViewingSubmission] = useState<QuizSubmission | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  
  // Gatekeeper effect to check authorization and set initial state
  useEffect(() => {
    if (authLoading) return;

    if (!user || !hasPermission('admin_panel')) {
      navigate('/');
      return;
    }
    
    if (isInitialLoad) {
        if (!accessLoggedRef.current) {
            logAdminAccess().catch(err => console.error("Failed to log admin access:", err));
            accessLoggedRef.current = true;
        }

        const firstAllowedTab = TABS.find(tab => hasPermission(tab.permission));
        if (firstAllowedTab) {
            setActiveTab(firstAllowedTab.id);
        }
        
        setIsAuthorized(true);
        setIsPageLoading(false);
        setIsInitialLoad(false);
    }
  }, [user, authLoading, navigate, hasPermission, isInitialLoad]);


  // Data fetching effect based on the active tab
  useEffect(() => {
    if (!isAuthorized) return;

    const fetchDataForTab = async () => {
        setIsTabLoading(true);
        try {
            const currentTabPermission = TABS.find(t => t.id === activeTab)?.permission;
            if (currentTabPermission && !hasPermission(currentTabPermission)) {
                const firstAllowedTab = TABS.find(t => hasPermission(t.permission));
                setActiveTab(firstAllowedTab?.id || 'submissions');
                return;
            }

            switch (activeTab) {
                case 'submissions': setSubmissions(await getSubmissions()); break;
                case 'quizzes': setQuizzes(await getQuizzes()); break;
                case 'audit': setAuditLogs(await getAuditLogs()); break;
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

  if (isPageLoading) {
    return (
        <div className="flex flex-col gap-4 justify-center items-center h-[calc(100vh-200px)] w-full">
            <Loader2 size={48} className="text-brand-cyan animate-spin" />
        </div>
    );
  }
  if (!hasPermission('admin_panel')) return null;
  
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
  
  const visibleTabs = TABS.filter(tab => hasPermission(tab.permission));

  return (
    <div className="container mx-auto px-6 py-16">
      <div className="text-center mb-12"><div className="inline-block p-4 bg-brand-light-blue rounded-full mb-4"><UserCog className="text-brand-cyan" size={48} /></div><h1 className="text-4xl md:text-5xl font-bold mb-4">{t('page_title_admin')}</h1></div>
      <div className="max-w-6xl mx-auto">
        <div className="flex border-b border-brand-light-blue/50 mb-6 overflow-x-auto">
            {visibleTabs.map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`py-3 px-6 font-bold flex-shrink-0 flex items-center gap-2 transition-colors ${activeTab === tab.id ? 'text-brand-cyan border-b-2 border-brand-cyan' : 'text-gray-400 hover:text-brand-cyan'}`}><tab.icon size={18}/> {t(tab.labelKey)}</button>
            ))}
        </div>
        <TabContent>
          {activeTab === 'submissions' && <SubmissionsPanel quizzes={quizzes} submissions={submissions} setSubmissions={setSubmissions} viewingSubmission={viewingSubmission} setViewingSubmission={setViewingSubmission} />}
          {activeTab === 'quizzes' && <QuizzesPanel quizzes={quizzes} setQuizzes={setQuizzes} editingQuiz={editingQuiz} setEditingQuiz={setEditingQuiz} />}
          {activeTab === 'rules' && <RulesPanel />}
          {activeTab === 'store' && <StorePanel />}
          {activeTab === 'appearance' && <AppearancePanel />}
          {activeTab === 'translations' && <TranslationsPanel />}
          {activeTab === 'permissions' && <PermissionsPanel />}
          {activeTab === 'lookup' && <UserLookupPanel />}
          {activeTab === 'audit' && <AuditLogPanel auditLogs={auditLogs} />}
        </TabContent>
      </div>
    </div>
  );
};

// ... Sub-components for each panel ...

const renderStatusBadge = (status: SubmissionStatus, t: Function) => {
    const statusMap = {
      pending: { text: t('status_pending'), color: 'bg-yellow-500/20 text-yellow-400' },
      taken: { text: t('status_taken'), color: 'bg-blue-500/20 text-blue-400' },
      accepted: { text: t('status_accepted'), color: 'bg-green-500/20 text-green-400' },
      refused: { text: t('status_refused'), color: 'bg-red-500/20 text-red-400' },
    };
    const { text, color } = statusMap[status];
    return <span className={`px-3 py-1 text-sm font-bold rounded-full ${color}`}>{text}</span>;
};

const RoleBadge: React.FC<{ role: DiscordRole, isSelected?: boolean }> = ({ role, isSelected }) => {
    const color = role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99aab5';
    const r = parseInt(color.slice(1, 3), 16), g = parseInt(color.slice(3, 5), 16), b = parseInt(color.slice(5, 7), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    const textColor = brightness > 125 ? 'text-black' : 'text-white';
    return <span className={`px-2 py-1 text-xs font-bold rounded-md ${textColor} ${isSelected ? 'ring-2 ring-offset-2 ring-offset-brand-dark-blue ring-brand-cyan' : ''}`} style={{ backgroundColor: color }}>{role.name}</span>;
};

// --- SUBMISSIONS PANEL ---
const SubmissionsPanel = ({quizzes, submissions, setSubmissions, viewingSubmission, setViewingSubmission} : any) => {
    const { user } = useAuth();
    const { t } = useLocalization();
    const { showToast } = useToast();

    const refreshSubmissions = useCallback(async () => {
      setSubmissions(await getSubmissions());
    }, [setSubmissions]);

    const handleTakeOrder = async (submissionId: string) => { if(user) { try { await updateSubmissionStatus(submissionId, 'taken'); refreshSubmissions(); } catch (e) { showToast(e instanceof Error ? e.message : 'Failed to take order', 'error'); } } };
    const handleDecision = async (submissionId: string, decision: 'accepted' | 'refused') => { if(user) { try { await updateSubmissionStatus(submissionId, decision); setViewingSubmission(null); refreshSubmissions(); } catch(e) { showToast(e instanceof Error ? e.message : 'Failed to process decision', 'error'); } } };
    
    const getTakeButton = (submission: QuizSubmission) => {
      if (submission.status !== 'pending' || !user) return null;
      const quizForSubmission = quizzes.find((q: Quiz) => q.id === submission.quizId);
      const allowedRoles = quizForSubmission?.allowedTakeRoles;
      const isAllowed = !allowedRoles || allowedRoles.length === 0 || user.roles.some(userRole => allowedRoles.includes(userRole.id));
      if (!isAllowed) return <div title={t('take_order_forbidden')}><button disabled className="bg-gray-600/50 text-gray-400 font-bold py-1 px-3 rounded-md text-sm cursor-not-allowed">{t('take_order_forbidden')}</button></div>
      return <button onClick={() => handleTakeOrder(submission.id)} className="bg-brand-cyan/20 text-brand-cyan font-bold py-1 px-3 rounded-md hover:bg-brand-cyan/40 text-sm">{t('take_order')}</button>;
    };

    return <>
        <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50 mt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead className="border-b border-brand-light-blue/50 text-gray-300">
                <tr>
                  <th className="p-4">{t('applicant')}</th><th className="p-4">{t('quiz_title')}</th><th className="p-4">{t('submitted_on')}</th><th className="p-4">{t('status')}</th><th className="p-4 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {submissions.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-gray-400">{t('no_pending_submissions')}</td></tr>
                ) : submissions.map((sub: QuizSubmission, index: number) => (
                  <tr key={sub.id} className={`border-b border-brand-light-blue/50 ${index === submissions.length - 1 ? 'border-none' : ''}`}>
                    <td className="p-4 font-semibold">{sub.username}</td><td className="p-4">{sub.quizTitle}</td><td className="p-4 text-sm text-gray-400">{new Date(sub.submittedAt).toLocaleDateString()}</td><td className="p-4">{renderStatusBadge(sub.status, t)}</td>
                    <td className="p-4 text-right">
                      <div className="inline-flex gap-4 items-center">
                        {sub.status === 'pending' && getTakeButton(sub)}
                        {sub.status === 'taken' && (<span className="text-xs text-gray-400 italic">{t('taken_by')} {sub.adminUsername === user?.username ? 'You' : sub.adminUsername}</span>)}
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
                    <p><strong>{t('applicant')}:</strong> {viewingSubmission.username}</p><p><strong>{t('quiz_title')}:</strong> {viewingSubmission.quizTitle}</p><p><strong>{t('submitted_on')}:</strong> {new Date(viewingSubmission.submittedAt).toLocaleString()}</p><p><strong>{t('status')}:</strong> {renderStatusBadge(viewingSubmission.status, t)}</p>
                    {viewingSubmission.adminUsername && <p><strong>{t('taken_by')}:</strong> {viewingSubmission.adminUsername}</p>}
                    <div className="border-t border-brand-light-blue pt-4 mt-4">
                        <h4 className="text-lg font-bold text-brand-cyan mb-2">{t('quiz_questions')}</h4>
                        <div className="space-y-3 max-h-60 overflow-y-auto pr-2">{viewingSubmission.answers.map((ans, i) => (<div key={ans.questionId}><p className="font-semibold text-gray-300">{i+1}. {ans.questionText}</p><p className="bg-brand-dark p-2 rounded mt-1 text-gray-200 whitespace-pre-wrap">{ans.answer}</p></div>))}</div>
                    </div>
                    {viewingSubmission.cheatAttempts && viewingSubmission.cheatAttempts.length > 0 && (
                        <div className="border-t border-brand-light-blue pt-4 mt-4">
                            <h4 className="text-lg font-bold text-red-400 mb-2 flex items-center gap-2"><ListChecks /> {t('cheat_attempts_report')}</h4>
                            <div className="space-y-2 max-h-40 overflow-y-auto pr-2 bg-brand-dark p-2 rounded-md">{viewingSubmission.cheatAttempts.map((attempt, i) => (<div key={i} className="text-sm"><span className="font-semibold text-red-300">{attempt.method}</span><span className="text-gray-500 text-xs ml-2">({new Date(attempt.timestamp).toLocaleString()})</span></div>))}</div>
                        </div>
                    )}
                    {viewingSubmission.status === 'taken' && viewingSubmission.adminId === user.id && (
                        <div className="flex justify-end gap-4 pt-6 border-t border-brand-light-blue">
                            <button onClick={() => handleDecision(viewingSubmission.id, 'refused')} className="flex items-center gap-2 bg-red-600 text-white font-bold py-2 px-5 rounded-md hover:bg-red-500 transition-colors"><X size={20}/> {t('refuse')}</button>
                            <button onClick={() => handleDecision(viewingSubmission.id, 'accepted')} className="flex items-center gap-2 bg-green-600 text-white font-bold py-2 px-5 rounded-md hover:bg-green-500 transition-colors"><Check size={20}/> {t('accept')}</button>
                        </div>
                    )}
                </div>
            </Modal>
        )}
    </>;
};

// --- QUIZZES PANEL ---
const QuizzesPanel = ({quizzes, setQuizzes, editingQuiz, setEditingQuiz}: any) => {
    const { t } = useLocalization();
    const { showToast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const handleCreateNewQuiz = () => setEditingQuiz({ id: '', titleKey: '', descriptionKey: '', isOpen: false, questions: [{ id: `q_${Date.now()}`, textKey: '', timeLimit: 60 }], allowedTakeRoles: [] });
    const handleEditQuiz = (quiz: Quiz) => setEditingQuiz(JSON.parse(JSON.stringify(quiz)));
    const handleSaveQuiz = async () => {
        if (editingQuiz) { setIsSaving(true); try { await apiSaveQuiz(editingQuiz); setQuizzes(await getQuizzes()); setEditingQuiz(null); showToast('Quiz saved successfully!', 'success'); } catch (error) { showToast(`Error saving quiz: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error'); } finally { setIsSaving(false); } }
    };
    const handleDeleteQuiz = async (quizId: string) => {
        const quizToDelete = quizzes.find((q: Quiz) => q.id === quizId);
        if (window.confirm(`Delete "${t(quizToDelete?.titleKey || 'this')}" quiz?`)) { try { await apiDeleteQuiz(quizId); setQuizzes(await getQuizzes()); showToast('Quiz deleted!', 'success'); } catch (error) { showToast(`Error deleting quiz: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error'); } }
    };

    return <>
        <div className="flex justify-between items-center my-6"><h2 className="text-2xl font-bold">{t('quiz_management')}</h2><button onClick={handleCreateNewQuiz} className="bg-brand-cyan text-brand-dark font-bold py-2 px-4 rounded-md hover:bg-white transition-all flex items-center gap-2"><Plus size={20} />{t('create_new_quiz')}</button></div>
        <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50">
          <table className="w-full text-left">
            <thead className="border-b border-brand-light-blue/50 text-gray-300"><tr><th className="p-4">{t('quiz_title')}</th><th className="p-4">{t('status')}</th><th className="p-4 text-right">{t('actions')}</th></tr></thead>
            <tbody>
              {quizzes.map((quiz: Quiz, index: number) => (<tr key={quiz.id} className={`border-b border-brand-light-blue/50 ${index === quizzes.length - 1 ? 'border-none' : ''}`}><td className="p-4 font-semibold">{t(quiz.titleKey)}</td><td className="p-4"><span className={`px-3 py-1 text-sm font-bold rounded-full ${quiz.isOpen ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{quiz.isOpen ? t('open') : t('closed')}</span></td><td className="p-4 text-right"><div className="inline-flex gap-4"><button onClick={() => handleEditQuiz(quiz)} className="text-gray-300 hover:text-brand-cyan"><Edit size={20}/></button><button onClick={() => handleDeleteQuiz(quiz.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={20}/></button></div></td></tr>))}
            </tbody>
          </table>
        </div>
        {editingQuiz && <Modal isOpen={!!editingQuiz} onClose={() => setEditingQuiz(null)} title={editingQuiz.id ? t('edit_quiz') : t('create_new_quiz')}>
            <div className="space-y-4 text-white">
                <div><label className="block mb-1 font-semibold text-gray-300">{t('quiz_title')}</label><input type="text" value={editingQuiz.titleKey} onChange={(e) => setEditingQuiz({...editingQuiz, titleKey: e.target.value})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" /></div>
                <div><label className="block mb-1 font-semibold text-gray-300">{t('quiz_handler_roles')}</label><input type="text" placeholder="e.g. 123,456" value={(editingQuiz.allowedTakeRoles || []).join(',')} onChange={(e) => setEditingQuiz({...editingQuiz, allowedTakeRoles: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" /><p className="text-xs text-gray-400 mt-1">{t('quiz_handler_roles_desc')}</p></div>
                <div className="flex items-center gap-4 pt-2"><label className="font-semibold text-gray-300">{t('status')}:</label><button onClick={() => setEditingQuiz({...editingQuiz, isOpen: !editingQuiz.isOpen})} className={`px-4 py-1 rounded-full font-bold ${editingQuiz.isOpen ? 'bg-green-500/30 text-green-300' : 'bg-red-500/30 text-red-300'}`}>{editingQuiz.isOpen ? t('open') : t('closed')}</button></div>
                <div className="flex justify-end gap-4 pt-4 border-t border-brand-light-blue/50 mt-4"><button onClick={() => setEditingQuiz(null)} disabled={isSaving} className="bg-gray-600 text-white font-bold py-2 px-6 rounded-md hover:bg-gray-500">Cancel</button><button onClick={handleSaveQuiz} disabled={isSaving} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white min-w-[8rem] flex justify-center">{isSaving ? <Loader2 className="animate-spin"/> : t('save_quiz')}</button></div>
            </div>
        </Modal>}
    </>;
};

// --- AUDIT LOG PANEL ---
const AuditLogPanel = ({auditLogs}: any) => {
    const { t } = useLocalization();
    return <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50 mt-6">
        <div className="overflow-x-auto"><table className="w-full text-left min-w-[600px]"><thead className="border-b border-brand-light-blue/50 text-gray-300"><tr><th className="p-4">{t('log_timestamp')}</th><th className="p-4">{t('log_admin')}</th><th className="p-4">{t('log_action')}</th></tr></thead><tbody>
        {auditLogs.length === 0 ? (<tr><td colSpan={3} className="p-8 text-center text-gray-400">{t('no_logs_found')}</td></tr>) : auditLogs.map((log: AuditLogEntry) => (<tr key={log.id} className="border-b border-brand-light-blue/50 last:border-none"><td className="p-4 text-sm text-gray-400">{new Date(log.timestamp).toLocaleString()}</td><td className="p-4 font-semibold">{log.admin_username} <code className="text-xs text-gray-500">({log.admin_id})</code></td><td className="p-4">{log.action}</td></tr>))}
        </tbody></table></div>
    </div>
};

// --- APPEARANCE PANEL ---
const AppearancePanel = () => {
    const { config, configLoading, refreshConfig } = useConfig();
    const { t } = useLocalization();
    const { showToast } = useToast();
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
      try { await saveConfig(localConfig); await refreshConfig(); showToast(t('config_updated_success'), 'success'); } catch (e) { showToast(e instanceof Error ? e.message : 'Failed to save settings', 'error'); } finally { setIsSaving(false); }
    };

    const ConfigInput: React.FC<{name: keyof AppConfig; labelKey: string; descKey?: string;}> = ({ name, labelKey, descKey }) => (
        <div><label htmlFor={name} className="block mb-1 font-semibold text-gray-300">{t(labelKey)}</label><input type="text" id={name} name={name} value={String(localConfig?.[name] ?? '')} onChange={handleChange} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600 focus:ring-brand-cyan focus:border-brand-cyan"/>{descKey && <p className="text-xs text-gray-400 mt-1">{t(descKey)}</p>}</div>
    );
  
    if (configLoading || !localConfig) return <div className="flex justify-center items-center py-20"> <Loader2 size={40} className="text-brand-cyan animate-spin" /> </div>;
  
    return <div className="mt-6"><div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold">{t('appearance_settings')}</h2><button onClick={handleSave} disabled={isSaving} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white transition-colors min-w-[9rem] flex justify-center">{isSaving ? <Loader2 className="animate-spin" /> : t('save_settings')}</button></div><div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50 p-6 grid grid-cols-1 md:grid-cols-2 gap-6"><ConfigInput name="COMMUNITY_NAME" labelKey="community_name" /><ConfigInput name="LOGO_URL" labelKey="logo_url" /><ConfigInput name="BACKGROUND_IMAGE_URL" labelKey="background_image_url" descKey="background_image_url_desc" /><ConfigInput name="DISCORD_GUILD_ID" labelKey="discord_guild_id" descKey="discord_guild_id_desc" /><ConfigInput name="SUBMISSIONS_CHANNEL_ID" labelKey="submissions_webhook_url" descKey="submissions_webhook_url_desc" /><ConfigInput name="AUDIT_LOG_CHANNEL_ID" labelKey="audit_log_webhook_url" descKey="audit_log_webhook_url_desc" /></div></div>
};

// --- PERMISSIONS PANEL ---
const PermissionsPanel = () => {
    const { t } = useLocalization();
    const { showToast } = useToast();
    const [roles, setRoles] = useState<DiscordRole[]>([]);
    const [selectedRoleId, setSelectedRoleId] = useState<string>('');
    const [permissions, setPermissions] = useState<Set<PermissionKey>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [hasInitialPermissions, setHasInitialPermissions] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const fetchedRoles = await getGuildRoles();
                setRoles(fetchedRoles);
                const firstRole = fetchedRoles[0]?.id;
                if(firstRole) { setSelectedRoleId(firstRole); const rolePerms = await getRolePermissions(firstRole); setPermissions(new Set(rolePerms?.permissions || [])); }
                if (supabase) { const { count } = await supabase.from('role_permissions').select('*', { count: 'exact', head: true }); if (count && count > 0) { setHasInitialPermissions(true); } }
            } catch (error) { showToast(error instanceof Error ? error.message : "Failed to load roles/permissions.", "error"); } finally { setIsLoading(false); }
        };
        fetchData();
    }, [showToast]);

    const handleRoleChange = async (roleId: string) => {
        setSelectedRoleId(roleId);
        if(!roleId) { setPermissions(new Set()); return; }
        try { const rolePerms = await getRolePermissions(roleId); setPermissions(new Set(rolePerms?.permissions || [])); } catch (error) { showToast(error instanceof Error ? error.message : "Failed to load permissions for role.", "error"); }
    };
    const handlePermissionChange = (key: PermissionKey, checked: boolean) => { const newPerms = new Set(permissions); if(checked) newPerms.add(key); else newPerms.delete(key); setPermissions(newPerms); };
    const handleSavePermissions = async () => {
        if(!selectedRoleId) return;
        setIsSaving(true);
        try { await saveRolePermissions(selectedRoleId, Array.from(permissions)); showToast(t('permissions_saved_success'), 'success'); } catch (error) { showToast(error instanceof Error ? error.message : "Failed to save permissions.", "error"); } finally { setIsSaving(false); }
    };
    
    if(isLoading) return <div className="flex justify-center items-center py-20"><Loader2 className="animate-spin text-brand-cyan" size={40} /></div>

    return (
      <div className="mt-6">
          <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold">{t('permissions_management')}</h2><button onClick={handleSavePermissions} disabled={isSaving || !selectedRoleId} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white transition-colors min-w-[9rem] flex justify-center disabled:opacity-50 disabled:cursor-not-allowed">{isSaving ? <Loader2 className="animate-spin" /> : t('save_permissions')}</button></div>
          <div className="p-4 rounded-md bg-brand-light-blue/50 border border-brand-light-blue text-gray-300 text-sm mb-6">{t(hasInitialPermissions ? 'admin_permissions_instructions' : 'admin_permissions_instructions_initial')}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 bg-brand-dark-blue p-4 rounded-lg border border-brand-light-blue/50"><h3 className="font-bold mb-3 text-lg text-brand-cyan">{t('discord_roles')}</h3><div className="space-y-2 max-h-96 overflow-y-auto pr-2">{roles.map(role => (<button key={role.id} onClick={() => handleRoleChange(role.id)} className="w-full"><RoleBadge role={role} isSelected={selectedRoleId === role.id} /></button>))}</div></div>
              <div className="md:col-span-2 bg-brand-dark-blue p-4 rounded-lg border border-brand-light-blue/50"><h3 className="font-bold mb-3 text-lg text-brand-cyan">{t('available_permissions')}</h3>{selectedRoleId ? (<div className="space-y-3 max-h-96 overflow-y-auto pr-2">{Object.entries(PERMISSIONS).map(([key, desc]) => (<label key={key} className="flex items-start gap-3 p-3 rounded-md bg-brand-light-blue/30 hover:bg-brand-light-blue/60 cursor-pointer"><input type="checkbox" className="mt-1 h-5 w-5 rounded bg-brand-dark border-gray-500 text-brand-cyan focus:ring-brand-cyan" checked={permissions.has(key as PermissionKey)} onChange={(e) => handlePermissionChange(key as PermissionKey, e.target.checked)}/><div><span className="font-bold text-white">{key}</span><p className="text-sm text-gray-400">{desc}</p></div></label>))}</div>) : <p className="text-gray-400">{t('select_role_to_manage')}</p>}</div>
          </div>
      </div>
    );
};

// --- IMPLEMENTED PANELS ---
const StorePanel = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const { t } = useLocalization();
    const { showToast } = useToast();

    const fetchProducts = useCallback(async () => {
        setIsLoading(true);
        try {
            setProducts(await getProducts());
        } catch (error) {
            showToast(error instanceof Error ? error.message : "Failed to load products", "error");
        }
        setIsLoading(false);
    }, [showToast]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const handleSave = async () => {
        if (!editingProduct) return;
        setIsSaving(true);
        try {
            await apiSaveProduct(editingProduct);
            showToast('Product saved!', 'success');
            setEditingProduct(null);
            fetchProducts();
        } catch (error) {
            showToast(error instanceof Error ? error.message : "Failed to save product", "error");
        }
        setIsSaving(false);
    };

    const handleDelete = async (product: Product) => {
        if (window.confirm(`Are you sure you want to delete "${t(product.nameKey)}"?`)) {
            try {
                await apiDeleteProduct(product.id);
                showToast('Product deleted!', 'success');
                fetchProducts();
            } catch (error) {
                showToast(error instanceof Error ? error.message : "Failed to delete product", "error");
            }
        }
    };
    
    if (isLoading) return <div className="flex justify-center items-center py-20"><Loader2 className="animate-spin text-brand-cyan" size={40} /></div>;

    return <>
        <div className="flex justify-between items-center my-6"><h2 className="text-2xl font-bold">{t('store_management')}</h2><button onClick={() => setEditingProduct({})} className="bg-brand-cyan text-brand-dark font-bold py-2 px-4 rounded-md hover:bg-white transition-all flex items-center gap-2"><Plus size={20} />Add Product</button></div>
        <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50"><table className="w-full text-left">
            <thead className="border-b border-brand-light-blue/50 text-gray-300"><tr><th className="p-4">Product Name</th><th className="p-4">Price</th><th className="p-4 text-right">Actions</th></tr></thead>
            <tbody>{products.map((p, i) => <tr key={p.id} className={`border-b border-brand-light-blue/50 ${i === products.length - 1 ? 'border-none' : ''}`}><td className="p-4 font-semibold">{t(p.nameKey)}</td><td className="p-4">${p.price.toFixed(2)}</td><td className="p-4 text-right"><div className="inline-flex gap-4"><button onClick={() => setEditingProduct(p)} className="text-gray-300 hover:text-brand-cyan"><Edit size={20}/></button><button onClick={() => handleDelete(p)} className="text-gray-300 hover:text-red-500"><Trash2 size={20}/></button></div></td></tr>)}</tbody>
        </table></div>
        {editingProduct && <Modal isOpen={!!editingProduct} onClose={() => setEditingProduct(null)} title={editingProduct.id ? 'Edit Product' : 'Add Product'}>
            <div className="space-y-4 text-white">
                <input type="text" placeholder="Name Key" value={editingProduct.nameKey || ''} onChange={e => setEditingProduct({...editingProduct, nameKey: e.target.value})} className="w-full bg-brand-light-blue p-2 rounded" />
                <input type="text" placeholder="Description Key" value={editingProduct.descriptionKey || ''} onChange={e => setEditingProduct({...editingProduct, descriptionKey: e.target.value})} className="w-full bg-brand-light-blue p-2 rounded" />
                <input type="number" placeholder="Price" value={editingProduct.price || ''} onChange={e => setEditingProduct({...editingProduct, price: parseFloat(e.target.value)})} className="w-full bg-brand-light-blue p-2 rounded" />
                <input type="text" placeholder="Image URL" value={editingProduct.imageUrl || ''} onChange={e => setEditingProduct({...editingProduct, imageUrl: e.target.value})} className="w-full bg-brand-light-blue p-2 rounded" />
                <div className="flex justify-end gap-4 pt-4"><button onClick={() => setEditingProduct(null)} className="bg-gray-600 font-bold py-2 px-6 rounded-md">Cancel</button><button onClick={handleSave} disabled={isSaving} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md">{isSaving ? <Loader2 className="animate-spin"/> : 'Save'}</button></div>
            </div>
        </Modal>}
    </>;
};

const RulesPanel = () => {
    const [rules, setRules] = useState<RuleCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { t } = useLocalization();
    const { showToast } = useToast();

    useEffect(() => {
        const fetch = async () => {
            setIsLoading(true);
            setRules(await getRules());
            setIsLoading(false);
        };
        fetch();
    }, []);

    const handleUpdate = (catIndex: number, ruleIndex: number | null, field: string, value: string) => {
        const newRules = JSON.parse(JSON.stringify(rules));
        if (ruleIndex === null) newRules[catIndex][field] = value;
        else newRules[catIndex].rules[ruleIndex][field] = value;
        setRules(newRules);
    };
    const addCategory = () => setRules([...rules, {id: `new_cat_${Date.now()}`, titleKey: '', order: rules.length, rules: []}]);
    const addRule = (catIndex: number) => {
        const newRules = [...rules];
        const newRule = {id: `new_rule_${Date.now()}`, textKey: '', order: newRules[catIndex].rules.length};
        newRules[catIndex].rules.push(newRule);
        setRules(newRules);
    };
    const removeCategory = (catIndex: number) => setRules(rules.filter((_, i) => i !== catIndex));
    const removeRule = (catIndex: number, ruleIndex: number) => {
        const newRules = [...rules];
        newRules[catIndex].rules = newRules[catIndex].rules.filter((_, i) => i !== ruleIndex);
        setRules(newRules);
    };
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const payload = rules.map((c, ci) => ({...c, order: ci, rules: c.rules.map((r, ri) => ({...r, order: ri}))}));
            await apiSaveRules(payload);
            showToast(t('rules_updated_success'), 'success');
        } catch (error) { showToast(error instanceof Error ? error.message : "Failed to save", "error"); }
        setIsSaving(false);
    };

    if (isLoading) return <div className="flex justify-center items-center py-20"><Loader2 className="animate-spin text-brand-cyan" size={40} /></div>;

    return <>
        <div className="flex justify-between items-center my-6"><h2 className="text-2xl font-bold">{t('rules_management')}</h2><button onClick={handleSave} disabled={isSaving} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white transition-colors">{isSaving ? <Loader2 className="animate-spin"/> : t('save_rules')}</button></div>
        <div className="space-y-4">
            {rules.map((cat, ci) => <div key={cat.id} className="bg-brand-dark-blue border border-brand-light-blue/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3"><input value={cat.titleKey} onChange={e => handleUpdate(ci, null, 'titleKey', e.target.value)} placeholder="Category Title Key" className="flex-grow bg-brand-light-blue p-2 rounded text-lg font-bold text-brand-cyan" /><button onClick={() => removeCategory(ci)} className="text-red-500"><Trash size={20}/></button></div>
                <div className="space-y-2 pl-4">{cat.rules.map((rule, ri) => <div key={rule.id} className="flex items-center gap-2"><input value={rule.textKey} onChange={e => handleUpdate(ci, ri, 'textKey', e.target.value)} placeholder="Rule Text Key" className="flex-grow bg-brand-dark p-2 rounded" /><button onClick={() => removeRule(ci, ri)} className="text-red-500"><Trash size={18}/></button></div>)}</div>
                <button onClick={() => addRule(ci)} className="text-brand-cyan text-sm mt-3 flex items-center gap-1"><PlusCircle size={16}/>Add Rule</button>
            </div>)}
            <button onClick={addCategory} className="w-full bg-brand-light-blue/50 border border-dashed border-brand-light-blue py-3 rounded-lg hover:bg-brand-light-blue">Add Category</button>
        </div>
    </>;
};

const TranslationsPanel = () => {
    const { translations: initialTranslations, loading: translationsLoading } = useTranslations();
    const [translations, setTranslations] = useState<Translations>({});
    const [searchTerm, setSearchTerm] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const { t } = useLocalization();
    const { showToast } = useToast();

    useEffect(() => setTranslations(initialTranslations), [initialTranslations]);
    
    const handleSave = async () => {
        setIsSaving(true);
        try {
            await apiSaveTranslations(translations);
            showToast('Translations saved!', 'success');
        } catch (e) { showToast(e instanceof Error ? e.message : "Failed to save", "error"); }
        setIsSaving(false);
    };

    const filteredKeys = Object.keys(translations).filter(key => key.toLowerCase().includes(searchTerm.toLowerCase()));

    if (translationsLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-cyan" size={40}/></div>;

    return <>
        <div className="flex justify-between items-center my-6"><h2 className="text-2xl font-bold">{t('translations_management')}</h2><button onClick={handleSave} disabled={isSaving} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white">{isSaving ? <Loader2 className="animate-spin"/> : t('save_translations')}</button></div>
        <div className="relative mb-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20}/><input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search keys..." className="w-full bg-brand-light-blue p-3 pl-10 rounded-md border border-gray-600"/></div>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">{filteredKeys.map(key => <div key={key} className="bg-brand-dark-blue p-3 rounded-lg border border-brand-light-blue/50">
            <p className="font-mono text-sm text-brand-cyan mb-2">{key}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <textarea value={translations[key].en} onChange={e => setTranslations({...translations, [key]: {...translations[key], en: e.target.value}})} className="w-full bg-brand-dark p-2 rounded h-20" placeholder="English"/>
                <textarea value={translations[key].ar} onChange={e => setTranslations({...translations, [key]: {...translations[key], ar: e.target.value}})} className="w-full bg-brand-dark p-2 rounded h-20 rtl" placeholder="Arabic"/>
            </div>
        </div>)}</div>
    </>;
};

const UserLookupPanel = () => {
    const [discordId, setDiscordId] = useState('');
    const [result, setResult] = useState<UserLookupResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { t } = useLocalization();

    const handleSearch = async () => {
        if (!discordId) return;
        setIsLoading(true);
        setError(null);
        setResult(null);
        try {
            setResult(await lookupUser(discordId));
        } catch (e) { setError(e instanceof Error ? e.message : "User not found"); }
        setIsLoading(false);
    };

    return <>
        <div className="my-6"><h2 className="text-2xl font-bold">{t('user_lookup')}</h2></div>
        <div className="flex gap-2"><input value={discordId} onChange={e => setDiscordId(e.target.value)} placeholder="Enter Discord User ID" className="flex-grow bg-brand-light-blue p-3 rounded-md border border-gray-600"/><button onClick={handleSearch} disabled={isLoading} className="bg-brand-cyan text-brand-dark font-bold py-3 px-6 rounded-md">{isLoading ? <Loader2 className="animate-spin"/> : "Search"}</button></div>
        {error && <div className="mt-4 text-red-400 text-center">{error}</div>}
        {result && <div className="mt-6 bg-brand-dark-blue p-4 rounded-lg border border-brand-light-blue/50">
            <div className="flex items-center gap-4"><img src={result.avatar} className="w-16 h-16 rounded-full"/><div><h3 className="text-xl font-bold">{result.username}</h3><div className="flex flex-wrap gap-1 mt-1">{result.roles.map(r => <RoleBadge key={r.id} role={r}/>)}</div></div></div>
            <h4 className="font-bold mt-4 pt-4 border-t border-brand-light-blue">Submissions</h4>
            <div className="overflow-x-auto"><table className="w-full text-left mt-2">
                <tbody>{result.submissions.map(s => <tr key={s.id} className="border-b border-brand-light-blue/50 last:border-b-0"><td className="p-2">{s.quizTitle}</td><td className="p-2">{new Date(s.submittedAt).toLocaleDateString()}</td><td className="p-2">{renderStatusBadge(s.status, t)}</td></tr>)}</tbody>
            </table></div>
        </div>}
    </>;
};


export default AdminPage;