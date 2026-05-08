/**
 * Nova Roleplay - Official Website
 * Two-Factor Authentication Setup Component
 */
import React, { useState, useEffect } from 'react';
import * as otplib from 'otplib';
import QRCode from 'qrcode';
import { ShieldCheck, ShieldAlert, Copy, RefreshCw, CheckCircle2, AlertCircle, Key, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocalization } from '../../contexts/LocalizationContext';
import { enable2FA, disable2FA } from '../../lib/api';

const TwoFactorSetup: React.FC = () => {
  const { user, updateUser } = useAuth();
  const { t, language } = useLocalization();
  const isArabic = language === 'ar';

  // Extract authenticator safely for both dev and production
  const authenticator = (otplib as any).authenticator || (otplib as any).default?.authenticator || otplib;

  const [step, setStep] = useState<'status' | 'setup' | 'verify' | 'backup'>('status');
  const [secret, setSecret] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user?.two_factor_enabled) {
      setStep('status');
    }
  }, [user]);

  const startSetup = async () => {
    setLoading(true);
    setError(null);
    try {
      const newSecret = authenticator.generateSecret();
      
      // Robust keyuri generation
      const userName = user?.discordId || user?.username || 'user';
      const issuer = 'Nova Roleplay نوفا رول بلاي';
      let otpauth = '';
      
      try {
        if (typeof authenticator.keyuri === 'function') {
          otpauth = authenticator.keyuri(userName, issuer, newSecret);
        } else {
          // Manual fallback if bundled incorrectly
          otpauth = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(userName)}?secret=${newSecret}&issuer=${encodeURIComponent(issuer)}`;
        }
      } catch (e) {
        otpauth = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(userName)}?secret=${newSecret}&issuer=${encodeURIComponent(issuer)}`;
      }
      
      const qr = await QRCode.toDataURL(otpauth);
      setSecret(newSecret);
      setQrCodeUrl(qr);
      setStep('setup');
    } catch (err) {
      console.error('2FA Setup Error:', err);
      setError(isArabic ? 'فشل إعداد الحماية الثنائية' : 'Failed to setup 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError(null);
    setLoading(true);
    try {
      if (!verificationCode || !secret || !user) {
        throw new Error(isArabic ? 'المعلومات ناقصة' : 'Missing fields');
      }

      // Try multiple verification methods provided by otplib variants
      let isValid = false;
      
      try {
        if (typeof authenticator.check === 'function') {
          isValid = authenticator.check(verificationCode, secret);
        } else if (typeof authenticator.verify === 'function') {
          isValid = authenticator.verify({ token: verificationCode, secret });
        }
      } catch (checkErr) {
        console.error('Check failed:', checkErr);
      }
      
      if (!isValid) {
        setError(t('2fa_invalid_code') || 'رمز غير صحيح');
        setLoading(false);
        return;
      }

      // If valid, send to backend
      const response = await fetch('/api/auth/2fa/enable', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sb-access-token')}` // Placeholder for real token handling
        },
        body: JSON.stringify({ secret, token: verificationCode })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to enable 2FA');
      }
      
      // Update local state
      updateUser({ ...user, two_factor_enabled: true });
      setStep('status');
    } catch (err: any) {
      console.error('2FA Activation Error:', err);
      setError(isArabic ? 'حدث خطأ أثناء التفعيل' : 'Error during activation');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!window.confirm(isArabic ? 'هل أنت متأكد من تعطيل الحماية الثنائية؟ سيقلل هذا من أمان حسابك.' : 'Are you sure you want to disable 2FA? This will reduce your account security.')) return;
    
    setLoading(true);
    try {
      await disable2FA();
      if (user) updateUser({ ...user, two_factor_enabled: false });
      setStep('status');
    } catch (err) {
      console.error('2FA Disable Error:', err);
      setError(isArabic ? 'فشل تعطيل الحماية' : 'Failed to disable 2FA');
    } finally {
      setLoading(false);
    }
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 overflow-hidden relative" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-4 mb-8">
        <div className={`p-4 rounded-2xl ${user?.two_factor_enabled ? 'bg-green-500/10' : 'bg-brand-cyan/10'}`}>
          {user?.two_factor_enabled ? <ShieldCheck className="text-green-500" size={42} /> : <Lock className="text-brand-cyan" size={42} />}
        </div>
        <div>
          <h2 className="text-2xl font-black text-white">{t('2fa_title') || 'الحماية الثنائية'}</h2>
          <p className="text-text-secondary text-sm">{t('2fa_desc') || 'أضف طبقة إضافية من الأمان لحسابك'}</p>
        </div>
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, x: -10 }} 
          animate={{ opacity: 1, x: 0 }} 
          className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 text-sm"
        >
          <AlertCircle size={18} />
          {error}
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {step === 'status' && (
          <motion.div key="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {user?.two_factor_enabled ? (
              <div className="space-y-6">
                <div className="p-8 bg-green-500/5 border border-green-500/10 rounded-[30px] text-center space-y-4">
                  <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto text-green-500">
                    <ShieldCheck size={64} />
                  </div>
                  <div>
                    <div className="text-xl font-black text-white mb-2">
                      {isArabic ? 'حسابك محمي بنجاح' : 'Account Securely Protected'}
                    </div>
                    <p className="text-text-secondary text-sm leading-relaxed opacity-70">
                      {isArabic ? 'الحماية الثنائية مفعلة حالياً. يتم طلب رمز التحقق عند كل دخول للوحة الإدارة.' : '2FA is active. A verification code will be required for every admin panel access.'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={handleDisable} 
                  disabled={loading}
                  className="w-full py-5 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 hover:border-red-500/20 rounded-2xl text-red-500 font-black transition-all flex items-center justify-center gap-3 group active:scale-95"
                >
                  <ShieldAlert size={20} className="opacity-50 group-hover:opacity-100 transition-opacity" />
                  {t('2fa_disable') || 'إيقاف الحماية الثنائية'}
                </button>
              </div>
            ) : (
              <div className="text-center py-6 space-y-8">
                <div className="w-24 h-24 bg-white/5 rounded-[40px] flex items-center justify-center mx-auto border border-white/5 text-white/20">
                  <Lock size={64} />
                </div>
                <div className="space-y-3">
                  <h3 className="text-xl font-black text-white">{isArabic ? 'قم بتعزيز أمان حسابك' : 'Fortify Your Account'}</h3>
                  <p className="text-text-secondary text-sm leading-relaxed max-w-xs mx-auto opacity-60">
                    {isArabic ? 'تفعيل المصادقة الثنائية يمنع المتسللين من الدخول لحسابك حتى لو حصلوا على كلمة المرور.' : 'Enabling 2FA stops hackers from accessing your account even if they have your password.'}
                  </p>
                </div>
                <button 
                  onClick={startSetup} 
                  disabled={loading}
                  className="w-full py-5 font-black rounded-3xl transition-all shadow-[0_20px_50px_-15px_rgba(0,0,0,0.5)] flex items-center justify-center gap-3 transform hover:translate-y-[-2px] active:scale-95"
                  style={{ backgroundColor: branding.primaryColor, color: '#000' }}
                >
                  {loading ? <RefreshCw className="animate-spin" size={20} /> : <ShieldCheck size={20} />}
                  {t('2fa_enable') || 'ابدأ خطوات التفعيل'}
                </button>
              </div>
            )}
          </motion.div>
        )}

        {step === 'setup' && (
          <motion.div key="setup" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
            <div className="text-center space-y-6">
              <div className="inline-flex items-center gap-3 px-6 py-2 bg-white/5 rounded-full border border-white/10 text-[11px] uppercase font-black tracking-[0.2em] text-text-secondary">
                <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: branding.primaryColor }}></span>
                {isArabic ? 'الخطوة 1: مسح الكود' : 'Step 1: Scan QR'}
              </div>
              <h3 className="text-3xl md:text-4xl font-black text-white">{isArabic ? 'بدء الحماية' : 'Secure Account'}</h3>
              <p className="text-text-secondary text-sm md:text-base leading-relaxed max-w-sm mx-auto opacity-70">
                {isArabic ? 'افتح تطبيق Authenticator على هاتفك وقم بمسح رمز الـ QR الظاهر أدناه لإضافة حسابك.' : 'Open your Authenticator app and scan the QR code below to link your community account.'}
              </p>
            </div>

            <div className="relative group max-w-[280px] mx-auto">
              <div className="absolute inset-0 bg-white/10 blur-[100px] rounded-full opacity-20 group-hover:opacity-40 transition-opacity"></div>
              <div className="relative p-8 bg-white rounded-[40px] shadow-2xl flex justify-center border-[10px] border-white/5 group-hover:scale-105 transition-transform">
                <img src={qrCodeUrl} alt="QR Code" className="w-full h-auto" />
              </div>
            </div>

            <div className="space-y-4 max-w-sm mx-auto">
              <button 
                onClick={() => setStep('verify')}
                className="w-full py-5 font-black rounded-3xl transition-all shadow-[0_20px_40px_-5px_rgba(0,0,0,0.4)] flex items-center justify-center gap-3 active:scale-95 group"
                style={{ backgroundColor: branding.primaryColor, color: '#111' }}
              >
                <span className="text-lg">{isArabic ? 'تم المسح، انتقل للتحقق' : 'I have scanned it'}</span>
                <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button 
                onClick={() => setStep('status')}
                className="w-full py-3 text-text-secondary text-sm font-black hover:text-white transition-all opacity-40 hover:opacity-100"
              >
                {isArabic ? 'إلغاء الإعداد' : 'Cancel Setup'}
              </button>
            </div>

            <div className="pt-6 p-6 bg-white/[0.03] rounded-[32px] border border-white/5 text-center max-w-sm mx-auto">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-3">{isArabic ? 'أو أدخل المفتاح يدوياً' : 'Or Manual Setup Key'}</div>
              <div className="flex items-center justify-between gap-4 bg-black/20 p-4 rounded-2xl border border-white/5">
                <code className="text-base font-mono text-white/80 select-all">{secret}</code>
                <button onClick={() => { navigator.clipboard.writeText(secret); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all text-brand-cyan">
                  {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'verify' && (
          <motion.div key="verify" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
            <div className="text-center space-y-6">
              <div className="inline-flex items-center gap-3 px-6 py-2 bg-white/5 rounded-full border border-white/10 text-[11px] uppercase font-black tracking-[0.2em] text-text-secondary">
                <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: branding.primaryColor }}></span>
                {isArabic ? 'الخطوة 2: التحقق' : 'Step 2: Verification'}
              </div>
              <h3 className="text-3xl md:text-4xl font-black text-white">{isArabic ? 'تأكيد الرمز' : 'Verify Code'}</h3>
              <p className="text-text-secondary text-sm md:text-base opacity-70">
                {isArabic ? 'أدخل الرمز المكون من 6 أرقام والموجود في تطبيق المصادقة لديك.' : 'Enter the 6-digit verification code from your authenticator app.'}
              </p>
            </div>

            <div className="space-y-8 max-w-sm mx-auto">
              <div className="relative">
                <input 
                  type="text" 
                  maxLength={6} 
                  placeholder="000 000"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-5xl font-black bg-white/5 border border-white/10 rounded-[40px] py-10 px-6 w-full text-white tracking-[0.2em] focus:border-white/30 focus:bg-white/[0.08] transition-all outline-none shadow-inner placeholder:opacity-10"
                />
              </div>
              
              <button 
                onClick={handleVerify} 
                disabled={loading || verificationCode.length !== 6}
                className="w-full py-6 font-black rounded-3xl transition-all shadow-[0_20px_40px_-5px_rgba(0,0,0,0.4)] flex items-center justify-center gap-4 disabled:opacity-20 disabled:grayscale active:scale-95 text-lg"
                style={{ backgroundColor: branding.primaryColor, color: '#111' }}
              >
                {loading ? <RefreshCw className="animate-spin" size={24} /> : (
                  <>
                    <ShieldCheck size={24} />
                    <span>{isArabic ? 'تفعيل الحماية المزدوجة' : 'Enable 2FA Protection'}</span>
                  </>
                )}
              </button>
              
              <button 
                onClick={() => setStep('setup')}
                className="w-full py-4 text-text-secondary text-sm font-black hover:text-white transition-all opacity-40 hover:opacity-100"
              >
                {isArabic ? 'رجوع لتصوير الكود' : 'Back to QR Code'}
              </button>
            </div>
          </motion.div>
        )}

        {step === 'backup' && (
          <motion.div key="backup" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
            <div className="p-6 bg-yellow-500/5 border border-yellow-500/10 rounded-3xl mb-6">
              <div className="flex items-center gap-3 text-yellow-500 font-bold mb-3">
                <AlertCircle size={20} />
                {t('2fa_backup_codes') || 'أكواد النسخ الاحتياطي'}
              </div>
              <p className="text-text-secondary text-sm leading-relaxed">
                {t('2fa_backup_desc') || 'يرجى حفظ هذه الأكواد في مكان آمن. يمكنك استخدامها في حال فقدان الوصول لتطبيق المصادقة.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-black/20 p-6 rounded-3xl border border-white/5 font-mono shadow-inner">
              {backupCodes.map((code, idx) => (
                <div key={idx} className="text-white font-bold opacity-80 hover:opacity-100 transition-opacity">
                  <span className="text-white/40 mr-2 text-xs">{idx + 1}.</span>
                  {code}
                </div>
              ))}
            </div>

            <div className="flex gap-4 pt-6">
              <button 
                onClick={copyBackupCodes}
                className="flex-1 py-5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white font-bold transition-all flex items-center justify-center gap-3"
              >
                {copied ? <CheckCircle2 className="text-green-500" size={24} /> : <Copy size={24} />}
                {isArabic ? 'نسخ' : 'Copy'}
              </button>
              <button 
                onClick={() => setStep('status')}
                className="flex-1 py-5 bg-white text-bg-primary font-black rounded-2xl transition-all shadow-xl"
              >
                {isArabic ? 'تم الحفظ' : 'Done'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TwoFactorSetup;
