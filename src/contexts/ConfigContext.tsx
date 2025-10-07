import React, { createContext, useState, useEffect, useMemo } from 'react';
import { staticConfig } from '../lib/config';
import { getPublicConfig } from '../lib/api';
import type { AppConfig } from '../types';

interface ConfigContextType {
  config: AppConfig;
  configLoading: boolean;
}

export const ConfigContext = createContext<ConfigContextType>({
  config: { 
    ...staticConfig, 
    SUPER_ADMIN_ROLE_IDS: [], 
    DISCORD_CLIENT_ID: '', 
    DISCORD_GUILD_ID: '',
    LOGO_URL: staticConfig.LOGO_URL,
  },
  configLoading: true,
});

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [remoteConfig, setRemoteConfig] = useState<Partial<AppConfig>>({});
  const [configLoading, setConfigLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const configData = await getPublicConfig();
        setRemoteConfig(configData);
      } catch (error) {
        console.warn("Could not fetch remote config, using static fallback.", error);
      } finally {
        setConfigLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const mergedConfig = useMemo(() => {
    // Remote config from the API overrides the local static fallback values.
    return { ...staticConfig, ...remoteConfig } as AppConfig;
  }, [remoteConfig]);

  return (
    <ConfigContext.Provider value={{ config: mergedConfig, configLoading }}>
      {children}
    </ConfigContext.Provider>
  );
};
