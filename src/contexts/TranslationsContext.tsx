// src/contexts/TranslationsContext.tsx
import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Translations } from '../types';

interface TranslationsContextType {
  translations: Translations;
  loading: boolean;
  refetch: () => void;
}

const TranslationsContext = createContext<TranslationsContextType | undefined>(undefined);

import { fallbackTranslations } from '../fallback_translations';

const defaultTranslations: Translations = fallbackTranslations;

export const TranslationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [translations, setTranslations] = useState<Translations>(defaultTranslations);
  const [loading, setLoading] = useState(true);

  const fetchTranslations = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('translations').select('*');
      if (error) throw error;

      const formattedTranslations: Translations = { ...defaultTranslations };
      if (data) {
        data.forEach(item => {
          formattedTranslations[item.key] = {
            ar: item.ar,
            en: item.en,
          };
        });
      }
      setTranslations(formattedTranslations);
    } catch (error: any) {
      // Missing tables or config can cause 404/406 errors, we can safely ignore them.
      if (error?.code !== 'PGRST116' && error?.code !== '42P01') {
         // Silenced error intentionally to avoid scaring the user when tables aren't created yet
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTranslations();
  }, [fetchTranslations]);

  const value = {
    translations,
    loading,
    refetch: fetchTranslations,
    refreshTranslations: fetchTranslations,
  };

  return (
    <TranslationsContext.Provider value={value}>
      {children}
    </TranslationsContext.Provider>
  );
};

export const useTranslations = (): TranslationsContextType => {
  const context = useContext(TranslationsContext);
  if (context === undefined) {
    throw new Error('useTranslations must be used within a TranslationsProvider');
  }
  return context;
};
