/**
 * Nova Roleplay - Official Website
 * Admin Staff Team Panel
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useLocalization } from '../../contexts/LocalizationContext';
import { useToast } from '../../contexts/ToastContext';
import { useConfig } from '../../contexts/ConfigContext';
import { useAuth } from '../../contexts/AuthContext';
import { getStaff, saveStaff, lookupUser, logAdminAction } from '../../lib/api';
import { useTranslations } from '../../contexts/TranslationsContext';
import { usePersistentState } from '../../hooks/usePersistentState';
import type { StaffMember, UserLookupResult } from '../../types';
import { Loader2, Plus, GripVertical, Trash2, ChevronUp, ChevronDown, AlertCircle, UserPlus, Save, Search, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Modal from '../Modal';

type EditingStaffMember = Omit<StaffMember, 'id'> & {
    id?: string;
    role_en: string;
    role_ar: string;
};

const StaffPanel: React.FC = () => {
    const { t, language, dir } = useLocalization();
    const isArabic = language === 'ar';
    const { showToast } = useToast();
    const { translations, refreshTranslations } = useTranslations();
    const { config, branding } = useConfig();
    const { user } = useAuth();
    
    const [staff, setStaff] = usePersistentState<EditingStaffMember[]>('vixel_admin_staff_draft', []);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    
    const [lookupDiscordId, setLookupDiscordId] = useState('');
    const [newStaffRoleEn, setNewStaffRoleEn] = useState('');
    const [newStaffRoleAr, setNewStaffRoleAr] = useState('');
    
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
            localStorage.removeItem('vixel_admin_staff_draft');
            showToast('Staff list saved successfully!', 'success');
            
            await logAdminAction(config, user, "تحديث فريق العمل", `تم تحديث قائمة فريق العمل المعروضة في صفحة 'من نحن'.\n**عدد الأعضاء الحالي:** ${staff.length}`, 'WARNING');
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
        if(window.confirm(t('confirm_delete') || 'Are you sure?')) {
            setStaff(prev => prev.filter(s => s.user_id !== userId));
        }
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
        if (newList[index]) {
          if (lang === 'en') newList[index].role_en = value;
          if (lang === 'ar') newList[index].role_ar = value;
          setStaff(newList);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in-up" dir={dir}>
            {/* Header / Stats */}
            <div className="bg-white/[0.02] border border-white/5 p-8 rounded-[40px] flex flex-col md:flex-row gap-8 items-center justify-between shadow-2xl backdrop-blur-xl">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-3xl flex items-center justify-center border border-blue-500/10 shadow-inner">
                        <UserPlus className="text-blue-500" size={32} />
                    </div>
                    <div>
                        <div className="text-4xl font-black text-white">{staff.length}</div>
                        <div className="text-text-secondary text-xs uppercase font-black tracking-widest mt-1">{t('staff_members_count')}</div>
                    </div>
                </div>

                <div className="flex gap-4">
                     <button 
                        onClick={() => setIsAddModalOpen(true)} 
                        className="bg-white/5 text-white border border-white/10 font-black py-4 px-8 rounded-2xl hover:bg-white/10 transition-all flex items-center gap-3 active:scale-95"
                    >
                        <Plus size={24} /> {t('add_staff_member')}
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={isSaving || isLoading} 
                        style={{ backgroundColor: branding.primaryColor }}
                        className="text-brand-dark font-black py-4 px-10 rounded-2xl hover:scale-105 transition-all shadow-xl min-w-[10rem] flex justify-center disabled:opacity-30 disabled:grayscale active:scale-95"
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={24} /> : (
                            <div className="flex items-center gap-3">
                                <Save size={24} />
                                {t('save_settings')}
                            </div>
                        )}
                    </button>
                </div>
            </div>

            {/* Warning Area */}
            <div className="bg-yellow-500/5 border border-yellow-500/10 p-6 rounded-3xl flex items-center gap-4 text-yellow-200">
                <AlertCircle className="flex-shrink-0" size={24} />
                <p className="text-sm font-black opacity-80">{t('staff_draft_hint') || 'التعديلات محفوظة كمسودة حتى تضغط حفظ لتطبيقها على الموقع.'}</p>
            </div>
            
            {/* Staff List */}
            <div className="space-y-4">
                {isLoading ? (
                    <div className="flex justify-center items-center py-20"><Loader2 size={64} className="animate-spin opacity-20" style={{ color: branding.primaryColor }} /></div>
                ) : staff.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {staff.map((member, index) => (
                        <div key={member.user_id} className="bg-white/[0.02] p-6 rounded-[32px] border border-white/5 flex flex-col md:flex-row items-center gap-8 shadow-xl group hover:border-white/10 transition-all">
                            <div className="flex items-center gap-6 flex-grow w-full">
                                <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-40 transition-opacity">
                                    <button onClick={() => handleMove(index, 'up')} disabled={index === 0} className="p-1 hover:text-white disabled:opacity-20"><ChevronUp size={20}/></button>
                                    <button onClick={() => handleMove(index, 'down')} disabled={index === staff.length - 1} className="p-1 hover:text-white disabled:opacity-20"><ChevronDown size={20}/></button>
                                </div>
                                <GripVertical className="text-white/10 cursor-grab hidden md:block" />
                                <div className="relative">
                                    <div className="absolute inset-0 blur-lg opacity-20 bg-white rounded-full"></div>
                                    <img src={member.avatar_url} alt={member.username} className="w-20 h-20 rounded-3xl relative z-10 border border-white/10 shadow-2xl" />
                                </div>
                                <div className="flex-grow">
                                    <p className="text-2xl font-black text-white mb-4 uppercase tracking-tight">{member.username}</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black text-text-secondary uppercase opacity-40">Role (EN)</p>
                                            <input 
                                                type="text" 
                                                value={member.role_en} 
                                                onChange={(e) => handleRoleChange(index, 'en', e.target.value)} 
                                                placeholder={t('staff_role_en')} 
                                                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-white/20 transition-all shadow-inner" 
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black text-text-secondary uppercase opacity-40">Role (AR)</p>
                                            <input 
                                                type="text" 
                                                value={member.role_ar} 
                                                onChange={(e) => handleRoleChange(index, 'ar', e.target.value)} 
                                                placeholder={t('staff_role_ar')} 
                                                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-white/20 transition-all shadow-inner text-right" 
                                                dir="rtl" 
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <button 
                                onClick={() => handleRemoveStaff(member.user_id)} 
                                className="w-full md:w-auto p-5 bg-red-500/5 text-red-500 hover:bg-red-500/10 rounded-2xl transition-all border border-red-500/10 hover:border-red-500/20 active:scale-95"
                            >
                                <Trash2 size={24} />
                            </button>
                        </div>
                    ))}
                  </div>
                ) : (
                    <div className="bg-white/[0.02] border border-white/5 rounded-[40px] py-32 text-center text-text-secondary shadow-lg">
                        <div className="flex flex-col items-center gap-6">
                            <User size={80} className="opacity-5" />
                            <p className="text-2xl font-black">{t('no_staff_members')}...</p>
                            <button onClick={() => setIsAddModalOpen(true)} className="px-8 py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-white font-black text-sm border border-white/10 transition-all">
                                {t('add_staff_member')}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Add Member Modal */}
            {isAddModalOpen && (
                <Modal isOpen={isAddModalOpen} onClose={closeAddModal} title={t('add_staff_member')}>
                    <div className="p-8 space-y-10" dir={dir}>
                        <div className="space-y-6">
                            <label className="text-xs font-black uppercase text-text-secondary opacity-40 tracking-widest">{t('discord_id_to_add')}</label>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <div className="relative flex-grow">
                                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-text-secondary opacity-40" size={24} />
                                    <input 
                                        type="text" 
                                        value={lookupDiscordId} 
                                        onChange={e => setLookupDiscordId(e.target.value)} 
                                        className="w-full bg-white/5 border-2 border-white/10 rounded-2xl py-5 pl-16 pr-6 text-xl text-white focus:outline-none transition-all placeholder:text-white/10 shadow-inner"
                                        placeholder="User Discord ID..."
                                    />
                                </div>
                                <button 
                                    onClick={handleLookupUser} 
                                    disabled={isLookingUp || !lookupDiscordId} 
                                    className="bg-white/5 text-white border border-white/10 font-black py-5 px-10 rounded-2xl hover:bg-white/10 transition-all shadow-xl min-w-[12rem] flex justify-center active:scale-95 disabled:opacity-30"
                                >
                                    {isLookingUp ? <Loader2 className="animate-spin" size={28} /> : t('find_user')}
                                </button>
                            </div>
                        </div>

                        {lookupResult ? (
                            <div className="p-8 bg-blue-500/5 rounded-[40px] border border-blue-500/10 flex items-center gap-6 animate-fade-in shadow-inner">
                                <img src={lookupResult.avatar} alt={lookupResult.username} className="w-20 h-20 rounded-3xl border border-white/10 shadow-2xl" />
                                <div>
                                    <p className="text-3xl font-black text-white mb-1">{lookupResult.username}</p>
                                    <p className="text-sm font-mono text-blue-400 opacity-60 tracking-widest">ID: {lookupResult.discordId}</p>
                                </div>
                            </div>
                        ) : lookupError ? (
                             <div className="p-6 bg-red-500/5 border border-red-500/10 rounded-3xl text-red-500 font-bold flex items-center gap-4 animate-shake">
                                <AlertCircle size={24} />
                                {lookupError.replace('Exception: ', '')}
                             </div>
                        ) : null}
                        
                        <div className="pt-8 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-8">
                             <div className="space-y-4">
                                <label className="text-xs font-black uppercase text-text-secondary opacity-40 tracking-widest">{t('staff_role_en')}</label>
                                <input 
                                    type="text" 
                                    value={newStaffRoleEn} 
                                    onChange={e => setNewStaffRoleEn(e.target.value)} 
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-lg text-white focus:outline-none transition-all shadow-inner"
                                    placeholder="Executive Director..."
                                />
                            </div>
                            <div className="space-y-4 text-right">
                                <label className="text-xs font-black uppercase text-text-secondary opacity-40 tracking-widest ml-auto" dir="rtl">{t('staff_role_ar')}</label>
                                <input 
                                    type="text" 
                                    value={newStaffRoleAr} 
                                    onChange={e => setNewStaffRoleAr(e.target.value)} 
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-lg text-white focus:outline-none transition-all shadow-inner text-right" 
                                    dir="rtl"
                                    placeholder="المدير التنفيذي..."
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-6 pt-10 border-t border-white/5">
                            <button onClick={closeAddModal} className="bg-white/5 text-text-secondary font-black py-4 px-10 rounded-2xl hover:bg-white/10 transition-all active:scale-95">Cancel</button>
                            <button 
                                onClick={handleAddToStaff} 
                                disabled={!lookupResult || !newStaffRoleEn || !lookupResult.id} 
                                style={{ backgroundColor: branding.primaryColor }}
                                className="text-brand-dark font-black py-4 px-12 rounded-2xl hover:scale-105 transition-all shadow-2xl disabled:opacity-30 active:scale-95 disabled:grayscale"
                            >
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
