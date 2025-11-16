// src/components/PermissionWarningBanner.tsx
import React from 'react';
// FIX: Switched to namespace import for react-router-dom to resolve module resolution issues.
import * as ReactRouterDOM from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useLocalization } from '../contexts/LocalizationContext';

interface PermissionWarningBannerProps {
    message: string;
}

const PermissionWarningBanner: React.FC<PermissionWarningBannerProps> = ({ message }) => {
  const { t } = useLocalization();

  return (
    <div className="bg-yellow-500/20 border-b-2 border-yellow-500/50 text-yellow-200 p-3 sticky top-[68px] z-40">
      <div className="container mx-auto flex items-center gap-4">
        <AlertTriangle className="h-8 w-8 flex-shrink-0" />
        <div className="text-sm font-semibold">
          <p>{message}</p>
          {/* FIX: Use namespace import 'ReactRouterDOM.Link'. */}
          <ReactRouterDOM.Link to="/health-check" className="underline hover:text-white font-bold">
            {t('health_check_banner_link')}
          </ReactRouterDOM.Link>
        </div>
      </div>
    </div>
  );
};

export default PermissionWarningBanner;