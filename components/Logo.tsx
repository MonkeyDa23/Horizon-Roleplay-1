
import React from 'react';
// FIX: Switched from deprecated static CONFIG to the useConfig hook.
import { useConfig } from '../src/hooks/useConfig';

const Logo: React.FC<{ className?: string }> = ({ className }) => {
  // FIX: Get config from the context provider.
  const { config } = useConfig();
  return (
    <img 
      src={config.LOGO_URL} 
      alt="Horizon Roleplay Logo" 
      className={className} 
    />
  );
};

export default Logo;