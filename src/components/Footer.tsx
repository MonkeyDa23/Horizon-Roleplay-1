import React from 'react';
import { useLocalization } from '../hooks/useLocalization';
import { useConfig } from '../hooks/useConfig';
import DiscordLogo from './icons/DiscordLogo';

const Footer: React.FC = () => {
  const { t } = useLocalization();
  const { config, configLoading } = useConfig();

  const year = new Date().getFullYear();
  const communityName = configLoading ? 'Horizon' : config.COMMUNITY_NAME;

  return (
    <footer className="bg-brand-dark-blue border-t border-brand-light-blue/50 mt-16">
      <div className="container mx-auto px-6 py-6 flex flex-col sm:flex-row justify-between items-center text-center sm:text-start">
        <p className="text-gray-400 text-sm">{t('footer_rights', { year, communityName })}</p>
        <div className="flex items-center gap-4 mt-4 sm:mt-0">
          <a href={config.DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
            <DiscordLogo className="w-7 h-7" />
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;