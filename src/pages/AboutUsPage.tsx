/**
 * Florida Roleplay - Official Website
 * About Us Page
 * Copyright (c) 2024 Florida Roleplay. All rights reserved.
 */

import React, { useState, useEffect } from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import { useTranslations } from '../contexts/TranslationsContext';
import { useConfig } from '../contexts/ConfigContext';
import { Info, Loader2, Users, Server, RefreshCw } from 'lucide-react';
import DiscordEmbed from '../components/DiscordEmbed';
import SEO from '../components/SEO';
import { getDiscordWidgets, getStaff } from '../lib/api';
import type { DiscordWidget, StaffMember } from '../types';

const StaffCard: React.FC<{ member: StaffMember, index: number }> = React.memo(({ member, index }) => {
    const { t } = useLocalization();
    const { branding } = useConfig();
    return (
        <div 
            className="bg-white/[0.03] border border-white/10 rounded-[40px] p-8 text-center group flex flex-col items-center animate-fade-in-up hover:-translate-y-2 transition-all duration-300 shadow-xl" 
            style={{ animationDelay: `${index * 100}ms` }}
        >
            <div className="relative mb-6">
                <img 
                    src={member.avatar_url} 
                    alt={member.username} 
                    className="w-32 h-32 rounded-full border-4 border-brand-dark shadow-2xl object-cover group-hover:scale-105 transition-transform duration-500" 
                />
                <div className="absolute inset-0 rounded-full border border-white/10" pointer-events="none" />
            </div>
            <h3 className="text-2xl font-black text-white mb-2 tracking-tight">{member.username}</h3>
            <span className="px-4 py-2 bg-white/5 rounded-xl border border-white/5 font-bold text-xs uppercase tracking-widest" style={{ color: branding.primaryColor }}>
                {t(member.role_key)}
            </span>
        </div>
    );
});


const AboutUsPage: React.FC = () => {
    const { t } = useLocalization();
    const { refreshTranslations } = useTranslations();
    const { config } = useConfig();
    const communityName = config.COMMUNITY_NAME;
    const [widgets, setWidgets] = useState<DiscordWidget[]>([]);
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeView, setActiveView] = useState<'staff' | 'servers'>('staff');

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch data and refresh translations in parallel to ensure role names are up to date
            const [widgetsData, staffData] = await Promise.all([
                getDiscordWidgets(),
                getStaff(),
                refreshTranslations() 
            ]);
            setWidgets(widgetsData);
            setStaff(staffData);
        } catch (error) {
            console.error("Failed to fetch About Us page data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);
    
    const renderActiveView = () => {
        if (isLoading) {
            return <div className="flex justify-center items-center py-20"><Loader2 size={40} className="text-primary-blue animate-spin" /></div>;
        }

        if (activeView === 'staff') {
            return (
                <div>
                    <div className="flex justify-between items-center mb-10">
                        <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight">{t('meet_the_team')}</h2>
                    </div>
                    {staff.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {staff.map((member, index) => <StaffCard key={member.id} member={member} index={index} />)}
                        </div>
                    ) : (
                        <div className="text-center bg-white/5 border border-white/10 rounded-[40px] p-10">
                            <p className="text-text-secondary text-lg font-bold">{t('staff_empty') || 'Staff list is currently empty.'}</p>
                        </div>
                    )}
                </div>
            );
        }

        if (activeView === 'servers') {
             return (
                 <div>
                    <h2 className="text-3xl md:text-5xl font-black text-center mb-10 tracking-tight">{t('our_servers')}</h2>
                     <div className="flex flex-wrap justify-center gap-8">
                         {widgets.length > 0 ? (
                            widgets.map((widget, index) => (
                                <div className="animate-fade-in-up" style={{ animationDelay: `${index * 100}ms` }} key={widget.id}>
                                    <DiscordEmbed 
                                        serverName={widget.server_name}
                                        serverId={widget.server_id}
                                        inviteUrl={widget.invite_url}
                                    />
                                </div>
                            ))
                         ) : (
                            <div className="text-center bg-white/5 border border-white/10 p-10 rounded-[40px] w-full max-w-2xl">
                                <p className="text-text-secondary font-bold text-lg">No server widgets configured yet.</p>
                            </div>
                         )}
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <>
            <SEO 
                title={`${communityName} - ${t('about_us')}`}
                description={`Learn more about the ${communityName} roleplay community, our mission, and what makes our server unique. Join our Discord to become a part of our story.`}
                keywords={`about, about us, community, mission, history, roleplay, ${(communityName || "").toLowerCase()}`}
            />
            <div className="container mx-auto px-6 py-16">
                <div className="text-center mb-16 animate-fade-in-up">
                    <div className="inline-flex p-5 rounded-[32px] mb-6 shadow-2xl items-center justify-center border" style={{ backgroundColor: `${config.branding?.primaryColor || '#00A9FF'}22`, borderColor: `${config.branding?.primaryColor || '#00A9FF'}55` }}>
                        <Info size={48} style={{ color: config.branding?.primaryColor || '#00A9FF' }} />
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-6">{t('page_title_about', { communityName: communityName })}</h1>
                    <p className="text-xl text-text-secondary font-bold max-w-3xl mx-auto leading-relaxed">{t('about_intro', { communityName: communityName })}</p>
                </div>
                
                <div className="bg-white/[0.02] border border-white/10 rounded-[48px] p-2 backdrop-blur-xl mb-16 flex flex-wrap gap-2 max-w-lg mx-auto">
                    <button 
                        onClick={() => setActiveView('staff')}
                        className={`flex-1 py-4 px-8 rounded-[40px] font-black text-sm transition-all flex items-center justify-center gap-3 ${activeView === 'staff' ? 'bg-white text-brand-dark shadow-xl' : 'text-text-secondary hover:text-white hover:bg-white/5'}`}
                    >
                        <Users size={20} />
                        {t('server_management')}
                    </button>
                    <button 
                        onClick={() => setActiveView('servers')}
                        className={`flex-1 py-4 px-8 rounded-[40px] font-black text-sm transition-all flex items-center justify-center gap-3 ${activeView === 'servers' ? 'bg-white text-brand-dark shadow-xl' : 'text-text-secondary hover:text-white hover:bg-white/5'}`}
                    >
                        <Server size={20} />
                        {t('our_servers')}
                    </button>
                </div>

                <div className="min-h-[400px]">
                    {renderActiveView()}
                </div>
            </div>
        </>
    );
};

export default AboutUsPage;
