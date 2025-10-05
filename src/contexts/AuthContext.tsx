
import React, { createContext, useState, useEffect, useCallback } from 'react';
import type { User, AuthContextType } from '../types';
import { Loader } from 'lucide-react';
import { CONFIG } from '../lib/config';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ===================================================================================
// --- REALISTIC OAUTH2 SIMULATION ---
// ===================================================================================
// This system now simulates a real OAuth2 popup flow.
// 1. `login()` opens a real Discord authorization URL in a popup.
// 2. The user "authorizes" the app.
// 3. Discord redirects the popup to `/#/auth/callback?code=...`
// 4. `AuthCallbackPage.tsx` handles this callback.
//    - It simulates exchanging the code for a token.
//    - It simulates fetching user info and server-specific roles.
//    - It sends the final `User` object back to this main window via `postMessage`.
// 5. This context listens for the message, sets the user, and closes the loop.
//
// This provides a high-fidelity prototype for a backend developer to implement
// the real, secure server-side logic required.
// ===================================================================================

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true); // Start true to check session

  // On initial load, check if a user session is stored
  useEffect(() => {
    try {
      const storedUser = sessionStorage.getItem('auth_user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error("Failed to parse user from sessionStorage", error);
      sessionStorage.removeItem('auth_user');
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Persist user session to sessionStorage
  const updateUser = useCallback((newUser: User | null) => {
    setUser(newUser);
    if (newUser) {
      sessionStorage.setItem('auth_user', JSON.stringify(newUser));
    } else {
      sessionStorage.removeItem('auth_user');
    }
  }, []);

  const login = () => {
    setLoading(true);

    const state = Math.random().toString(36).substring(7);
    // Use localStorage so the popup can access the state set by the main window.
    localStorage.setItem('oauth_state', state);

    // Dynamically generate the redirect URI to work across all environments
    // (localhost, Vercel previews, production).
    const REDIRECT_URI = `${window.location.origin}${window.location.pathname}#/auth/callback`;

    const params = new URLSearchParams({
      client_id: CONFIG.DISCORD_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'identify guilds.members.read', // Request scope to read guild member data (roles)
      state: state,
      prompt: 'consent' 
    });
    
    const discordAuthUrl = `https://discord.com/oauth2/authorize?${params.toString()}`;
    const width = 500, height = 800;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    const popup = window.open(
      discordAuthUrl,
      'DiscordAuth',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    // Poll to see if the popup was closed, to re-enable the login button.
    const timer = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(timer);
        // Only set loading to false if we haven't received a user object yet
        setUser(currentUser => {
          if (!currentUser) {
            setLoading(false);
          }
          return currentUser;
        });
      }
    }, 500);
  };

  const logout = () => {
    updateUser(null);
  };

  // Listen for the success message from the auth popup
  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      // IMPORTANT: Check the origin for security
      if (event.origin !== window.location.origin) return;

      const { type, user, error } = event.data;

      if (type === 'auth-success' && user) {
        updateUser(user);
        setLoading(false);
      } else if (type === 'auth-error') {
        console.error("Discord OAuth Error:", error);
        alert(`Login failed: ${error}`);
        setLoading(false);
      }
    };

    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, [updateUser]);

  // While checking the session, show a global loading screen.
  if (loading && !user) {
     return (
       <div className="flex flex-col items-center justify-center h-screen w-screen bg-brand-dark">
         <Loader size={48} className="text-brand-cyan animate-spin" />
       </div>
     );
  }

  const value = { user, login, logout, loading };
  // FIX: Corrected a typo where AuthContext.Provider was likely referenced as Auth.Provider.
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
