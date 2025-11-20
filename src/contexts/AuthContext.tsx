
// src/contexts/AuthContext.tsx
import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchUserProfile, sendDiscordLog, getConfig } from '../lib/api';
import type { User, AuthContextType, PermissionKey } from '../types';
import { useLocalization } from './LocalizationContext';


export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true); // For any loading state
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true); // Specifically for the first load
  const [permissionWarning, setPermissionWarning] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<Error | null>(null);
  const { t, language } = useLocalization();

  const handleSession = useCallback(async (session: any | null, isInitial: boolean = false) => {
    if (isInitial) {
        setIsInitialLoading(true);
    } else {
        setLoading(true);
    }
    setSyncError(null); // Clear previous errors on new session attempt

    if (session) {
      try {
        const { user: fullUserProfile, syncError: permWarning, isNewUser } = await fetchUserProfile();
        
        if (permWarning) {
            setPermissionWarning(permWarning);
        } else {
            setPermissionWarning(null);
        }

        setUser(fullUserProfile);

        // If it's a new user, log the event to Discord and the database.
        if (isNewUser) {
            console.log("New user detected, triggering log...");
            const config = await getConfig(); // Fetch config for channel IDs
            const embed = {
                title: t('log_new_user_title'),
                description: t('log_new_user_desc', { username: fullUserProfile.username, discordId: fullUserProfile.discordId }),
                author: {
                    name: fullUserProfile.username,
                    icon_url: fullUserProfile.avatar
                },
                color: 0x22C55E, // Green
                timestamp: new Date().toISOString()
            };
            sendDiscordLog(config, embed, 'auth', language);
            
            // Also log to the database audit log
            await supabase!.rpc('log_system_action', { 
                p_actor_id: fullUserProfile.id, // Log as the user themselves
                p_actor_username: fullUserProfile.username,
                p_action: `User ${fullUserProfile.username} (${fullUserProfile.discordId}) logged in for the first time.`,
                p_log_type: 'auth'
            });
        }

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
  }, [t, language]);

  useEffect(() => {
    if (!supabase) {
        setLoading(false);
        setIsInitialLoading(false);
        return;
    }

    const checkInitialSession = async () => {
      // Cast to any to support multiple Supabase client versions (v1/v2)
      const { data } = await (supabase.auth as any).getSession();
      const session = data?.session || null;
      handleSession(session, true); 
    };
    checkInitialSession();

    const { data } = (supabase.auth as any).onAuthStateChange((_event: string, session: any) => {
        if (_event === 'SIGNED_IN') {
          setLoading(true); 
        }
        handleSession(session, false);
    });
    const subscription = data?.subscription;

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
    
    // Cast to any to avoid type errors if types are v1 but client is v2
    const { error } = await (supabase.auth as any).signInWithOAuth({
      provider: 'discord',
      options: {
        scopes: 'identify guilds.members.read',
        captchaToken: captchaToken,
      }
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
    await (supabase.auth as any).signOut();
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
    const { data } = await (supabase.auth as any).getSession();
    const session = data?.session || null;
    await handleSession(session);
  }, [handleSession]);

  const value = { user, login, logout, loading, isInitialLoading, updateUser, hasPermission, permissionWarning, syncError, retrySync };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
