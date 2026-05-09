/**
 * Nova Roleplay - Official Website
 * Admin Translations Panel
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocalization } from '../../contexts/LocalizationContext';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { useConfig } from '../../contexts/ConfigContext';
import { getTranslations, saveTranslations, sendDiscordLog } from '../../lib/api';
import { translations as fallbackTranslations } from '../../lib/translations';
import { usePersistentState } from '../../hooks/usePersistentState';
import type { Translations } from '../../types';
import { Loader2, Search, AlertCircle, Globe, Save, RefreshCw, Languages } from 'lucide-react';

const TranslationsPanel: React.FC = () => {
    const { t, language, dir } = useLocalization();
    const isArabic = language === 'ar';
    const { showToast } = useToast();
    const { user } = useAuth();
    const { config, branding } = useConfig();
    
    const [editableTranslations, setEditableTranslations] = usePersistentState<Translations>('vixel_admin_translations_draft', {});
    const [searchTerm, setSearchTerm] = usePersistentState<string>('vixel_admin_translations_search', '');
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const fetchTranslations = useCallback(async () => {
        setIsLoading(true);
        try {
            const dbTranslations = await getTranslations();
            
            const mergedTranslations: Translations = {};
            const allKeys = new Set([...Object.keys(fallbackTranslations), ...Object.keys(dbTranslations)]);
            allKeys.forEach(key => {
                mergedTranslations[key] = {
                    ar: dbTranslations[key]?.ar || fallbackTranslations[key]?.ar || '',
                    en: dbTranslations[key]?.en || fallbackTranslations[key]?.en || '',
                };
            });
            
            setEditableTranslations(prev => Object.keys(prev).length > 0 ? prev : mergedTranslations);
        } catch (error) {
            showToast('Failed to load translations.', 'error');
            setEditableTranslations(prev => Object.keys(prev).length > 0 ? prev : fallbackTranslations);
        } finally {
            setIsLoading(false);
        }
    }, [showToast, setEditableTranslations]);

    useEffect(() => { fetchTranslations(); }, [fetchTranslations]);

    const handleSave = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            const result = await saveTranslations(editableTranslations);
            if (result.translations) {
                setEditableTranslations(result.translations);
            }
            showToast(t('save_translations'), 'success');
            localStorage.removeItem('vixel_admin_translations_draft');
            
            const embed = {
                title: "🌐 تحديث الترجمات",
                description: `قام المشرف **${user.username}** بتحديث نصوص وترجمات الموقع.`,
                color: 0x00F2EA,
                author: { name: user.username, icon_url: user.avatar },
                timestamp: new Date().toISOString(),
                footer: { text: "سجل الإعدادات" }
            };
            await sendDiscordLog(config, embed, 'admin');
        } catch (error) {
            showToast((error as Error).message, 'error');
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleTranslationChange = (key: string, lang: 'en' | 'ar', value: string) => {
        setEditableTranslations(prev => ({ ...prev, [key]: { ...prev[key], [lang]: value } }));
    };

    const filteredKeys = useMemo(() => {
        return Object.keys(editableTranslations).filter(key => 
            key.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (editableTranslations[key]?.en || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (editableTranslations[key]?.ar || '').toLowerCase().includes(searchTerm.toLowerCase())
        ).sort();
    }, [editableTranslations, searchTerm]);

    return (
        <div className="space-y-8 animate-fade-in-up" dir={dir}>
            {/* Header / Search Area */}
            <div className="bg-white/[0.02] border border-white/5 p-8 rounded-[40px] flex flex-col xl:flex-row gap-8 items-center justify-between shadow-2xl backdrop-blur-xl">
                <div className="flex items-center gap-6 w-full xl:w-auto">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-3xl flex items-center justify-center border border-blue-500/10 shadow-inner">
                        <Languages className="text-blue-500" size={32} />
                    </div>
                    <div>
                        <div className="text-4xl font-black text-white">{filteredKeys.length}</div>
                        <div className="text-text-secondary text-xs uppercase font-black tracking-widest mt-1">{t('total_translation_keys')}</div>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4 w-full xl:w-auto">
                    <div className="relative flex-grow min-w-[300px]">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-text-secondary opacity-40" size={24} />
                        <input 
                            type="text" 
                            placeholder={t('search_keys') || 'Search keys...'} 
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-16 pr-6 text-lg text-white focus:border-white/20 outline-none transition-all shadow-inner"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.currentTarget.value)}
                        />
                    </div>
                    <button 
                        onClick={handleSave} 
                        disabled={isSaving} 
                        style={{ backgroundColor: branding.primaryColor }}
                        className="text-brand-dark font-black py-4 px-10 rounded-2xl hover:scale-105 transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-30 disabled:grayscale active:scale-95"
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={28} /> : <Save size={28} />}
                        {t('save_translations')}
                    </button>
                    <button 
                        onClick={fetchTranslations} 
                        disabled={isLoading}
                        className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl text-text-secondary transition-all active:scale-95 border border-white/5"
                    >
                        <RefreshCw className={isLoading ? 'animate-spin' : ''} size={28} />
                    </button>
                </div>
            </div>

            {/* Warning Area */}
            <div className="bg-blue-500/5 border border-blue-500/10 p-6 rounded-3xl flex items-center gap-4 text-blue-200">
                <AlertCircle className="flex-shrink-0" size={24} />
                <p className="text-sm font-black opacity-80">{t('translations_edit_hint') || 'يقوم النظام بتطبيق الترجمات تلقائياً. يمكنك تعديل النصوص هنا وستظهر فوراً للمستخدمين.'}</p>
            </div>
            
            {/* Table Area */}
            <div className="bg-white/[0.02] border border-white/5 rounded-[40px] overflow-hidden shadow-2xl backdrop-blur-3xl">
                <div className="overflow-x-auto max-h-[70vh] custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead className="sticky top-0 bg-brand-dark z-20 shadow-xl">
                            <tr className="border-b border-white/5 bg-white/[0.03]">
                                <th className="px-10 py-6 text-xs font-black uppercase text-text-secondary tracking-widest w-1/4">Key</th>
                                <th className="px-10 py-6 text-xs font-black uppercase text-text-secondary tracking-widest w-[37.5%]">English (EN)</th>
                                <th className="px-10 py-6 text-xs font-black uppercase text-text-secondary tracking-widest w-[37.5%] text-right" dir="rtl">العربية (AR)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {isLoading ? (
                                Array.from({ length: 10 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={3} className="px-10 py-10"><div className="h-16 bg-white/5 rounded-3xl w-full"></div></td>
                                    </tr>
                                ))
                            ) : filteredKeys.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-10 py-32 text-center text-text-secondary">
                                        <div className="flex flex-col items-center gap-6">
                                            <Globe size={80} className="opacity-5" />
                                            <p className="text-2xl font-black">{t('no_keys_found')}</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredKeys.map(key => (
                                    <tr key={key} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-10 py-8 align-top">
                                            <div className="font-mono text-xs text-blue-400 font-bold bg-blue-500/5 px-3 py-2 rounded-lg border border-blue-500/10 inline-block">
                                                {key}
                                            </div>
                                        </td>
                                        <td className="px-10 py-8 space-y-4">
                                            <p className="text-[10px] font-black text-text-secondary uppercase opacity-40">English Text</p>
                                            <textarea 
                                                value={editableTranslations[key]?.en || ''} 
                                                onChange={(e) => handleTranslationChange(key, 'en', e.currentTarget.value)} 
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-white/20 transition-all shadow-inner min-h-[100px] resize-none"
                                            />
                                        </td>
                                        <td className="px-10 py-8 space-y-4 text-right">
                                            <p className="text-[10px] font-black text-text-secondary uppercase opacity-40 ml-auto" dir="rtl">النص العربي</p>
                                            <textarea 
                                                value={editableTranslations[key]?.ar || ''} 
                                                onChange={(e) => handleTranslationChange(key, 'ar', e.currentTarget.value)} 
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-white/20 transition-all shadow-inner min-h-[100px] resize-none text-right font-arabic" 
                                                dir="rtl"
                                            />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TranslationsPanel;
