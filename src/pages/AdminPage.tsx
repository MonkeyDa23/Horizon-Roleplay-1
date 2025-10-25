// src/pages/AdminPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLocalization } from '../hooks/useLocalization';
import { useToast } from '../hooks/useToast';
import { 
  getQuizzes, saveQuiz as apiSaveQuiz, deleteQuiz as apiDeleteQuiz,
  getSubmissions, updateSubmissionStatus, getAuditLogs, getRules, saveRules as apiSaveRules,
  getProducts, saveProduct as apiSaveProduct, deleteProduct as apiDeleteProduct,
  getTranslations, saveTranslations as apiSaveTranslations, saveConfig as apiSaveConfig,
  lookupUser, banUser, unbanUser,
  getGuildRoles, getRolePermissions, saveRolePermissions
} from '../lib/api';
import type { 
  Quiz, QuizSubmission, SubmissionStatus, AuditLogEntry, RuleCategory, 
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
import { useConfig } from '../hooks/useConfig';


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

                    {/* TODO: Add other panels back in */}
                    {activeTab === 'permissions' && <PermissionsPanel />}
                    {/* Fallback for now */}
                    {activeTab !== 'permissions' && <p className='text-center py-20 text-gray-400'>Panel for "{activeTab}" is under construction.</p>}
                </div>
            </div>
        </>
    );
};

// =============================================
// PERMISSIONS PANEL
// =============================================
const PermissionsPanel = () => {
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
                    ? [...rolePerms.permissions, permissionKey]
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


    if (isLoading) {
        return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-cyan" size={40} /></div>;
    }

    const selectedRolePermissions = permissions.find(p => p.role_id === selectedRoleId)?.permissions || [];
    const permissionKeys = Object.keys(PERMISSIONS) as PermissionKey[];

    return (
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
    );
};

export default AdminPage;
