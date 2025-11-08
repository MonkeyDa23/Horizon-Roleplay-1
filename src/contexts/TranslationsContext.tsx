// src/contexts/TranslationsContext.tsx
import React, { createContext, useState, useEffect, useCallback } from 'react';
import { getTranslations } from '../lib/api';
import { translations as fallbackTranslations } from '../lib/translations';
import type { Translations } from '../types';

interface TranslationsContextType {
  translations: Translations;
  loading: boolean;
  error: Error | null;
  refreshTranslations: () => Promise<void>;
}

export const TranslationsContext = createContext<TranslationsContextType | undefined>(undefined);

export const TranslationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [translations, setTranslations] = useState<Translations>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAndSetTranslations = useCallback(async () => {
    try {
      setLoading(true);
      const dbTranslations = await getTranslations();
      
      const mergedTranslations: Translations = {};
      // FIX: Replaced Set and spread operator with an object to ensure unique keys for older environment compatibility.
      const allKeysObj: { [key: string]: true } = {};
      
      var fallbackKeys = Object.keys(fallbackTranslations);
      for (var i = 0; i < fallbackKeys.length; i++) {
        allKeysObj[fallbackKeys[i]] = true;
      }

      var dbKeys = Object.keys(dbTranslations);
      for (var j = 0; j < dbKeys.length; j++) {
        allKeysObj[dbKeys[j]] = true;
      }

      const allKeys = Object.keys(allKeysObj);

      // FIX: Replaced forEach with a standard for loop for broader compatibility.
      for (var k = 0; k < allKeys.length; k++) {
        var key = allKeys[k];
        mergedTranslations[key] = {
            ar: (dbTranslations[key] && dbTranslations[key].ar) || (fallbackTranslations[key] && fallbackTranslations[key].ar) || key,
            en: (dbTranslations[key] && dbTranslations[key].en) || (fallbackTranslations[key] && fallbackTranslations[key].en) || key,
        };
      }
      
      setTranslations(mergedTranslations);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch translations from DB, using fallback file.", err);
      setError(err as Error);
      setTranslations(fallbackTranslations);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAndSetTranslations();
  }, [fetchAndSetTranslations]);

  const refreshTranslations = useCallback(async () => {
    await fetchAndSetTranslations();
  }, [fetchAndSetTranslations]);

  const value = { translations, loading, error, refreshTranslations };

  return (
    <TranslationsContext.Provider value={value}>
      {children}
    </TranslationsContext.Provider>
  );
};