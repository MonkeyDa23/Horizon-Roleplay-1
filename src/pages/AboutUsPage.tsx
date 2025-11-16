// src/pages/AboutUsPage.tsx
import React, { useState, useEffect } from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import { useConfig } from '../contexts/ConfigContext';
import { Info, Loader2, Users, Server } from 'lucide-react';
import DiscordEmbed from '../components/DiscordEmbed';
import SEO from '../components/SEO';
import { getDiscordWidgets, getStaff } from '../lib/api';
import type { DiscordWidget, StaffMember } from '../types';

const StaffCard: React.FC<{ member: StaffMember, index: number }> = ({ member, index }) => {
    const { t } = useLocalization();
    return (
        <div 
            className="glass-panel p-6 text-center group flex flex-col items-center animate-stagger" 
            style={{ animationDelay: `${index * 100}ms`, opacity: 0 }}
        >
            <div className="relative mb-4">
                <img 
                    src={member.avatar_url} 
                    alt={member.username} 
                    className="w-28 h-28 rounded-full border-4 border-border-color group-hover:border-primary-blue transition-colors duration-300" 
                />
            </div>
            <h3 className="text-xl font-bold text-white">{member.username}</h3>
            <p className="text-primary-blue font-semibold">{t(member.role_key)}</p>
        </div>
    );
};


const AboutUsPage: React.FC = () => {
    const { t } = useLocalization();
    const { config } = useConfig();
    const communityName = config.COMMUNITY_NAME;
    const [widgets, setWidgets] = useState<DiscordWidget[]>([]);
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeView, setActiveView] = useState<'staff' | 'servers' | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [widgetsData, staffData] = await Promise.all([
                    getDiscordWidgets(),
                    getStaff()
                ]);
                setWidgets(widgetsData);
                setStaff(staffData);
            } catch (error) {
                console.error("Failed to fetch About Us page data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);
    
    const renderActiveView = () => {
        if (isLoading) {
            return <div className="flex justify-center items-center py-20"><Loader2 size={40} className="text-primary-blue animate-spin" /></div>;
        }

        if (activeView === 'staff') {
            return (
                <div>
                    <h2 className="text-3xl md:text-4xl font-bold text-center mb-10">{t('meet_the_team')}</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {staff.map((member, index) => <StaffCard key={member.id} member={member} index={index} />)}
                    </div>
                </div>
            );
        }

        if (activeView === 'servers') {
             return (
                 <div>
                    <h2 className="text-3xl md:text-4xl font-bold text-center mb-10">{t('our_servers')}</h2>
                     <div className="flex flex-wrap justify-center gap-8">
                         {widgets.length > 0 ? (
                            widgets.map((widget, index) => (
                                <div className="animate-stagger" style={{ animationDelay: `${index * 100}ms`, opacity: 0 }} key={widget.id}>
                                    <DiscordEmbed 
                                        serverName={widget.server_name}
                                        serverId={widget.server_id}
                                        inviteUrl={widget.invite_url}
                                    />
                                </div>
                            ))
                         ) : (
                            <div className="animate-stagger" style={{ opacity: 0 }}>
                              <DiscordEmbed 
                                  serverName={config.COMMUNITY_NAME}
                                  serverId={config.DISCORD_GUILD_ID}
                                  inviteUrl={config.DISCORD_INVITE_URL}
                              />
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
                keywords={`about, about us, community, mission, history, roleplay, ${communityName.toLowerCase()}`}
            />
            <div className="container mx-auto px-6 py-16">
                <div className="text-center mb-16 animate-fade-in-up">
                    <div className="inline-block p-4 bg-background-light rounded-full mb-4 border-2 border-border-color shadow-lg">
                        <Info className="text-primary-blue" size={48} />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">{t('page_title_about', { communityName: config.COMMUNITY_NAME })}</h1>
                    <p className="text-lg text-text-secondary max-w-3xl mx-auto">{t('about_intro', { communityName: config.COMMUNITY_NAME })}</p>
                </div>
                
                <div className="flex justify-center items-center gap-6 mb-16 animate-fade-in-up" style={{ animationDelay: '200ms', opacity: 0 }}>
                    <button 
                        onClick={() => setActiveView('staff')}
                        className={`flex items-center gap-3 px-8 py-4 rounded-xl text-lg font-bold transition-all duration-300 transform hover:scale-105 ${activeView === 'staff' ? 'bg-primary-blue text-background-dark shadow-glow-blue' : 'glass-panel text-white hover:bg-primary-blue/30'}`}
                    >
                        <Users />
                        {t('server_management')}
                    </button>
                    <button 
                        onClick={() => setActiveView('servers')}
                        className={`flex items-center gap-3 px-8 py-4 rounded-xl text-lg font-bold transition-all duration-300 transform hover:scale-105 ${activeView === 'servers' ? 'bg-primary-blue text-background-dark shadow-glow-blue' : 'glass-panel text-white hover:bg-primary-blue/30'}`}
                    >
                        <Server />
                        {t('our_servers')}
                    </button>
                </div>

                <div className="min-h-[200px]">
                    {renderActiveView()}
                </div>
            </div>
        </>
    );
};

export default AboutUsPage;