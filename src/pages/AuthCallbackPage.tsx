// src/pages/AuthCallbackPage.tsx
import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Loader } from 'lucide-react';

const AuthCallbackPage: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    // This page runs in the popup window.
    // It communicates the login result back to the main application window via localStorage.
    const params = new URLSearchParams(location.search);
    const userDataB64 = params.get('user');
    const error = params.get('error');

    try {
        // First, verify that the state matches to prevent CSRF attacks.
        const storedState = localStorage.getItem('oauth_state');
        const receivedState = params.get('state');

        // Note: Discord doesn't always return the state on error, so we only check on success.
        if (userDataB64 && storedState !== receivedState) {
          throw new Error("Invalid OAuth state. Please try logging in again.");
        }
        
        // Clear the state from storage as it's a one-time use value.
        localStorage.removeItem('oauth_state');

        if (error) {
            // If there's an error from the backend, store it.
            // The main window's 'storage' event listener will pick this up.
            localStorage.setItem('horizon_auth_error', decodeURIComponent(error));
        } else if (userDataB64) {
            // If login was successful, decode the user data.
            const userJson = atob(userDataB64);
            // Store the user session.
            // The main window's 'storage' event listener will see this and log the user in.
            localStorage.setItem('horizon_user_session', userJson);
        } else {
            // This case should ideally not be reached with a proper OAuth flow.
            throw new Error("Invalid callback: No user data or error received.");
        }
    } catch (e) {
        console.error("Error processing auth callback:", e);
        const errorMessage = e instanceof Error ? e.message : "An unknown error occurred during login.";
        localStorage.setItem('horizon_auth_error', errorMessage);
    } finally {
        // Close the popup window. localStorage is synchronous, so the data
        // will be set before the window closes, triggering the event in the parent.
        window.close();
    }
  }, [location]);

  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen bg-brand-dark">
      <Loader size={48} className="text-brand-cyan animate-spin" />
      <p className="mt-4 text-white text-lg">Finalizing login...</p>
      <p className="text-gray-400">This window will close automatically.</p>
    </div>
  );
};

export default AuthCallbackPage;
