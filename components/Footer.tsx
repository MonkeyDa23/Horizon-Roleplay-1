

import React from 'react';
// FIX: Updated import path to point to the 'src' directory.
import { useLocalization } from '../src/hooks/useLocalization';
// FIX: Switched from deprecated static CONFIG to the useConfig hook.
import { useConfig } from '../src/hooks/useConfig';
import { Disc3 } from 'lucide-react'; // Using Disc3 for Discord icon

const Footer: React.FC = () => {
  const { t } = useLocalization();
  // FIX: Get config from the context provider.
  const { config } = useConfig();

  return (
    <footer className="bg-brand-dark-blue border-t border-brand-light-blue/50 mt-16">
      <div className="container mx-auto px-6 py-6 flex flex-col sm:flex-row justify-between items-center text-center sm:text-start">
        <p className="text-gray-400 text-sm">{t('footer_rights')}</p>
        <div className="flex items-center gap-4 mt-4 sm:mt-0">
          <a href={config.DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-brand-cyan transition-colors">
            <Disc3 size={24} />
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;