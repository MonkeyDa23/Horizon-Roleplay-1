
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
    if (typeof document !== 'undefined') {
      if (isOpen) {
        document.body.style.overflow = 'hidden'; // Prevent scrolling background
      } else {
        document.body.style.overflow = 'unset';
      }
      document.addEventListener('keydown', handleEscape);
      return () => {
          document.removeEventListener('keydown', handleEscape);
          document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen, onClose]);
  
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
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop - Fixed to cover entire viewport */}
      <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-md animate-fade-in" 
          onClick={onClose}
      ></div>

      {/* Modal Content - Fixed in center */}
      <div
        className={`relative z-10 glass-panel w-full ${maxWidthClass} flex flex-col max-h-[90vh] animate-slide-in-up shadow-2xl shadow-black/50 m-4`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-border-color flex justify-between items-center flex-shrink-0 bg-brand-dark-blue/50 rounded-t-2xl">
          <h2 className="text-xl font-bold text-primary-blue tracking-wide">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-full text-text-secondary hover:text-white hover:bg-white/10 transition-colors">
            <X size={24} />
          </button>
        </div>
        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
       <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.2s ease-out forwards; }
        
        /* Custom Scrollbar for Modal Content */
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 169, 255, 0.3);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 169, 255, 0.5);
        }
      `}</style>
    </div>
  );
};

export default Modal;
