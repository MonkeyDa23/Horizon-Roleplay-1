
import React, { useState, useEffect } from 'react';
import Logo from './icons/Logo';
import { useLocalization } from '../hooks/useLocalization';
import { CONFIG } from '../lib/config';
import { Loader2 } from 'lucide-react';

interface DiscordWidgetData {
  name: string;
  presence_count: number;
  members: { id: string; username: string; avatar_url: string; status: string }[];
  instant_invite: string;
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
      try {
        const response = await fetch(`https://discord.com/api/guilds/${CONFIG.DISCORD_SERVER_ID}/widget.json`);
        if (!response.ok) {
          throw new Error('Failed to fetch Discord widget data. Ensure the widget is enabled in your server settings.');
        }
        const data: DiscordWidgetData = await response.json();
        setWidgetData(data);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchWidgetData();
  }, []);

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
      {isLoading ? (
         <div className="flex justify-center items-center h-16">
            <Loader2 className="animate-spin text-gray-400" />
         </div>
      ) : error ? (
        <div className="text-center text-red-400 text-sm p-2 bg-red-500/10 rounded-md">
          {error}
        </div>
      ) : widgetData ? (
        <div className="space-y-2 text-gray-300 mb-4 px-2">
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
      ) : null}
      <a
        href={widgetData?.instant_invite || CONFIG.DISCORD_INVITE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full text-center bg-brand-cyan text-brand-dark font-bold py-2.5 rounded-md hover:bg-white transition-all duration-300 shadow-glow-cyan-light"
      >
        {t('join_us')}
      </a>
    </div>
  );
};

export default DiscordEmbed;