/**
 * Nova Roleplay - Official Website
 * Home Page
 */
import React, { useState } from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import { useConfig } from '../contexts/ConfigContext';
import Modal from '../components/Modal';
import { Gamepad2, ChevronRight, ShoppingCart } from 'lucide-react';
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
        <div className="absolute inset-0 z-0 overflow-hidden">
          <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] blur-[120px] opacity-15 rounded-full"
            style={{ backgroundColor: branding.primaryColor }}
          ></div>
          <div className="absolute inset-0 bg-brand-dark/20"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-brand-dark/70 to-transparent"></div>
        </div>

        <div className="container-custom relative z-20 text-center space-y-8 md:space-y-12 animate-fade-in-up px-4 md:px-8">
          <div className="space-y-4 md:space-y-6">
            <h1 
              className="text-6xl sm:text-8xl md:text-9xl lg:text-[10rem] font-black text-white leading-none tracking-tighter"
              style={{ textShadow: `0 10px 40px rgba(0,0,0,0.6)` }}
            >
              {branding.heroTitle || 'NOVA ROLEPLAY'}
            </h1>
            <p className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-text-secondary max-w-5xl mx-auto font-black leading-tight opacity-90 px-4">
              {branding.heroSubtitle || 'نحن هنا لنقدم لك التجربة الأمثل في عالم الـ رول بلاي.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 md:gap-8 px-4 pt-4">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="w-full sm:w-auto px-10 md:px-14 py-5 md:py-7 rounded-[30px] md:rounded-[40px] text-2xl md:text-3xl font-black transition-all hover:scale-105 active:scale-95 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5)] flex items-center justify-center gap-5 group"
              style={{ backgroundColor: branding.primaryColor, color: '#000' }}
            >
              {t('join_us') || 'انضم إلينا الآن'}
              <ChevronRight size={32} className={`group-hover:translate-x-2 transition-transform ${dir === 'rtl' ? 'rotate-180 group-hover:-translate-x-2' : ''}`} />
            </button>
            <a 
              href="/store"
              className="w-full sm:w-auto px-10 md:px-14 py-5 md:py-7 rounded-[30px] md:rounded-[40px] text-2xl md:text-3xl font-black transition-all hover:scale-105 active:scale-95 shadow-2xl flex items-center justify-center gap-5 group bg-white/5 border border-white/10 text-white"
            >
              {t('view_store') || 'تصفح المتجر'}
              <ShoppingCart size={32} className="opacity-40 group-hover:opacity-100 transition-all" />
            </a>
          </div>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('join_modal_title') || 'انضم لمجتمعنا'}>
        <div className="p-6 space-y-8">
          <p className="text-text-secondary text-2xl text-center font-bold">{t('join_modal_desc') || 'اختر المنصة التي ترغب في الانضمام من خلالها:'}</p>
          <div className="grid grid-cols-1 gap-6">
            <a 
              href={config.DISCORD_INVITE_URL} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="group flex items-center justify-between p-10 bg-[#5865F2] text-white font-black rounded-[40px] hover:bg-[#4752C4] transition-all duration-300 shadow-2xl hover:translate-y--1"
            >
              <div className="flex items-center gap-8">
                <DiscordLogo className="w-12 h-12 transition-transform duration-500 group-hover:rotate-12" />
                <span className="text-3xl">{t('join_discord') || 'خادم الديسكورد'}</span>
              </div>
              <ChevronRight size={32} className={dir === 'rtl' ? 'rotate-180' : ''} />
            </a>
            
            <a 
              href={config.MTA_SERVER_URL}
              className="group flex items-center justify-between p-10 bg-white/10 border border-white/10 text-white font-black rounded-[40px] hover:bg-white/20 transition-all duration-300 shadow-2xl hover:translate-y--1"
            >
              <div className="flex items-center gap-8">
                <Gamepad2 size={48} className="transition-transform duration-500 group-hover:scale-110" />
                <span className="text-3xl">{t('connect_mta') || 'خادم اللعبة (MTA)'}</span>
              </div>
              <ChevronRight size={32} className={dir === 'rtl' ? 'rotate-180' : ''} />
            </a>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default HomePage;
