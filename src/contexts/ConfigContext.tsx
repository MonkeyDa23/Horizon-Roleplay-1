import React, { createContext, useState, useEffect, useMemo } from 'react';
import { getConfig } from '../lib/api';
import type { AppConfig } from '../types';

interface ConfigContextType {
  config: AppConfig;
  configLoading: boolean;
}

const defaultConfig: AppConfig = {
    COMMUNITY_NAME: 'Horizon',
    LOGO_URL: '',
    DISCORD_INVITE_URL: '',
    MTA_SERVER_URL: '',
    BACKGROUND_IMAGE_URL: '',
    SHOW_HEALTH_CHECK: false,
    SUPER_ADMIN_ROLE_IDS: [],
};

export const ConfigContext = createContext<ConfigContextType>({
  config: defaultConfig,
  configLoading: true,
});

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [configLoading, setConfigLoading] = useState(true);

  useEffect(() => {
    const fetchAndSetConfig = async () => {
      try {
        const configData = await getConfig();
        setConfig(configData);
      } catch (error) {
        console.error("Fatal: Could not fetch remote config. Using fallback.", error);
        // In case of error, we'll stick with the hardcoded default.
      } finally {
        setConfigLoading(false);
      }
    };

    fetchAndSetConfig();
  }, []);

  return (
    <ConfigContext.Provider value={{ config, configLoading }}>
      {children}
    </ConfigContext.Provider>
  );
};
