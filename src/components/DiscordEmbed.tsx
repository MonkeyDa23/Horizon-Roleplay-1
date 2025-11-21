
// src/components/DiscordEmbed.tsx
import React, { useState, useEffect } from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import { Loader2, AlertTriangle } from 'lucide-react';
import DiscordLogo from './icons/DiscordLogo';
import { getInviteDetails } from '../lib/api';

interface DiscordEmbedProps {
  serverName: string;
  serverId: string;
  inviteUrl: string;
}

const DiscordEmbed: React.FC<DiscordEmbedProps> = ({ serverName, serverId, inviteUrl }) => {
  const { t } = useLocalization();
  
  const [stats, setStats] = useState<{ online: number; total: number; name: string; icon: string | null } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
        setIsLoading(true);
        setError(null);
        
        try {
            // Extract code from URL (handles https://discord.gg/CODE and other formats)
            const match = inviteUrl.match(/(?:discord\.gg|discord\.com\/invite)\/([a-zA-Z0-9-]+)/);
            const code = match ? match[1] : inviteUrl.split('/').pop();

            if (!code) {
                throw new Error('Invalid Invite URL');
            }

            const data = await getInviteDetails(code);
            
            setStats({
                online: data.presenceCount,
                total: data.memberCount,
                name: data.guild.name,
                icon: data.guild.iconURL
            });

        } catch (err) {
            console.error("Failed to fetch widget stats:", err);
            // Fallback to basic display with props if fetch fails, but log error
            setError("Could not load stats");
        } finally {
            setIsLoading(false);
        }
    };

    fetchStats();
  }, [inviteUrl]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center h-24">
          <Loader2 className="animate-spin text-text-secondary" />
        </div>
      );
    }
    
    // Use real stats if available, otherwise fallback to 0 or show error
    const online = stats ? stats.online : 0;
    const total = stats ? stats.total : 0;

    return (
    <div className="space-y-3 text-text-secondary mb-6 px-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2.5 h-2.5 bg-green-500 rounded-full shadow-md shadow-green-500/50"></span>
          <span>
            {online.toLocaleString()} {t('discord_online')}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2.5 h-2.5 bg-gray-500 rounded-full"></span>
          <span>
            {total.toLocaleString()} {t('discord_members')}
          </span>
        </div>
      </div>
    );
  };

  const displayName = stats ? stats.name : serverName;
  const displayIcon = stats && stats.icon;

  return (
    <div className="glass-panel p-8 w-full max-w-sm mx-auto hover:shadow-glow-blue-light transition-all duration-300">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-2xl bg-background-dark flex items-center justify-center border border-border-color overflow-hidden flex-shrink-0">
            {displayIcon ? (
                <img src={displayIcon} alt={displayName} className="w-full h-full object-cover" />
            ) : (
                <DiscordLogo className="w-9 h-9 text-white"/>
            )}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-text-secondary truncate">
            {t('join_community')}
          </p>
          <h3 className="font-bold text-white text-lg truncate pr-2" title={displayName}>{displayName}</h3>
        </div>
      </div>
      
      {renderContent()}

      <a
        href={inviteUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center justify-center gap-2 w-full text-center bg-[#5865F2] text-white font-bold py-3 rounded-lg hover:bg-[#4f5bda] transition-all duration-300 transform hover:scale-105"
      >
        <DiscordLogo className="w-6 h-5 transition-transform duration-300 group-hover:scale-110" />
        {t('join_us')}
      </a>
    </div>
  );
};

export default DiscordEmbed;
