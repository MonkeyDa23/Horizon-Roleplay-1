import React, { createContext, useState, useEffect } from 'react';
import type { User, AuthContextType as BaseAuthContextType } from '../types';

// The context type must include `updateUser` for components like SessionWatcher and AdminPage.
interface AuthContextType extends BaseAuthContextType {
  updateUser: (user: User) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// A predefined, hardcoded admin user. This guarantees access to the admin panel.
const MOCK_ADMIN_USER: User = {
  id: '123456789012345678', // A valid Discord Snowflake format ID
  username: 'Admin (Mock)',
  avatar: 'https://cdn.discordapp.com/embed/avatars/1.png', // A generic default avatar
  isAdmin: true,
  // This is a placeholder role ID. The AdminPage checks if a user has a role from the SUPER_ADMIN_ROLE_IDS list.
  roles: ['00001_MOCK_SUPER_ADMIN_ROLE'], 
  primaryRole: { id: '00001_MOCK_SUPER_ADMIN_ROLE', name: 'Super Admin', color: '#E62565' }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
    // REPLACED: The complex Discord OAuth popup is removed.
    // This function now performs a simple, client-side "mock" login.
    // It bypasses Discord and the backend entirely to guarantee access.
    setLoading(true);
    setUser(MOCK_ADMIN_USER);
    localStorage.setItem('horizon_user_session', JSON.stringify(MOCK_ADMIN_USER));
    setLoading(false);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('horizon_user_session');
  };
  
  // This function is kept so that SessionWatcher can still update user details.
  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('horizon_user_session', JSON.stringify(updatedUser));
  };

  // This listener allows cross-tab logout/login syncing.
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'horizon_user_session') {
        if (event.newValue) {
          try {
            const updatedUser = JSON.parse(event.newValue);
            setUser(updatedUser);
          } catch(e) {
            console.error("Failed to parse user from storage event", e);
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const value = { user, login, logout, loading, updateUser };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
