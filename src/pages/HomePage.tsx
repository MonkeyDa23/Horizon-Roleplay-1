/**
 * Nova Roleplay - Official Website
 * Home Page
 */
import React, { useState } from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import { useConfig } from '../contexts/ConfigContext';
import Modal from '../components/Modal';
import { Gamepad2, ChevronRight } from 'lucide-react';
import SEO from '../components/SEO';
import DiscordLogo from '../components/icons/DiscordLogo';

const HomePage: React.FC = () => {
  const { t, dir } = useLocalization();
  const { config, branding } = useConfig();
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const communityName = branding.siteName || 'Nova Roleplay';
  const description = branding.siteDescription || t('site_description');

  return (
    <>
      <SEO 
        title={`${communityName} - ${t('home') || 'الرئيسية'}`} 
        description={description} 
        keywords={`roleplay, community, ${(communityName || "").toLowerCase()}, mta, gta, gaming, nova`}
        image={branding.logoUrl} 
      />

      {/* Hero Section */}
      <div className="relative h-[90vh] min-h-[700px] flex items-center justify-center overflow-hidden">
        {/* Background Visuals */}
        <div className="absolute inset-0 z-0">
          <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] blur-[160px] opacity-20 rounded-full"
            style={{ backgroundColor: branding.primaryColor }}
          ></div>
          <div className="absolute inset-0 bg-brand-dark/20 backdrop-blur-[2px]"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-brand-dark/80 to-transparent"></div>
        </div>

        <div className="container-custom relative z-20 text-center space-y-8 md:space-y-12 animate-fade-in-up px-4 md:px-8">
          <div className="space-y-4 md:space-y-6">
            <h1 
              className="text-4xl sm:text-6xl md:text-8xl lg:text-9xl font-black text-white leading-tight tracking-tighter"
              style={{ textShadow: `0 0 50px ${branding.primaryColor}44, 0 20px 40px rgba(0,0,0,0.5)` }}
            >
              {branding.heroTitle || 'NOVA ROLEPLAY'}
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl text-text-secondary max-w-4xl mx-auto font-medium leading-relaxed opacity-80 px-4">
              {branding.heroSubtitle || 'نحن هنا لنقدم لك التجربة الأمثل في عالم الـ رول بلاي.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 md:gap-6 px-4">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="w-full sm:w-auto px-8 md:px-14 py-4 md:py-6 rounded-[24px] md:rounded-[32px] text-xl md:text-2xl font-black transition-all hover:scale-105 active:scale-95 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5)] flex items-center justify-center gap-4 group"
              style={{ backgroundColor: branding.primaryColor, color: '#000' }}
            >
              {t('join_us') || 'انضم إلينا الآن'}
              <ChevronRight className={`group-hover:translate-x-2 transition-transform ${dir === 'rtl' ? 'rotate-180 group-hover:-translate-x-2' : ''}`} />
            </button>
            <a 
              href={config.DISCORD_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-8 md:px-14 py-4 md:py-6 rounded-[24px] md:rounded-[32px] text-xl md:text-2xl font-black bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all backdrop-blur-xl flex items-center justify-center gap-4 group"
            >
              المتجر
              <ChevronRight className={`group-hover:translate-x-2 transition-transform ${dir === 'rtl' ? 'rotate-180 group-hover:-translate-x-2' : ''}`} />
            </a>
          </div>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('join_modal_title') || 'انضم لمجتمعنا'}>
        <div className="p-4 space-y-6">
          <p className="text-text-secondary text-lg text-center font-medium">اختر المنصة التي ترغب في الانضمام من خلالها:</p>
          <div className="grid grid-cols-1 gap-4">
            <a 
              href={config.DISCORD_INVITE_URL} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="group flex items-center justify-between p-8 bg-[#5865F2] text-white font-black rounded-[32px] hover:bg-[#4752C4] transition-all duration-300 shadow-xl"
            >
              <div className="flex items-center gap-6">
                <DiscordLogo className="w-10 h-10 transition-transform duration-500 group-hover:rotate-12" />
                <span className="text-2xl">{t('join_discord') || 'خادم الديسكورد'}</span>
              </div>
              <ChevronRight size={24} className={dir === 'rtl' ? 'rotate-180' : ''} />
            </a>
            
            <a 
              href={config.MTA_SERVER_URL}
              className="group flex items-center justify-between p-8 bg-white/10 border border-white/10 text-white font-black rounded-[32px] hover:bg-white/20 transition-all duration-300 shadow-xl"
            >
              <div className="flex items-center gap-6">
                <Gamepad2 size={40} className="transition-transform duration-500 group-hover:scale-110" />
                <span className="text-2xl">{t('connect_mta') || 'خادم اللعبة (MTA)'}</span>
              </div>
              <ChevronRight size={24} className={dir === 'rtl' ? 'rotate-180' : ''} />
            </a>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default HomePage;
