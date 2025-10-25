// src/components/admin/StorePanel.tsx
import React from 'react';
import { useLocalization } from '../../hooks/useLocalization';

const StorePanel: React.FC = () => {
    const { t } = useLocalization();
    // This panel's logic will be implemented in a future update.
    return (
        <div className="bg-brand-dark-blue p-8 rounded-lg border border-brand-light-blue/50 animate-fade-in-up">
            <p className="text-center text-gray-400 py-10">{t('coming_soon')}</p>
        </div>
    );
};

export default StorePanel;
