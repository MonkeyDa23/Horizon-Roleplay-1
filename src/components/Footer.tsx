/**
 * Nova Roleplay - Official Website
 * Footer Component
 * Copyright (c) 2024 Nova Roleplay. All rights reserved.
 */

import React from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import { useConfig } from '../contexts/ConfigContext';
import DiscordLogo from './icons/DiscordLogo';

const Footer: React.FC = () => {
  const { t } = useLocalization();
  const { config, configLoading } = useConfig();

  const year = new Date().getFullYear();
  const communityName = configLoading ? 'Nova Roleplay' : (config.COMMUNITY_NAME || 'Nova Roleplay');
  const rightsText = `جميع الحقوق محفوظة لـ ${communityName} 2026`;

  return (
    <footer className="relative mt-24 border-t border-white/5">
      <div className="absolute top-0 left-0 w-full h-full bg-brand-dark/30 backdrop-blur-sm"></div>
      <div className="container relative mx-auto px-6 py-12 flex flex-col sm:flex-row justify-between items-center text-center sm:text-start gap-8">
        <div className="space-y-2">
          <p className="text-white font-black text-xl tracking-tight">{communityName}</p>
          <p className="text-text-secondary text-sm font-medium opacity-60">{rightsText}</p>
        </div>
        <div className="flex items-center gap-4">
          <a href={config.DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer" className="text-text-secondary hover:text-white transition-colors duration-300 p-2 rounded-full hover:bg-primary-blue/20">
            <DiscordLogo className="w-6 h-6" />
          </a>
          {/* Add more social links here if needed */}
        </div>
      </div>
    </footer>
  );
};

export default Footer;