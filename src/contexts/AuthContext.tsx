// src/contexts/AuthContext.tsx
import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchUserProfile } from '../lib/api';
import type { User, AuthContextType, PermissionKey } from '../types';
import type { Session } from '@supabase/supabase-js';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true); // For any loading state
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true); // Specifically for the first app load
  const [permissionWarning, setPermissionWarning] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<Error | null>(null);

  const handleSession = useCallback(async (session: Session | null, isInitial: boolean = false) => {
    if (isInitial) {
        setIsInitialLoading(true);
    } else {
        setLoading(true);
    }
    setSyncError(null); // Clear previous errors on new session attempt

    if (session) {
      try {
        const { user: fullUserProfile, syncError: permWarning } = await fetchUserProfile();
        
        if (permWarning) {
            setPermissionWarning(permWarning);
        } else {
            setPermissionWarning(null);
        }

        // Set the user object regardless of ban status.
        // The AppContent component will now handle rendering the BannedPage.
        setUser(fullUserProfile);

      } catch (error) {
        console.error("Critical error fetching user profile:", error);
        setSyncError(error as Error); // Set the error state
        setUser(null); // Clear any partial user state
      }
    } else {
      setUser(null);
      setPermissionWarning(null);
    }
    setLoading(false);
    if (isInitial) {
        setIsInitialLoading(false); // Mark initial load as complete
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
        setLoading(false);
        setIsInitialLoading(false);
        return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
        handleSession(session, true); // This is the initial session handling
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (_event === 'SIGNED_IN') {
          // A new sign-in should show a loader, but not the initial full-screen one
          setLoading(true); 
        }
        handleSession(session, false); // Subsequent changes are not initial
    });

    return () => {
        subscription?.unsubscribe();
    };
  }, [handleSession]);
  
  const login = useCallback(async (captchaToken: string) => {
    if (!supabase) {
        if (typeof window !== 'undefined') (window as any).alert("Login is not configured. Please add Supabase environment variables.");
        return;
    }
    setLoading(true);
    // Pass the hCaptcha token to Supabase Auth, which will verify it server-side.
    // FIX: Moved `captchaToken` to the top level of the `signInWithOAuth` options, as required by Supabase Auth, to resolve a TypeScript error.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        scopes: 'identify guilds.members.read',
      },
      captchaToken: captchaToken,
    });
    if (error) {
        console.error("Error logging in:", error.message);
        if (typeof window !== 'undefined') (window as any).alert(`Login failed: ${error.message}`);
        setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    if (!supabase) return;
    setUser(null);
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

  const value = { user, login, logout, loading, isInitialLoading, updateUser, hasPermission, permissionWarning, syncError, retrySync };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Merged Hook
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
