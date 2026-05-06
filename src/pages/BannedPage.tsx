/**
 * Florida Roleplay - Official Website
 * Banned Page
 * Copyright (c) 2024 Florida Roleplay. All rights reserved.
 */

import React from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import { Ban, LogOut } from 'lucide-react';

interface BannedPageProps {
  reason: string;
  expires_at: string | null;
  onLogout: () => void;
}

const BannedPage: React.FC<BannedPageProps> = ({ reason, expires_at, onLogout }) => {
  const { t, dir } = useLocalization();
  const expirationDate = expires_at ? new Date(expires_at) : null;
  const isExpired = expirationDate && expirationDate < new Date();

  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen bg-brand-dark p-6 text-center" dir={dir}>
      <div className="bg-white/[0.03] border border-white/10 rounded-[50px] p-8 md:p-16 max-w-2xl w-full shadow-2xl relative overflow-hidden backdrop-blur-xl animate-fade-in-up">
        <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>
        <div className="mx-auto w-24 h-24 flex items-center justify-center rounded-[32px] bg-red-500/10 border border-red-500/20 mb-8">
          <Ban className="text-red-500" size={56} />
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tighter">{t('you_are_banned')}</h1>
        <p className="text-xl text-text-secondary mb-12 font-medium opacity-80">{t('banned_page_message')}</p>

        <div className="bg-black/40 p-8 rounded-[40px] text-start space-y-8 border border-white/5">
          <div>
            <h2 className="text-xs font-black text-red-500 uppercase tracking-widest mb-2">{t('ban_reason')}</h2>
            <p className="text-xl font-bold text-white leading-relaxed">{reason}</p>
          </div>
          <div>
            <h2 className="text-xs font-black text-red-500 uppercase tracking-widest mb-2">{t('ban_expires')}</h2>
            <p className="text-xl font-bold text-white">
              {isExpired
                ? t('ban_expired_msg')
                : expirationDate
                ? expirationDate.toLocaleString()
                : t('ban_permanent')}
            </p>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="mt-12 px-10 py-5 bg-white text-brand-dark font-black text-xl rounded-2xl shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-4 mx-auto group"
        >
          <LogOut size={24} className="group-hover:-translate-x-1 transition-transform" />
          {t('logout')}
        </button>
      </div>
    </div>
  );
};

export default BannedPage;