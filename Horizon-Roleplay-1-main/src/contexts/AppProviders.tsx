// src/contexts/AppProviders.tsx
import React from 'react';
import { LocalizationProvider } from './LocalizationContext';
import { ConfigProvider } from './ConfigContext';
import { TranslationsProvider } from './TranslationsContext';
import { AuthProvider } from './AuthContext';
import { CartProvider } from './CartContext';
import { ToastProvider } from './ToastContext';
import { AdminGateProvider } from './AdminGateContext';

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ConfigProvider>
      <TranslationsProvider>
        <LocalizationProvider>
          <AuthProvider>
            <CartProvider>
              <ToastProvider>
                <AdminGateProvider>
                    {children}
                </AdminGateProvider>
              </ToastProvider>
            </CartProvider>
          </AuthProvider>
        </LocalizationProvider>
      </TranslationsProvider>
    </ConfigProvider>
  );
};
