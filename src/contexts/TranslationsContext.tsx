import React, { createContext, useState, useEffect } from 'react';
import { getTranslations } from '../lib/api';
import { translations as fallbackTranslations } from '../lib/translations';
import type { Translations } from '../types';

interface TranslationsContextType {
  translations: Translations;
  loading: boolean;
  error: Error | null;
}

export const TranslationsContext = createContext<TranslationsContextType | undefined>(undefined);

export const TranslationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [translations, setTranslations] = useState<Translations>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchAndSetTranslations = async () => {
      try {
        setLoading(true);
        const dbTranslations = await getTranslations();
        
        // Merge DB translations with fallback to ensure all keys are present
        const mergedTranslations: Translations = {};
        const allKeys = new Set([...Object.keys(fallbackTranslations), ...Object.keys(dbTranslations)]);

        allKeys.forEach(key => {
            mergedTranslations[key] = {
                ar: dbTranslations[key]?.ar || fallbackTranslations[key]?.ar || key,
                en: dbTranslations[key]?.en || fallbackTranslations[key]?.en || key,
            };
        });
        
        setTranslations(mergedTranslations);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch translations from DB, using fallback file.", err);
        setError(err as Error);
        setTranslations(fallbackTranslations); // Use the static file as a fallback
      } finally {
        setLoading(false);
      }
    };

    fetchAndSetTranslations();
  }, []);

  const value = { translations, loading, error };

  return (
    <TranslationsContext.Provider value={value}>
      {children}
    </TranslationsContext.Provider>
  );
};