import React, { createContext, useState, useEffect, useCallback } from 'react';
import type { User } from '../types';
import { useConfig } from '../hooks/useConfig';

// This matches the type expected by useAuth hook
interface AuthContextType {
  user: User | null;
  login: () => void;
  logout: () => void;
  loading: boolean;
  updateUser: (user: User) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { config, configLoading } = useConfig();

  // On initial load, check for a user in localStorage.
  useEffect(() => {
    try {
      setLoading(true);
      const storedUser = localStorage.getItem('horizon_user_session');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.error("Failed to parse user from localStorage", e);
      localStorage.removeItem('horizon_user_session');
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(() => {
    if (configLoading || !config.DISCORD_CLIENT_ID) {
      alert("Configuration is not loaded yet or Client ID is missing. Please check the Health Check page or try again in a moment.");
      return;
    }
    setLoading(true);

    const state = Math.random().toString(36).substring(2, 15);
    localStorage.setItem('oauth_state', state);

    const OAUTH_SCOPES = 'identify'; // We get guild info from the bot, so only 'identify' is needed here.
    const REDIRECT_URI = `${window.location.origin}/api/auth/callback`;

    const params = new URLSearchParams({
      client_id: config.DISCORD_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: OAUTH_SCOPES,
      state: state,
      prompt: 'consent',
    });

    const discordAuthUrl = `https://discord.com/oauth2/authorize?${params.toString()}`;
    const width = 500, height = 800;
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
          // The storage event handler will set the user, but we should stop loading here.
          setLoading(false);
        }
      }, 500);
    } else {
      alert("Popup blocked. Please allow popups for this site to log in.");
      setLoading(false);
    }
  }, [config.DISCORD_CLIENT_ID, configLoading]);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('horizon_user_session');
  }, []);

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('horizon_user_session', JSON.stringify(updatedUser));
  }, []);

  // Listen for login/logout events from other tabs (the popup).
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'horizon_user_session') {
        setLoading(true);
        if (event.newValue) {
          try {
            setUser(JSON.parse(event.newValue));
          } catch (e) {
            console.error("Failed to parse user from storage event", e);
            logout();
          }
        } else {
          // If newValue is null, it means the item was removed (logout).
          setUser(null);
        }
        setLoading(false);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [logout]);
  
  const value = { user, login, logout, loading, updateUser };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
