import React, { useState, useEffect } from 'react';
import Logo from './icons/Logo';
import { useLocalization } from '../hooks/useLocalization';
import { CONFIG } from '../lib/config';
import { Loader2, AlertTriangle } from 'lucide-react';

interface DiscordWidgetData {
  name: string;
  presence_count: number;
  members: { id: string; username: string; avatar_url: string; status: string }[];
  instant_invite: string;
}

// This interface is for Discord's error response on the widget.json endpoint
interface DiscordWidgetError {
  code: number;
  message: string;
}

const DiscordEmbed: React.FC = () => {
  const { t } = useLocalization();
  const [widgetData, setWidgetData] = useState<DiscordWidgetData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWidgetData = async () => {
      setIsLoading(true);
      setError(null);

      // Explicitly check for the placeholder ID to guide the developer.
      // FIX: Changed DISCORD_SERVER_ID to DISCORD_GUILD_ID to match the config file.
      if (!CONFIG.DISCORD_GUILD_ID || CONFIG.DISCORD_GUILD_ID === '1422936346233933980') {
          setError(t('discord_widget_error_misconfigured'));
          setIsLoading(false);
          return;
      }

      try {
        // FIX: Changed DISCORD_SERVER_ID to DISCORD_GUILD_ID to match the config file.
        const response = await fetch(`https://discord.com/api/guilds/${CONFIG.DISCORD_GUILD_ID}/widget.json`);
        // The widget.json endpoint can return a 200 OK with an error object inside,
        // so we need to check the body content as well.
        const data: DiscordWidgetData | DiscordWidgetError = await response.json();

        if ('code' in data) {
           switch (data.code) {
               case 10004: // Unknown Guild
                   throw new Error(t('discord_widget_error_invalid_id'));
               case 50027: // Widget Disabled
                   throw new Error(t('discord_widget_error_disabled'));
               default:
                   throw new Error(data.message || t('discord_widget_error'));
           }
        }
        
        setWidgetData(data as DiscordWidgetData);
      } catch (err) {
        console.error("Discord Widget Error:", err);
        setError(err instanceof Error ? err.message : String(err));
        setWidgetData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWidgetData();
  }, [t]);

  const renderContent = () => {
    if (isLoading) {
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
            <div className="flex items-center gap-2 text-sm">
              <span className="w-2.5 h-2.5 bg-gray-500 rounded-full"></span>
              <span>
                {widgetData.members.length.toLocaleString()} {t('discord_members')}
              </span>
            </div>
          </div>
      );
    }
    // Fallback case
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
          <h3 className="font-bold text-white text-lg">{widgetData?.name || CONFIG.COMMUNITY_NAME}</h3>
          <p className="text-xs text-gray-400">
            {t('join_community')}
          </p>
        </div>
      </div>
      
      {renderContent()}

      <a
        href={widgetData?.instant_invite || CONFIG.DISCORD_INVITE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full text-center bg-brand-cyan text-brand-dark font-bold py-2.5 rounded-md hover:bg-white transition-all duration-300 shadow-glow-cyan-light mt-2"
      >
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
