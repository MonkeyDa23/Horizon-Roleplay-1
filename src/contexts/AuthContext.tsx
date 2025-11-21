
// src/contexts/AuthContext.tsx
import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
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
  const { t } = useLocalization();

  const handleSession = useCallback(async (session: any | null, isInitial: boolean = false) => {
    if (isInitial) setIsInitialLoading(true);
    else setLoading(true);
    
    setSyncError(null);

    if (session) {
      try {
        const { user: fullUserProfile, syncError: permWarning, isNewUser } = await fetchUserProfile();
        setPermissionWarning(permWarning);
        setUser(fullUserProfile);

        const config = await getConfig();

        // --- AUDIT SYSTEM: NEW USER DETECTION ---
        if (isNewUser) {
            // 1. Public Log
            const logEmbed = {
                title: '✨ عضو جديد انضم للموقع',
                description: `**الاسم:** ${fullUserProfile.username}\n**الآيدي:** \`${fullUserProfile.discordId}\`\n\nتم تسجيل الدخول للمرة الأولى.`,
                color: 0x00F2EA, // Cyan
                thumbnail: { url: fullUserProfile.avatar },
                timestamp: new Date().toISOString(),
                footer: { text: 'Vixel Security System' }
            };
            await sendDiscordLog(config, logEmbed, 'auth');

            // 2. Welcome DM
            const dmEmbed = {
                title: `أهلاً بك في ${config.COMMUNITY_NAME}!`,
                description: `مرحباً **${fullUserProfile.username}**،\n\nشكراً لتسجيلك في موقعنا الرسمي. حسابك الآن مفعل ويمكنك التقديم على الوظائف، تصفح المتجر، ومتابعة حالة طلباتك.\n\nنتمنى لك وقتاً ممتعاً!`,
                color: 0x00A9FF,
                thumbnail: { url: config.LOGO_URL },
                timestamp: new Date().toISOString()
            };
            await sendDiscordLog(config, dmEmbed, 'dm', fullUserProfile.discordId);
        } else if (!isInitial) {
            // --- SECURITY: LOGIN ALERT DM ---
            // Sent only on active login (not initial page load check)
            const loginAlertEmbed = {
                title: '⚠️ تنبيه أمني: تسجيل دخول جديد',
                description: `تم تسجيل الدخول إلى حسابك في موقع **${config.COMMUNITY_NAME}**.\n\nإذا لم تكن أنت من قام بهذا الإجراء، يرجى تغيير كلمة المرور الخاصة بحسابك في ديسكورد فوراً.`,
                color: 0xFFA500, // Orange
                timestamp: new Date().toISOString(),
                footer: { text: 'نظام الحماية' }
            };
            // We don't await this to not block UI
            sendDiscordLog(config, loginAlertEmbed, 'dm', fullUserProfile.discordId).catch(console.error);
        }

      } catch (error) {
        console.error("Auth critical error:", error);
        setSyncError(error as Error);
        setUser(null);
      }
    } else {
      setUser(null);
      setPermissionWarning(null);
    }
    setLoading(false);
    if (isInitial) setIsInitialLoading(false);
  }, []);

  useEffect(() => {
    if (!supabase) { setLoading(false); setIsInitialLoading(false); return; }

    const checkInitialSession = async () => {
      const { data } = await (supabase.auth as any).getSession();
      handleSession(data?.session || null, true); 
    };
    checkInitialSession();

    const { data } = (supabase.auth as any).onAuthStateChange((_event: string, session: any) => {
        if (_event === 'SIGNED_IN') setLoading(true);
        handleSession(session, _event === 'INITIAL_SESSION');
    });
    return () => { data?.subscription?.unsubscribe(); };
  }, [handleSession]);
  
  const login = useCallback(async (captchaToken: string) => {
    if (!supabase) return;
    setLoading(true);
    const { error } = await (supabase.auth as any).signInWithOAuth({
      provider: 'discord',
      options: { scopes: 'identify guilds.members.read', captchaToken }
    });
    if (error) {
        if (typeof window !== 'undefined') (window as any).alert(`Login failed: ${error.message}`);
        setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    if (!supabase) return;
    
    // --- SECURITY: LOGOUT ALERT DM ---
    if (user) {
        try {
            const config = await getConfig();
            const logoutEmbed = {
                title: '🔒 تم تسجيل الخروج',
                description: `تم تسجيل الخروج من حسابك في موقع **${config.COMMUNITY_NAME}** بنجاح.`,
                color: 0x808080, // Grey
                timestamp: new Date().toISOString(),
                footer: { text: 'نظام الحماية' }
            };
            await sendDiscordLog(config, logoutEmbed, 'dm', user.discordId);
        } catch (e) { console.error("Failed to send logout DM", e); }
    }

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

  const value = { user, login, logout, loading, isInitialLoading, updateUser, hasPermission, permissionWarning, syncError, retrySync };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
