import React, { createContext, useState, useEffect } from 'react';
import type { User, AuthContextType } from '../types';
import { CONFIG } from '../lib/config';


export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// --- Discord OAuth2 Configuration ---
const OAUTH_SCOPES = 'identify guilds.members.read';


export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const login = () => {
    setLoading(true);
    try {
      const state = Math.random().toString(36).substring(7);
      // Use localStorage because it's shared between tabs/windows from the same origin.
      // sessionStorage is isolated to a single tab.
      localStorage.setItem('oauth_state', state);

      // This is the crucial fix for HashRouter. The redirect URI must point to
      // the route within the hash.
      const REDIRECT_URI = `${window.location.origin}${window.location.pathname}#/auth/callback`;

      const params = new URLSearchParams({
        client_id: CONFIG.DISCORD_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: OAUTH_SCOPES,
        state: state,
        prompt: 'consent' 
      });
      
      const discordAuthUrl = `https://discord.com/oauth2/authorize?${params.toString()}`;
      const width = 500;
      const height = 800;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const popup = window.open(
        discordAuthUrl,
        'DiscordAuth',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );

      // Periodically check if the popup has been closed by the user.
      if (popup) {
        const timer = setInterval(() => {
          if (popup.closed) {
            clearInterval(timer);
            setLoading(false); // Re-enable the login button if the user closes the popup.
          }
        }, 500);
      } else {
        alert("Popup was blocked. Please allow popups for this site to log in.");
        setLoading(false);
      }
    } catch (error) {
      console.error("Local Storage is not available.", error);
      alert("Login failed: Local Storage is disabled in your browser.");
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
  };

  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const { type, user, error } = event.data;

      if (type === 'auth-success' && user) {
        setUser(user);
        setLoading(false);
      } else if (type === 'auth-error') {
        console.error("Discord OAuth Error:", error);
        alert(`Login Failed: ${error}`);
        setLoading(false);
      }
    };

    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, []);


  const value = { user, login, logout, loading };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};