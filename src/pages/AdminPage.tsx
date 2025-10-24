// src/pages/AdminPage.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLocalization } from '../hooks/useLocalization';
import { useToast } from '../hooks/useToast';
import { useConfig } from '../hooks/useConfig';
// FIX: Switched to named imports to fix hook resolution errors.
import { useNavigate, Link } from 'react-router-dom';
import { 
  ApiError, getQuizzes, saveQuiz as apiSaveQuiz, deleteQuiz as apiDeleteQuiz,
  getSubmissions, updateSubmissionStatus, getAuditLogs, getRules, saveRules as apiSaveRules,
  getProducts, saveProduct as apiSaveProduct, deleteProduct as apiDeleteProduct,
  getTranslations, saveTranslations as apiSaveTranslations, saveConfig as apiSaveConfig,
  getGuildRoles, getRolePermissions, saveRolePermissions, lookupUser, banUser, unbanUser
} from '../lib/api';
import type { 
  Quiz, QuizSubmission, SubmissionStatus, AuditLogEntry, RuleCategory, Rule, 
  Product, DiscordRole, PermissionKey, UserLookupResult, User, AppConfig, Translations, QuizQuestion
} from '../types';
import { 
  UserCog, Plus, Edit, Trash2, Check, X, FileText, Server, Eye, Loader2, ShieldCheck, BookCopy, Store,
  AlertTriangle, Palette, Languages, KeyRound, Search, GripVertical, PlusCircle, Trash, HelpCircle,
  Ban
} from 'lucide-react';
import Modal from '../components/Modal';
import { PERMISSIONS } from '../lib/permissions';
import SEO from '../components/SEO';


type AdminTab = 'submissions' | 'quizzes' | 'rules' | 'store' | 'translations' | 'appearance' | 'permissions' | 'lookup' | 'audit';

const AdminPage: React.FC = () => {
    const { t } = useLocalization();
    const { hasPermission } = useAuth();
    const TABS: { id: AdminTab; labelKey: string; icon: React.ElementType; perm: PermissionKey }[] = [
      { id: 'submissions', labelKey: 'submission_management', icon: FileText, perm: 'admin_submissions' },
      { id: 'quizzes', labelKey: 'quiz_management', icon: Server, perm: 'admin_quizzes' },
      { id: 'rules', labelKey: 'rules_management', icon: BookCopy, perm: 'admin_rules' },
      { id: 'store', labelKey: 'store_management', icon: Store, perm: 'admin_store' },
      { id: 'translations', labelKey: 'translations_management', icon: Languages, perm: 'admin_translations' },
      { id: 'appearance', labelKey: 'appearance_settings', icon: Palette, perm: 'admin_appearance' },
      { id: 'permissions', labelKey: 'permissions_management', icon: KeyRound, perm: 'admin_permissions' },
      { id: 'lookup', labelKey: 'user_lookup', icon: Search, perm: 'admin_lookup'},
      { id: 'audit', labelKey: 'audit_log', icon: ShieldCheck, perm: 'admin_audit_log' },
    ];
    const accessibleTabs = TABS.filter(tab => hasPermission(tab.perm));
    const [activeTab, setActiveTab] = useState<AdminTab>(accessibleTabs[0]?.id || 'submissions');

    return (
        <>
            <SEO title={`Admin Panel - ${t(TABS.find(t => t.id === activeTab)?.labelKey || '')}`} noIndex={true} description="Vixel Roleplay Administration Panel"/>
            <div className="container mx-auto px-6 py-16">
            <div className="text-center mb-12">
                <div className="inline-block p-4 bg-brand-light-blue rounded-full mb-4">
                <UserCog className="text-brand-cyan" size={48} />
                </div>
                <h1 className="text-4xl md:text-5xl font-bold mb-4">{t('page_title_admin')}</h1>
            </div>
            <div className="max-w-7xl mx-auto">
                <div className="flex border-b border-brand-light-blue/50 mb-6 overflow-x-auto">
                    {accessibleTabs.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button 
                                key={tab.id} 
                                onClick={() => setActiveTab(tab.id)} 
                                className={`py-3 px-6 font-bold flex-shrink-0 flex items-center gap-2 transition-colors ${isActive ? 'text-brand-cyan border-b-2 border-brand-cyan' : 'text-gray-400 hover:text-brand-cyan'}`}
                            >
                                <tab.icon size={18}/> {t(tab.labelKey)}
                            </button>
                        );
                    })}
                </div>
                <div>
                    {activeTab === 'submissions' && <SubmissionsPanel />}
                    {activeTab === 'quizzes' && <QuizzesPanel />}
                    {activeTab === 'rules' && <RulesPanel />}
                    {activeTab === 'store' && <StorePanel />}
                    {activeTab === 'translations' && <TranslationsPanel />}
                    {activeTab === 'appearance' && <AppearancePanel />}
                    {activeTab === 'permissions' && <PermissionsPanel />}
                    {activeTab === 'lookup' && <UserLookupPanel />}
                    {activeTab === 'audit' && <AuditLogPanel />}
                </div>
            </div>
            </div>
        </>
    )
}

// =================================================================
// TAB PANELS
// =================================================================

