
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
            
            const config = await getConfig();

            // 1. Login Log (For ALL users)
            const loginEmbed = {
                title: isNewUser ? '✨ عضو جديد انضم للموقع' : '🔓 تسجيل دخول',
                description: `**اللاعب:** ${fullUserProfile.username}\n**الآيدي:** \`${fullUserProfile.discordId}\`\n\n${isNewUser ? 'تم تسجيل الدخول للمرة الأولى وإنشاء حساب جديد.' : 'قام اللاعب بتسجيل الدخول للموقع.'}`,
                color: isNewUser ? 0x00F2EA : 0x6366F1,
                thumbnail: { url: fullUserProfile.avatar },
                fields: [
                    { name: 'اسم المستخدم', value: fullUserProfile.username, inline: true },
                    { name: 'الآيدي', value: `\`${fullUserProfile.discordId}\``, inline: true },
                    { name: 'الحالة', value: isNewUser ? 'حساب جديد' : 'مستخدم حالي', inline: true }
                ],
                timestamp: new Date().toISOString()
            };
            sendDiscordLog(config, loginEmbed, 'auth').catch(console.error);

            // 2. Welcome DM (Only for NEW users)
            if (isNewUser) {
                const dmEmbed = {
                    title: `أهلاً بك في ${config.COMMUNITY_NAME}!`,
                    description: `مرحباً **${fullUserProfile.username}**،\n\nشكراً لتسجيلك في موقعنا الرسمي. حسابك الآن مفعل ويمكنك التقديم على الوظائف، تصفح المتجر، ومتابعة حالة طلباتك.\n\n**معلومات حسابك:**\n- **الاسم:** ${fullUserProfile.username}\n- **الآيدي:** \`${fullUserProfile.discordId}\`\n\nنتمنى لك وقتاً ممتعاً!`,
                    color: 0x00A9FF,
                    thumbnail: { url: config.LOGO_URL },
                    timestamp: new Date().toISOString()
                };
                sendDiscordLog(config, dmEmbed, 'dm', fullUserProfile.discordId).catch(console.error);
            }
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
    
    if (user) {
        const config = await getConfig();
        const logoutEmbed = {
            title: '🔒 تسجيل خروج',
            description: `**اللاعب:** ${user.username}\n**الآيدي:** \`${user.discordId}\`\n\nقام اللاعب بتسجيل الخروج من الموقع.`,
            color: 0xFF4444,
            timestamp: new Date().toISOString()
        };
        sendDiscordLog(config, logoutEmbed, 'auth').catch(console.error);
    }

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
