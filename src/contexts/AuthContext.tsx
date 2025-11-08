import React, { createContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchUserProfile } from '../lib/api';
import type { User, AuthContextType, PermissionKey } from '../types';
import { useToast } from '../hooks/useToast';
import type { Session } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';
import BannedPage from '../pages/BannedPage';
import LoginErrorPage from '../pages/LoginErrorPage'; // New Import

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [bannedInfo, setBannedInfo] = useState<{ reason: string; expires_at: string | null } | null>(null);
  const [permissionWarning, setPermissionWarning] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<Error | null>(null);
  const { showToast } = useToast();

  const handleSession = useCallback(async (session: Session | null) => {
    setBannedInfo(null);
    setSyncError(null); // Clear previous errors on new session attempt

    if (session) {
      try {
        const { user: fullUserProfile, syncError: permWarning } = await fetchUserProfile();
        
        if (permWarning) {
            setPermissionWarning(permWarning);
        } else {
            setPermissionWarning(null);
        }

        if (fullUserProfile.is_banned) {
            setBannedInfo({ reason: fullUserProfile.ban_reason || 'No reason provided.', expires_at: fullUserProfile.ban_expires_at });
            setUser(null);
            await supabase?.auth.signOut();
        } else {
            setUser(fullUserProfile);
        }

      } catch (error) {
        console.error("Critical error fetching user profile:", error);
        setSyncError(error as Error); // Set the error state to render the error page
        setUser(null); // Clear any partial user state
      }
    } else {
      setUser(null);
      setPermissionWarning(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!supabase) {
        setLoading(false);
        return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
        handleSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (_event === 'SIGNED_IN') {
          setLoading(true);
        }
        handleSession(session);
    });

    return () => {
        subscription?.unsubscribe();
    };
  }, [handleSession]);
  
  const login = useCallback(async () => {
    if (!supabase) {
        // FIX: Replaced alert with window.alert for explicit browser API usage.
        // FIX: Cast window to any to bypass potential tsconfig lib errors for 'alert'.
        if (typeof window !== 'undefined') (window as any).alert("Login is not configured. Please add Supabase environment variables.");
        return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        scopes: 'identify guilds.members.read',
      },
    });
    if (error) {
        console.error("Error logging in:", error.message);
        // FIX: Replaced alert with window.alert for explicit browser API usage.
        // FIX: Cast window to any to bypass potential tsconfig lib errors for 'alert'.
        if (typeof window !== 'undefined') (window as any).alert(`Login failed: ${error.message}`);
        setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    if (!supabase) return;
    setUser(null);
    setBannedInfo(null);
    setPermissionWarning(null);
    setSyncError(null);
    await supabase.auth.signOut();
  }, []);
  
  const updateUser = useCallback((newUser: User) => {
    setUser(newUser);
  }, []);

  const hasPermission = useCallback((key: PermissionKey): boolean => {
    if (!user || !user.permissions) return false;
    if (user.permissions.includes('_super_admin')) return true;
    return user.permissions.includes(key);
  }, [user]);

  const retrySync = useCallback(async () => {
    if (!supabase) return;
    setSyncError(null);
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    await handleSession(session);
  }, [handleSession]);

  if (loading) {
    return (
       <div className="flex flex-col gap-4 justify-center items-center h-screen w-screen bg-brand-dark">
        <Loader2 size={48} className="text-brand-cyan animate-spin" />
        <p className="text-xl text-gray-300">Connecting...</p>
      </div>
    );
  }

  if (bannedInfo) {
    return <BannedPage reason={bannedInfo.reason} expires_at={bannedInfo.expires_at} onLogout={logout} />;
  }

  if (syncError) {
    return <LoginErrorPage error={syncError} onRetry={retrySync} onLogout={logout} />;
  }

  const value = { user, login, logout, loading, updateUser, hasPermission, permissionWarning, syncError };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