// Submission Panel
const SubmissionsPanel = () => {
    const { t } = useLocalization();
    const { user } = useAuth();
    const { showToast } = useToast();
    const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewingSubmission, setViewingSubmission] = useState<QuizSubmission | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            setSubmissions(await getSubmissions());
        } catch (e) { showToast(e instanceof Error ? e.message : 'Failed to load submissions', 'error'); } 
        finally { setIsLoading(false); }
    }, [showToast]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleTakeOrder = async (id: string) => {
        try {
            await updateSubmissionStatus(id, 'taken');
            showToast('Order taken!', 'success');
            fetchData();
        } catch (e) { showToast(e instanceof Error ? e.message : 'Failed to take order', 'error'); }
    };
    
    const handleDecision = async (id: string, decision: 'accepted' | 'refused') => {
        try {
            await updateSubmissionStatus(id, decision);
            showToast(`Submission ${decision}!`, 'success');
            setViewingSubmission(null);
            fetchData();
        } catch (e) { showToast(e instanceof Error ? e.message : 'Failed to process decision', 'error'); }
    };
    
    return (
        <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50">
            {isLoading ? <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-brand-cyan" size={32}/></div> : 
            <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[700px]">
                    <thead className="border-b border-brand-light-blue/50 text-gray-300">
                        <tr>
                            <th className="p-4">{t('applicant')}</th><th className="p-4">{t('application_type')}</th>
                            <th className="p-4">{t('submitted_on')}</th><th className="p-4">{t('status')}</th>
                            <th className="p-4 text-right">{t('actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {submissions.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-gray-400">{t('no_pending_submissions')}</td></tr>
                        ) : submissions.map(sub => (
                            <tr key={sub.id} className="border-b border-brand-light-blue/50 last:border-none hover:bg-brand-light-blue/30">
                                <td className="p-4 font-semibold">{sub.username} <span className="text-gray-500 text-xs">({sub.user_highest_role})</span></td>
                                <td className="p-4">{sub.quizTitle}</td>
                                <td className="p-4 text-sm text-gray-400">{new Date(sub.submittedAt).toLocaleDateString()}</td>
                                <td className="p-4"><StatusBadge status={sub.status} /></td>
                                <td className="p-4 text-right">
                                    <div className="inline-flex gap-4 items-center">
                                        {sub.status === 'pending' && <button onClick={() => handleTakeOrder(sub.id)} className="bg-brand-cyan/20 text-brand-cyan font-bold py-1 px-3 rounded-md hover:bg-brand-cyan/40 text-sm">{t('take_order')}</button>}
                                        {sub.status === 'taken' && <span className="text-xs text-gray-400 italic">{t('taken_by')} {sub.adminUsername === user?.username ? 'You' : sub.adminUsername}</span>}
                                        <button onClick={() => setViewingSubmission(sub)} className="text-gray-300 hover:text-brand-cyan" title={t('view_submission')}><Eye size={20}/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            }

            {viewingSubmission && user && <SubmissionModal submission={viewingSubmission} user={user} onClose={() => setViewingSubmission(null)} onDecision={handleDecision} />}
        </div>
    );
};

// Quiz Panel
const QuizzesPanel = () => {
    const { t } = useLocalization();
    const { showToast } = useToast();
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingQuiz, setEditingQuiz] = useState<Partial<Quiz> | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try { setQuizzes(await getQuizzes()); } 
        catch (e) { showToast(e instanceof Error ? e.message : 'Failed to load quizzes', 'error'); }
        finally { setIsLoading(false); }
    }, [showToast]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSave = async (quiz: Partial<Quiz>) => {
        try {
            await apiSaveQuiz(quiz);
            showToast('Quiz saved!', 'success');
            setEditingQuiz(null);
            fetchData();
        } catch (e) { showToast(e instanceof Error ? e.message : 'Failed to save quiz', 'error'); }
    };

    const handleDelete = async (id: string, titleKey: string) => {
        if (window.confirm(`Are you sure you want to delete the "${t(titleKey)}" quiz?`)) {
            try {
                await apiDeleteQuiz(id);
                showToast('Quiz deleted!', 'success');
                fetchData();
            } catch (e) { showToast(e instanceof Error ? e.message : 'Failed to delete quiz', 'error'); }
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">{t('quiz_management')}</h2>
                <button onClick={() => setEditingQuiz({ titleKey: '', descriptionKey: '', isOpen: false, questions: [{id: crypto.randomUUID(), textKey: '', timeLimit: 60 }] })} className="bg-brand-cyan text-brand-dark font-bold py-2 px-4 rounded-md hover:bg-white transition-all flex items-center gap-2"><Plus size={20} />{t('create_new_quiz')}</button>
            </div>
             <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50">
                {isLoading ? <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-brand-cyan" size={32}/></div> : 
                 <table className="w-full text-left">
                    <thead className="border-b border-brand-light-blue/50 text-gray-300">
                        <tr><th className="p-4">{t('quiz_title')}</th><th className="p-4">{t('questions')}</th><th className="p-4">{t('status')}</th><th className="p-4 text-right">{t('actions')}</th></tr>
                    </thead>
                    <tbody>
                        {quizzes.map(quiz => (
                            <tr key={quiz.id} className="border-b border-brand-light-blue/50 last:border-none hover:bg-brand-light-blue/30">
                                <td className="p-4 font-semibold">{t(quiz.titleKey)}</td>
                                <td className="p-4 text-gray-400">{quiz.questions?.length || 0}</td>
                                <td className="p-4"><span className={`px-3 py-1 text-sm font-bold rounded-full ${quiz.isOpen ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{quiz.isOpen ? t('open') : t('closed')}</span></td>
                                <td className="p-4 text-right">
                                    <div className="inline-flex gap-4">
                                        <button onClick={() => setEditingQuiz(quiz)} className="text-gray-300 hover:text-brand-cyan"><Edit size={20}/></button>
                                        <button onClick={() => handleDelete(quiz.id, quiz.titleKey)} className="text-gray-300 hover:text-red-500"><Trash2 size={20}/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
                }
            </div>
            {editingQuiz && <QuizEditorModal quiz={editingQuiz} onSave={handleSave} onClose={() => setEditingQuiz(null)} />}
        </div>
    )
};

// Rules Panel
const RulesPanel = () => {
    const { t } = useLocalization();
    const { showToast } = useToast();
    const [categories, setCategories] = useState<RuleCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try { 
                const data = await getRules();
                setCategories(data.sort((a,b) => a.position - b.position));
            } 
            catch (e) { showToast(e instanceof Error ? e.message : 'Failed to load rules', 'error'); } 
            finally { setIsLoading(false); }
        };
        fetchData();
    }, [showToast]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const categoriesToSave = categories.map((cat, index) => ({...cat, position: index}));
            await apiSaveRules(categoriesToSave);
            showToast(t('rules_updated_success'), 'success');
        } catch (e) { showToast(e instanceof Error ? e.message : 'Failed to save rules', 'error'); } 
        finally { setIsSaving(false); }
    };

    const handleCategoryChange = (index: number, value: string) => {
        const newCats = [...categories];
        newCats[index].titleKey = value;
        setCategories(newCats);
    };

    const handleRuleChange = (catIndex: number, ruleIndex: number, value: string) => {
        const newCats = [...categories];
        newCats[catIndex].rules[ruleIndex].textKey = value;
        setCategories(newCats);
    };
    
    const addCategory = () => setCategories([...categories, {id: crypto.randomUUID(), titleKey: '', position: categories.length, rules: []}]);
    const addRule = (catIndex: number) => {
        const newCats = [...categories];
        newCats[catIndex].rules.push({ id: crypto.randomUUID(), textKey: '' });
        setCategories(newCats);
    };
    
    const removeCategory = (index: number) => setCategories(categories.filter((_, i) => i !== index));
    const removeRule = (catIndex: number, ruleIndex: number) => {
        const newCats = [...categories];
        newCats[catIndex].rules = newCats[catIndex].rules.filter((_, i) => i !== ruleIndex);
        setCategories(newCats);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">{t('rules_management')}</h2>
                <div className="flex gap-4">
                    <button onClick={addCategory} className="bg-brand-light-blue text-white font-bold py-2 px-4 rounded-md hover:bg-brand-cyan/20 transition-all flex items-center gap-2"><Plus size={20} />Add Category</button>
                    <button onClick={handleSave} disabled={isSaving || isLoading} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white transition-colors min-w-[9rem] flex justify-center">{isSaving ? <Loader2 className="animate-spin" /> : t('save_rules')}</button>
                </div>
            </div>
            {isLoading ? <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-brand-cyan" size={32}/></div> :
            <div className="space-y-6">
                {categories.map((cat, catIndex) => (
                    <div key={cat.id} className="bg-brand-dark-blue p-4 rounded-lg border border-brand-light-blue/50">
                        <div className="flex items-center gap-2 mb-3">
                            <GripVertical className="text-gray-500 cursor-move" />
                            <input type="text" value={cat.titleKey} onChange={e => handleCategoryChange(catIndex, e.target.value)} placeholder="Category Title Key" className="flex-grow bg-brand-light-blue p-2 rounded border border-gray-600 font-bold text-lg text-brand-cyan" />
                            <button onClick={() => removeCategory(catIndex)} className="text-red-500 hover:text-red-400"><Trash size={20}/></button>
                        </div>
                        <div className="space-y-2 pl-8">
                            {cat.rules.map((rule, ruleIndex) => (
                                <div key={rule.id} className="flex items-center gap-2">
                                    <span className="text-gray-500">{ruleIndex + 1}.</span>
                                    <input type="text" value={rule.textKey} onChange={e => handleRuleChange(catIndex, ruleIndex, e.target.value)} placeholder="Rule Text Key" className="flex-grow bg-brand-dark p-2 rounded border border-gray-700" />
                                    <button onClick={() => removeRule(catIndex, ruleIndex)} className="text-red-500 hover:text-red-400"><Trash size={18}/></button>
                                </div>
                            ))}
                             <button onClick={() => addRule(catIndex)} className="text-brand-cyan/70 hover:text-brand-cyan text-sm flex items-center gap-1 mt-2"><PlusCircle size={16}/> Add Rule</button>
                        </div>
                    </div>
                ))}
            </div>
            }
        </div>
    );
};

// Store Panel
const StorePanel = () => {
    const { t } = useLocalization();
    const { showToast } = useToast();
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try { setProducts(await getProducts()); }
        catch (e) { showToast(e instanceof Error ? e.message : 'Failed to load products', 'error'); }
        finally { setIsLoading(false); }
    }, [showToast]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSave = async (product: Partial<Product>) => {
        try {
            await apiSaveProduct(product as any);
            showToast('Product saved!', 'success');
            setEditingProduct(null);
            fetchData();
        } catch (e) { showToast(e instanceof Error ? e.message : 'Failed to save product', 'error'); }
    };

    const handleDelete = async (id: string, nameKey: string) => {
        if (window.confirm(`Are you sure you want to delete "${t(nameKey)}"?`)) {
            try {
                await apiDeleteProduct(id);
                showToast('Product deleted!', 'success');
                fetchData();
            } catch (e) { showToast(e instanceof Error ? e.message : 'Failed to delete product', 'error'); }
        }
    };
    
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">{t('store_management')}</h2>
                <button onClick={() => setEditingProduct({ nameKey: '', descriptionKey: '', price: 0, imageUrl: '' })} className="bg-brand-cyan text-brand-dark font-bold py-2 px-4 rounded-md hover:bg-white transition-all flex items-center gap-2"><Plus size={20} />Add New Product</button>
            </div>
            <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50">
                {isLoading ? <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-brand-cyan" size={32}/></div> :
                <table className="w-full text-left">
                    <thead className="border-b border-brand-light-blue/50 text-gray-300">
                        <tr>
                            <th className="p-4">Image</th><th className="p-4">Name Key</th><th className="p-4">Price</th><th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.map(p => (
                            <tr key={p.id} className="border-b border-brand-light-blue/50 last:border-none hover:bg-brand-light-blue/30">
                                <td className="p-4"><img src={p.imageUrl} alt="" className="w-16 h-16 object-cover rounded-md"/></td>
                                <td className="p-4 font-semibold">{p.nameKey}</td>
                                <td className="p-4 text-gray-400">${p.price.toFixed(2)}</td>
                                <td className="p-4 text-right">
                                    <div className="inline-flex gap-4">
                                        <button onClick={() => setEditingProduct(p)} className="text-gray-300 hover:text-brand-cyan"><Edit size={20}/></button>
                                        <button onClick={() => handleDelete(p.id, p.nameKey)} className="text-gray-300 hover:text-red-500"><Trash2 size={20}/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                }
            </div>
            {editingProduct && <ProductEditorModal product={editingProduct} onSave={handleSave} onClose={() => setEditingProduct(null)} />}
        </div>
    );
};

const TranslationsPanel = () => {
    const { t } = useLocalization();
    const { showToast } = useToast();
    const [translations, setTranslations] = useState<Translations>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [filter, setFilter] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try { setTranslations(await getTranslations()); }
            catch(e) { showToast('Failed to load translations', 'error'); }
            finally { setIsLoading(false); }
        }
        fetchData();
    }, [showToast]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await apiSaveTranslations(translations);
            showToast('Translations saved!', 'success');
        } catch(e) { showToast('Failed to save translations', 'error'); }
        finally { setIsSaving(false); }
    };
    
    const handleTranslationChange = (key: string, lang: 'en' | 'ar', value: string) => {
        setTranslations(prev => ({
            ...prev,
            [key]: { ...prev[key], [lang]: value }
        }));
    };

    const filteredKeys = Object.keys(translations).filter(key => 
        key.toLowerCase().includes(filter.toLowerCase()) ||
        translations[key].en.toLowerCase().includes(filter.toLowerCase()) ||
        translations[key].ar.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">{t('translations_management')}</h2>
                <div className="flex gap-4 items-center">
                    <input type="text" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter translations..." className="bg-brand-light-blue p-2 rounded border border-gray-600"/>
                    <button onClick={handleSave} disabled={isSaving || isLoading} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white transition-colors min-w-[9rem] flex justify-center">{isSaving ? <Loader2 className="animate-spin" /> : t('save_translations')}</button>
                </div>
            </div>
            {isLoading ? <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-brand-cyan" size={32}/></div> :
             <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50 overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[800px]">
                    <thead className="border-b border-brand-light-blue/50 text-gray-300">
                        <tr><th className="p-4 w-1/4">Key</th><th className="p-4 w-1/3">English</th><th className="p-4 w-1/3">Arabic</th></tr>
                    </thead>
                    <tbody>
                        {filteredKeys.map(key => (
                            <tr key={key} className="border-b border-brand-light-blue/50 last:border-none">
                                <td className="p-2 font-mono text-xs text-gray-400">{key}</td>
                                <td className="p-2"><input type="text" value={translations[key].en} onChange={e => handleTranslationChange(key, 'en', e.target.value)} className="w-full bg-brand-dark p-2 rounded border border-gray-700"/></td>
                                <td className="p-2"><input type="text" value={translations[key].ar} onChange={e => handleTranslationChange(key, 'ar', e.target.value)} className="w-full bg-brand-dark p-2 rounded border border-gray-700" dir="rtl"/></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
            </div>
            }
        </div>
    );
};

const AppearancePanel = () => {
    const { t } = useLocalization();
    const { showToast } = useToast();
    const { config, configLoading, refreshConfig } = useConfig();
    const [settings, setSettings] = useState<Partial<AppConfig>>({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!configLoading) {
            setSettings(config);
        }
    }, [config, configLoading]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await apiSaveConfig(settings);
            await refreshConfig();
            showToast(t('config_updated_success'), 'success');
        } catch(e) {
            showToast((e as Error).message, 'error');
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleChange = (key: keyof AppConfig, value: string | boolean) => {
        setSettings(prev => ({...prev, [key]: value }));
    };

    const InputField: React.FC<{id: keyof AppConfig; label: string; desc?: string}> = ({ id, label, desc }) => (
         <div>
            <label htmlFor={id} className="block mb-1 font-semibold text-gray-300">{label}</label>
            <input type="text" id={id} value={settings[id] as string || ''} onChange={e => handleChange(id, e.target.value)} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600"/>
            {desc && <p className="text-xs text-gray-400 mt-1">{desc}</p>}
        </div>
    );

    if (configLoading) {
         return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-brand-cyan" size={32}/></div>
    }

    return (
        <div>
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">{t('appearance_settings')}</h2>
                <button onClick={handleSave} disabled={isSaving} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white transition-colors min-w-[9rem] flex justify-center">{isSaving ? <Loader2 className="animate-spin" /> : t('save_settings')}</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto bg-brand-dark-blue p-6 rounded-lg border border-brand-light-blue/50">
                <InputField id="COMMUNITY_NAME" label={t('community_name')} />
                <InputField id="LOGO_URL" label={t('logo_url')} />
                <InputField id="BACKGROUND_IMAGE_URL" label={t('background_image_url')} desc={t('background_image_url_desc')} />
                <InputField id="DISCORD_GUILD_ID" label={t('discord_guild_id')} desc={t('discord_guild_id_desc')} />
                <InputField id="SUBMISSIONS_CHANNEL_ID" label={t('submissions_webhook_url')} desc={t('submissions_webhook_url_desc')} />
                <InputField id="AUDIT_LOG_CHANNEL_ID" label={t('audit_log_webhook_url')} desc={t('audit_log_webhook_url_desc')} />
            </div>
        </div>
    );
};

const PermissionsPanel = () => {
    const { t } = useLocalization();
    const { showToast } = useToast();
    const [roles, setRoles] = useState<DiscordRole[]>([]);
    const [isLoadingRoles, setIsLoadingRoles] = useState(true);
    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
    const [rolePermissions, setRolePermissions] = useState<Set<PermissionKey>>(new Set());
    const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchRoles = async () => {
            setIsLoadingRoles(true);
            setError(null);
            try {
                const guildRoles = await getGuildRoles();
                setRoles(guildRoles);
            } catch (e) {
                console.error("Failed to fetch guild roles", e);
                setError("Failed to fetch roles from the Discord bot. This is a critical error.");
                showToast("Could not load Discord roles. The bot may be offline or misconfigured.", 'error');
            } finally {
                setIsLoadingRoles(false);
            }
        };
        fetchRoles();
    }, [showToast]);

    useEffect(() => {
        if (!selectedRoleId) return;
        const fetchPermissions = async () => {
            setIsLoadingPermissions(true);
            try {
                const { permissions } = await getRolePermissions(selectedRoleId);
                setRolePermissions(new Set(permissions));
            } catch (e) {
                showToast(`Failed to load permissions for role: ${(e as Error).message}`, 'error');
            } finally {
                setIsLoadingPermissions(false);
            }
        };
        fetchPermissions();
    }, [selectedRoleId, showToast]);

    const handlePermissionChange = (key: PermissionKey, checked: boolean) => {
        setRolePermissions(prev => {
            const newPerms = new Set(prev);
            if (checked) newPerms.add(key);
            else newPerms.delete(key);
            return newPerms;
        });
    };

    const handleSave = async () => {
        if (!selectedRoleId) return;
        setIsSaving(true);
        try {
            await saveRolePermissions(selectedRoleId, Array.from(rolePermissions));
            showToast(t('permissions_saved_success'), 'success');
        } catch(e) {
            showToast(`Error: ${(e as Error).message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const RoleSelectItem: React.FC<{ role: DiscordRole }> = ({ role }) => {
        const color = role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99aab5';
        return (
            <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }}></div>
                <span>{role.name}</span>
            </div>
        );
    };

    if (error) {
        return (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-6 rounded-lg text-center">
                <AlertTriangle className="mx-auto mb-4" size={40} />
                <h2 className="text-xl font-bold mb-2">Critical Error</h2>
                <p>{error}</p>
                <p className="mt-4">The most common cause for this is the **Server Members Intent** is not enabled for your bot in the Discord Developer Portal, or the bot is offline.</p>
                {/* FIX: Use Link directly from react-router-dom import. */}
                <Link to="/health-check" className="inline-block mt-4 bg-brand-cyan text-brand-dark font-bold py-2 px-4 rounded-md">Run Health Check</Link>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1">
                <h2 className="text-xl font-bold mb-3">{t('discord_roles')}</h2>
                {isLoadingRoles ? <Loader2 className="animate-spin" /> : (
                    <div className="space-y-2">
                        {roles.map(role => (
                            <button key={role.id} onClick={() => setSelectedRoleId(role.id)}
                                className={`w-full text-left p-3 rounded-md transition-colors border ${selectedRoleId === role.id ? 'bg-brand-cyan/20 border-brand-cyan' : 'bg-brand-dark-blue border-brand-light-blue/50 hover:bg-brand-light-blue/50'}`}
                            >
                                <RoleSelectItem role={role} />
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <div className="md:col-span-2">
                {selectedRoleId ? (
                    isLoadingPermissions ? <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-brand-cyan" size={32}/></div> :
                    <div>
                        <div className="flex justify-between items-center mb-4">
                             <h2 className="text-xl font-bold">{t('available_permissions')}</h2>
                             <button onClick={handleSave} disabled={isSaving} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white transition-colors min-w-[9rem] flex justify-center">{isSaving ? <Loader2 className="animate-spin" /> : t('save_permissions')}</button>
                        </div>
                        <p className="text-sm text-gray-400 mb-6">{t('admin_permissions_instructions')}</p>
                        <div className="space-y-3">
                            {(Object.keys(PERMISSIONS) as PermissionKey[]).map(key => (
                                <label key={key} className="flex items-start gap-3 bg-brand-dark-blue p-3 rounded-md border border-brand-light-blue/50 cursor-pointer hover:bg-brand-light-blue/50 has-[:checked]:border-brand-cyan">
                                    <input 
                                        type="checkbox" 
                                        checked={rolePermissions.has(key)}
                                        onChange={(e) => handlePermissionChange(key, e.target.checked)}
                                        className="mt-1 w-5 h-5 accent-brand-cyan bg-brand-light-blue border-gray-500 rounded focus:ring-brand-cyan"
                                    />
                                    <div>
                                        <p className="font-semibold text-white">{key}</p>
                                        <p className="text-xs text-gray-400">{PERMISSIONS[key]}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col justify-center items-center h-full text-center bg-brand-dark-blue p-8 rounded-lg border-2 border-dashed border-brand-light-blue/50">
                        <KeyRound size={48} className="text-gray-500 mb-4" />
                        <p className="text-lg text-gray-400">{t('select_role_to_manage')}</p>
                    </div>
                )}
                 <div className="mt-8 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                    <h4 className="font-bold text-yellow-300 flex items-center gap-2">
                        <HelpCircle size={20} />
                        {t('admin_permissions_bootstrap_instructions_title')}
                    </h4>
                    <p className="text-sm text-yellow-200 mt-2" dangerouslySetInnerHTML={{ __html: t('admin_permissions_bootstrap_instructions_body') }} />
                </div>
            </div>
        </div>
    )
};


const UserLookupPanel = () => {
    const { t } = useLocalization();
    const { showToast } = useToast();
    const [discordId, setDiscordId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [searchResult, setSearchResult] = useState<UserLookupResult | null>(null);
    const [isBanModalOpen, setBanModalOpen] = useState(false);

    const handleSearch = async () => {
        if (!discordId) return;
        setIsLoading(true);
        setSearchResult(null);
        try {
            const result = await lookupUser(discordId);
            setSearchResult(result);
        } catch(e) {
            const error = e as ApiError;
            showToast(error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleUnban = async () => {
        if (!searchResult) return;
        if(window.confirm(`Are you sure you want to unban ${searchResult.username}?`)) {
            try {
                await unbanUser(searchResult.id);
                showToast('User unbanned successfully', 'success');
                handleSearch(); // Refresh user data
            } catch (e) { showToast((e as Error).message, 'error'); }
        }
    };

    return (
        <div className="max-w-3xl mx-auto">
            <div className="flex gap-4 mb-6">
                <input type="text" value={discordId} onChange={e => setDiscordId(e.target.value)} placeholder={t('discord_id_placeholder')} className="w-full bg-brand-light-blue p-3 rounded border border-gray-600"/>
                <button onClick={handleSearch} disabled={isLoading || !discordId} className="bg-brand-cyan text-brand-dark font-bold py-3 px-6 rounded-md hover:bg-white transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                    {isLoading ? <Loader2 className="animate-spin"/> : <Search />}
                    {t('search')}
                </button>
            </div>

            {searchResult && (
                <div className="bg-brand-dark-blue p-6 rounded-lg border border-brand-light-blue/50 animate-fade-in-up">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <img src={searchResult.avatar} alt={searchResult.username} className="w-20 h-20 rounded-full border-2 border-brand-cyan"/>
                            <div>
                                <h3 className="text-2xl font-bold">{searchResult.username}</h3>
                                <p className="text-gray-400">ID: {searchResult.id}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                           {searchResult.is_banned 
                            ? <button onClick={handleUnban} className="bg-green-500/20 text-green-300 font-bold py-2 px-4 rounded-md hover:bg-green-500/40 flex items-center gap-2"><Ban/> {t('unban')}</button>
                            : <button onClick={() => setBanModalOpen(true)} className="bg-red-500/20 text-red-300 font-bold py-2 px-4 rounded-md hover:bg-red-500/40 flex items-center gap-2"><Ban/> {t('ban')}</button>
                           }
                        </div>
                    </div>
                     {searchResult.is_banned && (
                        <div className="mt-4 p-3 rounded-md bg-red-900/40 border border-red-500/50 text-red-200">
                            <p><strong>Banned!</strong> Reason: {searchResult.ban_reason}</p>
                            <p>Expires: {searchResult.ban_expires_at ? new Date(searchResult.ban_expires_at).toLocaleString() : 'Permanent'}</p>
                        </div>
                    )}
                </div>
            )}
            {isBanModalOpen && searchResult && (
                <BanUserModal user={searchResult} onClose={() => setBanModalOpen(false)} onBanned={handleSearch} />
            )}
        </div>
    );
};

// Audit Log Panel
const AuditLogPanel = () => {
  const { t } = useLocalization();
  const { showToast } = useToast();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        setLogs(await getAuditLogs());
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Failed to load audit logs', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [showToast]);

  return (
    <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50">
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="animate-spin text-brand-cyan" size={32} />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead className="border-b border-brand-light-blue/50 text-gray-300">
              <tr>
                <th className="p-4">{t('log_timestamp')}</th>
                <th className="p-4">{t('log_admin')}</th>
                <th className="p-4">{t('log_action')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-gray-400">{t('no_logs_found')}</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-brand-light-blue/50 last:border-none">
                    <td className="p-4 text-sm text-gray-400">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="p-4 font-semibold">{log.admin_username} <code className="text-xs text-gray-500">({log.admin_id})</code></td>
                    <td className="p-4">{log.action}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};


// =================================================================
// MODALS
// =================================================================

// Submission Modal
const SubmissionModal: React.FC<{submission: QuizSubmission; user: User; onClose: () => void; onDecision: (id: string, decision: 'accepted' | 'refused') => void;}> = ({ submission, user, onClose, onDecision }) => {
    const { t } = useLocalization();
    return (
        <Modal isOpen={true} onClose={onClose} title={t('submission_details')}>
            <div className="space-y-4 text-gray-200">
                <p><strong>{t('applicant')}:</strong> {submission.username}</p>
                <p><strong>{t('application_type')}:</strong> {submission.quizTitle}</p>
                <p><strong>{t('submitted_on')}:</strong> {new Date(submission.submittedAt).toLocaleString()}</p>
                <p><strong>{t('status')}:</strong> <StatusBadge status={submission.status} /></p>
                {submission.adminUsername && <p><strong>{t('taken_by')}:</strong> {submission.adminUsername}</p>}
                
                {submission.cheatAttempts && submission.cheatAttempts.length > 0 && (
                    <div className="p-3 bg-red-900/40 border border-red-500/50 rounded-lg">
                        <h4 className="font-bold text-red-300 flex items-center gap-2"><AlertTriangle size={18}/>{t('cheat_attempts_report')}</h4>
                        <p className="text-sm text-red-200">{t('cheat_attempts_count', { count: submission.cheatAttempts.length })}</p>
                    </div>
                )}

                <div className="border-t border-brand-light-blue pt-4 mt-4">
                    <h4 className="text-lg font-bold text-brand-cyan mb-2">{t('quiz_questions')}</h4>
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                        {submission.answers.map((ans, i) => (
                            <div key={i}>
                                <p className="font-semibold text-gray-300">{i + 1}. {ans.questionText}</p>
                                <p className="bg-brand-dark p-2 rounded mt-1 text-gray-200 whitespace-pre-wrap">{ans.answer}</p>
                            </div>
                        ))}
                    </div>
                </div>
                {submission.status === 'taken' && submission.adminId === user.id && (
                    <div className="flex justify-end gap-4 pt-6 border-t border-brand-light-blue">
                        <button onClick={() => onDecision(submission.id, 'refused')} className="flex items-center gap-2 bg-red-600 text-white font-bold py-2 px-5 rounded-md hover:bg-red-500 transition-colors"><X size={20}/> {t('refuse')}</button>
                        <button onClick={() => onDecision(submission.id, 'accepted')} className="flex items-center gap-2 bg-green-600 text-white font-bold py-2 px-5 rounded-md hover:bg-green-500 transition-colors"><Check size={20}/> {t('accept')}</button>
                    </div>
                )}
            </div>
        </Modal>
    );
};

// Quiz Editor Modal
const QuizEditorModal: React.FC<{quiz: Partial<Quiz>; onSave: (quiz: Partial<Quiz>) => void; onClose: () => void;}> = ({ quiz, onSave, onClose }) => {
    const [editedQuiz, setEditedQuiz] = useState<Partial<Quiz>>(quiz);
    const { t } = useLocalization();

    const handleQuestionChange = (index: number, field: keyof QuizQuestion, value: string | number) => {
        const newQuestions = [...(editedQuiz.questions || [])];
        newQuestions[index] = { ...newQuestions[index], [field]: value };
        setEditedQuiz({ ...editedQuiz, questions: newQuestions });
    };

    const addQuestion = () => {
        const newQuestions = [...(editedQuiz.questions || []), { id: crypto.randomUUID(), textKey: '', timeLimit: 60 }];
        setEditedQuiz({ ...editedQuiz, questions: newQuestions });
    };

    const removeQuestion = (index: number) => {
        const newQuestions = (editedQuiz.questions || []).filter((_, i) => i !== index);
        setEditedQuiz({ ...editedQuiz, questions: newQuestions });
    };

    return (
        <Modal isOpen={true} onClose={onClose} title={editedQuiz.id ? t('edit_quiz') : t('create_new_quiz')}>
             <div className="space-y-4 text-white max-h-[80vh] overflow-y-auto pr-2">
                <div><label className="block mb-1 font-semibold text-gray-300">{t('quiz_title')}</label><input type="text" value={editedQuiz.titleKey || ''} onChange={(e) => setEditedQuiz({...editedQuiz, titleKey: e.target.value})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" /></div>
                <div><label className="block mb-1 font-semibold text-gray-300">{t('quiz_description')}</label><textarea value={editedQuiz.descriptionKey || ''} onChange={(e) => setEditedQuiz({...editedQuiz, descriptionKey: e.target.value})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" rows={3}></textarea></div>
                <div><label className="block mb-1 font-semibold text-gray-300">Logo URL</label><input type="text" value={editedQuiz.logoUrl || ''} onChange={(e) => setEditedQuiz({...editedQuiz, logoUrl: e.target.value})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" /></div>
                <div><label className="block mb-1 font-semibold text-gray-300">Banner URL</label><input type="text" value={editedQuiz.bannerUrl || ''} onChange={(e) => setEditedQuiz({...editedQuiz, bannerUrl: e.target.value})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" /></div>
                <div><label className="block mb-1 font-semibold text-gray-300">{t('quiz_handler_roles')}</label><input type="text" placeholder="e.g. 123,456" value={(editedQuiz.allowedTakeRoles || []).join(',')} onChange={(e) => setEditedQuiz({...editedQuiz, allowedTakeRoles: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" /><p className="text-xs text-gray-400 mt-1">{t('quiz_handler_roles_desc')}</p></div>
                <div className="flex items-center gap-4 pt-2"><label className="font-semibold text-gray-300">{t('status')}:</label><button onClick={() => setEditedQuiz({...editedQuiz, isOpen: !editedQuiz.isOpen})} className={`px-4 py-1 rounded-full font-bold ${editedQuiz.isOpen ? 'bg-green-500/30 text-green-300' : 'bg-red-500/30 text-red-300'}`}>{editedQuiz.isOpen ? t('open') : t('closed')}</button></div>

                <div className="border-t border-brand-light-blue/50 pt-4 mt-4">
                    <h4 className="text-lg font-bold mb-2">{t('quiz_questions')}</h4>
                    <div className="space-y-3">
                        {(editedQuiz.questions || []).map((q, index) => (
                            <div key={q.id || index} className="bg-brand-dark p-3 rounded-md border border-gray-700">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="font-semibold text-gray-300">Question {index + 1}</label>
                                    <button onClick={() => removeQuestion(index)} className="text-red-500 hover:text-red-400"><Trash size={18}/></button>
                                </div>
                                <div className="space-y-2">
                                    <input type="text" placeholder={t('question_text')} value={q.textKey} onChange={(e) => handleQuestionChange(index, 'textKey', e.target.value)} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600"/>
                                    <input type="number" placeholder={t('time_limit_seconds')} value={q.timeLimit} onChange={(e) => handleQuestionChange(index, 'timeLimit', parseInt(e.target.value) || 0)} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600"/>
                                </div>
                            </div>
                        ))}
                        <button onClick={addQuestion} className="text-brand-cyan/70 hover:text-brand-cyan text-sm flex items-center gap-1 mt-2"><PlusCircle size={16}/> {t('add_question')}</button>
                    </div>
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t border-brand-light-blue/50 mt-4"><button onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-6 rounded-md hover:bg-gray-500">Cancel</button><button onClick={() => onSave(editedQuiz)} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white">{t('save_quiz')}</button></div>
            </div>
        </Modal>
    );
}

// Product Editor Modal
const ProductEditorModal: React.FC<{product: Partial<Product>; onSave: (p: Partial<Product>) => void; onClose: () => void;}> = ({ product, onSave, onClose }) => {
    const [editedProduct, setEditedProduct] = useState(product);
    const { t } = useLocalization();
    return (
        <Modal isOpen={true} onClose={onClose} title={product.id ? 'Edit Product' : 'Add New Product'}>
            <div className="space-y-4 text-white">
                <div><label className="block mb-1 font-semibold text-gray-300">Name Key</label><input type="text" value={editedProduct.nameKey} onChange={(e) => setEditedProduct({...editedProduct, nameKey: e.target.value})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" /></div>
                <div><label className="block mb-1 font-semibold text-gray-300">Description Key</label><input type="text" value={editedProduct.descriptionKey} onChange={(e) => setEditedProduct({...editedProduct, descriptionKey: e.target.value})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" /></div>
                <div><label className="block mb-1 font-semibold text-gray-300">Price</label><input type="number" value={editedProduct.price} onChange={(e) => setEditedProduct({...editedProduct, price: parseFloat(e.target.value)})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" /></div>
                <div><label className="block mb-1 font-semibold text-gray-300">Image URL</label><input type="text" value={editedProduct.imageUrl} onChange={(e) => setEditedProduct({...editedProduct, imageUrl: e.target.value})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" /></div>
                <div className="flex justify-end gap-4 pt-4 border-t border-brand-light-blue/50 mt-4">
                    <button onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-6 rounded-md hover:bg-gray-500">Cancel</button>
                    <button onClick={() => onSave(editedProduct)} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white">Save Product</button>
                </div>
            </div>
        </Modal>
    )
};

const BanUserModal: React.FC<{user: UserLookupResult; onClose: () => void; onBanned: () => void;}> = ({ user, onClose, onBanned }) => {
    const { t } = useLocalization();
    const { showToast } = useToast();
    const [reason, setReason] = useState('');
    const [duration, setDuration] = useState<number | null>(24); // Default 1 day
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!reason) {
            showToast('Reason is required', 'error');
            return;
        }
        setIsSubmitting(true);
        try {
            await banUser(user.id, reason, duration);
            showToast(`${user.username} has been banned.`, 'success');
            onBanned();
            onClose();
        } catch (e) {
            showToast((e as Error).message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const durationOptions = [
        { label: '1 Hour', value: 1 },
        { label: '1 Day', value: 24 },
        { label: '7 Days', value: 168 },
        { label: '30 Days', value: 720 },
        { label: 'Permanent', value: null },
    ];

    return (
        <Modal isOpen={true} onClose={onClose} title={`${t('ban')} ${user.username}`}>
            <div className="space-y-4">
                <div>
                    <label className="block mb-1 font-semibold text-gray-300">{t('reason')}</label>
                    <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600"/>
                </div>
                <div>
                    <label className="block mb-1 font-semibold text-gray-300">{t('duration')}</label>
                    <select value={String(duration)} onChange={e => setDuration(e.target.value === 'null' ? null : Number(e.target.value))} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600">
                        {durationOptions.map(opt => <option key={opt.label} value={String(opt.value)}>{opt.label}</option>)}
                    </select>
                </div>
                <div className="flex justify-end gap-4 pt-4 border-t border-brand-light-blue/50 mt-4">
                    <button onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-6 rounded-md hover:bg-gray-500">Cancel</button>
                    <button onClick={handleSubmit} disabled={isSubmitting} className="bg-red-600 text-white font-bold py-2 px-6 rounded-md hover:bg-red-500 flex items-center justify-center gap-2 min-w-[8rem]">
                        {isSubmitting ? <Loader2 className="animate-spin"/> : t('confirm_ban')}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

// =================================================================
// HELPER COMPONENTS
// =================================================================
const StatusBadge: React.FC<{ status: SubmissionStatus }> = ({ status }) => {
    const { t } = useLocalization();
    const statusMap = {
      pending: { text: t('status_pending'), color: 'bg-yellow-500/20 text-yellow-400' },
      taken: { text: t('status_taken'), color: 'bg-blue-500/20 text-blue-400' },
      accepted: { text: t('status_accepted'), color: 'bg-green-500/20 text-green-400' },
      refused: { text: t('status_refused'), color: 'bg-red-500/20 text-red-400' },
    };
    const { text, color } = statusMap[status];
    return <span className={`px-3 py-1 text-sm font-bold rounded-full ${color}`}>{text}</span>;
};


export default AdminPage;