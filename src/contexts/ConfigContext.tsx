import React, { createContext, useState, useEffect, useMemo } from 'react';
import { createClient } from '@vercel/edge-config';
import { staticConfig, AppConfig } from '../lib/staticConfig';

interface ConfigContextType {
  config: AppConfig;
  configLoading: boolean;
}

export const ConfigContext = createContext<ConfigContextType>({
  config: staticConfig,
  configLoading: true,
});

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [edgeConfig, setEdgeConfig] = useState<Partial<AppConfig>>({});
  const [configLoading, setConfigLoading] = useState(true);

  useEffect(() => {
    const connectionString = import.meta.env.VITE_EDGE_CONFIG;
    if (!connectionString) {
      console.warn("VITE_EDGE_CONFIG is not set. Using static fallback configuration.");
      setConfigLoading(false);
      return;
    }

    const fetchConfig = async () => {
      try {
        const configClient = createClient(connectionString);
        // We cast the result to be compatible with our AppConfig type.
        // It's up to the user to ensure keys in Edge Config match.
        const allConfig = await configClient.getAll() as Partial<AppConfig>;
        setEdgeConfig(allConfig);
      } catch (error) {
        console.error("Failed to fetch from Edge Config, using static fallbacks:", error);
      } finally {
        setConfigLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const mergedConfig = useMemo(() => {
    // Edge Config values will override static config values if they exist
    return { ...staticConfig, ...edgeConfig };
  }, [edgeConfig]);

  return (
    <ConfigContext.Provider value={{ config: mergedConfig, configLoading }}>
      {children}
    </ConfigContext.Provider>
  );
};
