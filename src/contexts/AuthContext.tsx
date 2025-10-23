import React, { createContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchUserProfile } from '../lib/api';
import type { User, AuthContextType, PermissionKey } from '../types';
import { useToast } from '../hooks/useToast';
import type { Session } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';
import BannedPage from '../pages/BannedPage';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [bannedInfo, setBannedInfo] = useState<{ reason: string; expires_at: string | null } | null>(null);
  const [permissionWarning, setPermissionWarning] = useState<string | null>(null);
  const { showToast } = useToast();

  const handleSession = useCallback(async (session: Session | null) => {
    setBannedInfo(null);
    if (session) {
      try {
        const { user: fullUserProfile, syncError } = await fetchUserProfile();
        
        if (syncError) {
            setPermissionWarning(syncError);
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

        if (syncError) {
            showToast(`Warning: ${syncError}`, 'warning');
        }
      } catch (error) {
        console.error("Critical error fetching user profile:", error);
        setPermissionWarning("A critical error occurred during login. The bot may be offline or misconfigured.");
        showToast("A critical error occurred during login. The bot may be offline or misconfigured.", 'error');
        await supabase?.auth.signOut();
        setUser(null);
      }
    } else {
      setUser(null);
      setPermissionWarning(null);
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
    setBannedInfo(null);
    setPermissionWarning(null);
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


  const value = { user, login, logout, loading, updateUser, hasPermission, permissionWarning };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};