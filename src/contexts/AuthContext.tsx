import React, { createContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchUserProfile } from '../lib/api';
import type { User, AuthContextType } from '../types';
import { useToast } from '../hooks/useToast';
// FIX: The Session type is sometimes not re-exported from the main supabase-js package. Importing directly from gotrue-js is safer.
import type { Session } from '@supabase/gotrue-js';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { showToast } = useToast();

  const handleSession = useCallback(async (session: Session | null) => {
    if (session) {
      try {
        const { user: fullUserProfile, syncError } = await fetchUserProfile(session);
        setUser(fullUserProfile);
        if (syncError) {
            showToast(`Warning: ${syncError}`, 'warning');
        }
      } catch (error) {
        console.error("Critical error fetching user profile:", error);
        showToast("A critical error occurred during login.", 'error');
        // If profile fetch fails, sign out to prevent being in a broken login state
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
        // If Supabase isn't configured, the app runs in a "logged out" state.
        return;
    }

    // Handle initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
        handleSession(session);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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

  const value = { user, login, logout, loading, updateUser };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};