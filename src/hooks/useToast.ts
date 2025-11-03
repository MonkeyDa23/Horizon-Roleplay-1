// src/hooks/useToast.ts
import { useContext } from 'react';
import { ToastContext } from '../contexts/ToastContext';
import type { ToastType } from '../components/Toast';


interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};