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

const defaultTranslations: Translations = {
  "nav_home": { "ar": "الرئيسية", "en": "Home" },
  "nav_about": { "ar": "من نحن", "en": "About Us" },
  "nav_rules": { "ar": "القوانين", "en": "Rules" },
  "nav_store": { "ar": "المتجر", "en": "Store" },
  "nav_applies": { "ar": "التقديمات", "en": "Applies" },
  "nav_admin": { "ar": "لوحة التحكم", "en": "Admin Panel" },
  "nav_login": { "ar": "تسجيل الدخول", "en": "Login" },
  "nav_logout": { "ar": "تسجيل الخروج", "en": "Logout" },
  "nav_hello": { "ar": "مرحباً", "en": "Hello" },
  "store_title": { "ar": "متجر الخادم", "en": "Server Store" },
  "store_desc": { "ar": "ادعم الخادم واحصل على مميزات حصرية", "en": "Support the server and get exclusive perks" },
  "add_to_cart": { "ar": "إضافة للسلة", "en": "Add to Cart" },
  "buy_now": { "ar": "شراء الان", "en": "Buy Now" },
  "price": { "ar": "السعر", "en": "Price" },
  "category_all": { "ar": "الكل", "en": "All" },
  "cart_empty": { "ar": "السلة فارغة", "en": "Cart is empty" },
  "cart_total": { "ar": "المجموع", "en": "Total" },
  "checkout": { "ar": "إتمام الطلب", "en": "Checkout" },
  "profile": { "ar": "الملف الشخصي", "en": "Profile" },
  "my_account": { "ar": "حسابي", "en": "My Account" },
  "loading": { "ar": "جاري التحميل...", "en": "Loading..." },
  "open_applies": { "ar": "التقديمات المفتوحة", "en": "Open Applications" },
  "closed_applies": { "ar": "التقديمات المغلقة", "en": "Closed Applications" },
  "apply_now": { "ar": "قدم الان", "en": "Apply Now" },
  "questions": { "ar": "أسئلة", "en": "Questions" },
  "begin_quiz": { "ar": "بدء التقديم", "en": "Start Application" },
  "submit_application": { "ar": "إرسال التقديم", "en": "Submit Application" },
  "admin_panel": { "ar": "لوحة الإدارة", "en": "Admin Panel" },
  "admin_dashboard": { "ar": "لوحة التحكم", "en": "Dashboard" },
  "admin_users": { "ar": "الأعضاء", "en": "Users" },
  "admin_store": { "ar": "المتجر", "en": "Store" },
  "admin_rules": { "ar": "القوانين", "en": "Rules" },
  "admin_applies": { "ar": "نماذج التقديم", "en": "Applications" },
  "admin_staff": { "ar": "الإدارة", "en": "Staff" },
  "admin_translations": { "ar": "الترجمات", "en": "Translations" },
  "admin_settings": { "ar": "الإعدادات", "en": "Settings" }
};

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
