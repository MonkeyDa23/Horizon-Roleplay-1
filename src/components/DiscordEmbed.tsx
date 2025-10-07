import React, { useState, useEffect } from 'react';
import Logo from './Logo';
import { useLocalization } from '../hooks/useLocalization';
import { useConfig } from '../hooks/useConfig';
import { getDiscordStats } from '../lib/api';
import { Loader2, AlertTriangle, Users, UserCheck, UserX } from 'lucide-react';
import DiscordLogo from './icons/DiscordLogo';

interface DiscordStats {
  onlineCount: number;
  totalCount: number;
}

const DiscordEmbed: React.FC = () => {
  const { t } = useLocalization();
  const { config, configLoading } = useConfig();
  const [stats, setStats] = useState<DiscordStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (configLoading) return;

    const fetchStats = async () => {
      setIsLoading(true);
      setError(null);

      if (!config.DISCORD_GUILD_ID) {
          setError(t('discord_widget_error_misconfigured'));
          setIsLoading(false);
          return;
      }
      
      try {
        const data = await getDiscordStats();
        setStats(data);
      } catch (err) {
        console.error("Discord Stats Error:", err);
        setError(err instanceof Error ? err.message : t('discord_widget_error'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 60000); // Refresh every minute
    return () => clearInterval(interval);

  }, [t, config.DISCORD_GUILD_ID, configLoading]);

  const renderContent = () => {
    if (isLoading || configLoading) {
      return (
        <div className="flex justify-center items-center h-24">
          <Loader2 className="animate-spin text-gray-400" />
        </div>
      );
    }
    if (error) {
      return (
        <div className="text-center text-red-400 text-sm py-2 px-2 animate-fade-in flex flex-col items-center gap-2 h-24 justify-center">
            <AlertTriangle size={24}/>
            <p className="font-bold">{error}</p>
        </div>
      );
    }
    if (stats) {
      const offlineCount = stats.totalCount - stats.onlineCount;
      return (
        <div className="space-y-2 text-gray-300 px-2 animate-fade-in h-24 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-sm">
              <UserCheck size={16} className="text-green-400" />
              <span>{stats.onlineCount.toLocaleString()} {t('discord_online')}</span>
            </div>
             <div className="flex items-center gap-2 text-sm">
              <UserX size={16} className="text-gray-500" />
              <span>{offlineCount.toLocaleString()} {t('discord_offline')}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Users size={16} className="text-brand-cyan" />
              <span>{stats.totalCount.toLocaleString()} {t('discord_total_members')}</span>
            </div>
          </div>
      );
    }
    return (
       <div className="text-center text-gray-400 text-sm py-2 h-24 flex items-center justify-center">
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
          <h3 className="font-bold text-white text-lg">{config.COMMUNITY_NAME}</h3>
          <p className="text-xs text-gray-400">
            {t('join_community')}
          </p>
        </div>
      </div>
      
      {renderContent()}

      <a
        href={config.DISCORD_INVITE_URL}
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
