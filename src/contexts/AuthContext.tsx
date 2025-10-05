import React, { createContext, useState, useEffect } from 'react';
import type { User, AuthContextType } from '../types';
import { CONFIG } from '../lib/config';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
      // Use localStorage for state as well for consistency.
      localStorage.setItem('oauth_state', state);

      // The Redirect URI points to our backend API route.
      const REDIRECT_URI = new URL('/api/auth/callback', window.location.origin).href;

      const params = new URLSearchParams({
        client_id: CONFIG.DISCORD_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: 'identify guilds.members.read',
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
            // The storage event will handle success/failure, but if the user closes manually, we stop loading.
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
    // Clear both session and potential error keys on logout.
    localStorage.removeItem('horizon_user_session');
    localStorage.removeItem('horizon_auth_error');
  };

  // --- Storage Listener for Cross-Window Communication ---
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      // Listen for the user session being set by the auth popup.
      if (event.key === 'horizon_user_session' && event.newValue) {
        try {
          const updatedUser = JSON.parse(event.newValue);
          setUser(updatedUser);
          localStorage.removeItem('horizon_auth_error'); // Clean up any old errors
        } catch (e) {
          console.error("Failed to parse user session from storage event", e);
          setUser(null);
        }
        setLoading(false);
      } 
      // Listen for an error being set by the auth popup.
      else if (event.key === 'horizon_auth_error' && event.newValue) {
        console.error("Discord OAuth Error from popup:", event.newValue);
        alert(`Login failed: ${event.newValue}`);
        localStorage.removeItem('horizon_auth_error'); // Clean up the error after showing it.
        setLoading(false);
      }
      // Handles logout from another tab.
      else if (event.key === 'horizon_user_session' && !event.newValue) {
         setUser(null);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);


  const value = { user, login, logout, loading };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};