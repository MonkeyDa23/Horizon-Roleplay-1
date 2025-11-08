




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
      // FIX: Cast event to 'any' to access 'key' property, avoiding potential tsconfig lib errors.
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
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-32"
      onClick={onClose}
    >
      <div
        className={`bg-brand-dark-blue border border-brand-light-blue rounded-lg shadow-2xl shadow-black/50 w-full ${maxWidthClass} relative animate-slide-in-down flex flex-col max-h-[90vh]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-brand-light-blue flex justify-between items-center flex-shrink-0">
          <h2 className="text-2xl font-bold text-brand-cyan">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={28} />
          </button>
        </div>
        <div className="flex-1 p-8 overflow-y-auto">
          {children}
        </div>
      </div>
      <style>{`
        @keyframes slide-in-down {
          from { 
            opacity: 0; 
            transform: translateY(-30px); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }
        .animate-slide-in-down {
          animation: slide-in-down 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default Modal;
