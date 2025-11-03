// src/pages/AdminPage.tsx
import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import * as ReactRouterDOM from 'react-router-dom';
import { useLocalization } from '../hooks/useLocalization';
import AdminLayout from '../components/admin/AdminLayout';
import AdminDashboard from '../components/admin/AdminDashboard';
import SubmissionsPanel from '../components/admin/SubmissionsPanel';
import QuizzesPanel from '../components/admin/QuizzesPanel';
import RulesPanel from '../components/admin/RulesPanel';
import StorePanel from '../components/admin/StorePanel';
import AuditLogPanel from '../components/admin/AuditLogPanel';
import PermissionsPanel from '../components/admin/PermissionsPanel';
import AppearancePanel from '../components/admin/AppearancePanel';
import TranslationsPanel from '../components/admin/TranslationsPanel';
import UserLookupPanel from '../components/admin/UserLookupPanel';
import NotificationsPanel from '../components/admin/NotificationsPanel';
import WidgetsPanel from '../components/admin/WidgetsPanel';

import { 
    LayoutDashboard, FileText, Server, BookCopy, Store, ShieldCheck, 
    Shield, Palette, Languages, Search, Bell, Blocks 
} from 'lucide-react';
import type { PermissionKey } from '../types';

export type AdminTab = 'dashboard' | 'submissions' | 'quizzes' | 'rules' | 'store' | 'audit' | 'permissions' | 'appearance' | 'translations' | 'lookup' | 'notifications' | 'widgets';

const AdminPage: React.FC = () => {
    const { hasPermission } = useAuth();
    const navigate = ReactRouterDOM.useNavigate();
    const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
    const { t } = useLocalization();

    const TABS: { id: AdminTab; labelKey: string; icon: React.ElementType; permission: PermissionKey }[] = [
        { id: 'dashboard', labelKey: 'dashboard', icon: LayoutDashboard, permission: 'admin_panel' },
        { id: 'submissions', labelKey: 'submission_management', icon: FileText, permission: 'admin_submissions' },
        { id: 'quizzes', labelKey: 'quiz_management', icon: Server, permission: 'admin_quizzes' },
        { id: 'rules', labelKey: 'rules_management', icon: BookCopy, permission: 'admin_rules' },
        { id: 'store', labelKey: 'store_management', icon: Store, permission: 'admin_store' },
        { id: 'widgets', labelKey: 'widgets_management', icon: Blocks, permission: 'admin_widgets' },
        { id: 'notifications', labelKey: 'notification_management', icon: Bell, permission: 'admin_notifications' },
        { id: 'translations', labelKey: 'translations_management', icon: Languages, permission: 'admin_translations' },
        { id: 'appearance', labelKey: 'appearance_settings', icon: Palette, permission: 'admin_appearance' },
        { id: 'permissions', labelKey: 'permissions_management', icon: Shield, permission: 'admin_permissions' },
        { id: 'lookup', labelKey: 'user_lookup', icon: Search, permission: 'admin_lookup' },
        { id: 'audit', labelKey: 'audit_log', icon: ShieldCheck, permission: 'admin_audit_log' },
    ];
    
    // Security check on component mount
    React.useEffect(() => {
        if (!hasPermission('admin_panel')) {
            navigate('/');
        }
    }, [hasPermission, navigate]);

    const availableTabs = TABS.filter(tab => hasPermission(tab.permission));
    const currentTabInfo = availableTabs.find(tab => tab.id === activeTab) || availableTabs[0];

    const renderActivePanel = () => {
        switch (activeTab) {
            case 'dashboard': return <AdminDashboard />;
            case 'submissions': return <SubmissionsPanel />;
            case 'quizzes': return <QuizzesPanel />;
            case 'rules': return <RulesPanel />;
            case 'store': return <StorePanel />;
            case 'audit': return <AuditLogPanel />;
            case 'permissions': return <PermissionsPanel />;
            case 'appearance': return <AppearancePanel />;
            case 'translations': return <TranslationsPanel />;
            case 'lookup': return <UserLookupPanel />;
            case 'notifications': return <NotificationsPanel />;
            case 'widgets': return <WidgetsPanel />;
            default: return <AdminDashboard />;
        }
    };
    
    return (
        <AdminLayout 
            tabs={availableTabs}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            pageTitle={t(currentTabInfo.labelKey)}
            pageIcon={currentTabInfo.icon}
        >
            {renderActivePanel()}
        </AdminLayout>
    );
};

export default AdminPage;