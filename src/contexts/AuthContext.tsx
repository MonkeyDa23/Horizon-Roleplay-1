
// src/contexts/AuthContext.tsx
import React, { createContext, useState, useEffect, useCallback, useContext, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchUserProfile, sendDiscordLog, getConfig } from '../lib/api';
import type { User, AuthContextType, PermissionKey } from '../types';
import { useLocalization } from './LocalizationContext';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [permissionWarning, setPermissionWarning] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<Error | null>(null);
  
  // Ref to track the last processed access token to prevent duplicate logs/DMs
  const processedTokenRef = useRef<string | null>(null);

  const handleSession = useCallback(async (session: any | null, isInitial: boolean = false) => {
    if (isInitial) setIsInitialLoading(true);
    else setLoading(true);
    
    setSyncError(null);

    if (session) {
      try {
        // 1. Clean URL Hash (Remove #access_token=...) immediately after session detection
        if (typeof window !== 'undefined' && window.location.hash && window.location.hash.includes('access_token')) {
            window.history.replaceState(null, '', window.location.pathname);
        }

        const { user: fullUserProfile, syncError: permWarning, isNewUser } = await fetchUserProfile();
        setPermissionWarning(permWarning);
        setUser(fullUserProfile);

        // --- SMART NOTIFICATION SYSTEM (DEBOUNCED) ---
        // Only proceed if we haven't processed this specific session token yet.
        if (session.access_token !== processedTokenRef.current) {
            processedTokenRef.current = session.access_token;
            
            // ONLY send notifications if it is a BRAND NEW USER
            if (isNewUser) {
                const config = await getConfig();
                
                // 1. Admin Log (Public - New User Joined)
                const logEmbed = {
                    title: '✨ عضو جديد انضم للموقع',
                    description: `**الاسم:** ${fullUserProfile.username}\n**الآيدي:** \`${fullUserProfile.discordId}\`\n\nتم تسجيل الدخول للمرة الأولى.`,
                    color: 0x00F2EA, // Cyan
                    thumbnail: { url: fullUserProfile.avatar },
                    timestamp: new Date().toISOString(),
                    footer: { text: 'Vixel Security System' }
                };
                sendDiscordLog(config, logEmbed, 'auth').catch(console.error);

                // 2. Welcome DM (One single warm welcome message)
                const dmEmbed = {
                    title: `أهلاً بك في ${config.COMMUNITY_NAME}!`,
                    description: `مرحباً **${fullUserProfile.username}**،\n\nشكراً لتسجيلك في موقعنا الرسمي. حسابك الآن مفعل ويمكنك التقديم على الوظائف، تصفح المتجر، ومتابعة حالة طلباتك.\n\nنتمنى لك وقتاً ممتعاً!`,
                    color: 0x00A9FF,
                    thumbnail: { url: config.LOGO_URL },
                    timestamp: new Date().toISOString()
                };
                sendDiscordLog(config, dmEmbed, 'dm', fullUserProfile.discordId).catch(console.error);
            }
            // Removed: Returning user Login Alert (Requested to be silent)
        }

      } catch (error) {
        console.error("Auth critical error:", error);
        setSyncError(error as Error);
        setUser(null);
      }
    } else {
      setUser(null);
      setPermissionWarning(null);
      processedTokenRef.current = null; // Reset logic on logout
    }
    setLoading(false);
    if (isInitial) setIsInitialLoading(false);
  }, []);

  useEffect(() => {
    if (!supabase) {
      const t = setTimeout(() => {
        setLoading(false);
        setIsInitialLoading(false);
      }, 0);
      return () => clearTimeout(t);
    }

    const checkInitialSession = async () => {
      const { data } = await (supabase.auth as any).getSession();
      handleSession(data?.session || null, true); 
    };
    checkInitialSession();

    const { data } = (supabase.auth as any).onAuthStateChange((_event: string, session: any) => {
        if (_event === 'SIGNED_IN') {
            setLoading(true);
            handleSession(session, false);
        } else if (_event === 'SIGNED_OUT') {
            handleSession(null, false);
        } else if (_event === 'INITIAL_SESSION') {
            handleSession(session, true);
        }
    });
    return () => { data?.subscription?.unsubscribe(); };
  }, [handleSession]);
  
  const login = useCallback(async (captchaToken: string) => {
    if (!supabase) return;
    setLoading(true);
    const { error } = await (supabase.auth as any).signInWithOAuth({
      provider: 'discord',
      options: { 
          scopes: 'identify guilds.members.read', 
          captchaToken,
          redirectTo: window.location.origin // Ensure we redirect back to clean root
      }
    });
    if (error) {
        if (typeof window !== 'undefined') (window as any).alert(`Login failed: ${error.message}`);
        setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    if (!supabase) return;
    
    // Removed: Logout DM Alert (Requested to be silent)

    processedTokenRef.current = null; // Reset duplication check
    setUser(null);
    await (supabase.auth as any).signOut();
  }, [user]);
  
  const updateUser = useCallback((newUser: User) => { setUser(newUser); }, []);

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
    await handleSession(data?.session || null);
  }, [handleSession]);

  const refreshUser = useCallback(async () => {
    if (!supabase) return;
    const { data } = await (supabase.auth as any).getSession();
    await handleSession(data?.session || null);
  }, [handleSession]);

  const value = { user, login, logout, loading, isInitialLoading, updateUser, hasPermission, permissionWarning, syncError, retrySync, refreshUser };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
