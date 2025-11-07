// src/components/admin/AppearancePanel.tsx
import React, { useState, useEffect } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useToast } from '../../hooks/useToast';
import { useConfig } from '../../hooks/useConfig';
import { saveConfig } from '../../lib/api';
import type { AppConfig } from '../../types';
import { Loader2, Info } from 'lucide-react';

const AppearancePanel: React.FC = () => {
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
            await saveConfig(settings);
            await refreshConfig(); // Refresh global config context
            showToast(t('config_updated_success'), 'success');
        } catch (error) {
            showToast((error as Error).message, 'error');
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleChange = (key: keyof AppConfig, value: string | boolean) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    if (configLoading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 size={40} className="text-brand-cyan animate-spin" />
            </div>
        );
    }
    
    const InputField = ({ labelKey, descKey, value, onChange, placeholder, isPassword }: { labelKey: string, descKey?: string, value: string | null | undefined, onChange: (val: string) => void, placeholder?: string, isPassword?: boolean }) => (
        <div>
            <label className="block text-lg font-semibold text-white mb-1">{t(labelKey)}</label>
            {descKey && <p className="text-sm text-gray-400 mb-2">{t(descKey)}</p>}
            <input 
                type={isPassword ? "password" : "text"}
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-brand-light-blue p-2 rounded border border-gray-600 focus:ring-brand-cyan focus:border-brand-cyan"
            />
        </div>
    );

    return (
        <div className="animate-fade-in-up">
             <div className="flex justify-end items-center mb-6">
                 <button onClick={handleSave} disabled={isSaving} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white transition-colors min-w-[9rem] flex justify-center">
                    {isSaving ? <Loader2 className="animate-spin" /> : t('save_settings')}
                </button>
            </div>
            <div className="bg-brand-dark-blue p-8 rounded-lg border border-brand-light-blue/50 space-y-8">
                <div>
                    <h3 className="text-2xl font-bold text-brand-cyan border-b-2 border-brand-cyan/50 pb-2 mb-6">General Settings</h3>
                    <div className="space-y-6">
                        <InputField labelKey="community_name" value={settings.COMMUNITY_NAME || ''} onChange={val => handleChange('COMMUNITY_NAME', val)} />
                        <InputField labelKey="logo_url" value={settings.LOGO_URL || ''} onChange={val => handleChange('LOGO_URL', val)} />
                        <InputField labelKey="background_image_url" descKey="background_image_url_desc" value={settings.BACKGROUND_IMAGE_URL || ''} onChange={val => handleChange('BACKGROUND_IMAGE_URL', val)} />
                    </div>
                </div>

                <div>
                    <h3 className="text-2xl font-bold text-brand-cyan border-b-2 border-brand-cyan/50 pb-2 mb-6">Discord & Notification Integration</h3>
                    <div className="p-4 rounded-md bg-blue-500/10 border border-blue-500/30 mb-6 flex items-start gap-3">
                        <Info size={24} className="text-blue-300 flex-shrink-0 mt-1" />
                        <p className="text-blue-200">
                            <strong>Important Change:</strong> All notification settings, including channel IDs and mention roles, are now managed directly in your Discord bot's <code>config.json</code> file. This simplifies the website setup and keeps all Discord-related secrets and IDs in one secure place.
                        </p>
                    </div>
                    <div className="space-y-6">
                        <InputField labelKey="discord_guild_id" descKey="discord_guild_id_desc" value={settings.DISCORD_GUILD_ID || ''} onChange={val => handleChange('DISCORD_GUILD_ID', val)} />
                        <InputField labelKey="supabase_project_url" descKey="supabase_project_url_desc" value={settings.SUPABASE_PROJECT_URL || ''} onChange={val => handleChange('SUPABASE_PROJECT_URL', val)} placeholder="e.g., https://xyz.supabase.co" />
                        <InputField labelKey="discord_proxy_secret" descKey="discord_proxy_secret_desc" value={settings.DISCORD_PROXY_SECRET || ''} onChange={val => handleChange('DISCORD_PROXY_SECRET', val)} isPassword />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AppearancePanel;