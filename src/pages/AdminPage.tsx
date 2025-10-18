import React, { useState, useEffect } from 'react';
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
import type { Quiz, QuizSubmission, SubmissionStatus, AuditLogEntry, RuleCategory, Product, AppConfig, UserLookupResult, Translations, DiscordRole, RolePermission, PermissionKey } from '../types';
import { useNavigate } from 'react-router-dom';
import { UserCog, Plus, Edit, Trash2, Check, X, FileText, Server, Eye, Loader2, ShieldCheck, BookCopy, Store, Palette, Search, Languages, Settings, Lock } from 'lucide-react';
import Modal from '../components/Modal';
import SEO from '../components/SEO';
import { PERMISSIONS } from '../lib/permissions';

type AdminTab = 'submissions' | 'lookup' | 'quizzes' | 'rules' | 'store' | 'appearance' | 'translations' | 'permissions' | 'audit';

const TABS: { id: AdminTab; labelKey: string; icon: React.ElementType; permission: PermissionKey }[] = [
  { id: 'submissions', labelKey: 'submission_management', icon: FileText, permission: 'admin_submissions' },
  { id: 'lookup', labelKey: 'user_lookup', icon: Search, permission: 'admin_lookup' },
  { id: 'quizzes', labelKey: 'quiz_management', icon: Server, permission: 'admin_quizzes' },
  { id: 'rules', labelKey: 'rules_management', icon: BookCopy, permission: 'admin_rules' },
  { id: 'store', labelKey: 'store_management', icon: Store, permission: 'admin_store' },
  { id: 'translations', labelKey: 'translations_management', icon: Languages, permission: 'admin_translations' },
  { id: 'appearance', labelKey: 'appearance_settings', icon: Palette, permission: 'admin_appearance' },
  { id: 'permissions', labelKey: 'permissions_management', icon: Lock, permission: 'admin_permissions' },
  { id: 'audit', labelKey: 'audit_log', icon: ShieldCheck, permission: 'admin_audit_log' },
];

