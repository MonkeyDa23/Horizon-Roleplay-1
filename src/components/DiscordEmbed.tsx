// src/components/DiscordEmbed.tsx
import React, { useState } from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
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
          <Loader2 className="animate-spin text-text-secondary" />
        </div>
      );
    }
    if (error) {
      return (
        <div className="text-center text-red-400 text-sm py-2 px-2 flex flex-col items-center gap-2 h-24 justify-center">
            <AlertTriangle size={24}/>
            <p className="font-bold">{error}</p>
        </div>
      );
    }
    return (
    <div className="space-y-3 text-text-secondary mb-6 px-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2.5 h-2.5 bg-green-500 rounded-full shadow-md shadow-green-500/50"></span>
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
    <div className="glass-panel p-8 w-full max-w-sm mx-auto hover:shadow-glow-blue-light">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-2xl bg-background-dark flex items-center justify-center border border-border-color">
            <DiscordLogo className="w-9 h-9 text-white"/>
        </div>
        <div>
          <p className="text-sm text-text-secondary">
            {t('join_community')}
          </p>
          <h3 className="font-bold text-white text-lg">{serverName}</h3>
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