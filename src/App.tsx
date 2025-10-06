import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LocalizationProvider } from './contexts/LocalizationContext';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { ToastProvider } from './contexts/ToastContext';

import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import StorePage from './pages/StorePage';
import RulesPage from './pages/RulesPage';
import AppliesPage from './pages/AppliesPage';
import AboutUsPage from './pages/AboutUsPage';
import AdminPage from './pages/AdminPage';
import QuizPage from './pages/QuizPage';
import MyApplicationsPage from './pages/MyApplicationsPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import ProfilePage from './pages/ProfilePage';
import HealthCheckPage from './pages/HealthCheckPage';
import SessionWatcher from './components/SessionWatcher';

const App: React.FC = () => {
  return (
    <LocalizationProvider>
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
                    <Route path="/auth/callback" element={<AuthCallbackPage />} />
                    <Route path="/health" element={<HealthCheckPage />} />
                  </Routes>
                </main>
                <Footer />
              </div>
            </ToastProvider>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </LocalizationProvider>
  );
};

export default App;