
// src/components/admin/AppearancePanel.tsx
import React, { useState, useEffect } from 'react';
import { useLocalization } from '../../contexts/LocalizationContext';
import { useToast } from '../../contexts/ToastContext';
import { useConfig } from '../../contexts/ConfigContext';
import { useAuth } from '../../contexts/AuthContext';
import { saveConfig, logAdminAction } from '../../lib/api';
import { supabase } from '../../lib/supabaseClient';
import type { AppConfig } from '../../types';
import { Loader2, Palette, Globe, Shield } from 'lucide-react';

const AppearancePanel: React.FC = () => {
    const { t } = useLocalization();
    const { showToast } = useToast();
    const { config, branding, configLoading, refreshConfig } = useConfig();
    const { user } = useAuth();
    const [settings, setSettings] = useState<Partial<AppConfig>>({});
    const [brandingData, setBrandingData] = useState(branding);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!configLoading) {
            setSettings(config);
            setBrandingData(branding);
        }
    }, [config, branding, configLoading]);

    const handleSave = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            await saveConfig(settings);
            const { error: brandingError } = await supabase
                .from('config')
                .upsert({ key: 'branding', value: brandingData }, { onConflict: 'key' });
            if (brandingError) throw brandingError;
            await refreshConfig();
            showToast(t('success'), 'success');
            await logAdminAction(config, user, "تحديث هوية الموقع", "تم تحديث الألوان والشعارات والإعدادات العامة", 'INFO');
        } catch (error) {
            showToast((error as Error).message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    if (configLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-brand-cyan" size={40} /></div>;

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex justify-between items-center bg-brand-dark/50 p-6 rounded-2xl border border-white/5">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Palette className="text-brand-cyan" /> {t('site_settings')}
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">Control your brand identity and site behavior.</p>
                </div>
                <button 
                    onClick={handleSave} 
                    disabled={isSaving}
                    className="bg-brand-cyan text-brand-dark font-bold py-3 px-8 rounded-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                >
                    {isSaving ? <Loader2 className="animate-spin" /> : <Shield size={18} />}
                    {t('save_changes')}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-brand-dark-blue p-8 rounded-3xl border border-white/5 space-y-6">
                    <h3 className="text-xl font-bold text-brand-cyan flex items-center gap-2">
                        <Palette size={20} /> {t('edit_branding')}
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">{t('site_name')}</label>
                            <input value={brandingData.siteName} onChange={e => setBrandingData(p => ({ ...p, siteName: e.target.value }))} className="vixel-input" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">{t('site_logo')}</label>
                            <input value={brandingData.logoUrl} onChange={e => setBrandingData(p => ({ ...p, logoUrl: e.target.value }))} className="vixel-input" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">{t('primary_color')}</label>
                                <input type="color" value={brandingData.primaryColor} onChange={e => setBrandingData(p => ({ ...p, primaryColor: e.target.value }))} className="w-full h-12 bg-transparent cursor-pointer rounded-lg overflow-hidden border border-white/10" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">{t('secondary_color')}</label>
                                <input type="color" value={brandingData.secondaryColor} onChange={e => setBrandingData(p => ({ ...p, secondaryColor: e.target.value }))} className="w-full h-12 bg-transparent cursor-pointer rounded-lg overflow-hidden border border-white/10" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">{t('hero_title')}</label>
                            <input value={brandingData.heroTitle} onChange={e => setBrandingData(p => ({ ...p, heroTitle: e.target.value }))} className="vixel-input" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">{t('hero_subtitle')}</label>
                            <textarea value={brandingData.heroSubtitle} onChange={e => setBrandingData(p => ({ ...p, heroSubtitle: e.target.value }))} className="vixel-input min-h-[100px]" />
                        </div>
                    </div>
                </div>

                <div className="bg-brand-dark-blue p-8 rounded-3xl border border-white/5 space-y-6">
                    <h3 className="text-xl font-bold text-gray-200 flex items-center gap-2">
                        <Shield size={20} /> Core Config
                    </h3>
                    <div className="flex items-center justify-between p-6 bg-brand-dark/30 rounded-2xl border border-white/5">
                        <div>
                            <h4 className="text-white font-bold">وضع الصيانة (Maintenance Mode)</h4>
                            <p className="text-xs text-gray-500">Only Admins can access the site when active.</p>
                        </div>
                        <button onClick={() => setSettings(prev => ({ ...prev, MAINTENANCE_MODE: !settings.MAINTENANCE_MODE }))} className={`w-14 h-8 rounded-full p-1 transition-all duration-300 ${settings.MAINTENANCE_MODE ? 'bg-brand-cyan' : 'bg-gray-600'}`}>
                            <div className={`w-6 h-6 bg-white rounded-full transition-transform duration-300 ${settings.MAINTENANCE_MODE ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Discord Guild ID</label>
                            <input value={settings.DISCORD_GUILD_ID || ''} onChange={e => setSettings(p => ({ ...p, DISCORD_GUILD_ID: e.target.value }))} className="vixel-input" placeholder="1234567890..." />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Discord Invite URL</label>
                            <input value={settings.DISCORD_INVITE_URL || ''} onChange={e => setSettings(p => ({ ...p, DISCORD_INVITE_URL: e.target.value }))} className="vixel-input" placeholder="https://discord.gg/..." />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AppearancePanel;
