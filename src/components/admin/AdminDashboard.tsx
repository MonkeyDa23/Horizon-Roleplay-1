// src/components/admin/AdminDashboard.tsx
import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocalization } from '../../contexts/LocalizationContext';

const AdminDashboard: React.FC = () => {
    const { user } = useAuth();
    const { t } = useLocalization();

    return (
        <div className="bg-white/[0.03] p-12 rounded-[50px] border border-white/10 animate-fade-in-up relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-cyan/20 to-transparent"></div>
            <h2 className="text-5xl font-black text-white mb-4 tracking-tighter">{t('welcome')}, {user?.username}!</h2>
            <p className="text-text-secondary text-xl font-medium opacity-80">{t('admin_dashboard_welcome_message', {})}</p>
        </div>
    );
};

export default AdminDashboard;