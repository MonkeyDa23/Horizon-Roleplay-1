import React, { createContext, useState, useEffect, useMemo } from 'react';
import { staticConfig, AppConfig } from '../lib/config';

interface ConfigContextType {
  config: AppConfig;
  configLoading: boolean;
}

export const ConfigContext = createContext<ConfigContextType>({
  config: staticConfig,
  configLoading: true,
});

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [remoteConfig, setRemoteConfig] = useState<Partial<AppConfig>>({});
  const [configLoading, setConfigLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/config');
        if (!response.ok) {
          throw new Error('Failed to fetch remote config');
        }
        const configData = await response.json();
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
