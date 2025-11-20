
// src/components/admin/AppearancePanel.tsx
import React, { useState, useEffect } from 'react';
import { useLocalization } from '../../contexts/LocalizationContext';
import { useToast } from '../../contexts/ToastContext';
import { useConfig } from '../../contexts/ConfigContext';
import { useAuth } from '../../contexts/AuthContext';
import { saveConfig, sendDiscordLog } from '../../lib/api';
import { supabase } from '../../lib/supabaseClient';
import type { AppConfig } from '../../types';
import { Loader2 } from 'lucide-react';

const AppearancePanel: React.FC = () => {
    const { t, language } = useLocalization();
    const { showToast } = useToast();
    const { config, configLoading, refreshConfig } = useConfig();
    const { user } = useAuth();
    const [settings, setSettings] = useState<Partial<AppConfig>>({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!configLoading) {
            setSettings(config);
        }
    }, [config, configLoading]);

    const handleSave = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            await saveConfig(settings);
            await refreshConfig(); // Refresh global config context
            showToast(t('config_updated_success'), 'success');

            // Log action to DB and Discord
            const action = `Admin ${user.username} updated Appearance Settings.`;
            supabase.rpc('log_admin_action', { p_action: action, p_log_type: 'admin' });

            const embed = {
                title: t('log_settings_updated_title'),
                description: t('log_appearance_updated_desc', { adminUsername: user.username }),
                color: 0xFFA500, // Orange
                author: { name: user.username, icon_url: user.avatar },
                timestamp: new Date().toISOString()
            };
            sendDiscordLog(config, embed, 'admin', language);

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
    
    const InputField = ({ labelKey, descKey, value, onChange, placeholder, type = 'text' }: { labelKey: string, descKey?: string, value: string | null | undefined, onChange: (val: string) => void, placeholder?: string, type?: string }) => (
        <div>
            <label className="block text-lg font-semibold text-white mb-1">{t(labelKey)}</label>
            {descKey && <p className="text-sm text-gray-400 mb-2">{t(descKey)}</p>}
            <input 
                type={type}
                value={value || ''}
                onChange={(e) => onChange(e.currentTarget.value)}
                placeholder={placeholder}
                className="vixel-input"
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
                    <h3 className="text-2xl font-bold text-brand-cyan border-b-2 border-brand-cyan/50 pb-2 mb-6">Core Integration</h3>
                     <div className="space-y-6">
                        <InputField labelKey="discord_guild_id" descKey="discord_guild_id_desc" value={settings.DISCORD_GUILD_ID || ''} onChange={val => handleChange('DISCORD_GUILD_ID', val)} />
                    </div>
                </div>

                <div>
                    <h3 className="text-2xl font-bold text-brand-cyan border-b-2 border-brand-cyan/50 pb-2 mb-6">Security</h3>
                     <div className="space-y-6">
                        <InputField labelKey="admin_panel_password" descKey="admin_panel_password_desc" value={settings.admin_password || ''} onChange={val => handleChange('admin_password', val)} type="password" placeholder="Leave empty to disable"/>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AppearancePanel;