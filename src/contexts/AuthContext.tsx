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
    try {
      const state = Math.random().toString(36).substring(7);
      localStorage.setItem('oauth_state', state);

      // The Redirect URI points to our backend API route.
      // We construct the full URL based on the current window location,
      // which works for both localhost and any Vercel domain (including previews).
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
      
      // Redirect the user to Discord for authentication.
      window.location.href = discordAuthUrl;

    } catch (error) {
      console.error("Local Storage is not available.", error);
      alert("Login failed: Local Storage is disabled in your browser.");
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('horizon_user_session');
  };
  
  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    localStorage.setItem('horizon_user_session', JSON.stringify(loggedInUser));
  };


  const value = { user, login, logout, loading, handleLoginSuccess };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};