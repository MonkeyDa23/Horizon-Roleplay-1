// src/pages/AboutUsPage.tsx
import React, { useState, useEffect } from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import { useConfig } from '../contexts/ConfigContext';
import { Info, Loader2 } from 'lucide-react';
import DiscordEmbed from '../components/DiscordEmbed';
import SEO from '../components/SEO';
import { getDiscordWidgets } from '../lib/api';
import type { DiscordWidget } from '../types';

const AboutUsPage: React.FC = () => {
  const { t } = useLocalization();
  const { config } = useConfig();
  const communityName = config.COMMUNITY_NAME;
  const [widgets, setWidgets] = useState<DiscordWidget[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchWidgets = async () => {
        setIsLoading(true);
        try {
            const data = await getDiscordWidgets();
            setWidgets(data);
        } catch (error) {
            console.error("Failed to fetch Discord widgets:", error);
        } finally {
            setIsLoading(false);
        }
    };
    fetchWidgets();
  }, []);

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

        <div className="max-w-6xl mx-auto grid lg:grid-cols-5 gap-12 items-start">
          <div className="lg:col-span-3 glass-panel p-10 rounded-lg h-full animate-stagger" style={{ animationDelay: '100ms', opacity: 0 }}>
            <h2 className="text-3xl font-bold text-primary-blue mb-6">{t('our_mission')}</h2>
            <p className="text-text-primary leading-relaxed text-lg">
              {t('mission_text')}
            </p>
          </div>
          
          <div className="lg:col-span-2 space-y-8">
             {isLoading ? (
                <div className="flex justify-center items-center h-48">
                    <Loader2 size={40} className="text-primary-blue animate-spin" />
                </div>
             ) : widgets.length > 0 ? (
                widgets.map((widget, index) => (
                    <div className="animate-stagger" style={{ animationDelay: `${200 + index * 100}ms`, opacity: 0 }} key={widget.id}>
                        <DiscordEmbed 
                            serverName={widget.server_name}
                            serverId={widget.server_id}
                            inviteUrl={widget.invite_url}
                        />
                    </div>
                ))
             ) : (
                // Fallback to main community discord if no widgets are configured
                <div className="animate-stagger" style={{ animationDelay: '200ms', opacity: 0 }}>
                  <DiscordEmbed 
                      serverName={config.COMMUNITY_NAME}
                      serverId={config.DISCORD_GUILD_ID}
                      inviteUrl={config.DISCORD_INVITE_URL}
                  />
                </div>
             )}
          </div>
        </div>
      </div>
    </>
  );
};

export default AboutUsPage;