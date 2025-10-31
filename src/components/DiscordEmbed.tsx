// src/components/DiscordEmbed.tsx
import React, { useState } from 'react';
import Logo from './Logo';
import { useLocalization } from '../hooks/useLocalization';
import { Loader2, AlertTriangle } from 'lucide-react';
import DiscordLogo from './icons/DiscordLogo';

interface DiscordEmbedProps {
  serverName: string;
  serverId: string;
  inviteUrl: string;
}

const DiscordEmbed: React.FC<DiscordEmbedProps> = ({ serverName, serverId, inviteUrl }) => {
  const { t } = useLocalization();
  
  // MOCK DATA until a serverless function is created for stats
  const [onlineMembers] = useState(Math.floor(Math.random() * (2500 - 500 + 1) + 500));
  const [totalMembers] = useState(Math.floor(Math.random() * (10000 - 3000 + 1) + 3000));
  const [isLoading] = useState(false);
  const [error] = useState<string | null>(null);

  const renderContent = () => {
    if (isLoading) {
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
    return (
    <div className="space-y-2 text-gray-300 mb-4 px-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
          <span>
            {onlineMembers.toLocaleString()} {t('discord_online')}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2.5 h-2.5 bg-gray-500 rounded-full"></span>
          <span>
            {totalMembers.toLocaleString()} {t('discord_members')}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[#2B2D31] p-4 rounded-lg w-full max-w-sm mx-auto border-l-4 border-brand-cyan shadow-lg">
      <div className="flex items-center gap-3 mb-3">
        <div className="bg-brand-dark rounded-full p-1">
          <Logo className="w-10 h-10" />
        </div>
        <div>
          <h3 className="font-bold text-white text-lg">{serverName}</h3>
          <p className="text-xs text-gray-400">
            {t('join_community')}
          </p>
        </div>
      </div>
      
      {renderContent()}

      <a
        href={inviteUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full text-center bg-[#5865F2] text-white font-bold py-2.5 rounded-md hover:bg-[#4f5bda] transition-all duration-300"
      >
        <DiscordLogo className="w-6 h-5" />
        {t('join_us')}
      </a>
    </div>
  );
};

export default DiscordEmbed;