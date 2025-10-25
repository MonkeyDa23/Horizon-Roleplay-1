
// src/pages/AdminPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLocalization } from '../hooks/useLocalization';
import { useToast } from '../hooks/useToast';
import { useConfig } from '../hooks/useConfig';
import { 
  getQuizzes, saveQuiz as apiSaveQuiz, deleteQuiz as apiDeleteQuiz,
  getSubmissions, updateSubmissionStatus, getAuditLogs, getRules, saveRules as apiSaveRules,
  getProducts, saveProduct as apiSaveProduct, deleteProduct as apiDeleteProduct,
  getTranslations, saveTranslations as apiSaveTranslations, saveConfig as apiSaveConfig,
  lookupUser, banUser, unbanUser,
  getGuildRoles, getRolePermissions, saveRolePermissions
} from '../lib/api';
import type { 
  Quiz, QuizSubmission, SubmissionStatus, AuditLogEntry, RuleCategory, Rule,
  Product, UserLookupResult, AppConfig, Translations, QuizQuestion,
  DiscordRole, RolePermission, PermissionKey
} from '../types';
import { PERMISSIONS } from '../lib/permissions';
import { 
  UserCog, Plus, Edit, Trash2, Check, X, FileText, Server, Eye, Loader2, ShieldCheck, BookCopy, Store,
  AlertTriangle, Palette, Languages, Search, GripVertical, PlusCircle, Trash,
  Ban, ShieldQuestion
} from 'lucide-react';
import Modal from '../components/Modal';
import SEO from '../components/SEO';

type AdminTab = 'submissions' | 'quizzes' | 'rules' | 'store' | 'translations' | 'appearance' | 'lookup' | 'permissions' | 'audit';

const TABS: { id: AdminTab; labelKey: string; icon: React.ElementType; permission: PermissionKey }[] = [
    { id: 'submissions', labelKey: 'submission_management', icon: FileText, permission: 'admin_submissions' },
    { id: 'quizzes', labelKey: 'quiz_management', icon: Server, permission: 'admin_quizzes' },
    { id: 'rules', labelKey: 'rules_management', icon: BookCopy, permission: 'admin_rules' },
    { id: 'store', labelKey: 'store_management', icon: Store, permission: 'admin_store' },
    { id: 'translations', labelKey: 'translations_management', icon: Languages, permission: 'admin_translations' },
    { id: 'appearance', labelKey: 'appearance_settings', icon: Palette, permission: 'admin_appearance' },
    { id: 'lookup', labelKey: 'user_lookup', icon: Search, permission: 'admin_lookup'},
    { id: 'permissions', labelKey: 'permissions_management', icon: ShieldQuestion, permission: 'admin_permissions' },
    { id: 'audit', labelKey: 'audit_log', icon: ShieldCheck, permission: 'admin_audit_log' },
];

