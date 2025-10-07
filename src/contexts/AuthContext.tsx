import React, { createContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getProfileById, getDiscordRoles } from '../lib/api';
import type { User, AuthContextType, DiscordRole } from '../types';
import { useConfig } from '../hooks/useConfig';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { config, configLoading } = useConfig();

  const getAppUser = useCallback(async (supabaseUser: any): Promise<User | null> => {
    if (!supabaseUser) return null;

    const profile = await getProfileById(supabaseUser.id);
    if (!profile) return null; // User may exist in Auth but not have a profile yet
    
    // Fetch user's Discord roles from your backend to determine primary role and permissions
    const discordRolesApi = await getDiscordRoles(supabaseUser.id);
    const discordRoles: DiscordRole[] = discordRolesApi.map(r => ({
        id: r.id,
        name: r.name,
        color: `#${r.color.toString(16).padStart(6, '0')}`
    }));

    const superAdminRoles = config.SUPER_ADMIN_ROLE_IDS || [];

    const primaryRole = discordRoles.length > 0 ? discordRoles[0] : undefined;

    return {
      id: supabaseUser.id,
      username: supabaseUser.user_metadata.full_name,
      avatar: supabaseUser.user_metadata.avatar_url,
      isAdmin: profile.is_admin,
      isSuperAdmin: profile.is_super_admin || discordRoles.some(r => superAdminRoles.includes(r.id)),
      roles: discordRoles.map(r => r.id),
      primaryRole: primaryRole,
      discordRoles: discordRoles,
    };
  }, [config.SUPER_ADMIN_ROLE_IDS]);


  useEffect(() => {
    setLoading(true);
    // FIX: Cast supabase.auth to 'any' to bypass TypeScript errors with its methods.
    const { data: { subscription } } = (supabase.auth as any).onAuthStateChange(async (event: any, session: any) => {
      if (session?.user) {
        const appUser = await getAppUser(session.user);
        setUser(appUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    // Check for existing session on initial load
    const checkSession = async () => {
        // FIX: Cast supabase.auth to 'any' to bypass TypeScript errors with its methods.
        const { data: { session } } = await (supabase.auth as any).getSession();
        if (session?.user) {
            const appUser = await getAppUser(session.user);
            setUser(appUser);
        }
        setLoading(false);
    };

    if (!configLoading) {
       checkSession();
    }

    return () => subscription.unsubscribe();
  }, [getAppUser, configLoading]);
  
  const login = async () => {
    setLoading(true);
    // FIX: Cast supabase.auth to 'any' to bypass TypeScript errors with its methods.
    const { error } = await (supabase.auth as any).signInWithOAuth({
      provider: 'discord',
    });
    if (error) {
      console.error('Error logging in:', error);
      alert('Error logging in: ' + error.message);
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    // FIX: Cast supabase.auth to 'any' to bypass TypeScript errors with its methods.
    await (supabase.auth as any).signOut();
    setUser(null);
    setLoading(false);
  };

  // FIX: Add updateUser function to allow components to update the user state.
  const updateUser = useCallback((newUser: User) => {
    setUser(newUser);
  }, []);

  const value = { user, login, logout, loading, updateUser };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};