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
  saveConfig,
  lookupDiscordUser,
  getProducts,
  saveProduct,
  deleteProduct,
  getTranslations,
  saveTranslations,
  getGuildRoles,
  getRolePermissions,
  saveRolePermissions,
} from '../lib/api';
import type { Quiz, QuizSubmission, SubmissionStatus, AuditLogEntry, RuleCategory, Rule, Product, AppConfig, UserLookupResult, Translations, DiscordRole, RolePermission } from '../types';
import { useNavigate } from 'react-router-dom';
import { UserCog, Plus, Edit, Trash2, Check, X, FileText, Server, Eye, Loader2, ShieldCheck, BookCopy, Store, Palette, Search, Languages, KeyRound } from 'lucide-react';
import Modal from '../components/Modal';
import SEO from '../components/SEO';


type AdminTab = 'submissions' | 'quizzes' | 'rules' | 'store' | 'appearance' | 'lookup' | 'translations' | 'permissions' | 'audit';
type PermissionKey = Exclude<AdminTab, 'permissions' | 'submissions' | 'lookup'> | '_super_admin';


const TABS: { id: AdminTab; labelKey: string; icon: React.ElementType; permission: string }[] = [
  { id: 'submissions', labelKey: 'submission_management', icon: FileText, permission: 'submissions' },
  { id: 'lookup', labelKey: 'user_lookup', icon: Search, permission: 'lookup' },
  { id: 'permissions', labelKey: 'permissions_management', icon: KeyRound, permission: '_super_admin' },
  { id: 'quizzes', labelKey: 'quiz_management', icon: Server, permission: 'quizzes' },
  { id: 'rules', labelKey: 'rules_management', icon: BookCopy, permission: 'rules' },
  { id: 'store', labelKey: 'store_management', icon: Store, permission: 'store' },
  { id: 'translations', labelKey: 'translations_management', icon: Languages, permission: 'translations' },
  { id: 'appearance', labelKey: 'appearance_settings', icon: Palette, permission: 'appearance' },
  { id: 'audit', labelKey: 'audit_log', icon: ShieldCheck, permission: 'audit' },
];

const AVAILABLE_PERMISSIONS: { key: PermissionKey; labelKey: string }[] = [
    { key: '_super_admin', labelKey: 'grant_super_admin_access' },
    { key: 'quizzes', labelKey: 'quiz_management' },
    { key: 'rules', labelKey: 'rules_management' },
    { key: 'store', labelKey: 'store_management' },
    { key: 'translations', labelKey: 'translations_management' },
    { key: 'appearance', labelKey: 'appearance_settings' },
    { key: 'audit', labelKey: 'audit_log' },
];


const AdminPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLocalization();
  const { showToast } = useToast();
  const { config } = useConfig();
  const communityName = config.COMMUNITY_NAME;
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
  const [translations, setTranslations] = useState<Translations>({});
  
  const [isTabLoading, setIsTabLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // User Lookup State
  const [lookupUserId, setLookupUserId] = useState('');
  const [lookupResult, setLookupResult] = useState<UserLookupResult | null>(null);
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Permissions Panel State
  const [allGuildRoles, setAllGuildRoles] = useState<DiscordRole[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  
  useEffect(() => {
    if (!authLoading && !user?.isAdmin) {
        navigate('/');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user?.isAdmin) return;
    setLookupResult(null);

    const fetchDataForTab = async () => {
        setIsTabLoading(true);
        try {
            switch (activeTab) {
                case 'submissions': 
                    if (user.permissions.has('submissions')) {
                      setSubmissions(await getSubmissions());
                      if(quizzes.length === 0) setQuizzes(await getQuizzes());
                    }
                    break;
                case 'quizzes': if (user.permissions.has('quizzes')) setQuizzes(await getQuizzes()); break;
                case 'lookup': break;
                case 'permissions':
                    if (user.permissions.has('_super_admin')) {
                        const [guildRoles, currentPerms] = await Promise.all([getGuildRoles(), getRolePermissions()]);
                        setAllGuildRoles(guildRoles.sort((a,b) => b.position - a.position));
                        setRolePermissions(currentPerms);
                    }
                    break;
                case 'rules': if (user.permissions.has('rules')) setEditableRules(JSON.parse(JSON.stringify(await getRules()))); break;
                case 'store': if (user.permissions.has('store')) setProducts(await getProducts()); break;
                case 'translations': if(user.permissions.has('translations')) setTranslations(await getTranslations()); break;
                case 'appearance': if (user.permissions.has('appearance')) setEditableConfig({ ...config }); break;
                case 'audit': if (user.permissions.has('audit')) setAuditLogs(await getAuditLogs()); break;
            }
        } catch (error) {
            console.error(`Failed to fetch data for tab: ${activeTab}`, error);
            showToast(`Failed to load data for ${activeTab}.`, "error");
        } finally {
            setIsTabLoading(false);
        }
    };

    fetchDataForTab();
  }, [activeTab, user]);

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
            setTimeout(() => window.location.reload(), 1000);
        } catch(e) {
            showToast(`Error saving settings: ${e instanceof Error ? e.message : 'Unknown error'}`, 'error');
        } finally { setIsSaving(false); }
    }
  }
  
  const handleSaveTranslations = async () => {
    if(translations) {
        setIsSaving(true);
        try {
            await saveTranslations(translations);
            showToast(t('translations_updated_success'), 'success');
            setTimeout(() => window.location.reload(), 1000);
        } catch(e) {
            showToast(`Error saving translations: ${e instanceof Error ? e.message : 'Unknown error'}`, 'error');
        } finally { setIsSaving(false); }
    }
  };

  const handleUserLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupUserId.trim()) return;
    
    setIsLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);

    try {
        const result = await lookupDiscordUser(lookupUserId.trim());
        setLookupResult(result);
    } catch (error) {
        console.error("User lookup failed:", error);
        setLookupError(t('no_user_found_or_no_data'));
    } finally {
        setIsLookupLoading(false);
    }
  };
  
  const handleSaveProduct = async () => {
    if (!editingProduct) return;
    setIsSaving(true);
    try {
      await saveProduct(editingProduct);
      setProducts(await getProducts());
      setEditingProduct(null);
      showToast('Product saved successfully!', 'success');
    } catch (error) {
      showToast(`Error saving product: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (window.confirm(t('delete_product_confirm') + `\n"${t(product?.nameKey || 'this product')}"`)) {
      try {
        await deleteProduct(productId);
        setProducts(await getProducts());
        showToast('Product deleted!', 'success');
      } catch (error) {
        showToast(`Error deleting product: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      }
    }
  };
  
  const handleSaveRules = async () => {
    if (!editableRules) return;
    setIsSaving(true);
    try {
        await apiSaveRules(editableRules);
        showToast(t('rules_updated_success'), 'success');
    } catch (error) {
        // FIX: Corrected variable name from 'e' to 'error'.
        showToast(`Error saving rules: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
        setIsSaving(false);
    }
  };

  if (authLoading || !user?.isAdmin) {
    return (
        <div className="flex flex-col gap-4 justify-center items-center h-screen w-screen">
            <Loader2 size={48} className="text-brand-cyan animate-spin" />
        </div>
    );
  }

  // Filter tabs based on user's new permissions structure
  const visibleTabs = TABS.filter(tab => user.permissions.has(tab.permission));

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
        <tbody>{quizzes.map((quiz, i) => (<tr key={quiz.id} className={`border-b border-brand-light-blue/50 ${i === quizzes.length - 1 ? 'border-none' : ''}`}><td className="p-4 font-semibold">{t(quiz.titleKey)}</td><td className="p-4"><span className={`px-3 py-1 text-sm font-bold rounded-full ${quiz.isOpen ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{quiz.isOpen ? t('open') : t('closed')}</span></td><td className="p-4 text-right"><div className="inline-flex gap-4"><button onClick={() => setEditingQuiz(JSON.parse(JSON.stringify(quiz)))} className="text-gray-300 hover:text-brand-cyan"><Edit size={20}/></button><button onClick={() => handleDeleteQuiz(quiz.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={20}/></button></div></td></tr>))}</tbody>
      </table></div>
    </div>
  );

  const StorePanel = () => (
    <div>
      <div className="flex justify-between items-center my-6">
        <h2 className="text-2xl font-bold">{t('store_management')}</h2>
        <button onClick={() => setEditingProduct({ id: '', nameKey: '', descriptionKey: '', price: 0, imageUrl: '' })} className="bg-brand-cyan text-brand-dark font-bold py-2 px-4 rounded-md hover:bg-white transition-all flex items-center gap-2">
            <Plus size={20} />{t('add_new_product')}
        </button>
      </div>
      <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50">
        <table className="w-full text-left"><thead className="border-b border-brand-light-blue/50 text-gray-300"><tr><th className="p-4">{t('product_name_key')}</th><th className="p-4">{t('price')}</th><th className="p-4 text-right">{t('actions')}</th></tr></thead>
        <tbody>
          {products.map((product, i) => (
            <tr key={product.id} className={`border-b border-brand-light-blue/50 ${i === products.length - 1 ? 'border-none' : ''}`}>
              <td className="p-4 font-semibold">{t(product.nameKey)}</td>
              <td className="p-4">${product.price.toFixed(2)}</td>
              <td className="p-4 text-right"><div className="inline-flex gap-4"><button onClick={() => setEditingProduct(JSON.parse(JSON.stringify(product)))} className="text-gray-300 hover:text-brand-cyan"><Edit size={20}/></button><button onClick={() => handleDeleteProduct(product.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={20}/></button></div></td>
            </tr>
          ))}
        </tbody></table>
      </div>
    </div>
  );
  
  const RulesPanel = () => {
    const handleCategoryChange = (index: number, newTitle: string) => {
        if (!editableRules) return;
        const newRules = [...editableRules];
        newRules[index].titleKey = newTitle;
        setEditableRules(newRules);
    };
    const handleRuleChange = (catIndex: number, ruleIndex: number, newText: string) => {
        if (!editableRules) return;
        const newRules = [...editableRules];
        if (newRules[catIndex]?.rules?.[ruleIndex]) {
            newRules[catIndex].rules[ruleIndex].textKey = newText;
            setEditableRules(newRules);
        }
    };
    const addCategory = () => {
        const newCategory: RuleCategory = { id: `cat_${Date.now()}`, titleKey: '', rules: [] };
        setEditableRules(prev => prev ? [...prev, newCategory] : [newCategory]);
    };
    const addRule = (catIndex: number) => {
        if (!editableRules || !editableRules[catIndex]) return;
        const newRule: Rule = { id: `rule_${Date.now()}`, textKey: '' };
        const newRules = [...editableRules];
        // Ensure the rules property is an array before pushing to it.
        if (!Array.isArray(newRules[catIndex].rules)) {
            newRules[catIndex].rules = [];
        }
        newRules[catIndex].rules.push(newRule);
        setEditableRules(newRules);
    };
    const deleteCategory = (catIndex: number) => {
        if (!editableRules || !window.confirm(t('delete_category_confirm'))) return;
        const newRules = [...editableRules];
        newRules.splice(catIndex, 1);
        setEditableRules(newRules);
    };
     const deleteRule = (catIndex: number, ruleIndex: number) => {
        if (!editableRules) return;
        const newRules = [...editableRules];
        if (newRules[catIndex] && Array.isArray(newRules[catIndex].rules)) {
            newRules[catIndex].rules.splice(ruleIndex, 1);
            setEditableRules(newRules);
        }
    };

    return (
      <div>
        <div className="flex justify-between items-center my-6">
          <h2 className="text-2xl font-bold">{t('rules_management')}</h2>
          <div className="flex gap-4">
            <button onClick={addCategory} className="bg-brand-light-blue text-white font-bold py-2 px-4 rounded-md hover:bg-brand-cyan/20 flex items-center gap-2"><Plus size={20} />{t('add_category')}</button>
            <button onClick={handleSaveRules} disabled={isSaving} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white transition-colors min-w-[9rem] flex justify-center">{isSaving ? <Loader2 className="animate-spin" /> : t('save_rules')}</button>
          </div>
        </div>
        <div className="space-y-6">
            {(editableRules || []).map((cat, catIndex) => (
                <div key={cat.id} className="bg-brand-dark-blue p-6 rounded-lg border border-brand-light-blue/50">
                    <div className="flex items-center gap-4 mb-4">
                        <input type="text" placeholder={t('category_title_key')} value={cat.titleKey} onChange={(e) => handleCategoryChange(catIndex, e.target.value)} className="w-full bg-brand-light-blue text-white text-xl font-bold p-2 rounded border border-gray-600" />
                        <button onClick={() => deleteCategory(catIndex)} className="text-red-500 hover:text-red-400"><Trash2/></button>
                    </div>
                    <div className="space-y-3 pl-6 border-l-2 border-brand-light-blue">
                        {(cat.rules || []).map((rule, ruleIndex) => (
                            <div key={rule.id} className="flex items-center gap-2">
                                <span className="text-brand-cyan font-bold">{ruleIndex + 1}.</span>
                                <input type="text" placeholder={t('rule_text_key')} value={rule.textKey} onChange={(e) => handleRuleChange(catIndex, ruleIndex, e.target.value)} className="w-full bg-brand-dark p-2 rounded border border-gray-700" />
                                <button onClick={() => deleteRule(catIndex, ruleIndex)} className="text-red-500/70 hover:text-red-400"><X size={18}/></button>
                            </div>
                        ))}
                        <button onClick={() => addRule(catIndex)} className="text-sm bg-brand-light-blue/50 text-brand-cyan font-bold py-1 px-3 rounded-md hover:bg-brand-light-blue flex items-center gap-1"><Plus size={16}/>{t('add_rule')}</button>
                    </div>
                </div>
            ))}
        </div>
      </div>
    );
  };
  
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
        
        <div className="pt-4 border-t border-brand-light-blue/50">
            <h3 className="text-xl font-bold text-brand-cyan mb-4">Discord Integration</h3>
            <div><label className="block mb-2 font-semibold text-gray-300">{t('discord_guild_id')}</label><input type="text" placeholder="e.g. 1422936346233933980" value={editableConfig.DISCORD_GUILD_ID || ''} onChange={(e) => setEditableConfig({...editableConfig, DISCORD_GUILD_ID: e.target.value})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" /><p className="text-xs text-gray-400 mt-1">{t('discord_guild_id_desc')}</p></div>
            <div className="mt-4"><label className="block mb-2 font-semibold text-gray-300">{t('submissions_webhook_url')}</label><input type="text" value={editableConfig.SUBMISSIONS_WEBHOOK_URL || ''} onChange={(e) => setEditableConfig({...editableConfig, SUBMISSIONS_WEBHOOK_URL: e.target.value})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" /><p className="text-xs text-gray-400 mt-1">{t('submissions_webhook_url_desc')}</p></div>
            <div className="mt-4"><label className="block mb-2 font-semibold text-gray-300">{t('audit_log_webhook_url')}</label><input type="text" value={editableConfig.AUDIT_LOG_WEBHOOK_URL || ''} onChange={(e) => setEditableConfig({...editableConfig, AUDIT_LOG_WEBHOOK_URL: e.target.value})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" /><p className="text-xs text-gray-400 mt-1">{t('audit_log_webhook_url_desc')}</p></div>
        </div>
        
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
    <div className="mt-6 max-w-5xl mx-auto">
      <form onSubmit={handleUserLookup} className="bg-brand-dark-blue p-6 rounded-lg border border-brand-light-blue/50 flex flex-col sm:flex-row items-center gap-4">
        <input type="text" value={lookupUserId} onChange={e => setLookupUserId(e.target.value)} placeholder={t('enter_discord_id')} className="w-full bg-brand-light-blue text-white p-3 rounded-md border border-gray-600 focus:ring-2 focus:ring-brand-cyan focus:border-brand-cyan transition-colors" />
        <button type="submit" disabled={isLookupLoading} className="w-full sm:w-auto bg-brand-cyan text-brand-dark font-bold py-3 px-8 rounded-md hover:bg-white transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait">
          {isLookupLoading ? <Loader2 className="animate-spin" /> : <Search />} <span>{t('search')}</span>
        </button>
      </form>

      {isLookupLoading && <div className="flex justify-center py-10"><Loader2 size={40} className="animate-spin text-brand-cyan" /></div>}
      {lookupError && <div className="mt-6 text-center text-red-400 bg-red-500/10 p-4 rounded-lg">{lookupError}</div>}
      
      {lookupResult && (
        <div className="mt-8 space-y-8 animate-fade-in-up">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-1 space-y-6">
                  {/* User Info Card */}
                  <div className="bg-brand-dark-blue p-6 rounded-lg border border-brand-light-blue/50">
                      <h3 className="text-xl font-bold text-brand-cyan mb-4">{t('user_information')}</h3>
                      <div className="flex flex-col items-center">
                          <img src={lookupResult.avatar} alt={lookupResult.username} className="w-24 h-24 rounded-full border-4 border-brand-cyan/50"/>
                          <p className="text-2xl font-bold mt-3">{lookupResult.username}</p>
                          <p className="text-sm text-gray-400">ID: {lookupResult.id}</p>
                          <p className="text-xs text-gray-500 mt-2">{t('joined_discord')}: {new Date(lookupResult.joinedAt).toLocaleDateString()}</p>
                      </div>
                      <div className="mt-4 pt-4 border-t border-brand-light-blue/50">
                          <h4 className="font-semibold text-gray-300 mb-2">{t('discord_roles')}</h4>
                          <div className="flex flex-wrap justify-center gap-1.5">
                              {lookupResult.discordRoles.filter(r => r.name !== '@everyone').map(role => (
                                <span key={role.id} className="px-2 py-0.5 text-xs font-semibold rounded-full border" style={{ backgroundColor: `${role.color}20`, borderColor: role.color, color: role.color }}>{role.name}</span>
                              ))}
                          </div>
                      </div>
                  </div>
                   <div className="bg-brand-dark-blue p-6 rounded-lg border border-brand-light-blue/50">
                      <h3 className="text-xl font-bold text-brand-cyan mb-4">{t('permissions')}</h3>
                      {lookupResult.permissions.length > 0 ? (
                        <ul className="space-y-2">
                          {lookupResult.permissions.map(perm => (
                            <li key={perm} className="flex items-center gap-2 text-gray-200">
                              <Check size={16} className="text-green-400" />
                              <span>{t(perm === '_super_admin' ? 'grant_super_admin_access' : `${perm}_management`)}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-gray-400 italic">This user has no admin permissions.</p>
                      )}
                   </div>
              </div>
              <div className="md:col-span-2">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><FileText className="text-brand-cyan"/>{t('application_history')}</h3>
                  <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50"><div className="overflow-x-auto"><table className="w-full text-left min-w-[500px]"><thead className="border-b border-brand-light-blue/50 text-gray-300"><tr><th className="p-4">{t('application_type')}</th><th className="p-4">{t('submitted_on')}</th><th className="p-4">{t('status')}</th></tr></thead>
                  <tbody>
                    {lookupResult.submissions.length === 0 ? (<tr><td colSpan={3} className="p-8 text-center text-gray-400">{t('no_submissions_found_for_user')}</td></tr>) : lookupResult.submissions.map(sub => (<tr key={sub.id} className="border-b border-brand-light-blue/50 last:border-none"><td className="p-4 font-semibold">{sub.quizTitle}</td><td className="p-4 text-sm text-gray-400">{new Date(sub.submittedAt).toLocaleDateString()}</td><td className="p-4">{renderStatusBadge(sub.status)}</td></tr>))}
                  </tbody></table></div></div>
              </div>
            </div>
        </div>
      )}
    </div>
  );
  
  const TranslationsPanel = () => {
    const [searchTerm, setSearchTerm] = useState('');

    const handleTranslationChange = (key: string, lang: 'ar' | 'en', value: string) => {
      setTranslations(prev => ({
        ...prev,
        [key]: { ...prev[key], [lang]: value }
      }));
    };
    
    const filteredKeys = Object.keys(translations).filter(key => 
      key.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div>
        <div className="flex justify-between items-center my-6">
          <h2 className="text-2xl font-bold">{t('translations_management')}</h2>
          <button onClick={handleSaveTranslations} disabled={isSaving} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white transition-colors min-w-[9rem] flex justify-center">{isSaving ? <Loader2 className="animate-spin" /> : t('save_translations')}</button>
        </div>
        <div className="mb-4">
          <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder={t('search_by_key')} className="w-full bg-brand-light-blue text-white p-3 rounded-md border border-gray-600 focus:ring-2 focus:ring-brand-cyan"/>
        </div>
        <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50 max-h-[60vh] overflow-y-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-brand-dark-blue border-b border-brand-light-blue/50 text-gray-300">
              <tr>
                <th className="p-4 w-1/4">{t('key')}</th>
                <th className="p-4 w-2/5">{t('english_translation')}</th>
                <th className="p-4 w-2/5">{t('arabic_translation')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredKeys.map(key => (
                <tr key={key} className="border-b border-brand-light-blue/50 last:border-none">
                  <td className="p-4 font-mono text-sm text-gray-400">{key}</td>
                  <td className="p-4">
                    <textarea value={translations[key]?.en || ''} onChange={e => handleTranslationChange(key, 'en', e.target.value)} className="w-full bg-brand-dark p-2 rounded border border-gray-700 h-20" />
                  </td>
                   <td className="p-4">
                    <textarea dir="rtl" value={translations[key]?.ar || ''} onChange={e => handleTranslationChange(key, 'ar', e.target.value)} className="w-full bg-brand-dark p-2 rounded border border-gray-700 h-20" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const PermissionsPanel = () => {
    const [currentPerms, setCurrentPerms] = useState<string[]>([]);
    
    useEffect(() => {
        if(selectedRoleId) {
            const existing = rolePermissions.find(p => p.role_id === selectedRoleId);
            setCurrentPerms(existing ? existing.permissions : []);
        } else {
            setCurrentPerms([]);
        }
    }, [selectedRoleId]);
    
    const handlePermissionChange = (permKey: PermissionKey, checked: boolean) => {
        let newPerms = new Set(currentPerms);
        if (checked) {
            newPerms.add(permKey);
            if(permKey === '_super_admin') {
                AVAILABLE_PERMISSIONS.forEach(p => newPerms.add(p.key));
            }
        } else {
            newPerms.delete(permKey);
             if(permKey === '_super_admin') {
                newPerms.clear();
            }
        }
        setCurrentPerms(Array.from(newPerms));
    }

    const handleSave = async () => {
        if (!selectedRoleId) return;
        setIsSaving(true);
        try {
            await saveRolePermissions(selectedRoleId, currentPerms);
            setRolePermissions(await getRolePermissions());
            showToast(t('permissions_saved_success'), 'success');
        } catch(e) {
            showToast(e instanceof Error ? e.message : 'Failed to save.', 'error');
        } finally {
            setIsSaving(false);
        }
    }
    
    return (
      <div className="mt-6 max-w-3xl mx-auto">
        <div className="bg-brand-dark-blue p-6 rounded-lg border border-brand-light-blue/50">
            <h3 className="text-xl font-bold text-brand-cyan mb-4">{t('discord_role')}</h3>
            <select value={selectedRoleId} onChange={e => setSelectedRoleId(e.target.value)} className="w-full bg-brand-light-blue text-white p-3 rounded-md border border-gray-600 mb-6">
                <option value="">{t('select_role_to_configure')}</option>
                {allGuildRoles.filter(r => r.name !== '@everyone').map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                ))}
            </select>

            {selectedRoleId && (
                <div className="animate-fade-in-up">
                    <h3 className="text-xl font-bold text-brand-cyan mb-4">{t('available_permissions')}</h3>
                    <div className="space-y-3">
                        {AVAILABLE_PERMISSIONS.map(perm => {
                            const isChecked = currentPerms.includes(perm.key);
                            const isSuperAdmin = currentPerms.includes('_super_admin');
                            return (
                                <div key={perm.key} className="flex items-center bg-brand-light-blue/50 p-3 rounded-md">
                                    <input 
                                        type="checkbox" 
                                        id={`perm-${perm.key}`} 
                                        checked={isChecked}
                                        disabled={isSuperAdmin && perm.key !== '_super_admin'}
                                        onChange={e => handlePermissionChange(perm.key, e.target.checked)}
                                        className="h-5 w-5 rounded bg-brand-dark border-gray-500 text-brand-cyan focus:ring-brand-cyan disabled:opacity-50"
                                    />
                                    <label htmlFor={`perm-${perm.key}`} className="ms-3 font-semibold text-gray-200">{t(perm.labelKey)}</label>
                                </div>
                            )
                        })}
                    </div>
                    <div className="flex justify-end mt-8">
                        <button onClick={handleSave} disabled={isSaving} className="bg-brand-cyan text-brand-dark font-bold py-2 px-8 rounded-md hover:bg-white min-w-[9rem] flex justify-center">{isSaving ? <Loader2 className="animate-spin"/> : t('save_permissions')}</button>
                    </div>
                </div>
            )}
        </div>
      </div>
    );
  };

  return (
    <>
      <SEO 
        title={`${communityName} - ${t('admin_panel')}`}
        description="Admin control panel for authorized staff members."
        noIndex={true}
      />
      <div className="container mx-auto px-6 py-16">
        <div className="text-center mb-12"><div className="inline-block p-4 bg-brand-light-blue rounded-full mb-4"><UserCog className="text-brand-cyan" size={48} /></div><h1 className="text-4xl md:text-5xl font-bold mb-4">{t('page_title_admin')}</h1></div>
        <div className="max-w-6xl mx-auto">
            <div className="flex border-b border-brand-light-blue/50 mb-6 overflow-x-auto">
                {visibleTabs.map((tab) => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`py-3 px-6 font-bold flex-shrink-0 flex items-center gap-2 transition-colors ${activeTab === tab.id ? 'text-brand-cyan border-b-2 border-brand-cyan' : 'text-gray-400 hover:text-brand-cyan'}`}><tab.icon size={18}/> {t(tab.labelKey)}</button>
                ))}
            </div>
            <TabContent>
              {activeTab === 'submissions' && user.permissions.has('submissions') && <SubmissionsPanel />}
              {activeTab === 'quizzes' && user.permissions.has('quizzes') && <QuizzesPanel />}
              {activeTab === 'lookup' && user.permissions.has('lookup') && <UserLookupPanel />}
              {activeTab === 'permissions' && user.permissions.has('_super_admin') && <PermissionsPanel />}
              {activeTab === 'rules' && user.permissions.has('rules') && <RulesPanel />}
              {activeTab === 'store' && user.permissions.has('store') && <StorePanel />}
              {activeTab === 'translations' && user.permissions.has('translations') && <TranslationsPanel />}
              {activeTab === 'appearance' && user.permissions.has('appearance') && <AppearancePanel />}
              {activeTab === 'audit' && user.permissions.has('audit') && <AuditLogPanel />}
            </TabContent>
        </div>
        
        {editingQuiz && <Modal isOpen={!!editingQuiz} onClose={() => setEditingQuiz(null)} title={editingQuiz.id ? t('edit_quiz') : t('create_new_quiz')}>
            <div className="space-y-4 text-white max-h-[70vh] overflow-y-auto pr-2">
                <div><label className="block mb-1 font-semibold text-gray-300">{t('quiz_title')}</label><input type="text" value={editingQuiz.titleKey} onChange={(e) => setEditingQuiz({...editingQuiz, titleKey: e.target.value})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" /></div>
                <div><label className="block mb-1 font-semibold text-gray-300">{t('quiz_description')}</label><textarea value={editingQuiz.descriptionKey} onChange={(e) => setEditingQuiz({...editingQuiz, descriptionKey: e.target.value})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" rows={3}></textarea></div>
                <div><label className="block mb-1 font-semibold text-gray-300">{t('quiz_logo_url')}</label><input type="text" value={editingQuiz.logoUrl || ''} onChange={(e) => setEditingQuiz({...editingQuiz, logoUrl: e.target.value})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" /><p className="text-xs text-gray-400 mt-1">{t('quiz_logo_url_desc')}</p></div>
                <div><label className="block mb-1 font-semibold text-gray-300">{t('quiz_banner_url')}</label><input type="text" value={editingQuiz.bannerUrl || ''} onChange={(e) => setEditingQuiz({...editingQuiz, bannerUrl: e.target.value})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" /><p className="text-xs text-gray-400 mt-1">{t('quiz_banner_url_desc')}</p></div>
                <div><label className="block mb-1 font-semibold text-gray-300">{t('quiz_handler_roles')}</label><input type="text" placeholder="e.g. 123,456" value={(editingQuiz.allowedTakeRoles || []).join(',')} onChange={(e) => setEditingQuiz({...editingQuiz, allowedTakeRoles: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" /><p className="text-xs text-gray-400 mt-1">{t('quiz_handler_roles_desc')}</p></div>
                
                <div className="pt-4 border-t border-brand-light-blue/50">
                  <h3 className="text-lg font-bold text-brand-cyan mb-2">{t('quiz_questions')}</h3>
                  <div className="space-y-3">
                    {(editingQuiz.questions || []).map((q, index) => (
                      <div key={q.id} className="bg-brand-dark p-3 rounded-md">
                        <div className="flex justify-between items-center mb-2">
                          <label className="font-semibold text-gray-300">{t('question')} {index + 1}</label>
                          <button onClick={() => setEditingQuiz(prev => prev ? {...prev, questions: (prev.questions || []).filter((_, i) => i !== index)} : null)} className="text-red-500 hover:text-red-400"><Trash2 size={18}/></button>
                        </div>
                        <input type="text" placeholder={t('question_text')} value={q.textKey} onChange={e => { const newQuestions = [...(editingQuiz.questions || [])]; newQuestions[index].textKey = e.target.value; setEditingQuiz({...editingQuiz, questions: newQuestions}); }} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600 mb-2"/>
                        <div className="flex items-center gap-2">
                          <label className="text-sm">{t('time_limit_seconds')}:</label>
                          <input type="number" value={q.timeLimit} onChange={e => { const newQuestions = [...(editingQuiz.questions || [])]; newQuestions[index].timeLimit = parseInt(e.target.value, 10) || 60; setEditingQuiz({...editingQuiz, questions: newQuestions}); }} className="w-24 bg-brand-light-blue p-1 text-center rounded border border-gray-600"/>
                        </div>
                      </div>
                    ))}
                  </div>
                   <button onClick={() => setEditingQuiz(prev => prev ? {...prev, questions: [...(prev.questions || []), {id: `q_${Date.now()}`, textKey: '', timeLimit: 60}]} : null)} className="mt-3 text-sm bg-brand-light-blue/50 text-brand-cyan font-bold py-2 px-3 rounded-md hover:bg-brand-light-blue flex items-center gap-1"><Plus size={16}/>{t('add_question')}</button>
                </div>

                <div className="flex items-center gap-4 pt-4 border-t border-brand-light-blue/50">
                    <label className="font-semibold text-gray-300">{t('status')}:</label>
                    <button onClick={() => setEditingQuiz({...editingQuiz, isOpen: !editingQuiz.isOpen})}
                      className={`px-4 py-1 rounded-full font-bold ${editingQuiz.isOpen ? 'bg-green-500/30 text-green-300' : 'bg-red-500/30 text-red-300'}`}>
                      {editingQuiz.isOpen ? t('open') : t('closed')}
                    </button>
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t border-brand-light-blue/50 mt-4"><button onClick={() => setEditingQuiz(null)} disabled={isSaving} className="bg-gray-600 text-white font-bold py-2 px-6 rounded-md hover:bg-gray-500">{t('cancel')}</button><button onClick={handleSaveQuiz} disabled={isSaving} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white min-w-[8rem] flex justify-center">{isSaving ? <Loader2 className="animate-spin"/> : t('save_quiz')}</button></div>
            </div>
        </Modal>}
        
        {editingProduct && <Modal isOpen={!!editingProduct} onClose={() => setEditingProduct(null)} title={editingProduct.id ? t('edit_product') : t('add_new_product')}>
            <div className="space-y-4 text-white">
                <div><label className="block mb-1 font-semibold text-gray-300">{t('product_name_key')}</label><input type="text" value={editingProduct.nameKey} onChange={(e) => setEditingProduct({...editingProduct, nameKey: e.target.value})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" /></div>
                <div><label className="block mb-1 font-semibold text-gray-300">{t('product_desc_key')}</label><input type="text" value={editingProduct.descriptionKey} onChange={(e) => setEditingProduct({...editingProduct, descriptionKey: e.target.value})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" /></div>
                <div><label className="block mb-1 font-semibold text-gray-300">{t('price')}</label><input type="number" step="0.01" value={editingProduct.price} onChange={(e) => setEditingProduct({...editingProduct, price: parseFloat(e.target.value) || 0})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" /></div>
                <div><label className="block mb-1 font-semibold text-gray-300">{t('image_url')}</label><input type="text" value={editingProduct.imageUrl} onChange={(e) => setEditingProduct({...editingProduct, imageUrl: e.target.value})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" /></div>
                <div className="flex justify-end gap-4 pt-4 border-t border-brand-light-blue/50 mt-4"><button onClick={() => setEditingProduct(null)} disabled={isSaving} className="bg-gray-600 text-white font-bold py-2 px-6 rounded-md hover:bg-gray-500">{t('cancel')}</button><button onClick={handleSaveProduct} disabled={isSaving} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white min-w-[8rem] flex justify-center">{isSaving ? <Loader2 className="animate-spin"/> : t('save')}</button></div>
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
    </>
  );
};

export default AdminPage;