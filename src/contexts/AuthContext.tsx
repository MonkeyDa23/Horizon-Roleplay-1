import React, { createContext, useState, useEffect } from 'react';
import type { User, AuthContextType } from '../types';
import { useConfig } from '../hooks/useConfig';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// --- Discord OAuth2 Configuration ---
const DISCORD_CLIENT_ID = '1423341328355295394';
// FIX: Use a dedicated callback path for the redirect URI.
// This URL must be added to the "Redirects" list in your Discord Developer Portal application.
const REDIRECT_URI = `${window.location.origin}/auth/callback`;
const OAUTH_SCOPES = 'identify guilds.members.read';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { config } = useConfig();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const login = () => {
    setLoading(true);
    try {
      const state = Math.random().toString(36).substring(7);
      sessionStorage.setItem('oauth_state', state);

      const params = new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        redirect_uri: REDIRECT_URI, // Use the updated, fixed URI
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

      if (popup) {
        const timer = setInterval(() => {
          if (popup.closed) {
            clearInterval(timer);
            setLoading(false); // Stop loading when popup is closed, regardless of result
          }
        }, 500);
      } else {
        alert("Popup was blocked. Please allow popups for this site to log in.");
        setLoading(false);
      }
    } catch (error) {
      console.error("Session Storage is not available.", error);
      alert("Login failed: Session Storage is disabled in your browser.");
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
  };
  
  const updateUser = (newUser: User) => {
    setUser(newUser);
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
        alert(`Login failed: ${error}`);
        setLoading(false);
      }
    };

    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, []);
  
  const value = { user, login, logout, loading, updateUser };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
