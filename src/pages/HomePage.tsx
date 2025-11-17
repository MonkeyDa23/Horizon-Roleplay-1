import React, { useState } from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import { useConfig } from '../contexts/ConfigContext';
import Modal from '../components/Modal';
import { Disc3, Gamepad2 } from 'lucide-react';
import SEO from '../components/SEO';

const HomePage: React.FC = () => {
  const { t } = useLocalization();
  const { config } = useConfig();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const communityName = config.COMMUNITY_NAME || 'Vixel Roleplay';
  // This description comes from metadata.json
  const description = "A visually stunning website for the Vixel Roleplay community, featuring multilingual support, Discord integration, and pages for community rules, applications, and store.";


  return (
    <>
      <SEO 
        title={`${communityName} - ${t('home')}`}
        description={description}
        keywords={`roleplay, community, ${communityName.toLowerCase()}, mta, gta, gaming, vixel`}
        image={config.BACKGROUND_IMAGE_URL || config.LOGO_URL}
      />
      <div className="relative h-[calc(90vh)] min-h-[600px] flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-gradient-to-t from-background-dark via-background-dark/80 to-transparent z-10"
        ></div>
        
        <div className="text-center z-20 p-6 animate-fade-in-up">
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold text-white tracking-tighter" style={{ textShadow: '0 0 40px rgba(0, 169, 255, 0.6), 0 0 15px rgba(0, 242, 234, 0.6)' }}>
            {t('hero_title', { communityName })}
          </h1>
          <p className="mt-6 text-lg md:text-xl text-text-secondary max-w-3xl mx-auto">
            {t('hero_subtitle')}
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-12 px-10 py-4 bg-gradient-to-r from-primary-blue to-accent-cyan text-background-dark font-bold text-lg rounded-xl shadow-glow-blue hover:opacity-90 hover:scale-105 transform transition-all duration-300 ease-in-out"
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
            <Disc3 size={24} className="transition-transform duration-300 group-hover:rotate-180" />
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