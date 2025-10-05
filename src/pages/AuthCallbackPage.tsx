// src/pages/AuthCallbackPage.tsx
import React, { useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { Loader } from 'lucide-react';
import type { User } from '../types';

const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useContext(AuthContext);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const userDataB64 = params.get('user');
    const error = params.get('error');

    if (error) {
      console.error("Discord Login Error:", decodeURIComponent(error));
      alert(`Login failed: ${decodeURIComponent(error)}`);
      navigate('/');
      return;
    }

    if (userDataB64 && auth) {
      try {
        // Decode the user data from Base64
        const userJson = atob(userDataB64);
        const user: User = JSON.parse(userJson);
        
        // Use the context to set the user and store it in localStorage
        auth.handleLoginSuccess(user);
        
        // Redirect to the home page after successful login
        navigate('/');

      } catch (e) {
        console.error("Failed to parse user data from callback:", e);
        alert("An error occurred during login. Please try again.");
        navigate('/');
      }
    } else if (!error) {
        console.warn("Auth callback page accessed without user data or error.");
        navigate('/');
    }
  }, [location, navigate, auth]);

  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen bg-brand-dark">
      <Loader size={48} className="text-brand-cyan animate-spin" />
      <p className="mt-4 text-white text-lg">Finalizing login...</p>
      <p className="text-gray-400">Please wait, you will be redirected shortly.</p>
    </div>
  );
};

export default AuthCallbackPage;
