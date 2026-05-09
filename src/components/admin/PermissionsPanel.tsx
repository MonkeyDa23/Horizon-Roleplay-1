/**
 * Nova Roleplay - Official Website
 * Permissions Management Panel
 */
import React, { useState, useEffect } from 'react';
import { useLocalization } from '../../contexts/LocalizationContext';
import { useToast } from '../../contexts/ToastContext';
import { getGuildRoles, getRolePermissions, saveRolePermissions } from '../../lib/api';
import type { DiscordRole, RolePermission, PermissionKey } from '../../types';
import { PERMISSIONS } from '../../lib/permissions';
import { useConfig } from '../../contexts/ConfigContext';
import { Loader2, ShieldQuestion, AlertTriangle, Save, Shield, Search, ChevronRight } from 'lucide-react';

const PermissionsPanel: React.FC = () => {
    const { t, dir } = useLocalization();
    const { showToast } = useToast();
    const { branding } = useConfig();
    const isArabic = dir === 'rtl';

    const [roles, setRoles] = useState<DiscordRole[]>([]);
    const [permissions, setPermissions] = useState<RolePermission[]>([]);
    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setFetchError(null);
            try {
                const [guildRoles, rolePermissions] = await Promise.all([ getGuildRoles(), getRolePermissions() ]);
                setRoles(guildRoles);
                setPermissions(rolePermissions);
            } catch (error) {
                console.error("Failed to fetch permissions data:", error);
                const errorMessage = (error instanceof Error) ? error.message : "An unknown error occurred.";
                showToast(`${t('permissions_load_error')}: ${errorMessage}`, "error");
                setFetchError(errorMessage);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [showToast, t]);

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

    const RoleBadge = ({ role }: { role: DiscordRole }) => {
        const color = role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99aab5';
        return <span className="inline-block px-3 py-1 text-[10px] uppercase tracking-widest font-black rounded-lg text-white shadow-xl" style={{ backgroundColor: `${color}44`, border: `1px solid ${color}66` }}>{role.name}</span>;
    };

    const selectedRolePermissions = permissions.find(p => p.role_id === selectedRoleId)?.permissions || [];
    const permissionKeys = (Object.keys(PERMISSIONS) as PermissionKey[]).filter(k => k.toLowerCase().includes(searchTerm.toLowerCase()));

    if (isLoading) {
        return (
            <div className="flex flex-col gap-6 justify-center items-center py-32 min-h-[500px]">
                <div className="relative">
                    <div className="absolute inset-0 blur-3xl opacity-20" style={{ backgroundColor: branding.primaryColor }}></div>
                    <Loader2 size={40} className="animate-spin text-white relative z-10" style={{ color: branding.primaryColor }} />
                </div>
                <p className="text-text-secondary font-black uppercase tracking-[0.3em] animate-pulse">{t('please_wait')}</p>
            </div>
        );
    }

    if (fetchError) {
        return (
            <div className="bg-red-500/5 border border-red-500/20 p-12 rounded-[50px] shadow-2xl animate-fade-in-up">
                <div className="flex flex-col items-center text-center gap-6">
                    <div className="w-16 h-16 bg-red-500/10 rounded-[28px] flex items-center justify-center text-red-500 border border-red-500/10">
                        <AlertTriangle size={32} />
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-3xl font-black text-white uppercase tracking-tight">Discord Sync Error</h3>
                        <p className="max-w-xl text-text-secondary opacity-60 leading-relaxed mx-auto">
                            The system could not communicate with your Discord Bot integration. Ensure your bot is online and the API key matches.
                        </p>
                    </div>
                    <div className="p-6 bg-brand-dark rounded-3xl border border-white/5 font-mono text-xs text-red-400 max-w-2xl w-full overflow-hidden">
                        {fetchError}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-fade-in-up">
            {/* Left Sidebar: Roles */}
            <aside className="lg:col-span-4 xl:col-span-3">
                <div className="bg-white/[0.02] border border-white/5 rounded-[50px] overflow-hidden flex flex-col h-full shadow-2xl">
                    <div className="p-8 border-b border-white/5 bg-white/[0.01]">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-text-secondary mb-4">{t('discord_roles')}</h3>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                            <input 
                                type="text"
                                placeholder="Search roles..."
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-white/20 transition-all font-bold"
                            />
                        </div>
                    </div>
                    <div className="flex-grow overflow-y-auto p-4 custom-scrollbar max-h-[70vh]">
                        <div className="space-y-2">
                            {roles.map(role => (
                                <button 
                                    key={role.id}
                                    onClick={() => setSelectedRoleId(role.id)}
                                    className={`w-full group flex items-center justify-between p-5 rounded-3xl transition-all border ${selectedRoleId === role.id ? 'bg-white/10 border-white/10 shadow-2xl scale-[1.02]' : 'hover:bg-white/5 border-transparent'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: `#${role.color.toString(16).padStart(6, '0')}` }}></div>
                                        <span className={`text-sm font-black tracking-tight ${selectedRoleId === role.id ? 'text-white' : 'text-text-secondary group-hover:text-white'}`}>
                                            {role.name}
                                        </span>
                                    </div>
                                    <ChevronRight size={18} className={`transition-all ${selectedRoleId === role.id ? 'opacity-100 translate-x-1' : 'opacity-0'}`} />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </aside>

            {/* Right Panel: Permissions */}
            <div className="lg:col-span-8 xl:col-span-9">
                <div className="bg-white/[0.02] border border-white/5 rounded-[60px] p-10 xl:p-16 h-full shadow-2xl relative overflow-hidden flex flex-col">
                    {selectedRoleId ? (
                        <>
                            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 mb-12 relative z-10">
                                <div className="flex items-center gap-8">
                                    <div className="w-16 h-16 rounded-[28px] flex items-center justify-center bg-white/5 border border-white/10 shadow-inner relative">
                                        <div className="absolute inset-0 blur-2xl opacity-20" style={{ backgroundColor: branding.primaryColor }}></div>
                                        <Shield size={24} style={{ color: branding.primaryColor }} className="relative z-10" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-4xl font-black text-white uppercase tracking-tight">{t('available_permissions')}</h3>
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                            <RoleBadge role={roles.find(r => r.id === selectedRoleId)!} />
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={handleSave} 
                                    disabled={isSaving} 
                                    style={{ backgroundColor: branding.primaryColor }}
                                    className={`group px-12 py-6 rounded-[30px] font-black text-lg transition-all shadow-2xl flex items-center gap-4 active:scale-95 ${isSaving ? 'opacity-50' : 'hover:translate-y-[-4px]'}`}
                                >
                                    {isSaving ? (
                                        <Loader2 size={24} className="animate-spin text-brand-dark" />
                                    ) : (
                                        <>
                                            <Save size={24} className="text-brand-dark" />
                                            <span className="text-brand-dark">{t('save_permissions')}</span>
                                        </>
                                    )}
                                </button>
                            </div>

                            <div className="bg-white/[0.03] border border-white/5 p-6 rounded-3xl mb-12 flex items-center gap-6">
                                <div className="w-12 h-12 rounded-2xl bg-brand-cyan/10 flex items-center justify-center text-brand-cyan">
                                    <ShieldQuestion size={24} />
                                </div>
                                <p className="text-sm text-text-secondary font-medium leading-relaxed max-w-3xl" dangerouslySetInnerHTML={{ __html: t('admin_permissions_instructions') }} />
                            </div>

                            <div className="mb-8 relative max-w-md">
                                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20" size={20} />
                                <input 
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder={t('search_keys') || "Search permissions..."}
                                    className="w-full bg-white/5 border border-white/10 rounded-[28px] py-4 pl-14 pr-8 text-white font-bold focus:outline-none focus:border-white/20 transition-all shadow-inner"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto pr-6 custom-scrollbar max-h-[50vh]">
                                {permissionKeys.map(key => (
                                    <label key={key} className="relative group cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="peer hidden"
                                            checked={selectedRolePermissions.includes(key)}
                                            onChange={(e) => handlePermissionChange(key, e.target.checked)}
                                        />
                                        <div className="h-full bg-white/[0.02] border border-white/5 p-6 rounded-[32px] transition-all peer-checked:bg-brand-cyan/10 peer-checked:border-brand-cyan/30 hover:bg-white/[0.05] group-hover:scale-[1.02]">
                                            <div className="flex items-start justify-between mb-4">
                                                <code className={`text-xs font-black uppercase tracking-widest ${selectedRolePermissions.includes(key) ? 'text-brand-cyan' : 'text-white'}`}>
                                                    {key}
                                                </code>
                                                <div className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${selectedRolePermissions.includes(key) ? 'bg-brand-cyan border-brand-cyan text-brand-dark' : 'border-white/10'}`}>
                                                    {selectedRolePermissions.includes(key) && <Save size={14} />}
                                                </div>
                                            </div>
                                            <p className="text-xs text-text-secondary leading-relaxed line-clamp-3 font-medium opacity-60">
                                                {PERMISSIONS[key]}
                                            </p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center space-y-8 animate-pulse-slow">
                            <div className="w-24 h-24 bg-white/5 rounded-[32px] flex items-center justify-center text-white/10 border border-white/5 shadow-2xl">
                                <ShieldQuestion size={40} />
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-3xl font-black text-text-secondary opacity-40 uppercase tracking-tight">{t('select_role_to_manage')}</h3>
                                <div className="max-w-md mx-auto p-6 bg-white/[0.02] rounded-3xl border border-white/5 text-xs text-text-secondary font-black tracking-widest leading-loose opacity-20" dangerouslySetInnerHTML={{ __html: t('admin_permissions_bootstrap_instructions_body') }} />
                            </div>
                        </div>
                    )}
                    
                    {/* Background decoration */}
                    <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-brand-cyan/5 blur-[150px] rounded-full -z-10"></div>
                </div>
            </div>
        </div>
    );
};

export default PermissionsPanel;
