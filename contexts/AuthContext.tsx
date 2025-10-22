import React, { createContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchUserProfile } from '../lib/api';
import type { User, AuthContextType, PermissionKey } from '../types';
import { useToast } from '../hooks/useToast';
import type { Session } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { showToast } = useToast();

  const handleSession = useCallback(async (session: Session | null) => {
    if (session) {
      try {
        const { user: fullUserProfile, syncError } = await fetchUserProfile();
        setUser(fullUserProfile);
        if (syncError) {
            showToast(`Warning: ${syncError}`, 'warning');
        }
      } catch (error) {
        console.error("Critical error fetching user profile:", error);
        showToast("A critical error occurred during login. The bot may be offline or misconfigured.", 'error');
        await supabase?.auth.signOut();
        setUser(null);
      }
    } else {
      setUser(null);
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => {
    if (!supabase) {
        setLoading(false);
        return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
        handleSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        // Show loading spinner during the user sync process after login
        if (_event === 'SIGNED_IN') {
          setLoading(true);
        }
        handleSession(session);
    });

    return () => {
        subscription?.unsubscribe();
    };
  }, [handleSession]);
  
  const login = async () => {
    if (!supabase) {
        alert("Login is not configured. Please add Supabase environment variables.");
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
        alert(`Login failed: ${error.message}`);
        setLoading(false);
    }
  };

  const logout = async () => {
    if (!supabase) return;
    setUser(null);
    await supabase.auth.signOut();
  };
  
  const updateUser = (newUser: User) => {
    setUser(newUser);
  };

  const hasPermission = useCallback((key: PermissionKey): boolean => {
    if (!user) return false;
    // Super admin has all permissions implicitly
    if (user.permissions.has('_super_admin')) return true;
    return user.permissions.has(key);
  }, [user]);

  // Render a full-page loader while the initial session is being processed.
  if (loading && !user) {
    return (
       <div className="flex flex-col gap-4 justify-center items-center h-screen w-screen bg-brand-dark">
        <Loader2 size={48} className="text-brand-cyan animate-spin" />
        <p className="text-xl text-gray-300">Connecting...</p>
      </div>
    );
  }


  const value = { user, login, logout, loading, updateUser, hasPermission };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
