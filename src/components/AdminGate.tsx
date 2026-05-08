/**
 * Nova Roleplay - Official Website
 * Admin Gate Component
 */
import React, { useState, useEffect, useRef } from 'react';
import { useAdminGate } from '../contexts/AdminGateContext';
import { useConfig } from '../contexts/ConfigContext';
import { useLocalization } from '../contexts/LocalizationContext';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { verifyAdminPassword, verifyCaptcha, sendDiscordLog } from '../lib/api';
import { supabase } from '../lib/supabaseClient';
import Modal from './Modal';
import { Loader2, KeyRound, ShieldAlert } from 'lucide-react';
import { env } from '../env';

const HCaptcha: React.FC<{ onVerify: (token: string) => void, sitekey: string }> = ({ onVerify, sitekey }) => {
  const captchaRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if ((window as any).hcaptcha && captchaRef.current && !widgetIdRef.current) {
      try {
        const id = (window as any).hcaptcha.render(captchaRef.current, {
          sitekey: sitekey,
          callback: onVerify,
          theme: 'dark'
        });
        widgetIdRef.current = id;
      } catch (e) {
        console.error('HCaptcha render error:', e);
      }
    }
  }, [onVerify, sitekey]);

  return <div ref={captchaRef} className="min-h-[78px] flex justify-center"></div>;
};

const AdminGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isVerified, verify } = useAdminGate();
  const { config, branding } = useConfig();
  const { t, language, dir } = useLocalization();
  const { showToast } = useToast();
  const { user } = useAuth();
  
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hcaptchaToken, setHcaptchaToken] = useState<string | null>(null);
  const hasLoggedAccess = useRef(false);

  useEffect(() => {
    if (isVerified && user && !hasLoggedAccess.current) {
      hasLoggedAccess.current = true;
      const logAccess = async () => {
        if (supabase) {
          await supabase.rpc('log_admin_action', {
            p_action: `Admin ${user.username} accessed control panel`,
            p_log_type: 'admin_access'
          });
        }
        sendDiscordLog(config, {
          title: t('log_admin_panel_access_title') || 'Admin Access',
          description: user.username,
          color: 0xFFA500
        }, 'admin', language);
      };
      logAccess();
    }
  }, [isVerified, user, t, config, language]);

  if (!config.admin_password || isVerified) return <>{children}</>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hcaptchaToken) {
      showToast(t('complete_captcha_msg'), 'warning');
      return;
    }

    setIsLoading(true);
    try {
      await verifyCaptcha(hcaptchaToken);
      const success = await verifyAdminPassword(password);
      if (success) {
        verify();
      } else {
        showToast(t('admin_gate_incorrect') || 'كلمة المرور غير صحيحة', 'error');
        setPassword('');
        if ((window as any).hcaptcha) {
          try { (window as any).hcaptcha.reset(); } catch (e) {
            console.error('HCaptcha reset error:', e);
          }
        }
        setHcaptchaToken(null);
      }
    } catch (error) {
      showToast((error as Error).message, 'error');
      if ((window as any).hcaptcha) {
        try { (window as any).hcaptcha.reset(); } catch (e) { console.error('Captcha reset failed', e); }
      }
      setHcaptchaToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={() => {}} title={t('admin_gate_title') || 'منطقة الإدارة'}>
      <div className="p-8 space-y-10 text-center" dir={dir}>
        <div className="flex flex-col items-center gap-6">
          <div className="w-24 h-24 bg-red-500/10 rounded-[40px] flex items-center justify-center border border-red-500/10 shadow-2xl">
            <ShieldAlert className="w-12 h-12 text-red-500" />
          </div>
          <div className="space-y-4">
            <h2 className="text-3xl font-black text-white">{t('admin_gate_prompt') || 'يرجى إدخال كلمة السر للمتابعة'}</h2>
            <p className="text-text-secondary font-medium text-lg leading-relaxed opacity-60">تنبيه: سيتم تسجيل جميع المحاولات وإرسالها لخادم الديسكورد.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-10 max-w-sm mx-auto">
          <div className="space-y-6">
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              className="w-full bg-white/5 border-2 border-white/10 rounded-[32px] p-6 text-center text-2xl text-white focus:outline-none transition-all placeholder:text-white/10 shadow-inner"
              placeholder="••••••••"
              autoFocus 
            />
            
            <div className="flex justify-center scale-110 py-4">
              {env.VITE_HCAPTCHA_SITE_KEY ? (
                <HCaptcha onVerify={setHcaptchaToken} sitekey={env.VITE_HCAPTCHA_SITE_KEY} />
              ) : (
                <p className="text-red-400 font-bold">Error: Captcha Site Key Missing</p>
              )}
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading || !password || !hcaptchaToken}
            className="w-full py-6 rounded-[32px] font-black text-xl shadow-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:grayscale hover:scale-105"
            style={{ backgroundColor: branding.primaryColor, color: '#000' }}
          >
            {isLoading ? <Loader2 className="animate-spin" size={28} /> : (
              <>
                <KeyRound size={28} />
                {t('admin_gate_enter') || 'دخول'}
              </>
            )}
          </button>
        </form>
      </div>
    </Modal>
  );
};

export default AdminGate;
