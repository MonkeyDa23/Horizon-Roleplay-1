import React, { createContext, useState, useEffect } from 'react';
import type { User, AuthContextType } from '../types';
import { CONFIG } from '../lib/config';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // Start true for initial localStorage check

  // On initial app load, check for a user session in localStorage.
  useEffect(() => {
    try {
      const storedUserJSON = localStorage.getItem('horizon_user_session');
      if (storedUserJSON) {
        setUser(JSON.parse(storedUserJSON));
      }
    } catch (error) {
      console.error("Failed to load user from localStorage", error);
      localStorage.removeItem('horizon_user_session');
    }
    setLoading(false);
  }, []);

  const login = () => {
    setLoading(true);
    try {
      const state = Math.random().toString(36).substring(7);
      localStorage.setItem('oauth_state', state);

      // The Redirect URI points to our backend API route.
      const REDIRECT_URI = new URL('/api/auth/callback', window.location.origin).href;

      const params = new URLSearchParams({
        client_id: CONFIG.DISCORD_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: 'identify guilds.members.read', // guilds.members.read is needed for roles
        state: state,
        prompt: 'consent'
      });
      
      const discordAuthUrl = `https://discord.com/oauth2/authorize?${params.toString()}`;

      // --- Popup Window Logic ---
      const width = 500;
      const height = 800;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const popup = window.open(
        discordAuthUrl,
        'DiscordAuth',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );

      if (popup) {
        const timer = setInterval(() => {
          if (popup.closed) {
            clearInterval(timer);
            // Stop loading when popup is closed, either by success or manually by user.
            setLoading(false);
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
    localStorage.removeItem('horizon_user_session');
  };

  // --- Message Listener for Popup ---
  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      // Security: ensure the message is from our own origin
      if (event.origin !== window.location.origin) return;
      
      const { type, user, error } = event.data;

      if (type === 'auth-success' && user) {
        setUser(user);
        localStorage.setItem('horizon_user_session', JSON.stringify(user));
        setLoading(false);
      } else if (type === 'auth-error') {
        console.error("Discord OAuth Error from popup:", error);
        alert(`Login failed: ${error}`);
        setLoading(false);
      }
    };

    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, []);


  const value = { user, login, logout, loading };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};