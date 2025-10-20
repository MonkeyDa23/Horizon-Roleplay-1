import React, { createContext, useState, useEffect } from 'react';
import { getConfig } from '../lib/api';
import type { AppConfig } from '../types';

interface ConfigContextType {
  config: AppConfig;
  configLoading: boolean;
  configError: Error | null;
}

const defaultConfig: AppConfig = {
    COMMUNITY_NAME: 'Vixel Roleplay',
    LOGO_URL: '',
    DISCORD_GUILD_ID: '',
    DISCORD_INVITE_URL: '',
    MTA_SERVER_URL: '',
    BACKGROUND_IMAGE_URL: '',
    SHOW_HEALTH_CHECK: false,
    SUBMISSIONS_WEBHOOK_URL: '',
    AUDIT_LOG_WEBHOOK_URL: '',
};

export const ConfigContext = createContext<ConfigContextType>({
  config: defaultConfig,
  configLoading: true,
  configError: null,
});

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchAndSetConfig = async () => {
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
    };

    fetchAndSetConfig();
  }, []);

  return (
    <ConfigContext.Provider value={{ config, configLoading, configError }}>
      {children}
    </ConfigContext.Provider>
  );
};