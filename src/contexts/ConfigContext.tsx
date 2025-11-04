// src/contexts/ConfigContext.tsx
import React, { createContext, useState, useEffect, useCallback } from 'react';
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
    LOGO_URL: 'https://l.top4top.io/p_356271n1v1.png',
    DISCORD_GUILD_ID: '',
    DISCORD_INVITE_URL: 'https://discord.gg/u3CazwhxVa',
    MTA_SERVER_URL: 'mtasa://134.255.216.22:22041',
    BACKGROUND_IMAGE_URL: '',
    SHOW_HEALTH_CHECK: false,
    SUBMISSIONS_WEBHOOK_URL: null,
    AUDIT_LOG_WEBHOOK_URL: null,
    AUDIT_LOG_SUBMISSIONS_WEBHOOK_URL: null,
    AUDIT_LOG_BANS_WEBHOOK_URL: null,
    AUDIT_LOG_ADMIN_WEBHOOK_URL: null,
    SUPABASE_PROJECT_URL: null,
    DISCORD_PROXY_SECRET: null,
    // FIX: Added missing properties to default config to match AppConfig type.
    MENTION_ROLE_SUBMISSIONS: null,
    MENTION_ROLE_AUDIT_LOG_GENERAL: null,
    MENTION_ROLE_AUDIT_LOG_SUBMISSIONS: null,
    MENTION_ROLE_AUDIT_LOG_BANS: null,
    MENTION_ROLE_AUDIT_LOG_ADMIN: null,
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
      setConfig(configData);
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
