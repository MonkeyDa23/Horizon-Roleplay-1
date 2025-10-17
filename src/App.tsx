import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import VideoBackground from './components/VideoBackground';

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

const AdminPage = React.lazy(() => import('./pages/AdminPage'));

const AppContent: React.FC = () => {
  const { config, configLoading, configError } = useConfig();
  const { user } = useAuth();
      
  if (configLoading) {
    return (
      <div className="flex flex-col gap-4 justify-center items-center h-screen w-screen bg-brand-dark">
        <Loader2 size={48} className="text-brand-cyan animate-spin" />
        <p className="text-xl text-gray-300">Loading Community Hub...</p>
      </div>
    )
  }

  if (configError) {
    return (
       <div className="flex flex-col gap-4 justify-center items-center h-screen w-screen bg-brand-dark p-8">
          <AlertTriangle size={60} className="text-red-500" />
          <h1 className="text-3xl font-bold text-white mt-4 text-center">Configuration Error</h1>
          <p className="text-lg text-gray-300 max-w-2xl text-center">
            The application could not connect to the database to load essential settings. This usually means the database schema has not been set up yet.
          </p>
          <div className="bg-brand-dark-blue p-4 rounded-lg mt-4 max-w-2xl w-full">
            <p className="font-semibold text-brand-cyan mb-2">How to fix:</p>
            <ol className="list-decimal list-inside text-gray-300 space-y-1">
                <li>Go to your Supabase project's SQL Editor.</li>
                <li>Copy the SQL code from the `src/lib/database_schema.ts` file.</li>
                <li>Paste the code into a new query and click "RUN".</li>
            </ol>
          </div>
          <p className="text-gray-500 mt-4 text-sm">Error details: {configError.message}</p>
      </div>
    )
  }

  return (
    <Router>
      <div 
        className="flex flex-col min-h-screen text-white font-sans"
      >
        <VideoBackground />
        <div className="flex flex-col min-h-screen relative z-10 bg-brand-dark/90 backdrop-blur-sm">
          <Navbar />
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/store" element={<StorePage />} />
              <Route path="/rules" element={<RulesPage />} />
              <Route path="/applies" element={<AppliesPage />} />
              <Route path="/applies/:quizId" element={<QuizPage />} />
              <Route path="/about" element={<AboutUsPage />} />
              <Route path="/admin" element={
                <Suspense fallback={<div className="flex justify-center items-center h-full w-full py-20"><Loader2 className="animate-spin text-brand-cyan" size={48}/></div>}>
                  {user?.isAdmin ? <AdminPage /> : <Navigate to="/" />}
                </Suspense>
              } />
              <Route path="/my-applications" element={user ? <MyApplicationsPage /> : <Navigate to="/" />} />
              <Route path="/profile" element={user ? <ProfilePage /> : <Navigate to="/" />} />
              
              <Route 
                path="/health-check" 
                element={<HealthCheckPage />} 
              />
            </Routes>
          </main>
          <Footer />
        </div>
      </div>
    </Router>
  );
};


function App() {
  return (
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
  );
}

export default App;