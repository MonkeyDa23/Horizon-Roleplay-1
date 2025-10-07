import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Loader, CheckCircle, XCircle } from 'lucide-react';

const AuthCallbackPage: React.FC = () => {
  const location = useLocation();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Finalizing login, please wait...');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const userDataB64 = params.get('user');
    const error = params.get('error');
    const receivedState = params.get('state');
    
    // Use a short timeout to ensure the component has rendered before we process and close.
    setTimeout(() => {
      try {
        const storedState = localStorage.getItem('oauth_state');
        localStorage.removeItem('oauth_state'); // Clean up state regardless of outcome.

        if (error) {
          throw new Error(decodeURIComponent(error));
        }
        
        // State validation is critical for security (CSRF).
        if (!userDataB64 || storedState !== receivedState) {
          throw new Error("Invalid authentication state. Please try logging in again.");
        }
        
        const userJson = atob(userDataB64);
        // This localStorage event will be picked up by the AuthProvider in the main window.
        localStorage.setItem('horizon_user_session', userJson);
        
        setStatus('success');
        setMessage('Success! You are now logged in. This window will close automatically.');

        // Close the window after a short delay to show the success message.
        setTimeout(() => {
          window.close();
        }, 1500);

      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
        console.error("Auth Callback Error:", errorMessage);
        setStatus('error');
        setMessage(errorMessage);
        // We DO NOT close the window on error, so the user can read the message.
      }
    }, 500); // Initial delay to allow rendering.

  }, [location]);

  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen bg-brand-dark p-8 text-center">
      {status === 'processing' && <Loader size={48} className="text-brand-cyan animate-spin" />}
      {status === 'success' && <CheckCircle size={48} className="text-green-400" />}
      {status === 'error' && <XCircle size={48} className="text-red-400" />}
      
      <p className={`mt-6 text-xl font-bold ${status === 'error' ? 'text-red-300' : 'text-white'}`}>
        {message}
      </p>
      
      {status === 'error' && (
        <p className="mt-4 text-gray-400">
          You can close this window and try again. The most common cause for this error is an incorrect Redirect URI in the Discord Developer Portal. Please use the Health Check page on the main site to verify the correct URI.
        </p>
      )}
       {status === 'success' && (
        <p className="mt-2 text-gray-400">
          Redirecting you back to the main site...
        </p>
      )}
    </div>
  );
};

export default AuthCallbackPage;
