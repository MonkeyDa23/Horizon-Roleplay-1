import React, { createContext, useState, useEffect, useCallback } from 'react';
import { useTranslations } from '../hooks/useTranslations';
import type { Language, LocalizationContextType } from '../types';

export const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

export const LocalizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('ar');
  const { translations, loading } = useTranslations();

  useEffect(() => {
    // FIX: Guard against document access in non-browser environments.
    if (typeof document !== 'undefined') {
      const dir = language === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = language;
      document.documentElement.dir = dir;
    }
  }, [language]);

  const t = useCallback((key: string, replacements?: { [key: string]: string | number }): string => {
    if (loading) return '...'; // Return a loading indicator while translations are being fetched
    
    let translation = translations[key]?.[language] || key;
    if (replacements) {
      // FIX: Replaced forEach with a for...in loop for broader compatibility.
      for (const placeholder in replacements) {
        if (Object.prototype.hasOwnProperty.call(replacements, placeholder)) {
            const regex = new RegExp(`{${placeholder}}`, 'g');
            translation = translation.replace(regex, String(replacements[placeholder]));
        }
      }
    }
    return translation;
  }, [language, translations, loading]);

  const value = {
    language,
    setLanguage,
    t,
    dir: language === 'ar' ? 'rtl' : 'ltr' as 'rtl' | 'ltr',
  };

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
};
