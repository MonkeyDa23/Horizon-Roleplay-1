import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ShieldAlert, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { useLocalization } from '../../contexts/LocalizationContext';
import { useConfig } from '../../contexts/ConfigContext';
import { useAuth } from '../../contexts/AuthContext';
import type { AdminTab } from '../../pages/AdminPage';
import type { PermissionKey } from '../../types';

import HCaptcha from '@hcaptcha/react-hcaptcha';

interface AdminLayoutProps {
  children: React.ReactNode;
  tabs: { id: AdminTab; labelKey: string; icon: React.ElementType; permission: PermissionKey }[];
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  pageTitle: string;
  pageIcon?: React.ElementType;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, tabs, activeTab, setActiveTab, pageTitle, pageIcon: PageIcon }) => {
  const { t, dir } = useLocalization();
  const { branding } = useConfig();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = React.useRef<HCaptcha>(null);

  // 1. Check for 2FA Enablement
  if (user && !user.two_factor_enabled) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6" dir={dir}>
        <div className="glass-panel p-12 max-w-2xl w-full text-center space-y-8 animate-fade-in-up">
          <div className="w-24 h-24 bg-red-500/10 rounded-[40px] flex items-center justify-center text-red-500 mx-auto border border-red-500/10">
            <ShieldAlert size={48} />
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-black text-white">{t('2fa_required_title') || 'المصادقة الثنائية مطلوبة'}</h1>
            <p className="text-text-secondary text-lg leading-relaxed opacity-80">
              {t('2fa_required_desc') || 'للوصول إلى لوحة الإدارة، يجب عليك تفعيل المصادقة الثنائية (2FA) أولاً من ملفك الشخصي لحماية الموقع.'}
            </p>
          </div>
          <Link 
            to="/profile" 
            className="inline-flex items-center gap-3 px-10 py-5 rounded-3xl font-black text-lg transition-all hover:scale-105 shadow-2xl"
            style={{ backgroundColor: branding.primaryColor, color: '#000' }}
          >
            {t('go_to_profile')}
            <ArrowRight size={20} className={dir === 'rtl' ? 'rotate-180' : ''} />
          </Link>
        </div>
      </div>
    );
  }

  // 2. Admin Password Gate
  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!captchaToken) {
      setError(t('complete_captcha_msg') || 'يرجى إكمال التحقق أولاً');
      return;
    }

    // The password is set in the environment or config.
    const adminPass = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123';
    if (password === adminPass) {
      setIsAdminUnlocked(true);
      setError('');
    } else {
      setError(t('invalid_admin_password') || 'كلمة المرور غير صحيحة');
      setCaptchaToken(null);
      captchaRef.current?.resetCaptcha();
    }
  };

  if (!isAdminUnlocked) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6" dir={dir}>
        <div className="glass-panel p-12 max-w-md w-full text-center space-y-10 animate-fade-in-up border-white/5 shadow-2xl">
          <div className="w-20 h-20 bg-brand-dark/50 rounded-[35px] flex items-center justify-center text-white/20 mx-auto border border-white/10 shadow-inner">
            <Lock size={40} />
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl font-black text-white">{t('admin_lock_title') || 'لوحة الإدارة مقفولة'}</h1>
            <p className="text-text-secondary font-medium opacity-60">يرجى إدخال كلمة مرور الإدارة للمتابعة</p>
          </div>
          
          <form onSubmit={handleUnlock} className="space-y-6">
            <div className="space-y-4">
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-center text-xl text-white focus:outline-none focus:border-white/20 transition-all font-mono"
                autoFocus
              />
              
              <div className="flex justify-center border border-white/5 rounded-3xl bg-white/[0.02] overflow-hidden p-2">
                <HCaptcha
                  sitekey={import.meta.env.VITE_HCAPTCHA_SITE_KEY || "10000000-ffff-ffff-ffff-000000000001"}
                  onVerify={(token) => setCaptchaToken(token)}
                  onExpire={() => setCaptchaToken(null)}
                  theme="dark"
                  ref={captchaRef}
                />
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-sm font-black animate-shake">{error}</p>
            )}
            
            <button 
              type="submit"
              disabled={!captchaToken || !password}
              className={`w-full py-5 rounded-[24px] font-black text-lg transition-all shadow-[0_20px_50px_-15px_rgba(0,0,0,0.5)] active:scale-95 ${(!captchaToken || !password) ? 'opacity-30 cursor-not-allowed grayscale' : 'hover:translate-y-[-2px]'}`}
              style={{ 
                backgroundColor: branding.primaryColor,
                color: '#000'
              }}
            >
              <div className="flex items-center justify-center gap-3">
                <ShieldCheck size={22} />
                {t('unlock_admin') || 'فتح لوحة التحكم'}
              </div>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-24 max-w-[1600px]" dir={dir}>
      {branding.SHOW_HEALTH_CHECK && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-200 p-8 rounded-[40px] mb-12 animate-fade-in-up flex items-center gap-8">
          <div className="w-16 h-16 bg-yellow-500/20 rounded-2xl flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="h-10 w-10 text-yellow-500" />
          </div>
          <div>
            <p className="text-lg font-bold mb-1">{t('admin_health_check_promo')}</p>
            <Link to="/health-check" className="text-sm underline hover:text-white opacity-80" style={{ color: branding.primaryColor }}>
              {t('admin_health_check_promo_link')}
            </Link>
          </div>
        </div>
      )}

      <div className={`flex flex-col xl:flex-row gap-12`}>
        {/* Sidebar Navigation */}
        <aside className="w-full xl:w-80 flex-shrink-0">
          <div className="bg-white/[0.03] p-4 rounded-[40px] border border-white/10 sticky top-32">
            <div className="px-6 py-8 border-b border-white/5 mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-text-secondary mb-2">{t('management_panel')}</h2>
                <p className="text-xl font-black text-white leading-none">{branding.siteName}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-400 border border-green-500/20" title="Unlocked">
                <ShieldCheck size={20} />
              </div>
            </div>
            
            <nav className="space-y-1">
              {tabs.map(tab => (
                <button 
                  key={tab.id} 
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-sm font-black transition-all group ${
                    activeTab === tab.id 
                      ? 'shadow-xl text-brand-dark' 
                      : 'text-text-secondary hover:bg-white/5 hover:text-white'
                  }`}
                  style={{ 
                    backgroundColor: activeTab === tab.id ? branding.primaryColor : undefined,
                    boxShadow: activeTab === tab.id ? `0 10px 25px -5px ${branding.primaryColor}33` : 'none'
                  }}
                >
                  <tab.icon size={24} className={activeTab === tab.id ? 'text-brand-dark' : 'opacity-40 group-hover:opacity-100'} />
                  <span>{t(tab.labelKey)}</span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row items-center gap-6 mb-12">
            {PageIcon && (
              <div className="w-20 h-20 rounded-[28px] flex items-center justify-center bg-white/5 border border-white/10 shadow-2xl relative">
                <div className="absolute inset-0 blur-xl opacity-20" style={{ backgroundColor: branding.primaryColor }}></div>
                <PageIcon style={{ color: branding.primaryColor }} size={40} className="relative z-10" />
              </div>
            )}
            <h1 className="text-4xl md:text-5xl font-black text-white">{pageTitle}</h1>
          </div>
          
          <div className="animate-fade-in-up">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
