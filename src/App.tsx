// src/App.tsx
import React from 'react';
// FIX: Switched to named imports for react-router-dom components as per standard usage.
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LocalizationProvider } from './contexts/LocalizationContext';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { ConfigProvider } from './contexts/ConfigContext';
import { ToastProvider } from './contexts/ToastContext';
import { useConfig } from './hooks/useConfig';
import { useAuth } from './hooks/useAuth';
import { TranslationsProvider } from './contexts/TranslationsContext';
import { AdminGateProvider } from './contexts/AdminGateContext'; // New
import AdminGate from './components/AdminGate'; // New

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
import HealthCheckPage from './pages/HealthCheckPage';
import AdminPage from './pages/AdminPage';
import BannedPage from './pages/BannedPage';
import LoginErrorPage from './pages/LoginErrorPage';


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
      // FIX: Use named import 'Navigate' instead of 'ReactRouterDOM.Navigate'.
      return <Navigate to="/" replace />;
  }

  if (permission && !hasPermission(permission)) {
      // FIX: Use named import 'Navigate' instead of 'ReactRouterDOM.Navigate'.
      return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
  
const AppContent: React.FC = () => {
  const { config, configLoading, configError } = useConfig();
  const { user, loading: authLoading, permissionWarning, syncError, logout, retrySync } = useAuth();
  
  if (authLoading || configLoading) {
    return (
      <div className="flex flex-col gap-4 justify-center items-center h-screen w-screen bg-brand-dark">
        <Loader2 size={48} className="text-brand-cyan animate-spin" />
        <p className="text-xl text-gray-300">
            {authLoading ? 'Connecting...' : 'Loading Community Hub...'}
        </p>
      </div>
    )
  }

  if (configError) {
    const isMissingEnvVars = !env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_URL === 'YOUR_SUPABASE_URL';

    return (
       <div className="flex flex-col gap-4 justify-center items-center h-screen w-screen bg-brand-dark p-8">
          <AlertTriangle size={60} className="text-yellow-400" />
          <h1 className="text-3xl font-bold text-white mt-4 text-center">
            {isMissingEnvVars ? 'Environment Setup Incomplete' : 'Database Connection Error'}
          </h1>
          <p className="text-lg text-gray-300 max-w-3xl text-center">
            {isMissingEnvVars 
              ? "The application is missing essential Supabase credentials. Please follow the steps below to connect to your database."
              : "The application could not connect to the database to load essential settings. This usually means the database schema has not been set up yet."
            }
          </p>
          
          {isMissingEnvVars ? (
            <div className="bg-brand-dark-blue p-6 rounded-lg mt-4 max-w-3xl w-full text-left">
              <p className="font-semibold text-brand-cyan mb-3 text-lg">How to fix:</p>
              <ol className="list-decimal list-inside text-gray-200 space-y-2">
                  <li>In your Supabase project, go to <strong className="text-white">Project Settings {'>'} API</strong>.</li>
                  <li>In the root of this project, find the file named <code className="bg-brand-dark px-2 py-1 rounded">.env.example</code>.</li>
                  <li>Create a copy of this file and rename it to <code className="bg-brand-dark px-2 py-1 rounded">.env</code>.</li>
                  <li>Paste your <strong className="text-white">Project URL</strong> and <strong className="text-white">anon public API Key</strong> into the <code className="bg-brand-dark px-2 py-1 rounded">.env</code> file.</li>
                  <li><strong className="text-white">Restart the development server</strong> to apply the changes.</li>
              </ol>
            </div>
          ) : (
            <div className="bg-brand-dark-blue p-4 rounded-lg mt-4 max-w-2xl w-full">
              <p className="font-semibold text-brand-cyan mb-2">How to fix:</p>
              <ol className="list-decimal list-inside text-gray-300 space-y-1">
                  <li>Go to your Supabase project's SQL Editor.</li>
                  <li>Copy the SQL code from the <code className="bg-brand-dark px-1 rounded">src/lib/database_schema.ts</code> file.</li>
                  <li>Paste the code into a new query and click "RUN".</li>
              </ol>
            </div>
          )}
          
          <p className="text-gray-500 mt-4 text-sm">Error details: {configError.message}</p>
      </div>
    )
  }

  if (syncError) {
    return <LoginErrorPage error={syncError} onRetry={retrySync!} onLogout={logout} />;
  }

  if (user?.is_banned) {
    return <BannedPage reason={user.ban_reason || 'No reason specified'} expires_at={user.ban_expires_at} onLogout={logout} />;
  }

  return (
      <div 
        className="flex flex-col min-h-screen text-white font-sans"
        style={{ 
          backgroundImage: config.BACKGROUND_IMAGE_URL ? `url(${config.BACKGROUND_IMAGE_URL})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }}
      >
        <CosmicBackground />
        <div className="flex flex-col min-h-screen relative z-10 bg-brand-dark/90">
          <Navbar />
          {permissionWarning && <PermissionWarningBanner message={permissionWarning} />}
          <main className="flex-grow">
            {/* FIX: Use named import 'Routes' and 'Route' instead of 'ReactRouterDOM.*'. */}
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/store" element={<ProtectedRoute permission="page_store"><StorePage /></ProtectedRoute>} />
              <Route path="/store/:productId" element={<ProtectedRoute permission="page_store"><ProductDetailPage /></ProtectedRoute>} />
              <Route path="/rules" element={<ProtectedRoute permission="page_rules"><RulesPage /></ProtectedRoute>} />
              <Route path="/applies" element={<ProtectedRoute permission="page_applies"><AppliesPage /></ProtectedRoute>} />
              <Route path="/applies/:quizId" element={<ProtectedRoute permission="page_applies"><QuizPage /></ProtectedRoute>} />
              <Route path="/about" element={<AboutUsPage />} />
              <Route path="/admin" element={
                <ProtectedRoute permission="admin_panel">
                  <AdminGate>
                    <AdminPage />
                  </AdminGate>
                </ProtectedRoute>
              } />
              <Route path="/my-applications" element={
                <ProtectedRoute>
                  <MyApplicationsPage />
                </ProtectedRoute>
              }/>
              <Route path="/profile" element={
                 <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              } />
              
              {config.SHOW_HEALTH_CHECK && (
                <Route 
                  path="/health-check" 
                  element={
                     <ProtectedRoute permission="_super_admin">
                        <HealthCheckPage />
                     </ProtectedRoute>
                  }
                />
              )}
              {/* Fallback route for any undefined paths */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </div>
  );
};


function App() {
  return (
    // FIX: Use named import 'BrowserRouter' instead of 'ReactRouterDOM.BrowserRouter'.
    <BrowserRouter>
      <TranslationsProvider>
        <LocalizationProvider>
          <ToastProvider>
            <ConfigProvider>
              <AuthProvider>
                <AdminGateProvider>
                  <CartProvider>
                    <AppContent />
                    <SessionWatcher />
                  </CartProvider>
                </AdminGateProvider>
              </AuthProvider>
            </ConfigProvider>
          </ToastProvider>
        </LocalizationProvider>
      </TranslationsProvider>
    </BrowserRouter>
  );
}

export default App;