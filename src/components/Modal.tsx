// src/components/Modal.tsx
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = 'md' }) => {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if ((event as any).key === 'Escape') {
        onClose();
      }
    };
    // FIX: Guard against document access in non-browser environments.
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [onClose]);
  
  if (!isOpen) return null;

  const maxWidthClass = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
  }[maxWidth];

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className={`glass-panel w-full ${maxWidthClass} relative animate-slide-in-up flex flex-col max-h-[90vh]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-border-color flex justify-between items-center flex-shrink-0">
          <h2 className="text-2xl font-bold text-primary-blue tracking-wide">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-full text-text-secondary hover:text-white hover:bg-white/10 transition-colors">
            <X size={24} />
          </button>
        </div>
        <div className="flex-1 p-8 overflow-y-auto">
          {children}
        </div>
      </div>
       <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default Modal;
