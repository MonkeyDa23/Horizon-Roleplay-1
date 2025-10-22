import React, { Suspense } from 'react';
// FIX: Switched from a namespace import to named imports to resolve component errors.
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LocalizationProvider } from './contexts/LocalizationContext';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { ConfigProvider } from './contexts/ConfigContext';
import { ToastProvider } from './contexts/ToastContext';
import { useConfig } from './hooks/useConfig';
import { useAuth } from './hooks/useAuth';

import Navbar from './components/Navbar';
import Footer from './components/Footer';
import SessionWatcher from './components/SessionWatcher';
import HexagonBackground from './components/HexagonBackground';

import HomePage from './pages/HomePage';
import StorePage from './pages/StorePage';
import RulesPage from './pages/RulesPage';
import AppliesPage from './pages/AppliesPage';
import AboutUsPage from './pages/AboutUsPage';
import QuizPage from './pages/QuizPage';
import MyApplicationsPage from './pages/MyApplicationsPage';
import ProfilePage from './pages/ProfilePage';
import HealthCheckPage from './pages/HealthCheckPage';
import { Loader2, AlertTriangle } from 'lucide-react';
import { TranslationsProvider } from './contexts/TranslationsContext';

const AdminPage = React.lazy(() => import('./pages/AdminPage'));

const AppContent: React.FC = () => {
  const { config, configLoading, configError } = useConfig();
  const { user, hasPermission } = useAuth();
      
  if (configLoading) {
    return (
      <div className="flex flex-col gap-4 justify-center items-center h-screen w-screen bg-brand-dark">
        <Loader2 size={48} className="text-brand-cyan animate-spin" />
        <p className="text-xl text-gray-300">Loading Community Hub...</p>
      </div>
    )
  }

  if (configError) {
    const isMissingEnvVars = configError.message === 'Supabase not configured';

    return (
       <div className="flex flex-col gap-4 justify-center items-center h-screen w-screen bg-brand-dark p-8">
          <AlertTriangle size={60} className="text-yellow-400" />
          <h1 className="text-3xl font-bold text-white mt-4 text-center">
            {isMissingEnvVars ? 'Environment Setup Incomplete' : 'Configuration Error'}
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
                  <li>Create a new file named <code className="bg-brand-dark px-2 py-1 rounded">.env</code> in the root directory of this project.</li>
                  <li>Copy the contents of the <code className="bg-brand-dark px-2 py-1 rounded">.env.example</code> file into your new <code className="bg-brand-dark px-2 py-1 rounded">.env</code> file.</li>
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

  return (
    <BrowserRouter>
      <div 
        className="flex flex-col min-h-screen text-white font-sans"
        style={{ 
          backgroundImage: config.BACKGROUND_IMAGE_URL ? `url(${config.BACKGROUND_IMAGE_URL})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }}
      >
        <HexagonBackground />
        <div className="flex flex-col min-h-screen relative z-10 bg-brand-dark/90 backdrop-blur-sm">
          <Navbar />
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<HomePage />} />
              {hasPermission('page_store') && <Route path="/store" element={<StorePage />} />}
              {hasPermission('page_rules') && <Route path="/rules" element={<RulesPage />} />}
              {hasPermission('page_applies') && <Route path="/applies" element={<AppliesPage />} />}
              {hasPermission('page_applies') && <Route path="/applies/:quizId" element={<QuizPage />} />}
              <Route path="/about" element={<AboutUsPage />} />
              {hasPermission('admin_panel') && (
                <Route path="/admin" element={
                  <Suspense fallback={<div className="flex justify-center items-center h-full w-full py-20"><Loader2 className="animate-spin text-brand-cyan" size={48}/></div>}>
                    <AdminPage />
                  </Suspense>
                } />
              )}
              <Route path="/my-applications" element={user ? <MyApplicationsPage /> : <Navigate to="/" />} />
              <Route path="/profile" element={user ? <ProfilePage /> : <Navigate to="/" />} />
              
              {config.SHOW_HEALTH_CHECK && (
                <Route 
                  path="/health-check" 
                  element={<HealthCheckPage />} 
                />
              )}
              {/* Fallback route for any undefined paths */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </div>
    </BrowserRouter>
  );
};


function App() {
  return (
    <TranslationsProvider>
      <LocalizationProvider>
        <ToastProvider>
          <ConfigProvider>
            <AuthProvider>
              <CartProvider>
                <AppContent />
                <SessionWatcher />
              </CartProvider>
            </AuthProvider>
          </ConfigProvider>
        </ToastProvider>
      </LocalizationProvider>
    </TranslationsProvider>
  );
}

export default App;