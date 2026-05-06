/**
 * Nova Roleplay - Official Website
 * Home Page
 * Copyright (c) 2024 Nova Roleplay. All rights reserved.
 */

import React, { useState } from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import { useConfig } from '../contexts/ConfigContext';
import Modal from '../components/Modal';
import { Gamepad2 } from 'lucide-react';
import SEO from '../components/SEO';
import DiscordLogo from '../components/icons/DiscordLogo';

const HomePage: React.FC = () => {
  const { t } = useLocalization();
  const { config, branding } = useConfig();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const communityName = branding.siteName || 'Nova Roleplay';
  const description = t('site_description');


  return (
    <>
      <SEO 
        title={`${communityName} - ${t('home')}`}
        description={description}
        keywords={`roleplay, community, ${communityName.toLowerCase()}, mta, gta, gaming, nova`}
        image={branding.logoUrl}
      />
      {/* Reduced height from 90vh to 85vh to ensure footer/bottom line is visible on standard screens */}
      <div className="relative h-[85vh] min-h-[600px] flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-gradient-to-t from-background-dark via-background-dark/80 to-transparent z-10"
        ></div>
        
        <div className="text-center z-20 p-6 animate-fade-in-up">
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold text-white tracking-tighter" style={{ textShadow: `0 0 40px ${branding.primaryColor}88, 0 0 15px ${branding.secondaryColor}88`, color: 'white' }}>
            {branding.heroTitle}
          </h1>
          <p className="mt-6 text-lg md:text-xl text-text-secondary max-w-3xl mx-auto">
            {branding.heroSubtitle}
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-12 px-10 py-4 font-bold text-lg rounded-xl shadow-glow-blue hover:opacity-90 hover:scale-105 transform transition-all duration-300 ease-in-out"
            style={{ background: `linear-gradient(to right, ${branding.primaryColor}, ${branding.secondaryColor})`, color: 'black' }}
          >
            {t('join_us')}
          </button>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('join_modal_title')}>
        <div className="space-y-6">
          <a
            href={config.DISCORD_INVITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-center gap-4 w-full p-4 bg-[#5865F2] text-white font-bold rounded-lg hover:bg-[#4f5bda] transition-all duration-300 transform hover:scale-105"
          >
            <DiscordLogo className="w-6 h-6 transition-transform duration-300 group-hover:rotate-12" />
            <span>{t('join_discord')}</span>
          </a>
          <a
            href={config.MTA_SERVER_URL}
            className="group flex items-center justify-center gap-4 w-full p-4 bg-background-light text-white font-bold rounded-lg hover:bg-border-color transition-all duration-300 transform hover:scale-105"
          >
            <Gamepad2 size={24} className="transition-transform duration-300 group-hover:translate-x-1" />
            <span>{t('connect_mta')}</span>
          </a>
        </div>
      </Modal>
    </>
  );
};

export default HomePage;