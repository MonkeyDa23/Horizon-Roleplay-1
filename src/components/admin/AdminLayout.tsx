// src/components/admin/AdminLayout.tsx
import React from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import type { AdminTab } from '../../pages/AdminPage';
import type { PermissionKey } from '../../types';

interface AdminLayoutProps {
    children: React.ReactNode;
    tabs: { id: AdminTab; labelKey: string; icon: React.ElementType; permission: PermissionKey }[];
    activeTab: AdminTab;
    setActiveTab: (tab: AdminTab) => void;
    pageTitle: string;
    pageIcon?: React.ElementType;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, tabs, activeTab, setActiveTab, pageTitle, pageIcon: PageIcon }) => {
    const { t } = useLocalization();

    return (
        <div className="container mx-auto px-6 py-12">
            <div className="md:flex md:gap-8">
                {/* Sidebar Navigation */}
                <aside className="w-full md:w-64 flex-shrink-0 mb-8 md:mb-0">
                    <div className="bg-brand-dark-blue p-4 rounded-lg border border-brand-light-blue/50 sticky top-24">
                        <h2 className="text-xl font-bold mb-4 px-2 text-white">{t('admin_panel')}</h2>
                        <nav className="space-y-2">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition-colors ${
                                        activeTab === tab.id
                                            ? 'bg-brand-cyan/20 text-brand-cyan'
                                            : 'text-gray-300 hover:bg-brand-light-blue hover:text-white'
                                    }`}
                                >
                                    <tab.icon size={20} />
                                    <span>{t(tab.labelKey)}</span>
                                </button>
                            ))}
                        </nav>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 min-w-0">
                   <div className="flex items-center gap-4 mb-6">
                        {PageIcon && <div className="p-3 bg-brand-light-blue rounded-lg"><PageIcon className="text-brand-cyan" size={28} /></div>}
                        <h1 className="text-3xl md:text-4xl font-bold">{pageTitle}</h1>
                   </div>
                   {children}
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;