// src/components/admin/PermissionsPanel.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useToast } from '../../hooks/useToast';
import { getGuildRoles, getRolePermissions, saveRolePermissions } from '../../lib/api';
import type { DiscordRole, RolePermission, PermissionKey } from '../../types';
import { PERMISSIONS } from '../../lib/permissions';
import { Loader2, ShieldQuestion } from 'lucide-react';

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

const RoleBadge: React.FC<{ role: DiscordRole }> = ({ role }) => {
    const color = role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99aab5';
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    const textColor = brightness > 125 ? 'text-black' : 'text-white';
    return <span className={`inline-block px-2 py-1 text-xs font-bold rounded-md ${textColor}`} style={{ backgroundColor: color }}>{role.name}</span>;
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
                const [guildRoles, rolePermissions] = await Promise.all([ getGuildRoles(), getRolePermissions() ]);
                setRoles(guildRoles);
                setPermissions(rolePermissions);
            } catch (error) {
                console.error("Failed to fetch permissions data:", error);
                const errorMessage = (error instanceof Error) ? error.message : "An unknown error occurred.";
                showToast(`${t('permissions_load_error')}: ${errorMessage}`, "error");
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

    const selectedRolePermissions = permissions.find(p => p.role_id === selectedRoleId)?.permissions || [];
    const permissionKeys = Object.keys(PERMISSIONS) as PermissionKey[];

    return (
        <Panel isLoading={isLoading} loadingText={t('loading_roles_permissions')}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 bg-brand-dark-blue p-4 rounded-lg border border-brand-light-blue/50">
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
            <div className="lg:col-span-2 bg-brand-dark-blue p-6 rounded-lg border border-brand-light-blue/50">
                {selectedRoleId ? (
                    <>
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h3 className="text-xl font-bold">{t('available_permissions')}</h3>
                                <div className="mt-1"><RoleBadge role={roles.find(r => r.id === selectedRoleId)!} /></div>
                            </div>
                            <button onClick={handleSave} disabled={isSaving} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white transition-colors min-w-[9rem] flex justify-center">
                                {isSaving ? <Loader2 className="animate-spin" /> : t('save_permissions')}
                            </button>
                        </div>
                        <p className="text-sm text-gray-400 mb-6" dangerouslySetInnerHTML={{ __html: t('admin_permissions_instructions') }} />
                        <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                           {permissionKeys.map(key => (
                               <label key={key} className="flex items-start gap-3 p-3 rounded-md bg-brand-light-blue/50 hover:bg-brand-light-blue cursor-pointer transition-colors">
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
                        <p className="text-xl font-bold">{t('select_role_to_manage')}</p>
                        <p className="mt-2 text-gray-500">{t('admin_permissions_bootstrap_instructions_title')}</p>
                        <p className="text-xs text-gray-500 mt-1 max-w-sm" dangerouslySetInnerHTML={{ __html: t('admin_permissions_bootstrap_instructions_body') }} />
                    </div>
                )}
            </div>
        </div>
        </Panel>
    );
};

export default PermissionsPanel;
