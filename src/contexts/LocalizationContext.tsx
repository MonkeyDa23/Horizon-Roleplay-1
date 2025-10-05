
import React, { createContext, useState, useEffect, useCallback } from 'react';
import { translations } from '../lib/translations';
import type { Language, LocalizationContextType } from '../types';

export const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

export const LocalizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('ar');

  useEffect(() => {
    const dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
  }, [language]);

  const t = useCallback((key: string, replacements?: Record<string, string | number>): string => {
    let translation = translations[key]?.[language] || key;
    if (replacements) {
      Object.keys(replacements).forEach(placeholder => {
        const regex = new RegExp(`{${placeholder}}`, 'g');
        translation = translation.replace(regex, String(replacements[placeholder]));
      });
    }
    return translation;
  }, [language]);

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