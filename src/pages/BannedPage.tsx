// src/pages/BannedPage.tsx
import React from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import { Ban, LogOut } from 'lucide-react';

interface BannedPageProps {
  reason: string;
  expires_at: string | null;
  onLogout: () => void;
}

const BannedPage: React.FC<BannedPageProps> = ({ reason, expires_at, onLogout }) => {
  const { t } = useLocalization();
  const expirationDate = expires_at ? new Date(expires_at) : null;
  const isExpired = expirationDate && expirationDate < new Date();

  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen bg-brand-dark p-6 text-center">
      <div className="bg-brand-dark-blue border-2 border-red-500/50 rounded-xl p-8 md:p-12 max-w-2xl w-full shadow-2xl shadow-black/50 animate-fade-in-up">
        <div className="mx-auto w-20 h-20 flex items-center justify-center rounded-full bg-red-500/10 border-2 border-red-500/50 mb-6">
          <Ban className="text-red-400" size={48} />
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-red-400 mb-4">{t('you_are_banned')}</h1>
        <p className="text-lg text-gray-300 mb-8">{t('banned_page_message')}</p>

        <div className="bg-brand-dark p-6 rounded-lg text-left space-y-4 border border-brand-light-blue">
          <div>
            <h2 className="font-bold text-brand-cyan text-lg">{t('ban_reason')}</h2>
            <p className="text-gray-200 mt-1">{reason}</p>
          </div>
          <div>
            <h2 className="font-bold text-brand-cyan text-lg">{t('ban_expires')}</h2>
            <p className="text-gray-200 mt-1">
              {isExpired
                ? "Your ban has expired. Please log out and log back in."
                : expirationDate
                ? expirationDate.toLocaleString()
                : t('ban_permanent')}
            </p>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="mt-10 px-8 py-3 bg-brand-cyan text-brand-dark font-bold text-lg rounded-lg shadow-glow-cyan hover:bg-white hover:scale-105 transform transition-all duration-300 ease-in-out flex items-center justify-center gap-3 mx-auto"
        >
          <LogOut size={22}/>
          {t('logout')}
        </button>
      </div>
    </div>
  );
};

export default BannedPage;