// src/pages/AuthCallbackPage.tsx
import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Loader } from 'lucide-react';
import type { User } from '../types';

const AuthCallbackPage: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    // This page runs in the popup. Its only job is to pass the result to the main window.
    if (!window.opener) {
        console.error("AuthCallbackPage opened without a window.opener. This can happen if a user navigates to the URL directly.");
        // We can't post a message, but we can try to close if it's a popup.
        // If not a popup, this won't do anything, which is fine.
        window.close();
        return;
    }
    
    const params = new URLSearchParams(location.search);
    const userDataB64 = params.get('user');
    const error = params.get('error');

    try {
        if (error) {
            throw new Error(decodeURIComponent(error));
        }

        if (userDataB64) {
            const userJson = atob(userDataB64);
            const user: User = JSON.parse(userJson);
            window.opener.postMessage({ type: 'auth-success', user }, window.location.origin);
        } else {
            throw new Error("No user data received from the server.");
        }
    } catch (e) {
        console.error("Error in auth callback popup:", e);
        const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
        window.opener.postMessage({ type: 'auth-error', error: errorMessage }, window.location.origin);
    } finally {
        // Always close the popup after attempting to send the message.
        window.close();
    }
  }, [location]);

  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen bg-brand-dark">
      <Loader size={48} className="text-brand-cyan animate-spin" />
      <p className="mt-4 text-white text-lg">Processing login...</p>
      <p className="text-gray-400">Please wait, this window will close automatically.</p>
    </div>
  );
};

export default AuthCallbackPage;