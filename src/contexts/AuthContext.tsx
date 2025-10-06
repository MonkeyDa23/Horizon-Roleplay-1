import React, { createContext, useState, useEffect } from 'react';
import type { User, AuthContextType } from '../types';
import { useConfig } from '../hooks/useConfig';

// Define a new AuthContextType that includes the updateUser function
interface AppAuthContextType extends AuthContextType {
  updateUser: (user: User) => void;
}

export const AuthContext = createContext<AppAuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { config } = useConfig();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // Start loading until we check localStorage

  // On initial app load, check for a user session in localStorage.
  useEffect(() => {
    try {
      setLoading(true);
      const storedUserJSON = localStorage.getItem('horizon_user_session');
      if (storedUserJSON) {
        setUser(JSON.parse(storedUserJSON));
      }
    } catch (error) {
      console.error("Failed to load user from localStorage", error);
      localStorage.removeItem('horizon_user_session');
    } finally {
      setLoading(false);
    }
  }, []);

  const login = () => {
    setLoading(true);
    try {
      const state = Math.random().toString(36).substring(7);
      localStorage.setItem('oauth_state', state);

      const REDIRECT_URI = new URL('/api/auth/callback', window.location.origin).href;

      const params = new URLSearchParams({
        client_id: config.DISCORD_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: 'identify guilds.members.read',
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

      const timer = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(timer);
          setLoading(false);
        }
      }, 500);

      if (!popup) {
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
  
  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('horizon_user_session', JSON.stringify(updatedUser));
  };


  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'horizon_user_session') {
        if (event.newValue) {
          try {
            const updatedUser = JSON.parse(event.newValue);
            setUser(updatedUser);
          } catch (e) {
            console.error("Failed to parse user session from storage event", e);
            setUser(null);
          }
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const value = { user, login, logout, loading, updateUser };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};