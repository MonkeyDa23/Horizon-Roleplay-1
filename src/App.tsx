import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LocalizationProvider } from './contexts/LocalizationContext';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { ConfigProvider } from './contexts/ConfigContext';
import { ToastProvider } from './contexts/ToastContext';
import { useConfig } from './hooks/useConfig';

import Navbar from './components/Navbar';
import Footer from './components/Footer';
import SessionWatcher from './components/SessionWatcher';

import HomePage from './pages/HomePage';
import StorePage from './pages/StorePage';
import RulesPage from './pages/RulesPage';
import AppliesPage from './pages/AppliesPage';
import AboutUsPage from './pages/AboutUsPage';
import AdminPage from './pages/AdminPage';
import QuizPage from './pages/QuizPage';
import MyApplicationsPage from './pages/MyApplicationsPage';
import ProfilePage from './pages/ProfilePage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import HealthCheckPage from './pages/HealthCheckPage';

const AppContent: React.FC = () => {
  const { config, configLoading } = useConfig();

  const backgroundStyle: React.CSSProperties =
    !configLoading && config.BACKGROUND_IMAGE_URL
      ? {
          backgroundImage: `url(${config.BACKGROUND_IMAGE_URL})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }
      : {};

  return (
    <Router>
      <SessionWatcher />
      <div 
        className="flex flex-col min-h-screen bg-brand-dark text-white font-sans app-container"
        style={backgroundStyle}
      >
        <div className="flex flex-col min-h-screen" style={{ zIndex: 1, position: 'relative', backgroundColor: config.BACKGROUND_IMAGE_URL ? 'rgba(10, 15, 24, 0.8)' : 'transparent', backdropFilter: config.BACKGROUND_IMAGE_URL ? 'blur(4px)' : 'none' }}>
          <Navbar />
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/store" element={<StorePage />} />
              <Route path="/rules" element={<RulesPage />} />
              <Route path="/applies" element={<AppliesPage />} />
              <Route path="/applies/:quizId" element={<QuizPage />} />
              <Route path="/about" element={<AboutUsPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/my-applications" element={<MyApplicationsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/health-check" element={<HealthCheckPage />} />
              <Route path="/api/auth/callback" element={<AuthCallbackPage />} />
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
    <ConfigProvider>
      <LocalizationProvider>
        <ToastProvider>
          <AuthProvider>
            <CartProvider>
              <AppContent />
            </CartProvider>
          </AuthProvider>
        </ToastProvider>
      </LocalizationProvider>
    </ConfigProvider>
  );
}

export default App;
