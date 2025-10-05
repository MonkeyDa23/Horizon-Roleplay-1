import React, { createContext, useState, useEffect, useCallback } from 'react';
import type { User, AuthContextType, DiscordRole } from '../types';
import { CONFIG } from '../lib/config';
import { MOCK_DISCORD_ROLES, MOCK_GUILD_MEMBERS } from '../lib/mockData';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Simulates a server-side validation of a user's roles.
 * In a real app, this would be an API call that decodes a JWT 
 * or re-fetches user data to ensure their permissions are up-to-date.
 * @param user The user object to validate.
 * @returns The updated user object, or null if the user is no longer valid.
 */
const revalidateUser = (user: User): User | null => {
  const mockGuildMember = MOCK_GUILD_MEMBERS[user.id];
  if (!mockGuildMember) {
    // This simulates the user leaving the Discord server.
    console.warn(`User ${user.id} not found in mock guild members. Invalidating session.`);
    return null;
  }

  const userRoleIds = new Set(mockGuildMember.roles);
  
  // Check if the user has any of the roles designated as admin roles in the config.
  const isAdmin = CONFIG.ADMIN_ROLE_IDS.some(adminRoleId => userRoleIds.has(adminRoleId));

  // Find the user's highest-priority role to display on their profile.
  const userRoles = MOCK_DISCORD_ROLES
    .filter(role => userRoleIds.has(role.id))
    .sort((a, b) => b.position - a.position); // Sort by highest position first.

  const primaryRole: DiscordRole | undefined = userRoles.length > 0 ? {
    id: userRoles[0].id,
    name: userRoles[0].name,
    color: userRoles[0].color,
  } : undefined;

  // Return a new user object with potentially updated admin status and primary role.
  return { ...user, username: mockGuildMember.username, avatar: mockGuildMember.avatar, isAdmin, primaryRole };
};


export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // Manages initial auth state check.

  useEffect(() => {
    // On initial app load, check for a stored user session.
    setLoading(true);
    try {
      const storedUserJSON = localStorage.getItem('horizon_user_session');
      if (storedUserJSON) {
        const storedUser = JSON.parse(storedUserJSON);
        // Re-validate the user's roles to ensure they are up-to-date.
        const validatedUser = revalidateUser(storedUser);
        if (validatedUser) {
          setUser(validatedUser);
        } else {
          // The user is no longer valid (e.g., roles changed, left server).
          localStorage.removeItem('horizon_user_session');
        }
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

      const REDIRECT_URI = `${window.location.origin}/auth/callback`;

      const params = new URLSearchParams({
        client_id: CONFIG.DISCORD_CLIENT_ID,
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
      
      window.open(
        discordAuthUrl,
        'DiscordAuth',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );
    } catch (error) {
      console.error("Local Storage is not available.", error);
      alert("Login failed: Local Storage is disabled in your browser.");
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('horizon_user_session');
  };

  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      // Security: Only accept messages from our own origin.
      if (event.origin !== window.location.origin) return;

      const { type, user: receivedUser, error } = event.data;

      if (type === 'auth-success' && receivedUser) {
        setUser(receivedUser);
        localStorage.setItem('horizon_user_session', JSON.stringify(receivedUser));
      } else if (type === 'auth-error') {
        console.error("Discord OAuth Error:", error);
        alert(`Login Failed: ${error}`);
      }
    };

    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, []);

  // Use the loading state to avoid showing a logged-out state briefly on page load.
  if (loading) {
    return null; // Or a full-page loader
  }

  const value = { user, login, logout, loading: false }; // Loading is only for initial check now.
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};