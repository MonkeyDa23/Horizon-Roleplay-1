import React from 'react';
import { useConfig } from '../hooks/useConfig';

const Logo: React.FC<{ className?: string }> = ({ className }) => {
  const { config, configLoading } = useConfig();

  // Render a placeholder to prevent layout shift while config is loading
  if (configLoading) {
    return <div className={className} style={{ aspectRatio: '1 / 1' }} />;
  }

  return (
    <img 
      src={config.LOGO_URL} 
      alt={`${config.COMMUNITY_NAME} Logo`}
      className={className} 
    />
  );
};

export default Logo;