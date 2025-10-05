
import React from 'react';
// FIX: Changed react-router-dom v6 imports (Routes) to v5 (Switch)
import { BrowserRouter, Switch, Route } from 'react-router-dom';
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

const App: React.FC = () => {
  return (
    <LocalizationProvider>
      <AuthProvider>
        <CartProvider>
          <BrowserRouter>
            <div className="bg-brand-dark min-h-screen text-white font-sans">
              <Navbar />
              <main>
                {/* FIX: Replaced Routes with Switch and element prop with component prop for react-router-dom v5 compatibility */}
                <Switch>
                  <Route exact path="/" component={HomePage} />
                  <Route path="/store" component={StorePage} />
                  <Route path="/rules" component={RulesPage} />
                  <Route exact path="/applies" component={AppliesPage} />
                  <Route path="/applies/:quizId" component={QuizPage} />
                  <Route path="/about" component={AboutUsPage} />
                  <Route path="/admin" component={AdminPage} />
                  <Route path="/my-applications" component={MyApplicationsPage} />
                  <Route path="/profile" component={ProfilePage} />
                  <Route path="/auth/callback" component={AuthCallbackPage} />
                </Switch>
              </main>
              <Footer />
            </div>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </LocalizationProvider>
  );
};

export default App;
