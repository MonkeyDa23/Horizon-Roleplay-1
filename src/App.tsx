
// src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProviders } from './contexts/AppProviders';
import { useConfig } from './contexts/ConfigContext';
import { useAuth } from './contexts/AuthContext';


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
import LinkAccountPage from './pages/LinkAccountPage';
import AdminPage from './pages/AdminPage';
import BannedPage from './pages/BannedPage';
import LoginErrorPage from './pages/LoginErrorPage';
import SubmissionDetailPage from './pages/SubmissionDetailPage'; // New Import
import AdminGate from './components/AdminGate';


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
  const { config, configLoading, configError } = useConfig();
  const { user, isInitialLoading, loading, permissionWarning, syncError, logout, retrySync } = useAuth();
  
  if (isInitialLoading || configLoading) {
    return (
      <div className="flex flex-col gap-4 justify-center items-center h-screen w-screen bg-brand-dark">
        <Loader2 size={48} className="text-brand-cyan animate-spin" />
        <p className="text-xl text-gray-300">
            {isInitialLoading ? 'Connecting...' : 'Loading Community Hub...'}
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
            <p className="text-gray-400 mt-4">Please run the database schema script in your Supabase SQL Editor to initialize the required tables and functions.</p>
          )}

       </div>
    );
  }

  if (syncError) {
    return <LoginErrorPage error={syncError} onRetry={retrySync!} onLogout={logout} />;
  }

  if (user?.is_banned) {
    return <BannedPage reason={user.ban_reason || 'No reason provided.'} expires_at={user.ban_expires_at} onLogout={logout} />;
  }
  
  return (
    <div className="flex flex-col min-h-screen bg-brand-dark text-white font-sans relative z-10">
      <Navbar />
      {permissionWarning && <PermissionWarningBanner message={permissionWarning} />}
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/store" element={<StorePage />} />
          <Route path="/store/:productId" element={<ProductDetailPage />} />
          <Route path="/rules" element={<RulesPage />} />
          <Route path="/applies" element={<AppliesPage />} />
          <Route path="/about" element={<AboutUsPage />} />
          <Route path="/applies/:quizId" element={<ProtectedRoute><QuizPage /></ProtectedRoute>} />
          <Route path="/my-applications" element={<ProtectedRoute><MyApplicationsPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/link-account" element={<ProtectedRoute><LinkAccountPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute permission="admin_panel"><AdminGate><AdminPage /></AdminGate></ProtectedRoute>} />
          <Route path="/admin/submissions/:submissionId" element={<ProtectedRoute permission="admin_submissions"><AdminGate><SubmissionDetailPage /></AdminGate></ProtectedRoute>} />
          <Route path="/health-check" element={<ProtectedRoute permission="_super_admin"><HealthCheckPage /></ProtectedRoute>} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

const App: React.FC = () => {
  return (
    <BrowserRouter>
        <AppProviders>
            <SessionWatcher />
            <CosmicBackground />
            <AppContent />
        </AppProviders>
    </BrowserRouter>
  );
};

export default App;
