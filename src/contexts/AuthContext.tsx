// src/contexts/AuthContext.tsx
import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { supabase } from '../lib/supabaseClient';
// FIX: Added 'sendDiscordLog' to import.
import { fetchUserProfile, sendDiscordLog, getConfig } from '../lib/api';
import type { User, AuthContextType, PermissionKey } from '../types';
// FIX: Removed Session import as it's not exported in older Supabase versions. The type will be inferred.
// import type { Session } from '@supabase/supabase-js';
import { useLocalization } from './LocalizationContext';


export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true); // For any loading state
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true); // Specifically for the first app load
  const [permissionWarning, setPermissionWarning] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<Error | null>(null);
  const { t, language } = useLocalization();

  // FIX: Changed Session type to any for compatibility with older Supabase versions.
  const handleSession = useCallback(async (session: any | null, isInitial: boolean = false) => {
    if (isInitial) {
        setIsInitialLoading(true);
    } else {
        setLoading(true);
    }
    setSyncError(null); // Clear previous errors on new session attempt

    if (session) {
      try {
        // FIX: Destructured 'isNewUser' from fetchUserProfile response.
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
            
            // Also log to the database audit log, using the specific function for system actions
            await supabase.rpc('log_system_action', { 
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

    // FIX: Replaced async getSession() with sync session() for older Supabase v1 compatibility.
    const session = supabase.auth.session();
    handleSession(session, true); // This is the initial session handling

    // FIX: Adjusted destructuring for onAuthStateChange for older Supabase v1 compatibility.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
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
    // FIX: Replaced signInWithOAuth with signIn for older Supabase v1 compatibility.
    // FIX: Cast to 'any' to allow the 'captchaToken' property, which may not be in the installed Supabase client type definitions.
    const { error } = await supabase.auth.signIn({
      provider: 'discord',
    }, {
      scopes: 'identify guilds.members.read',
      captchaToken: captchaToken,
    } as any);
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
    // FIX: Replaced async getSession() with sync session() for older Supabase v1 compatibility.
    const session = supabase.auth.session();
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
