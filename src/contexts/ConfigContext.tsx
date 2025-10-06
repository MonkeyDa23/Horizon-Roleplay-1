import React, { createContext, useState, useEffect, useMemo } from 'react';
import { staticConfig, AppConfig } from '../lib/config';
import { getPublicConfig } from '../lib/api';

interface ExtendedAppConfig extends AppConfig {
    SUPER_ADMIN_ROLE_IDS?: string[];
}

interface ConfigContextType {
  config: ExtendedAppConfig;
  configLoading: boolean;
}

export const ConfigContext = createContext<ConfigContextType>({
  config: staticConfig,
  configLoading: true,
});

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [remoteConfig, setRemoteConfig] = useState<Partial<ExtendedAppConfig>>({});
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
    return { ...staticConfig, ...remoteConfig };
  }, [remoteConfig]);

  return (
    <ConfigContext.Provider value={{ config: mergedConfig, configLoading }}>
      {children}
    </ConfigContext.Provider>
  );
};