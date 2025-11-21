
// src/pages/AdminPage.tsx
import React, { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocalization } from '../contexts/LocalizationContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { PermissionKey } from '../types';
import SEO from '../components/SEO';
import { UserCog, FileText, Server, BookCopy, Store, Languages, Palette, Search, ShieldCheck, ShieldQuestion, Bell, LayoutGrid, Users } from 'lucide-react';
import { logAdminPageVisit, sendDiscordLog } from '../lib/api'; 
import { useConfig } from '../contexts/ConfigContext';

// Import Panels
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
import WidgetsPanel from '../components/admin/WidgetsPanel'; 
import StaffPanel from '../components/admin/StaffPanel'; 

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
    const { config } = useConfig();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    
    // Get active tab from URL or default to dashboard
    const activeTab = (searchParams.get('tab') as AdminTab) || 'dashboard';
    
    const accessibleTabs = TABS.filter(tab => hasPermission(tab.permission));

    useEffect(() => {
        if (!loading && !user) navigate('/');
    }, [user, loading, navigate]);
    
    useEffect(() => {
        // If current tab is not accessible, redirect to first accessible tab
        if (accessibleTabs.length > 0 && !accessibleTabs.find(t => t.id === activeTab)) {
            setSearchParams({ tab: accessibleTabs[0].id });
        }
    }, [accessibleTabs, activeTab, setSearchParams]);
    
    const setActiveTab = (tab: AdminTab) => {
        setSearchParams({ tab });
    };

    // --- AUDIT TRAIL: LOG ADMIN NAVIGATION ---
    // Using a ref to prevent double logging on mount due to StrictMode
    const lastLoggedTab = useRef<string | null>(null);

    useEffect(() => {
        if (user && hasPermission('admin_panel') && activeTab !== lastLoggedTab.current) {
            lastLoggedTab.current = activeTab;
            const pageName = TABS.find(t => t.id === activeTab)?.labelKey || activeTab;
            const translatedPage = t(pageName);
            
            // 1. Log to Database
            logAdminPageVisit(translatedPage).catch(err => console.error("Failed to log visit:", err));
            
            // 2. Log to Discord (Admin Channel) - Stealthy navigation log
            const embed = {
                title: "👀 تصفح لوحة التحكم",
                description: `قام المشرف **${user.username}** بالانتقال إلى صفحة: **${translatedPage}**`,
                color: 0x95A5A6, // Greyish
                author: { name: user.username, icon_url: user.avatar },
                timestamp: new Date().toISOString(),
                footer: { text: "نظام المراقبة" }
            };
            // Use 'admin' log type which maps to log_channel_admin
            sendDiscordLog(config, embed, 'admin').catch(console.error);
        }
    }, [activeTab, user, hasPermission, config, t]);

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
