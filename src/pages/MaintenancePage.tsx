/**
 * Nova Roleplay - Official Website
 * Maintenance Page
 * Copyright (c) 2024 Nova Roleplay. All rights reserved.
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Wrench, Hammer, Clock, MessageSquare, ShieldAlert } from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';
import { useLocalization } from '../contexts/LocalizationContext';
import LoginCaptchaModal from '../components/LoginCaptchaModal';

const MaintenancePage: React.FC = () => {
    const { branding } = useConfig();
    const { language, t, dir } = useLocalization();
    const [isLoginCaptchaOpen, setLoginCaptchaOpen] = useState(false);
    const isArabic = language === 'ar';

    const handleAdminLogin = () => {
        setLoginCaptchaOpen(true);
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-brand-dark p-6 relative overflow-hidden" dir={dir}>
            {/* Background Accents */}
            <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] blur-[120px] rounded-full animate-pulse opacity-20" style={{ backgroundColor: branding.primaryColor }} />
            <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] blur-[120px] rounded-full opacity-10" style={{ backgroundColor: branding.primaryColor }} />

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl w-full text-center relative z-10"
            >
                {/* Icon Grid */}
                <div className="flex justify-center gap-6 mb-12">
                    <motion.div 
                        animate={{ rotate: [0, 15, -15, 0] }}
                        transition={{ repeat: Infinity, duration: 4 }}
                        className="bg-white/5 p-6 rounded-[32px] border border-white/10 shadow-2xl"
                    >
                        <Wrench style={{ color: branding.primaryColor }} size={48} />
                    </motion.div>
                    <motion.div 
                        animate={{ y: [0, -10, 0] }}
                        transition={{ repeat: Infinity, duration: 3 }}
                        className="bg-white/5 p-6 rounded-[32px] border border-white/10 mt-6 shadow-2xl"
                    >
                        <Hammer style={{ color: branding.primaryColor }} size={48} />
                    </motion.div>
                </div>

                <h1 className="text-6xl md:text-8xl font-black text-white mb-8 tracking-tighter leading-none">
                    {t('maintenance_title')}
                </h1>
                
                <p className="text-xl md:text-2xl text-text-secondary leading-relaxed mb-16 font-medium opacity-80">
                    {t('maintenance_desc', { communityName: branding.siteName })}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16 max-w-xl mx-auto">
                    <div className="bg-white/[0.03] border border-white/10 p-8 rounded-[40px] flex items-center gap-6 group hover:bg-white/5 transition-all duration-500">
                        <div className="w-16 h-16 rounded-[24px] flex items-center justify-center bg-white/5 border border-white/5 group-hover:scale-110 transition-all duration-500">
                            <Clock style={{ color: branding.primaryColor }} size={32} />
                        </div>
                        <div className={isArabic ? 'text-right' : 'text-left'}>
                            <div className="text-white text-xl font-black">{t('expected_back')}</div>
                            <div className="text-text-secondary font-medium opacity-60">{t('expected_back_desc')}</div>
                        </div>
                    </div>
                    
                    <a 
                        href={branding.discordLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-white/[0.03] border border-white/10 p-8 rounded-[40px] flex items-center gap-6 group hover:bg-white/5 transition-all duration-500"
                    >
                        <div className="w-16 h-16 rounded-[24px] flex items-center justify-center bg-white/5 border border-white/5 group-hover:scale-110 transition-all duration-500">
                            <MessageSquare style={{ color: branding.primaryColor }} size={32} />
                        </div>
                        <div className={isArabic ? 'text-right' : 'text-left'}>
                            <div className="text-white text-xl font-black">{t('follow_updates')}</div>
                            <div className="text-text-secondary font-medium opacity-60">{t('follow_updates_desc')}</div>
                        </div>
                    </a>
                </div>

                <div className="inline-block px-10 py-5 rounded-full border border-white/10 bg-white/5 shadow-2xl">
                    <span className="font-black text-xs uppercase tracking-[0.3em] animate-pulse" style={{ color: branding.primaryColor }}>
                        {t('maintenance_in_progress')}
                    </span>
                </div>

                {/* Admin Access Section */}
                <div className="mt-24 pt-12 border-t border-white/5 flex flex-col items-center">
                    <p className="text-text-secondary text-sm mb-6 font-bold opacity-40">
                        {t('are_you_staff')}
                    </p>
                    <button 
                        onClick={handleAdminLogin}
                        className="flex items-center gap-4 px-10 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white font-black text-sm transition-all group shadow-xl"
                    >
                        <ShieldAlert size={20} style={{ color: branding.primaryColor }} className="group-hover:scale-110 transition-transform" />
                        <span>{t('staff_login')}</span>
                    </button>
                    <p className="mt-4 text-red-500/60 text-[10px] font-black tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                        {t('staff_only_access')}
                    </p>
                </div>
            </motion.div>
            
            <footer className="mt-20 py-8 text-text-secondary text-xs opacity-40 font-black tracking-widest uppercase">
                © {new Date().getFullYear()} {branding.siteName}. {t('all_rights_reserved')}.
            </footer>

            <LoginCaptchaModal isOpen={isLoginCaptchaOpen} onClose={() => setLoginCaptchaOpen(false)} />
        </div>
    );
};

export default MaintenancePage;
