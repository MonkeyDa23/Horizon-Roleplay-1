import React from 'react';
import { useConfig } from '../hooks/useConfig';

const Logo: React.FC<{ className?: string }> = ({ className }) => {
  const { config, configLoading } = useConfig();

  // Render a placeholder to prevent layout shift while config is loading
  if (configLoading) {
    return <div className={`${className} rounded-full bg-brand-light-blue`} style={{ aspectRatio: '1 / 1' }} />;
  }

  return (
    <img 
      src={config.LOGO_URL} 
      alt={`${config.COMMUNITY_NAME} Logo`}
      className={`${className} rounded-full object-cover border-2 border-brand-cyan/50 shadow-glow-cyan animate-pulse-slow`}
    />
  );
};

export default Logo;
