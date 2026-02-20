// src/components/admin/AdminDashboard.tsx
import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocalization } from '../../contexts/LocalizationContext';

const AdminDashboard: React.FC = () => {
    const { user } = useAuth();
    const { t } = useLocalization();

    return (
        <div className="bg-brand-dark-blue p-8 rounded-lg border border-brand-light-blue/50 animate-fade-in-up">
            <h2 className="text-3xl font-bold text-white mb-2">{t('welcome')}, {user?.username}!</h2>
            <p className="text-gray-300">{t('admin_dashboard_welcome_message', {})}</p>
        </div>
    );
};

export default AdminDashboard;