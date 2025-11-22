
// src/contexts/ConfigContext.tsx
import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { getConfig } from '../lib/api';
import type { AppConfig } from '../types';
import { supabase } from '../lib/supabaseClient';

interface ConfigContextType {
  config: AppConfig;
  configLoading: boolean;
  configError: Error | null;
  refreshConfig: () => Promise<void>;
}

const defaultConfig: AppConfig = {
    COMMUNITY_NAME: 'Vixel Roleplay',
    LOGO_URL: '', // Empty by default, to be filled from DB
    DISCORD_GUILD_ID: '',
    DISCORD_INVITE_URL: 'https://discord.gg/u3CazwhxVa',
    MTA_SERVER_URL: 'mtasa://134.255.216.22:22041',
    BACKGROUND_IMAGE_URL: '',
    SHOW_HEALTH_CHECK: false,
    admin_password: null,

    // New Webhook logging settings
    DISCORD_PROXY_URL: null,
    DISCORD_PROXY_SECRET: null,

    // Notification Channel IDs
    submissions_channel_id: null,
    log_channel_submissions: null,
    log_channel_bans: null,
    log_channel_admin: null,
    log_channel_auth: null, // New Members Log
    log_channel_finance: null, // New: Finance Log (Balance/Invoices)
    log_channel_store: null, // New: Store Log (User Purchases)
    audit_log_channel_id: null,

    // Mention Roles
    mention_role_submissions: null,
    mention_role_audit_log_submissions: null,
    mention_role_audit_log_bans: null,
    mention_role_audit_log_admin: null,
    mention_role_auth: null, // New Members Role
    mention_role_finance: null, // New
    mention_role_store: null, // New
    mention_role_audit_log_general: null,
};

export const ConfigContext = createContext<ConfigContextType>({
  config: defaultConfig,
  configLoading: true,
  configError: null,
  refreshConfig: async () => {},
});

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<Error | null>(null);

  const fetchAndSetConfig = useCallback(async () => {
    if (!supabase) {
        setConfigError(new Error("Supabase not configured"));
        setConfigLoading(false);
        return;
    }
    try {
      const configData = await getConfig();
      setConfig(configData); // Directly use data from DB without overrides
      setConfigError(null);
    } catch (error) {
      console.error("Fatal: Could not fetch remote config. Using fallback.", error);
      setConfigError(error as Error);
    } finally {
      setConfigLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAndSetConfig();
  }, [fetchAndSetConfig]);

  const refreshConfig = async () => {
    setConfigLoading(true);
    await fetchAndSetConfig();
  };

  return (
    <ConfigContext.Provider value={{ config, configLoading, configError, refreshConfig }}>
      {children}
    </ConfigContext.Provider>
  );
};

// Merged Hook
export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};