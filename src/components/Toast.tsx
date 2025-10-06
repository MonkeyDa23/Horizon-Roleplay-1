import React, { useEffect } from 'react';
import { X, CheckCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'info' | 'error' | 'warning';

interface ToastProps {
  id: number;
  message: string;
  type: ToastType;
  onClose: (id: number) => void;
}

const icons = {
  success: <CheckCircle />,
  info: <Info />,
  error: <AlertTriangle />,
  warning: <AlertTriangle />,
};

const colors = {
  success: 'bg-green-500/20 border-green-500/50 text-green-300',
  info: 'bg-blue-500/20 border-blue-500/50 text-blue-300',
  error: 'bg-red-500/20 border-red-500/50 text-red-300',
  warning: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300',
};

export const Toast: React.FC<ToastProps> = ({ id, message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, 5000);
    return () => clearTimeout(timer);
  }, [id, onClose]);

  return (
    <div className={`flex items-start gap-4 p-4 rounded-lg border shadow-lg animate-toast-in ${colors[type]}`}>
      <div className="flex-shrink-0 mt-0.5">{icons[type]}</div>
      <p className="flex-grow text-white text-sm font-medium">{message}</p>
      <button onClick={() => onClose(id)} className="flex-shrink-0 opacity-70 hover:opacity-100">
        <X size={20} />
      </button>
    </div>
  );
};

export const ToastContainer: React.FC<{ toasts: Omit<ToastProps, 'onClose'>[]; onClose: (id: number) => void; }> = ({ toasts, onClose }) => {
    return (
        <div className="fixed top-24 end-6 z-[9999] w-full max-w-sm space-y-3">
            {toasts.map((toast) => (
                <Toast key={toast.id} {...toast} onClose={onClose} />
            ))}
            <style>{`
                @keyframes toast-in {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .animate-toast-in { animation: toast-in 0.5s ease-out forwards; }
            `}</style>
        </div>
    );
}