const AdminPage: React.FC = () => {
    const { hasPermission } = useAuth();
    const { t } = useLocalization();

    const accessibleTabs = TABS.filter(tab => hasPermission(tab.permission));
    const [activeTab, setActiveTab] = useState<AdminTab>(accessibleTabs[0]?.id || 'submissions');
    
    useEffect(() => {
        if (!accessibleTabs.find(t => t.id === activeTab)) {
            setActiveTab(accessibleTabs[0]?.id || 'submissions');
        }
    }, [accessibleTabs, activeTab]);

    const currentTab = TABS.find(t => t.id === activeTab);

    return (
        <>
            <SEO title={`Admin Panel - ${t(currentTab?.labelKey || '')}`} noIndex={true} description="Vixel Roleplay Administration Panel"/>
            <div className="container mx-auto px-6 py-16">
                <div className="text-center mb-12">
                    <div className="inline-block p-4 bg-brand-light-blue rounded-full mb-4">
                        <UserCog className="text-brand-cyan" size={48} />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">{t('page_title_admin')}</h1>
                </div>
                
                <div className="max-w-7xl mx-auto">
                    <div className="flex border-b border-brand-light-blue/50 mb-6 overflow-x-auto">
                        {accessibleTabs.map((tab) => (
                            <button 
                                key={tab.id} 
                                onClick={() => setActiveTab(tab.id)} 
                                className={`py-3 px-6 font-bold flex-shrink-0 flex items-center gap-2 transition-colors ${activeTab === tab.id ? 'text-brand-cyan border-b-2 border-brand-cyan' : 'text-gray-400 hover:text-brand-cyan'}`}
                            >
                                <tab.icon size={18}/> {t(tab.labelKey)}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'submissions' && <SubmissionsPanel />}
                    {activeTab === 'quizzes' && <QuizzesPanel />}
                    {activeTab === 'rules' && <RulesPanel />}
                    {activeTab === 'store' && <StorePanel />}
                    {activeTab === 'translations' && <TranslationsPanel />}
                    {activeTab === 'appearance' && <AppearancePanel />}
                    {activeTab === 'lookup' && <UserLookupPanel />}
                    {activeTab === 'permissions' && <PermissionsPanel />}
                    {activeTab === 'audit' && <AuditLogPanel />}
                </div>
            </div>
        </>
    );
};

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
    const { user } = useAuth();
    const { showToast } = useToast();
    const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewingSubmission, setViewingSubmission] = useState<QuizSubmission | null>(null);

    const fetchSubmissions = useCallback(async () => {
        setIsLoading(true);
        try {
            setSubmissions(await getSubmissions());
        } catch (e) {
            showToast((e as Error).message, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchSubmissions();
    }, [fetchSubmissions]);

    const handleUpdateStatus = async (id: string, status: 'taken' | 'accepted' | 'refused') => {
        try {
            await updateSubmissionStatus(id, status);
            fetchSubmissions();
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

    return (
        <Panel isLoading={isLoading} loadingText="Loading submissions...">
            <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50 overflow-hidden">
                <table className="w-full text-left min-w-[600px]">
                    <thead className="border-b border-brand-light-blue/50 text-gray-300">
                        <tr>
                            <th className="p-4">{t('applicant')}</th>
                            <th className="p-4">{t('application_type')}</th>
                            <th className="p-4">{t('submitted_on')}</th>
                            <th className="p-4">{t('status')}</th>
                            <th className="p-4 text-right">{t('actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {submissions.map((sub) => (
                             <tr key={sub.id} className="border-b border-brand-light-blue/50 last:border-none">
                                <td className="p-4 font-semibold">{sub.username}</td>
                                <td className="p-4">{sub.quizTitle}</td>
                                <td className="p-4 text-sm text-gray-400">{new Date(sub.submittedAt).toLocaleDateString()}</td>
                                <td className="p-4">{renderStatusBadge(sub.status)}</td>
                                <td className="p-4 text-right">
                                    <div className="inline-flex gap-4 items-center">
                                        {sub.status === 'pending' && <button onClick={() => handleUpdateStatus(sub.id, 'taken')} className="bg-brand-cyan/20 text-brand-cyan font-bold py-1 px-3 rounded-md hover:bg-brand-cyan/40 text-sm">{t('take_order')}</button>}
                                        {sub.status === 'taken' && <span className="text-xs text-gray-400 italic">{t('taken_by')} {sub.adminUsername === user?.username ? 'You' : sub.adminUsername}</span>}
                                        <button onClick={() => setViewingSubmission(sub)} className="text-gray-300 hover:text-brand-cyan" title={t('view_submission')}><Eye size={20}/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {viewingSubmission && user && <Modal isOpen={!!viewingSubmission} onClose={() => setViewingSubmission(null)} title={t('submission_details')}>
                <div className="space-y-4 text-gray-200">
                    <p><strong>{t('applicant')}:</strong> {viewingSubmission.username}</p>
                    <p><strong>{t('quiz_title')}:</strong> {viewingSubmission.quizTitle}</p>
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
                    {viewingSubmission.status === 'taken' && viewingSubmission.adminId === user.id && (
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

const QuizzesPanel: React.FC = () => {
    const { t } = useLocalization();
    const { showToast } = useToast();
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);

    const fetchQuizzes = useCallback(async () => {
        setIsLoading(true);
        try {
            setQuizzes(await getQuizzes());
        } catch (error) { showToast('Failed to load quizzes', 'error'); }
        finally { setIsLoading(false); }
    }, [showToast]);

    useEffect(() => { fetchQuizzes(); }, [fetchQuizzes]);

    const handleCreateNew = () => setEditingQuiz({
        id: '', titleKey: '', descriptionKey: '', isOpen: false, questions: [],
        allowedTakeRoles: [], logoUrl: '', bannerUrl: ''
    });

    const handleSave = async () => {
        if (!editingQuiz) return;
        setIsSaving(true);
        try {
            await apiSaveQuiz(editingQuiz);
            setEditingQuiz(null);
            showToast('Quiz saved!', 'success');
            fetchQuizzes();
        } catch (error) {
            showToast(`Error: ${(error as Error).message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (quiz: Quiz) => {
        if (window.confirm(`Delete "${t(quiz.titleKey)}"? This is irreversible.`)) {
            try {
                await apiDeleteQuiz(quiz.id);
                showToast('Quiz deleted!', 'success');
                fetchQuizzes();
            } catch (error) {
                showToast(`Error: ${(error as Error).message}`, 'error');
            }
        }
    };

    const handleQuestionChange = (index: number, field: keyof QuizQuestion, value: string | number) => {
        if (!editingQuiz) return;
        const newQuestions = [...editingQuiz.questions];
        (newQuestions[index] as any)[field] = value;
        setEditingQuiz({ ...editingQuiz, questions: newQuestions });
    };

    const addQuestion = () => {
        if (!editingQuiz) return;
        const newQuestion: QuizQuestion = { id: `q_${Date.now()}`, textKey: '', timeLimit: 60 };
        setEditingQuiz({ ...editingQuiz, questions: [...editingQuiz.questions, newQuestion] });
    };

    const removeQuestion = (index: number) => {
        if (!editingQuiz) return;
        setEditingQuiz({ ...editingQuiz, questions: editingQuiz.questions.filter((_, i) => i !== index) });
    };


    return (
        <Panel isLoading={isLoading} loadingText="Loading quizzes...">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">{t('quiz_management')}</h2>
                <button onClick={handleCreateNew} className="bg-brand-cyan text-brand-dark font-bold py-2 px-4 rounded-md hover:bg-white transition-all flex items-center gap-2">
                    <Plus size={20} /> {t('create_new_quiz')}
                </button>
            </div>
            <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="border-b border-brand-light-blue/50 text-gray-300">
                        <tr>
                            <th className="p-4">{t('quiz_title')}</th>
                            <th className="p-4">{t('status')}</th>
                            <th className="p-4 text-right">{t('actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {quizzes.map((quiz) => (
                            <tr key={quiz.id} className="border-b border-brand-light-blue/50 last:border-none">
                                <td className="p-4 font-semibold">{t(quiz.titleKey)}</td>
                                <td className="p-4">
                                    <span className={`px-3 py-1 text-sm font-bold rounded-full ${quiz.isOpen ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {quiz.isOpen ? t('open') : t('closed')}
                                    </span>
                                </td>
                                <td className="p-4 text-right">
                                    <div className="inline-flex gap-4">
                                        <button onClick={() => setEditingQuiz(JSON.parse(JSON.stringify(quiz)))} className="text-gray-300 hover:text-brand-cyan"><Edit size={20}/></button>
                                        <button onClick={() => handleDelete(quiz)} className="text-gray-300 hover:text-red-500"><Trash2 size={20}/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {editingQuiz && <Modal isOpen={!!editingQuiz} onClose={() => setEditingQuiz(null)} title={t(editingQuiz.id ? 'edit_quiz' : 'create_new_quiz')}>
                <div className="space-y-4 text-white max-h-[70vh] overflow-y-auto pr-4">
                    {/* Quiz Editor Form */}
                </div>
            </Modal>}
        </Panel>
    );
};

const RulesPanel: React.FC = () => {
    const { t } = useLocalization();
    const { showToast } = useToast();
    const [rules, setRules] = useState<RuleCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchRules = async () => {
            setIsLoading(true);
            try {
                setRules(await getRules());
            } catch (e) {
                showToast((e as Error).message, 'error');
            } finally {
                setIsLoading(false);
            }
        };
        fetchRules();
    }, [showToast]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await apiSaveRules(rules);
            showToast('Rules saved successfully!', 'success');
        } catch (e) {
            showToast((e as Error).message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Panel isLoading={isLoading} loadingText="Loading rules...">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">{t('rules_management')}</h2>
                <button onClick={handleSave} disabled={isSaving} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white transition-colors min-w-[9rem] flex justify-center">
                    {isSaving ? <Loader2 className="animate-spin" /> : t('save_rules')}
                </button>
            </div>
            <p className="text-center text-gray-400 py-10">Rules management UI is coming soon.</p>
        </Panel>
    );
};

const StorePanel: React.FC = () => {
    const { t } = useLocalization();
    const { showToast } = useToast();
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const fetchProducts = useCallback(async () => {
        setIsLoading(true);
        try {
            setProducts(await getProducts());
        } catch (e) { showToast((e as Error).message, 'error'); }
        finally { setIsLoading(false); }
    }, [showToast]);

    useEffect(() => { fetchProducts(); }, [fetchProducts]);

    const handleSave = async () => {
        if (!editingProduct) return;
        setIsSaving(true);
        try {
            await apiSaveProduct(editingProduct as Product);
            showToast('Product saved!', 'success');
            setEditingProduct(null);
            fetchProducts();
        } catch (e) { showToast((e as Error).message, 'error'); }
        finally { setIsSaving(false); }
    };
    
    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this product?')) {
            try {
                await apiDeleteProduct(id);
                showToast('Product deleted!', 'success');
                fetchProducts();
            } catch (e) { showToast((e as Error).message, 'error'); }
        }
    };

    return (
        <Panel isLoading={isLoading} loadingText="Loading products...">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">{t('store_management')}</h2>
                <button onClick={() => setEditingProduct({ nameKey: '', descriptionKey: '', price: 0, imageUrl: '' })} className="bg-brand-cyan text-brand-dark font-bold py-2 px-4 rounded-md hover:bg-white transition-all flex items-center gap-2">
                    <Plus size={20} /> Add Product
                </button>
            </div>
             <p className="text-center text-gray-400 py-10">Store management UI is coming soon.</p>
        </Panel>
    );
};

const TranslationsPanel: React.FC = () => {
    const { t } = useLocalization();
    return <p>{t('translations_management')}</p>;
};

const AppearancePanel: React.FC = () => {
    const { t } = useLocalization();
    return <p>{t('appearance_settings')}</p>;
};

const UserLookupPanel: React.FC = () => {
    const { t } = useLocalization();
    return <p>{t('user_lookup')}</p>;
};

const PermissionsPanel: React.FC = () => {
    const { t } = useLocalization();
    const { showToast } = useToast();
    const [roles, setRoles] = useState<DiscordRole[]>([]);
    const [permissions, setPermissions] = useState<RolePermission[]>([]);
    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [guildRoles, rolePermissions] = await Promise.all([
                    getGuildRoles(),
                    getRolePermissions()
                ]);
                setRoles(guildRoles);
                setPermissions(rolePermissions);
            } catch (error) {
                console.error("Failed to fetch permissions data:", error);
                showToast("Failed to load roles and permissions.", "error");
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [showToast]);

    const handlePermissionChange = (permissionKey: PermissionKey, checked: boolean) => {
        if (!selectedRoleId) return;
        setPermissions(prev => {
            const rolePerms = prev.find(p => p.role_id === selectedRoleId);
            if (rolePerms) {
                const newPerms = checked
                    ? [...new Set([...rolePerms.permissions, permissionKey])]
                    : rolePerms.permissions.filter(p => p !== permissionKey);
                return prev.map(p => p.role_id === selectedRoleId ? { ...p, permissions: newPerms } : p);
            } else {
                return [...prev, { role_id: selectedRoleId, permissions: [permissionKey] }];
            }
        });
    };

    const handleSave = async () => {
        if (!selectedRoleId) return;
        setIsSaving(true);
        try {
            const dataToSave = permissions.find(p => p.role_id === selectedRoleId) || { role_id: selectedRoleId, permissions: [] };
            await saveRolePermissions(dataToSave);
            showToast(t('permissions_saved_success'), 'success');
        } catch (error) {
            console.error(error);
            showToast("Failed to save permissions.", "error");
        } finally {
            setIsSaving(false);
        }
    };
    
    const RoleBadge: React.FC<{ role: DiscordRole, small?: boolean }> = ({ role, small=false }) => {
        const color = role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99aab5';
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        const textColor = brightness > 125 ? 'text-black' : 'text-white';
        const padding = small ? 'px-2 py-0.5' : 'px-2 py-1';
        return <span className={`inline-block ${padding} text-xs font-bold rounded-md ${textColor}`} style={{ backgroundColor: color }}>{role.name}</span>;
    };


    const selectedRolePermissions = permissions.find(p => p.role_id === selectedRoleId)?.permissions || [];
    const permissionKeys = Object.keys(PERMISSIONS) as PermissionKey[];

    return (
        <Panel isLoading={isLoading} loadingText="Loading roles & permissions...">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1 bg-brand-dark-blue p-4 rounded-lg border border-brand-light-blue/50">
                <h3 className="text-xl font-bold mb-4 px-2">{t('discord_roles')}</h3>
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {roles.map(role => (
                        <button 
                            key={role.id}
                            onClick={() => setSelectedRoleId(role.id)}
                            className={`w-full text-left p-2 rounded-md transition-colors ${selectedRoleId === role.id ? 'bg-brand-cyan/20' : 'hover:bg-brand-light-blue'}`}
                        >
                            <RoleBadge role={role} />
                        </button>
                    ))}
                </div>
            </div>
            <div className="md:col-span-2 bg-brand-dark-blue p-6 rounded-lg border border-brand-light-blue/50">
                {selectedRoleId ? (
                    <>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">{t('available_permissions')}</h3>
                            <button onClick={handleSave} disabled={isSaving} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white transition-colors min-w-[9rem] flex justify-center">
                                {isSaving ? <Loader2 className="animate-spin" /> : t('save_permissions')}
                            </button>
                        </div>
                        <p className="text-sm text-gray-400 mb-6" dangerouslySetInnerHTML={{ __html: t('admin_permissions_instructions') }} />
                        <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                           {permissionKeys.map(key => (
                               <label key={key} className="flex items-start gap-3 p-3 rounded-md bg-brand-light-blue/50 hover:bg-brand-light-blue cursor-pointer">
                                   <input
                                       type="checkbox"
                                       className="mt-1 h-5 w-5 rounded bg-brand-dark border-gray-500 text-brand-cyan focus:ring-brand-cyan"
                                       checked={selectedRolePermissions.includes(key)}
                                       onChange={(e) => handlePermissionChange(key, e.target.checked)}
                                   />
                                   <div>
                                       <code className="font-bold text-white text-base">{key}</code>
                                       <p className="text-sm text-gray-300">{(PERMISSIONS as Record<string, string>)[key]}</p>
                                   </div>
                               </label>
                           ))}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                        <ShieldQuestion size={48} className="mb-4" />
                        <p className="text-xl">{t('select_role_to_manage')}</p>
                    </div>
                )}
            </div>
        </div>
        </Panel>
    );
};

const AuditLogPanel: React.FC = () => {
    const { t } = useLocalization();
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { showToast } = useToast();

    useEffect(() => {
        const fetchLogs = async () => {
            setIsLoading(true);
            try {
                setLogs(await getAuditLogs());
            } catch (e) {
                showToast((e as Error).message, 'error');
            } finally {
                setIsLoading(false);
            }
        };
        fetchLogs();
    }, [showToast]);

    return (
        <Panel isLoading={isLoading} loadingText="Loading audit logs...">
            <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50 overflow-hidden">
                <table className="w-full text-left min-w-[600px]">
                    <thead className="border-b border-brand-light-blue/50 text-gray-300">
                        <tr>
                            <th className="p-4">{t('log_timestamp')}</th>
                            <th className="p-4">{t('log_admin')}</th>
                            <th className="p-4">{t('log_action')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map(log => (
                            <tr key={log.id} className="border-b border-brand-light-blue/50 last:border-none">
                                <td className="p-4 text-sm text-gray-400">{new Date(log.timestamp).toLocaleString()}</td>
                                <td className="p-4 font-semibold">{log.admin_username}</td>
                                <td className="p-4">{log.action}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Panel>
    );
};

export default AdminPage;
