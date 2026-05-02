
// src/contexts/AdminGateContext.tsx
import React, { createContext, useState, useContext } from 'react';

interface AdminGateContextType {
  isVerified: boolean;
  verify: () => void;
}

const AdminGateContext = createContext<AdminGateContextType | undefined>(undefined);

export const AdminGateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isVerified, setIsVerified] = useState<boolean>(false);

  const verify = () => {
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