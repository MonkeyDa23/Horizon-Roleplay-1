
// src/components/admin/StaffPanel.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useLocalization } from '../../contexts/LocalizationContext';
import { useToast } from '../../contexts/ToastContext';
import { useConfig } from '../../contexts/ConfigContext';
import { useAuth } from '../../contexts/AuthContext';
import { getStaff, saveStaff, lookupUser, sendDiscordLog } from '../../lib/api';
import { useTranslations } from '../../contexts/TranslationsContext';
import { usePersistentState } from '../../hooks/usePersistentState';
import type { StaffMember, UserLookupResult } from '../../types';
import { Loader2, Plus, GripVertical, Trash2, Search, ChevronUp, ChevronDown, AlertCircle } from 'lucide-react';
import Modal from '../Modal';

type EditingStaffMember = Omit<StaffMember, 'id'> & {
    id?: string; // id can be missing for new members
    role_en: string;
    role_ar: string;
};

const StaffPanel: React.FC = () => {
    const { t } = useLocalization();
    const { showToast } = useToast();
    const { translations, refreshTranslations } = useTranslations();
    const { config } = useConfig();
    const { user } = useAuth();
    
    // PERSISTENT STATE
    const [staff, setStaff] = usePersistentState<EditingStaffMember[]>('vixel_admin_staff_draft', []);
    const [isAddModalOpen, setIsAddModalOpen] = usePersistentState<boolean>('vixel_admin_staff_modal_open', false);
    
    // Modal Field State (Persistent)
    const [lookupDiscordId, setLookupDiscordId] = usePersistentState<string>('vixel_admin_staff_lookup_id', '');
    const [newStaffRoleEn, setNewStaffRoleEn] = usePersistentState<string>('vixel_admin_staff_new_role_en', '');
    const [newStaffRoleAr, setNewStaffRoleAr] = usePersistentState<string>('vixel_admin_staff_new_role_ar', '');
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isLookingUp, setIsLookingUp] = useState(false);
    const [lookupResult, setLookupResult] = useState<UserLookupResult | null>(null);
    const [lookupError, setLookupError] = useState<string | null>(null);

    const fetchStaff = useCallback(async () => {
        setIsLoading(true);
        try {
            const staffData = await getStaff();
            
            setStaff((prev) => {
                if (prev.length > 0) return prev;
                return staffData.map(s => ({
                    ...s,
                    role_en: translations[s.role_key]?.en || '',
                    role_ar: translations[s.role_key]?.ar || ''
                }));
            });
        } catch (error) {
            showToast('Failed to load staff list.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showToast, translations, setStaff]);

    useEffect(() => {
        if (staff.length === 0) fetchStaff();
        else setIsLoading(false);
    }, [fetchStaff, staff.length]);

    // Re-run lookup if modal opens and ID exists (restores state visually)
    useEffect(() => {
        if (isAddModalOpen && lookupDiscordId && !lookupResult) {
            // Optional: Auto-lookup again or just let user click? 
            // Let's let user click to avoid spamming API on reload
        }
    }, [isAddModalOpen, lookupDiscordId]);

    const handleSave = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            const dataToSave = staff.map((member, index) => ({
                user_id: member.user_id,
                role_key: member.role_key,
                position: index,
                role_en: member.role_en,
                role_ar: member.role_ar,
            }));
            await saveStaff(dataToSave);
            await refreshTranslations();
            
            // Clear draft
            localStorage.removeItem('vixel_admin_staff_draft');
            
            showToast('Staff list saved successfully!', 'success');
            
            // Refresh list
            const staffData = await getStaff();
            setStaff(staffData.map(s => ({
                ...s,
                role_en: translations[s.role_key]?.en || '',
                role_ar: translations[s.role_key]?.ar || ''
            })));

            const embed = {
                title: "👥 تحديث فريق العمل",
                description: `قام المشرف **${user.username}** بتحديث قائمة فريق العمل المعروضة في صفحة 'من نحن'.\n\n**عدد الأعضاء الحالي:** ${staff.length}`,
                color: 0xFFA500, // Orange
                author: { name: user.username, icon_url: user.avatar },
                timestamp: new Date().toISOString(),
                footer: { text: "سجل الإدارة" }
            };
            await sendDiscordLog(config, embed, 'admin');

        } catch (error) {
            showToast((error as Error).message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleLookupUser = async () => {
        if (!lookupDiscordId) return;
        setIsLookingUp(true);
        setLookupResult(null);
        setLookupError(null);
        try {
            const result = await lookupUser(lookupDiscordId);
            setLookupResult(result);
        } catch (error) {
            setLookupError((error as Error).message);
        } finally {
            setIsLookingUp(false);
        }
    };

    const handleAddToStaff = () => {
        if (!lookupResult || !newStaffRoleEn || !lookupResult.id) {
            showToast('User and Role (English) are required.', 'warning');
            return;
        }
        if (staff.some(s => s.user_id === lookupResult.id)) {
            showToast('This user is already on the staff list.', 'warning');
            return;
        }
        const roleKey = `staff_role_${lookupResult.discordId}`;
        const newMember: EditingStaffMember = {
            user_id: lookupResult.id,
            username: lookupResult.username,
            avatar_url: lookupResult.avatar,
            discord_id: lookupDiscordId,
            role_key: roleKey,
            position: staff.length,
            role_en: newStaffRoleEn,
            role_ar: newStaffRoleAr
        };
        setStaff([...staff, newMember]);
        closeAddModal();
    };

    const closeAddModal = () => {
        setIsAddModalOpen(false);
        setLookupDiscordId('');
        setLookupResult(null);
        setLookupError(null);
        setNewStaffRoleEn('');
        setNewStaffRoleAr('');
    };

    const handleRemoveStaff = (userId: string) => {
        setStaff(prev => prev.filter(s => s.user_id !== userId));
    };
    
    const handleMove = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === staff.length - 1) return;
        
        const newList = [...staff];
        const item = newList[index];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        
        newList[index] = newList[swapIndex];
        newList[swapIndex] = item;
        
        setStaff(newList);
    };

    const handleRoleChange = (index: number, lang: 'en' | 'ar', value: string) => {
        const newList = [...staff];
        if (lang === 'en') newList[index].role_en = value;
        if (lang === 'ar') newList[index].role_ar = value;
        setStaff(newList);
    };

    return (
        <div className="animate-fade-in-up">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2 text-gray-400 bg-brand-dark p-2 rounded">
                    <AlertCircle size={16} />
                    <span className="text-sm">التعديلات محفوظة كمسودة حتى تضغط حفظ.</span>
                </div>
                <div className="flex gap-4">
                     <button onClick={() => setIsAddModalOpen(true)} className="bg-blue-500/80 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-500 transition-colors flex items-center gap-2">
                        <Plus size={18} /> {t('add_staff_member')}
                    </button>
                    <button onClick={handleSave} disabled={isSaving || isLoading} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white transition-colors min-w-[9rem] flex justify-center">
                        {isSaving ? <Loader2 className="animate-spin" /> : t('save_settings')}
                    </button>
                </div>
            </div>
            
            <div className="space-y-4">
                {isLoading ? (
                    <div className="flex justify-center items-center py-20"><Loader2 size={40} className="text-brand-cyan animate-spin" /></div>
                ) : staff.length > 0 ? staff.map((member, index) => (
                    <div key={member.user_id} className="bg-brand-dark-blue p-3 rounded-lg border border-brand-light-blue/50 flex items-center gap-4">
                        <GripVertical className="cursor-grab text-gray-500 flex-shrink-0" />
                        <img src={member.avatar_url} alt={member.username} className="w-12 h-12 rounded-full" />
                        <div className="flex-grow">
                            <p className="font-bold text-white">{member.username}</p>
                            <div className="flex gap-2 mt-1">
                                <input type="text" value={member.role_en} onChange={(e) => handleRoleChange(index, 'en', e.target.value)} placeholder={t('staff_role_en')} className="vixel-input !p-1 !text-sm" />
                                <input type="text" value={member.role_ar} onChange={(e) => handleRoleChange(index, 'ar', e.target.value)} placeholder={t('staff_role_ar')} className="vixel-input !p-1 !text-sm" dir="rtl" />
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <button onClick={() => handleMove(index, 'up')} disabled={index === 0} className="p-1 text-gray-400 hover:text-white disabled:opacity-30"><ChevronUp size={16}/></button>
                            <button onClick={() => handleMove(index, 'down')} disabled={index === staff.length - 1} className="p-1 text-gray-400 hover:text-white disabled:opacity-30"><ChevronDown size={16}/></button>
                        </div>
                        <button onClick={() => handleRemoveStaff(member.user_id)} className="text-red-500 hover:text-red-400 p-2"><Trash2 size={20} /></button>
                    </div>
                )) : (
                    <div className="text-center py-10 text-gray-400">No staff members added yet.</div>
                )}
            </div>

            {isAddModalOpen && (
                <Modal isOpen={isAddModalOpen} onClose={closeAddModal} title={t('add_staff_member')}>
                    <div className="space-y-4">
                        <div>
                            <label className="block font-semibold mb-1">{t('discord_id_to_add')}</label>
                            <div className="flex gap-2">
                                <input type="text" value={lookupDiscordId} onChange={e => setLookupDiscordId(e.target.value)} className="vixel-input !p-2"/>
                                <button onClick={handleLookupUser} disabled={isLookingUp || !lookupDiscordId} className="bg-brand-cyan text-brand-dark font-bold py-2 px-4 rounded-md hover:bg-white w-32 flex justify-center">
                                    {isLookingUp ? <Loader2 className="animate-spin" /> : t('find_user')}
                                </button>
                            </div>
                        </div>
                        {lookupResult ? (
                            <div className="p-4 bg-brand-dark rounded-lg border border-brand-light-blue flex items-center gap-4">
                                <img src={lookupResult.avatar} alt={lookupResult.username} className="w-16 h-16 rounded-full" />
                                <div>
                                    <p className="text-xl font-bold text-white">{lookupResult.username}</p>
                                    <p className="text-sm text-gray-400">ID: {lookupResult.discordId}</p>
                                </div>
                            </div>
                        ) : lookupError ? (
                             <p className="text-yellow-400 text-sm p-2 bg-yellow-500/10 rounded-md">{lookupError.replace('Exception: ', '')}</p>
                        ) : lookupDiscordId && !isLookingUp && (
                            <div className="p-2 text-sm text-gray-400">Click "Find User" to verify ID.</div>
                        )}
                        
                        <div className="pt-4 border-t border-brand-light-blue/50 space-y-4">
                                <div>
                                <label className="block font-semibold mb-1">{t('staff_role_en')}</label>
                                <input type="text" value={newStaffRoleEn} onChange={e => setNewStaffRoleEn(e.target.value)} className="vixel-input !p-2"/>
                            </div>
                                <div>
                                <label className="block font-semibold mb-1">{t('staff_role_ar')}</label>
                                <input type="text" value={newStaffRoleAr} onChange={e => setNewStaffRoleAr(e.target.value)} className="vixel-input !p-2" dir="rtl"/>
                            </div>
                        </div>

                        <div className="flex justify-end gap-4 pt-4 border-t border-brand-light-blue/50 mt-4">
                            <button onClick={closeAddModal} className="bg-gray-600 text-white font-bold py-2 px-6 rounded-md hover:bg-gray-500">Cancel</button>
                            <button onClick={handleAddToStaff} disabled={!lookupResult || !newStaffRoleEn || !lookupResult.id} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white disabled:opacity-50">
                                {t('add_to_staff')}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default StaffPanel;
