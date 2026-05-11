/**
 * Nova Roleplay - Official Website
 * Main App Component
 */
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { AppProviders } from './contexts/AppProviders';
import { useConfig } from './contexts/ConfigContext';
import { useAuth } from './contexts/AuthContext';
import { CurrencyProvider } from './contexts/CurrencyContext';
import { InitialCaptchaGate } from './components/InitialCaptchaGate';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import SessionWatcher from './components/SessionWatcher';
import CosmicBackground from './components/CosmicBackground';
import PermissionWarningBanner from './components/PermissionWarningBanner';
import HomePage from './pages/HomePage';
import StorePage from './pages/StorePage';
import ProductDetailPage from './pages/ProductDetailPage';
import RulesPage from './pages/RulesPage';
import AppliesPage from './pages/AppliesPage';
import AboutUsPage from './pages/AboutUsPage';
import QuizPage from './pages/QuizPage';
import MyApplicationsPage from './pages/MyApplicationsPage';
import ProfilePage from './pages/ProfilePage';
import CharacterDetailPage from './pages/CharacterDetailPage';
import HealthCheckPage from './pages/HealthCheckPage';
import AdminPage from './pages/AdminPage';
import BannedPage from './pages/BannedPage';
import LoginErrorPage from './pages/LoginErrorPage';
import SubmissionDetailPage from './pages/SubmissionDetailPage';
import AdminGate from './components/AdminGate';
import MaintenancePage from './pages/MaintenancePage';
import TwoFactorModal from './components/auth/TwoFactorModal';
import { useLocalization } from './contexts/LocalizationContext';
import { Loader2, AlertTriangle } from 'lucide-react';
import { env } from './env';
import type { PermissionKey } from './types';

const ProtectedRoute: React.FC<{ children: React.ReactNode; permission?: PermissionKey; }> = ({ children, permission }) => {
  const { user, hasPermission, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex flex-col gap-4 justify-center items-center h-[calc(100vh-136px)] w-full">
        <Loader2 size={48} className="text-brand-cyan animate-spin" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/" replace />;
  }
  
  if (permission && !hasPermission(permission)) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const { branding, config, configLoading, configError } = useConfig();
  const { user, isInitialLoading, permissionWarning, syncError, logout, retrySync, hasPermission } = useAuth();
  const { t, dir } = useLocalization();
  const location = useLocation();

  if (isInitialLoading || configLoading) {
    return (
      <div className="flex flex-col gap-8 justify-center items-center h-screen w-screen bg-brand-dark" dir={dir}>
        <div className="w-24 h-24 bg-white/5 rounded-[32px] flex items-center justify-center border border-white/10 shadow-2xl relative">
          <div className="absolute inset-0 blur-2xl opacity-20 rounded-full" style={{ backgroundColor: branding.primaryColor }}></div>
          <Loader2 style={{ color: branding.primaryColor }} size={48} className="animate-spin relative z-10" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-black text-white mb-2">{isInitialLoading ? t('connecting') : t('loading_community_hub')}</h2>
          <p className="text-text-secondary font-medium opacity-60">{t('please_wait')}</p>
        </div>
      </div>
    );
  }

  if (configError) {
    const isMissingEnvVars = !env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_URL === 'YOUR_SUPABASE_URL';
    return (
      <div className="flex flex-col gap-6 justify-center items-center h-screen w-screen bg-brand-dark p-8 text-center" dir={dir}>
        <div className="w-24 h-24 bg-red-500/10 rounded-[32px] flex items-center justify-center border border-red-500/20 shadow-2xl">
          <AlertTriangle size={48} className="text-red-500" />
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-white mt-4">
          {isMissingEnvVars ? t('setup_incomplete') : t('db_connection_error')}
        </h1>
        <p className="text-xl text-text-secondary max-w-2xl font-medium opacity-80 leading-relaxed">
          {isMissingEnvVars ? t('missing_env_desc') : t('db_conn_error_desc') }
        </p>
        {isMissingEnvVars && (
          <div className="bg-white/[0.03] border border-white/10 p-10 rounded-[40px] mt-8 max-w-3xl w-full text-start">
            <p className="font-black text-white mb-6 text-xl flex items-center gap-3">
              <div className="w-2 h-8 rounded-full" style={{ backgroundColor: branding.primaryColor }}></div>
              {t('how_to_fix')}
            </p>
            <ol className="list-decimal list-inside text-text-secondary space-y-4 font-medium opacity-90">
              <li>{t('fix_step_1')}</li>
              <li>{t('fix_step_2')}</li>
              <li>{t('fix_step_3')}</li>
              <li>{t('fix_step_4')}</li>
              <li><strong className="text-white">{t('fix_step_5')}</strong></li>
            </ol>
          </div>
        )}
      </div>
    );
  }

  if (syncError) {
    return <LoginErrorPage error={syncError} onRetry={retrySync!} onLogout={logout} />;
  }

  if (user?.is_banned) {
    return <BannedPage reason={user.ban_reason || t('no_reason_provided')} expires_at={user.ban_expires_at} onLogout={logout} />;
  }

  // Maintenance Mode Check
  const isAdmin = user && (hasPermission('admin_panel') || hasPermission('_super_admin'));
  if (config && config.MAINTENANCE_MODE && !isAdmin) {
    return <MaintenancePage />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-brand-dark text-white font-sans relative z-10" dir={dir}>
      <TwoFactorModal />
      <Navbar />
      {permissionWarning && <PermissionWarningBanner message={permissionWarning} />}
      <main className="flex-grow pt-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<HomePage />} />
              <Route path="/store" element={<StorePage />} />
              <Route path="/store/:productId" element={<ProductDetailPage />} />
              <Route path="/rules" element={<RulesPage />} />
              <Route path="/applies" element={<AppliesPage />} />
              <Route path="/about" element={<AboutUsPage />} />
              <Route 
                path="/applies/:quizId" 
                element={<ProtectedRoute><QuizPage /></ProtectedRoute>} 
              />
              <Route 
                path="/my-applications" 
                element={<ProtectedRoute><MyApplicationsPage /></ProtectedRoute>} 
              />
              <Route 
                path="/profile" 
                element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} 
              />
              <Route 
                path="/character/:id" 
                element={<ProtectedRoute><CharacterDetailPage /></ProtectedRoute>} 
              />
              <Route 
                path="/admin" 
                element={<ProtectedRoute permission="admin_panel"><AdminGate><AdminPage /></AdminGate></ProtectedRoute>} 
              />
              <Route 
                path="/admin/submissions/:submissionId" 
                element={<ProtectedRoute permission="admin_submissions"><AdminGate><SubmissionDetailPage /></AdminGate></ProtectedRoute>} 
              />
              <Route 
                path="/health-check" 
                element={<ProtectedRoute permission="_super_admin"><HealthCheckPage /></ProtectedRoute>} 
              />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppProviders>
        <CurrencyProvider>
          <InitialCaptchaGate>
            <SessionWatcher />
            <CosmicBackground />
            <AppContent />
          </InitialCaptchaGate>
        </CurrencyProvider>
      </AppProviders>
    </BrowserRouter>
  );
};

export default App;
