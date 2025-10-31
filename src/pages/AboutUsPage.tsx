import React, { useState, useEffect } from 'react';
import { useLocalization } from '../hooks/useLocalization';
import { useConfig } from '../hooks/useConfig';
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
        <div className="text-center mb-12">
          <div className="inline-block p-4 bg-brand-light-blue rounded-full mb-4">
            <Info className="text-brand-cyan" size={48} />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t('page_title_about', { communityName: config.COMMUNITY_NAME })}</h1>
          <p className="text-lg text-gray-300 max-w-3xl mx-auto">{t('about_intro', { communityName: config.COMMUNITY_NAME })}</p>
        </div>

        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-start">
          <div className="bg-brand-dark-blue p-8 rounded-lg border border-brand-light-blue h-full">
            <h2 className="text-3xl font-bold text-brand-cyan mb-4">{t('our_mission')}</h2>
            <p className="text-gray-300 leading-relaxed">
              {t('mission_text')}
            </p>
          </div>
          
          <div className="space-y-8">
             {isLoading ? (
                <div className="flex justify-center items-center h-48">
                    <Loader2 size={40} className="text-brand-cyan animate-spin" />
                </div>
             ) : widgets.length > 0 ? (
                widgets.map(widget => (
                    <DiscordEmbed 
                        key={widget.id}
                        serverName={widget.server_name}
                        inviteUrl={widget.invite_url}
                    />
                ))
             ) : (
                <DiscordEmbed 
                    serverName={config.COMMUNITY_NAME}
                    inviteUrl={config.DISCORD_INVITE_URL}
                />
             )}
          </div>
        </div>
      </div>
    </>
  );
};

export default AboutUsPage;