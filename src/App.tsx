import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LocalizationProvider } from './contexts/LocalizationContext';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { ToastProvider } from './contexts/ToastContext';
import { ConfigProvider } from './contexts/ConfigContext';

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
import HealthCheckPage from './pages/HealthCheckPage';
import AuthCallbackPage from './pages/AuthCallbackPage';

const App: React.FC = () => {
  return (
    <LocalizationProvider>
      <ConfigProvider>
        <AuthProvider>
          <CartProvider>
            <BrowserRouter>
              <ToastProvider>
                <div className="bg-brand-dark min-h-screen text-white font-sans">
                  <Navbar />
                  <SessionWatcher />
                  <main>
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
                      <Route path="/health" element={<HealthCheckPage />} />
                      <Route path="/auth/callback" element={<AuthCallbackPage />} />
                    </Routes>
                  </main>
                  <Footer />
                </div>
              </ToastProvider>
            </BrowserRouter>
          </CartProvider>
        </AuthProvider>
      </ConfigProvider>
    </LocalizationProvider>
  );
};

export default App;
