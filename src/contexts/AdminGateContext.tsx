
// src/contexts/AdminGateContext.tsx
import React, { createContext, useState, useContext } from 'react';

interface AdminGateContextType {
  isVerified: boolean;
  verify: () => void;
}

const AdminGateContext = createContext<AdminGateContextType | undefined>(undefined);

export const AdminGateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isVerified, setIsVerified] = useState<boolean>(() => {
    // FIX: Guard against window/sessionStorage access in non-browser environments.
    try {
      if (typeof window !== 'undefined') {
        return window.sessionStorage.getItem('isAdminVerified') === 'true';
      }
      return false;
    } catch {
      return false;
    }
  });

  const verify = () => {
    try {
      // FIX: Guard against window/sessionStorage access in non-browser environments.
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('isAdminVerified', 'true');
      }
    } catch {}
    setIsVerified(true);
  };

  return (
    <AdminGateContext.Provider value={{ isVerified, verify }}>
      {children}
    </AdminGateContext.Provider>
  );
};

export const useAdminGate = (): AdminGateContextType => {
  const context = useContext(AdminGateContext);
  if (!context) {
    throw new Error('useAdminGate must be used within an AdminGateProvider');
  }
  return context;
};