const AdminPage: React.FC = () => {
  const { user, loading: authLoading, hasPermission } = useAuth();
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
  
  // Permissions Page State
  const [guildRoles, setGuildRoles] = useState<DiscordRole[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [rolePermissions, setRolePermissions] = useState<Set<PermissionKey>>(new Set());
  
  // User Lookup State
  const [lookupUserId, setLookupUserId] = useState('');
  const [lookupResult, setLookupResult] = useState<UserLookupResult | null>(null);
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !hasPermission('admin_panel')) {
        navigate('/');
    }
  }, [authLoading, hasPermission, navigate]);

  useEffect(() => {
    if (!hasPermission('admin_panel')) return;
    setLookupResult(null);

    const fetchDataForTab = async () => {
        setIsTabLoading(true);
        try {
            const currentTabPermission = TABS.find(t => t.id === activeTab)?.permission;
            if (currentTabPermission && !hasPermission(currentTabPermission)) {
                // If user loses permission for the active tab, switch to the first one they CAN see
                const firstAllowedTab = TABS.find(t => hasPermission(t.permission));
                setActiveTab(firstAllowedTab?.id || 'submissions');
                return;
            }

            switch (activeTab) {
                case 'submissions': if (hasPermission('admin_submissions')) setSubmissions(await getSubmissions()); break;
                case 'quizzes': if (hasPermission('admin_quizzes')) setQuizzes(await getQuizzes()); break;
                case 'rules': if (hasPermission('admin_rules')) setEditableRules(JSON.parse(JSON.stringify(await getRules()))); break;
                case 'store': if (hasPermission('admin_store')) setProducts(await getProducts()); break;
                case 'translations': if(hasPermission('admin_translations')) setTranslations(await getTranslations()); break;
                case 'appearance': if (hasPermission('admin_appearance')) setEditableConfig({ ...config }); break;
                case 'audit': if (hasPermission('admin_audit_log')) setAuditLogs(await getAuditLogs()); break;
                case 'permissions':
                    if (hasPermission('admin_permissions')) {
                        let cacheLoaded = false;
                        try {
                            const cachedRolesRaw = localStorage.getItem('vixel_guildRolesCache');
                            if (cachedRolesRaw) {
                                const { roles: cachedRoles } = JSON.parse(cachedRolesRaw);
                                setGuildRoles(cachedRoles);
                                setIsTabLoading(false); // We have data, no need to show loader
                                cacheLoaded = true;
                            }
                        } catch (e) { console.error("Failed to load guild roles from cache", e); }

                        try {
                            const freshRoles = await getGuildRoles();
                            setGuildRoles(freshRoles);
                            localStorage.setItem('vixel_guildRolesCache', JSON.stringify({ roles: freshRoles }));
                        } catch (err) {
                            console.error("Failed to refresh guild roles:", err);
                            if (!cacheLoaded) {
                                throw err; // Re-throw to be caught by the outer catch block
                            }
                        }
                    }
                    break;
                case 'lookup': break; // No initial data load needed
            }
        } catch (error) {
            showToast(`Failed to load data for ${activeTab}.`, "error");
        } finally {
            setIsTabLoading(false);
        }
    };
    fetchDataForTab();
  }, [activeTab, hasPermission]);
  
  // Fetch permissions when a role is selected
  useEffect(() => {
    if (activeTab === 'permissions' && selectedRoleId) {
      const fetchPerms = async () => {
        setIsTabLoading(true);
        try {
          const data = await getRolePermissions(selectedRoleId);
          setRolePermissions(new Set(data?.permissions || []));
        } catch (error) {
          showToast("Failed to load role permissions", "error");
        } finally {
          setIsTabLoading(false);
        }
      };
      fetchPerms();
    } else {
      setRolePermissions(new Set());
    }
  }, [selectedRoleId, activeTab]);


  const handleSaveRolePermissions = async () => {
    if (!selectedRoleId) return;
    setIsSaving(true);
    try {
      await saveRolePermissions(selectedRoleId, Array.from(rolePermissions));
      showToast(t('permissions_saved_success'), 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to save permissions", "error");
    } finally {
      setIsSaving(false);
    }
  };


  const refreshSubmissions = React.useCallback(async () => { /* ... */ }, []);
  const handleSaveQuiz = async () => { /* ... */ };
  const handleDeleteQuiz = async (id: string) => { /* ... */ };
  const handleTakeOrder = async (id: string) => { /* ... */ };
  const handleDecision = async (id: string, decision: 'accepted'|'refused') => { /* ... */ };
  const handleSaveConfig = async () => { /* ... */ };
  const handleSaveTranslations = async () => { /* ... */ };
  const handleUserLookup = async (e: React.FormEvent) => { /* ... */ };
  const handleSaveProduct = async () => { /* ... */ };
  const handleDeleteProduct = async (id: string) => { /* ... */ };
  const handleSaveRules = async () => { /* ... */ };
  
  if (authLoading || !user) return <div className="flex justify-center items-center h-screen w-screen"><Loader2 size={48} className="animate-spin text-brand-cyan" /></div>;
  if (!hasPermission('admin_panel')) return null;

  const visibleTabs = TABS.filter(tab => hasPermission(tab.permission));

  const renderStatusBadge = (status: SubmissionStatus) => { /* ... */ return <span>{status}</span> };

  const TabContent: React.FC<{children: React.ReactNode}> = ({ children }) => {
      if (isTabLoading) return <div className="flex justify-center py-20"><Loader2 size={40} className="text-brand-cyan animate-spin" /></div>;
      return <>{children}</>;
  }

  const SubmissionsPanel = () => ( <div>Submissions</div> );
  const QuizzesPanel = () => ( <div>Quizzes</div> );
  const StorePanel = () => ( <div>Store</div> );
  const RulesPanel = () => ( <div>Rules</div> );
  const AuditLogPanel = () => ( <div>Audit</div> );
  const AppearancePanel = () => ( <div>Appearance</div> );
  const TranslationsPanel = () => ( <div>Translations</div> );
  const UserLookupPanel = () => ( <div>Lookup</div> );
  
  const PermissionsPanel = () => (
    <div className="mt-6 max-w-4xl mx-auto">
        <div className="bg-brand-dark-blue p-6 rounded-lg border border-brand-light-blue/50">
            <h2 className="text-xl font-bold text-brand-cyan mb-4">{t('select_role_to_configure')}</h2>
            <select
                value={selectedRoleId}
                onChange={e => setSelectedRoleId(e.target.value)}
                className="w-full bg-brand-light-blue text-white p-3 rounded-md border border-gray-600 focus:ring-2 focus:ring-brand-cyan"
            >
                <option value="">-- Select a Role --</option>
                {guildRoles.filter(r => r.name !== '@everyone').sort((a,b) => b.position - a.position).map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                ))}
            </select>
        </div>

        {selectedRoleId && !isTabLoading && (
            <div className="mt-8 animate-fade-in-up">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">{t('available_permissions')}</h3>
                    <button onClick={handleSaveRolePermissions} disabled={isSaving} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white min-w-[9rem] flex justify-center">
                        {isSaving ? <Loader2 className="animate-spin"/> : t('save_permissions')}
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(PERMISSIONS).map(([key, description]) => {
                        const permKey = key as PermissionKey;
                        const isChecked = rolePermissions.has(permKey);
                        return (
                            <div key={key} className={`p-4 rounded-lg border transition-all ${isChecked ? 'bg-brand-cyan/10 border-brand-cyan/50' : 'bg-brand-dark-blue border-brand-light-blue/50'}`}>
                                <label className="flex items-center justify-between cursor-pointer">
                                    <div className="flex-grow pr-4">
                                        <p className={`font-bold ${isChecked ? 'text-brand-cyan' : 'text-white'}`}>{t(`perm_${key}`)}</p>
                                        <p className="text-xs text-gray-400">{t(`perm_${key}_desc`, { default: description })}</p>
                                    </div>
                                    <div className="relative inline-block w-12 flex-shrink-0 align-middle select-none transition duration-200 ease-in">
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => {
                                                const newPerms = new Set(rolePermissions);
                                                if (newPerms.has(permKey)) newPerms.delete(permKey);
                                                else newPerms.add(permKey);
                                                setRolePermissions(newPerms);
                                            }}
                                            className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                                        />
                                        <span className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-600 cursor-pointer"></span>
                                    </div>
                                </label>
                            </div>
                        )
                    })}
                </div>
            </div>
        )}
        <style>{`.toggle-checkbox:checked { right: 0; border-color: #00f2ea; } .toggle-checkbox:checked + .toggle-label { background-color: #00f2ea; }`}</style>
    </div>
  );

  return (
    <>
      <SEO title={`${communityName} - ${t('admin_panel')}`} description="Admin control panel for authorized staff members." noIndex={true} />
      <div className="container mx-auto px-6 py-16">
        <div className="text-center mb-12"><div className="inline-block p-4 bg-brand-light-blue rounded-full mb-4"><UserCog className="text-brand-cyan" size={48} /></div><h1 className="text-4xl md:text-5xl font-bold mb-4">{t('page_title_admin')}</h1></div>
        <div className="max-w-7xl mx-auto">
            <div className="flex border-b border-brand-light-blue/50 mb-6 overflow-x-auto">{visibleTabs.map((tab) => (<button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`py-3 px-6 font-bold flex-shrink-0 flex items-center gap-2 transition-colors ${activeTab === tab.id ? 'text-brand-cyan border-b-2 border-brand-cyan' : 'text-gray-400 hover:text-brand-cyan'}`}><tab.icon size={18}/> {t(tab.labelKey)}</button>))}</div>
            <TabContent>
              {activeTab === 'submissions' && hasPermission('admin_submissions') && <SubmissionsPanel />}
              {activeTab === 'lookup' && hasPermission('admin_lookup') && <UserLookupPanel />}
              {activeTab === 'quizzes' && hasPermission('admin_quizzes') && <QuizzesPanel />}
              {activeTab === 'rules' && hasPermission('admin_rules') && <RulesPanel />}
              {activeTab === 'store' && hasPermission('admin_store') && <StorePanel />}
              {activeTab === 'translations' && hasPermission('admin_translations') && <TranslationsPanel />}
              {activeTab === 'appearance' && hasPermission('admin_appearance') && <AppearancePanel />}
              {activeTab === 'permissions' && hasPermission('admin_permissions') && <PermissionsPanel />}
              {activeTab === 'audit' && hasPermission('admin_audit_log') && <AuditLogPanel />}
            </TabContent>
        </div>
        {/* Modals will go here */}
      </div>
    </>
  );
};

export default AdminPage;