import React, { useState, useEffect } from 'react';
import Logo from './Logo';
import { useLocalization } from '../hooks/useLocalization';
import { useConfig } from '../hooks/useConfig';
// This would need a serverless function, we'll mock it for now.
// import { getDiscordStats } from '../lib/api'; 
import { Loader2, AlertTriangle } from 'lucide-react';
import DiscordLogo from './icons/DiscordLogo';

const DiscordEmbed: React.FC = () => {
  const { t } = useLocalization();
  const { config, configLoading } = useConfig();
  
  // MOCK DATA until a serverless function is created for stats
  const [onlineMembers] = useState(1234);
  const [totalMembers] = useState(5678);
  const [isLoading] = useState(false);
  const [error] = useState<string | null>(null);

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
    return (
    <div className="space-y-2 text-gray-300 mb-4 px-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
          <span>
            {onlineMembers.toLocaleString()} {t('discord_online')}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2.s h-2.5 bg-gray-500 rounded-full"></span>
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
    </div>
  );
};

export default DiscordEmbed;