// src/pages/AdminPage.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLocalization } from '../hooks/useLocalization';
import { useNavigate } from 'react-router-dom';
import type { PermissionKey } from '../types';
import SEO from '../components/SEO';
import { UserCog, FileText, Server, BookCopy, Store, Languages, Palette, Search, ShieldCheck, ShieldQuestion } from 'lucide-react';

// Import the new layout and panel components
import AdminLayout from '../components/admin/AdminLayout';
import SubmissionsPanel from '../components/admin/SubmissionsPanel';
import QuizzesPanel from '../components/admin/QuizzesPanel';
import RulesPanel from '../components/admin/RulesPanel';
import StorePanel from '../components/admin/StorePanel';
import TranslationsPanel from '../components/admin/TranslationsPanel';
import AppearancePanel from '../components/admin/AppearancePanel';
import UserLookupPanel from '../components/admin/UserLookupPanel';
import PermissionsPanel from '../components/admin/PermissionsPanel';
import AuditLogPanel from '../components/admin/AuditLogPanel';
import AdminDashboard from '../components/admin/AdminDashboard';


export type AdminTab = 'dashboard' | 'submissions' | 'quizzes' | 'rules' | 'store' | 'translations' | 'appearance' | 'lookup' | 'permissions' | 'audit';

export const TABS: { id: AdminTab; labelKey: string; icon: React.ElementType; permission: PermissionKey }[] = [
    { id: 'dashboard', labelKey: 'dashboard', icon: UserCog, permission: 'admin_panel' },
    { id: 'submissions', labelKey: 'submission_management', icon: FileText, permission: 'admin_submissions' },
    { id: 'quizzes', labelKey: 'quiz_management', icon: Server, permission: 'admin_quizzes' },
    { id: 'rules', labelKey: 'rules_management', icon: BookCopy, permission: 'admin_rules' },
    { id: 'store', labelKey: 'store_management', icon: Store, permission: 'admin_store' },
    { id: 'translations', labelKey: 'translations_management', icon: Languages, permission: 'admin_translations' },
    { id: 'appearance', labelKey: 'appearance_settings', icon: Palette, permission: 'admin_appearance' },
    { id: 'lookup', labelKey: 'user_lookup', icon: Search, permission: 'admin_lookup'},
    { id: 'permissions', labelKey: 'permissions_management', icon: ShieldQuestion, permission: 'admin_permissions' },
    { id: 'audit', labelKey: 'audit_log', icon: ShieldCheck, permission: 'admin_audit_log' },
];

const AdminPage: React.FC = () => {
    const { t } = useLocalization();
    const { hasPermission, user, loading } = useAuth();
    const navigate = useNavigate();

    const accessibleTabs = TABS.filter(tab => hasPermission(tab.permission));
    const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

    useEffect(() => {
        if (!loading && !user) {
            navigate('/');
        }
    }, [user, loading, navigate]);
    
    useEffect(() => {
        if (!accessibleTabs.find(t => t.id === activeTab)) {
            setActiveTab(accessibleTabs[0]?.id || 'dashboard');
        }
    }, [accessibleTabs, activeTab]);

    const renderActivePanel = () => {
        switch(activeTab) {
            case 'dashboard': return <AdminDashboard />;
            case 'submissions': return <SubmissionsPanel />;
            case 'quizzes': return <QuizzesPanel />;
            case 'rules': return <RulesPanel />;
            case 'store': return <StorePanel />;
            case 'translations': return <TranslationsPanel />;
            case 'appearance': return <AppearancePanel />;
            case 'lookup': return <UserLookupPanel />;
            case 'permissions': return <PermissionsPanel />;
            case 'audit': return <AuditLogPanel />;
            default: return <AdminDashboard />;
        }
    }

    const currentTab = TABS.find(t => t.id === activeTab);

    return (
        <>
            <SEO title={`${t('admin_panel')} - ${t(currentTab?.labelKey || '')}`} noIndex={true} description="Vixel Roleplay Administration Panel"/>
            <AdminLayout 
                tabs={accessibleTabs}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                pageTitle={t(currentTab?.labelKey || '')}
                pageIcon={currentTab?.icon}
            >
                {renderActivePanel()}
            </AdminLayout>
        </>
    );
};

export default AdminPage;