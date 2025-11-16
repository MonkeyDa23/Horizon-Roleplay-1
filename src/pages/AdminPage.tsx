// src/pages/AdminPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocalization } from '../contexts/LocalizationContext';
// FIX: Switched to namespace import for react-router-dom to resolve module resolution issues.
import * as ReactRouterDOM from 'react-router-dom';
import type { PermissionKey } from '../types';
import SEO from '../components/SEO';
import { UserCog, FileText, Server, BookCopy, Store, Languages, Palette, Search, ShieldCheck, ShieldQuestion, Bell, LayoutGrid, Users } from 'lucide-react';
import { logAdminPageVisit } from '../lib/api'; // Import the new logging function

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
import NotificationsPanel from '../components/admin/NotificationsPanel';
import WidgetsPanel from '../components/admin/WidgetsPanel'; // New Import
import StaffPanel from '../components/admin/StaffPanel'; // New Staff Panel Import


export type AdminTab = 'dashboard' | 'submissions' | 'quizzes' | 'rules' | 'store' | 'translations' | 'appearance' | 'lookup' | 'permissions' | 'audit' | 'notifications' | 'widgets' | 'staff';

export const TABS: { id: AdminTab; labelKey: string; icon: React.ElementType; permission: PermissionKey }[] = [
    { id: 'dashboard', labelKey: 'dashboard', icon: UserCog, permission: 'admin_panel' },
    { id: 'submissions', labelKey: 'submission_management', icon: FileText, permission: 'admin_submissions' },
    { id: 'quizzes', labelKey: 'quiz_management', icon: Server, permission: 'admin_quizzes' },
    { id: 'rules', labelKey: 'rules_management', icon: BookCopy, permission: 'admin_rules' },
    { id: 'store', labelKey: 'store_management', icon: Store, permission: 'admin_store' },
    { id: 'staff', labelKey: 'staff_management', icon: Users, permission: 'admin_staff' },
    { id: 'notifications', labelKey: 'notifications_management', icon: Bell, permission: 'admin_notifications' },
    { id: 'translations', labelKey: 'translations_management', icon: Languages, permission: 'admin_translations' },
    { id: 'appearance', labelKey: 'appearance_settings', icon: Palette, permission: 'admin_appearance' },
    { id: 'widgets', labelKey: 'widgets_management', icon: LayoutGrid, permission: 'admin_widgets' },
    { id: 'lookup', labelKey: 'user_lookup', icon: Search, permission: 'admin_lookup'},
    { id: 'permissions', labelKey: 'permissions_management', icon: ShieldQuestion, permission: 'admin_permissions' },
    { id: 'audit', labelKey: 'audit_log', icon: ShieldCheck, permission: 'admin_audit_log' },
];

const AdminPage: React.FC = () => {
    const { t } = useLocalization();
    const { hasPermission, user, loading } = useAuth();
    // FIX: Use namespace import 'ReactRouterDOM.useNavigate'.
    const navigate = ReactRouterDOM.useNavigate();
    const hasLoggedVisit = useRef(false);

    const accessibleTabs = TABS.filter(tab => hasPermission(tab.permission));
    const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

    useEffect(() => {
        if (!loading && !user) {
            navigate('/');
        }
    }, [user, loading, navigate]);
    
    useEffect(() => {
        if (accessibleTabs.length > 0 && !accessibleTabs.find(t => t.id === activeTab)) {
            setActiveTab(accessibleTabs[0].id);
        }
    }, [accessibleTabs, activeTab]);
    
    // NEW: Effect to log page visits within the admin panel
    useEffect(() => {
        if (user && hasPermission('admin_panel')) {
            // Avoid logging the initial "dashboard" load as a separate action from "Accessed Admin Panel"
            if (activeTab === 'dashboard' && !hasLoggedVisit.current) {
                hasLoggedVisit.current = true;
                return;
            }
            logAdminPageVisit(activeTab).catch(err => console.error("Failed to log page visit:", err));
        }
    }, [activeTab, user, hasPermission]);

    const renderActivePanel = () => {
        switch(activeTab) {
            case 'dashboard': return <AdminDashboard />;
            case 'submissions': return <SubmissionsPanel />;
            case 'quizzes': return <QuizzesPanel />;
            case 'rules': return <RulesPanel />;
            case 'store': return <StorePanel />;
            case 'staff': return <StaffPanel />;
            case 'notifications': return <NotificationsPanel />;
            case 'translations': return <TranslationsPanel />;
            case 'appearance': return <AppearancePanel />;
            case 'widgets': return <WidgetsPanel />;
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