
import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { LocalizationProvider } from './contexts/LocalizationContext';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';

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
import ScenarioGeneratorPage from './pages/ScenarioGeneratorPage';
import LivePage from './pages/LivePage';

const App: React.FC = () => {
  return (
    <LocalizationProvider>
      <AuthProvider>
        <CartProvider>
          <HashRouter>
            <div className="bg-brand-dark min-h-screen text-white font-sans">
              <Navbar />
              <main>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/store" element={<StorePage />} />
                  <Route path="/rules" element={<RulesPage />} />
                  <Route path="/applies" element={<AppliesPage />} />
                  <Route path="/applies/:quizId" element={<QuizPage />} />
                  <Route path="/scenarios" element={<ScenarioGeneratorPage />} />
                  <Route path="/live" element={<LivePage />} />
                  <Route path="/about" element={<AboutUsPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="/my-applications" element={<MyApplicationsPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/auth/callback" element={<AuthCallbackPage />} />
                </Routes>
              </main>
              <Footer />
            </div>
          </HashRouter>
        </CartProvider>
      </AuthProvider>
    </LocalizationProvider>
  );
};

export default App;