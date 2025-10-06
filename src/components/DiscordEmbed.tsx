import React, { useState, useEffect } from 'react';
import Logo from './Logo';
import { useLocalization } from '../hooks/useLocalization';
import { useConfig } from '../hooks/useConfig';
import { Loader2, AlertTriangle } from 'lucide-react';
import DiscordLogo from './icons/DiscordLogo';

interface DiscordWidgetData {
  name: string;
  presence_count: number;
  members: { id: string; username: string; avatar_url: string; status: string }[];
  instant_invite: string;
}

interface DiscordWidgetError {
  code: number;
  message: string;
}

const DiscordEmbed: React.FC = () => {
  const { t } = useLocalization();
  const { config, configLoading } = useConfig();
  const [widgetData, setWidgetData] = useState<DiscordWidgetData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (configLoading) return;

    const fetchWidgetData = async () => {
      setIsLoading(true);
      setError(null);

      if (!config.DISCORD_GUILD_ID) {
          setError(t('discord_widget_error_misconfigured'));
          setIsLoading(false);
          return;
      }

      try {
        const response = await fetch(`https://discord.com/api/guilds/${config.DISCORD_GUILD_ID}/widget.json`);
        if (!response.ok) {
            const errorData: DiscordWidgetError = await response.json();
            switch (errorData.code) {
               case 10004: // Unknown Guild
                   throw new Error(t('discord_widget_error_invalid_id'));
               case 50027: // This is a community server that has not opted into server listings.
                   throw new Error(t('discord_widget_error_disabled'));
               default:
                   throw new Error(errorData.message || t('discord_widget_error'));
           }
        }
        
        const data: DiscordWidgetData = await response.json();
        setWidgetData(data);
      } catch (err) {
        console.error("Discord Widget Error:", err);
        setError(err instanceof Error ? err.message : String(err));
        setWidgetData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWidgetData();
  }, [t, config.DISCORD_GUILD_ID, configLoading]);

  const renderContent = () => {
    if (isLoading || configLoading) {
      return (
        <div className="flex justify-center items-center h-16">
          <Loader2 className="animate-spin text-gray-400" />
        </div>
      );
    }
    if (error) {
      return (
        <div className="text-center text-red-400 text-sm py-2 px-2 animate-fade-in flex flex-col items-center gap-2">
            <AlertTriangle size={24}/>
            <p className="font-bold">{error}</p>
        </div>
      );
    }
    if (widgetData) {
      return (
        <div className="space-y-2 text-gray-300 px-2 animate-fade-in h-16 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-sm">
              <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
              <span>
                {widgetData.presence_count.toLocaleString()} {t('discord_online')}
              </span>
            </div>
            {/* The member list from the widget is often incomplete for large servers, so presence_count is more reliable */}
          </div>
      );
    }
    return (
       <div className="text-center text-gray-400 text-sm py-2 h-16 flex items-center justify-center">
         {t('discord_widget_error')}
       </div>
    )
  };


  return (
    <div className="bg-[#2B2D31] p-4 rounded-lg w-full max-w-sm mx-auto border-l-4 border-brand-cyan shadow-lg">
      <div className="flex items-center gap-3 mb-3">
        <div className="bg-brand-dark rounded-full p-1">
          <Logo className="w-10 h-10" />
        </div>
        <div>
          <h3 className="font-bold text-white text-lg">{widgetData?.name || config.COMMUNITY_NAME}</h3>
          <p className="text-xs text-gray-400">
            {t('join_community')}
          </p>
        </div>
      </div>
      
      {renderContent()}

      <a
        href={widgetData?.instant_invite || config.DISCORD_INVITE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full text-center bg-[#5865F2] text-white font-bold py-2.5 rounded-md hover:bg-[#4f5bda] transition-all duration-300 shadow-glow-cyan-light mt-2"
      >
        <DiscordLogo className="w-6 h-5" />
        {t('join_us')}
      </a>
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default DiscordEmbed;
