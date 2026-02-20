import React from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import { useConfig } from '../contexts/ConfigContext';
import DiscordLogo from './icons/DiscordLogo';

const Footer: React.FC = () => {
  const { t } = useLocalization();
  const { config, configLoading } = useConfig();

  const year = new Date().getFullYear();
  const communityName = configLoading ? 'Vixel Roleplay' : config.COMMUNITY_NAME;

  return (
    <footer className="relative mt-24 border-t border-border-color">
      <div className="absolute top-0 left-0 w-full h-full bg-background-light/30 backdrop-blur-sm"></div>
      <div className="container relative mx-auto px-6 py-8 flex flex-col sm:flex-row justify-between items-center text-center sm:text-start gap-4">
        <p className="text-text-secondary text-sm">{t('footer_rights', { year, communityName })}</p>
        <div className="flex items-center gap-4">
          <a href={config.DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer" className="text-text-secondary hover:text-white transition-colors duration-300 p-2 rounded-full hover:bg-primary-blue/20">
            <DiscordLogo className="w-6 h-6" />
          </a>
          {/* Add more social links here if needed */}
        </div>
      </div>
    </footer>
  );
};

export default Footer;