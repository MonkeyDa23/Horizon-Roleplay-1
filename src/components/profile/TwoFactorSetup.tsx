/**
 * Nova Roleplay - Official Website
 * Two-Factor Authentication Setup Component
 */
import React, { useState, useEffect } from 'react';
import * as otplibNamespace from 'otplib';
const otplib = otplibNamespace as any;
const authenticator = otplib.authenticator || (otplib.default && otplib.default.authenticator) || otplib.default || otplib;
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
      // Robust check/verify call to handle different export formats in production
      const checkFn = authenticator.check || (authenticator as any).verify || (authenticator as any).default?.check;
      
      if (typeof checkFn !== 'function') {
        throw new Error('Authenticator check function not found');
      }

      const isValid = checkFn(verificationCode, secret);
      if (!isValid) {
        setError(t('2fa_invalid_code') || 'رمز غير صحيح');
        return;
      }

      // Generate 10 backup codes
      const codes = Array.from({ length: 10 }, () => 
        Math.random().toString(36).substring(2, 10).toUpperCase()
      );

      await enable2FA(secret, codes);
      setBackupCodes(codes);
      setStep('backup');

      // Update local user state
      if (user) {
        updateUser({ ...user, two_factor_enabled: true });
      }
    } catch (err) {
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
        <div className={`p-3 rounded-2xl ${user?.two_factor_enabled ? 'bg-green-500/10' : 'bg-brand-cyan/10'}`}>
          {user?.two_factor_enabled ? <ShieldCheck className="text-green-500" size={32} /> : <Lock className="text-brand-cyan" size={32} />}
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
                <div className="p-6 bg-green-500/5 border border-green-500/10 rounded-2xl">
                  <div className="flex items-center gap-3 text-green-500 font-bold mb-2">
                    <CheckCircle2 size={20} />
                    {isArabic ? 'الحماية الثنائية مفعلة' : 'Two-Factor Authentication is active'}
                  </div>
                  <p className="text-text-secondary text-sm">
                    {isArabic ? 'حسابك محمي حالياً بكلمة مرور ورمز من تطبيق المصادقة الخاص بك.' : 'Your account is currently protected by your password and a code from your authentication app.'}
                  </p>
                </div>
                <button 
                  onClick={handleDisable} 
                  disabled={loading}
                  className="w-full py-4 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 rounded-2xl text-white font-bold transition-all flex items-center justify-center gap-2 group"
                >
                  <ShieldAlert size={20} className="text-red-500 opacity-50 group-hover:opacity-100 transition-opacity" />
                  {t('2fa_disable') || 'تعطيل الحماية'}
                </button>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="mb-6 text-text-secondary">
                  {isArabic ? 'لم تقم بتفعيل الحماية الثنائية بعد. ننصح وبشدة بتفعيلها لحماية حسابك من الاختراق.' : 'You haven\'t enabled 2FA yet. We highly recommend enabling it to protect your account from hacking.'}
                </div>
                <button 
                  onClick={startSetup} 
                  disabled={loading}
                  className="w-full py-4 bg-white text-bg-primary font-black rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  {loading ? <RefreshCw className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                  {t('2fa_enable') || 'تفعيل الآن'}
                </button>
              </div>
            )}
          </motion.div>
        )}

        {step === 'setup' && (
          <motion.div key="setup" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex flex-col items-center">
              <div className="p-4 bg-white rounded-3xl mb-6 shadow-2xl">
                <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" />
              </div>
              <p className="text-text-secondary text-center text-sm mb-6 max-w-sm">
                {t('2fa_qr_help') || 'قم بمسح الكود أعلاه باستخدام تطبيق Google Authenticator أو تطبيق مماثل.'}
              </p>
              
              <div className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl mb-8">
                <div className="text-xs text-text-secondary mb-2 uppercase font-bold">
                  {isArabic ? 'أو أدخل الكود يدوياً' : 'Or enter secret manually'}
                </div>
                <div className="flex items-center justify-between gap-4">
                  <code className="text-white font-mono text-lg">{secret}</code>
                  <button 
                    onClick={() => navigator.clipboard.writeText(secret)}
                    className="p-2 hover:bg-white/10 rounded-xl text-text-secondary transition-colors"
                  >
                    <Copy size={18} />
                  </button>
                </div>
              </div>

              <button 
                onClick={() => setStep('verify')}
                className="w-full py-4 bg-white text-bg-primary font-black rounded-2xl transition-all shadow-xl"
              >
                {isArabic ? 'التالي: التحقق' : 'Next: Verify'}
              </button>
              <button 
                onClick={() => setStep('status')}
                className="mt-4 text-text-secondary text-sm hover:text-white transition-colors"
              >
                {isArabic ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </motion.div>
        )}

        {step === 'verify' && (
          <motion.div key="verify" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
            <div className="text-center mb-8">
              <div className="bg-white/5 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/5">
                <Key className="text-white" size={32} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{t('2fa_verify_code') || 'التحقق من الرمز'}</h3>
              <p className="text-text-secondary text-sm">
                {isArabic ? 'أدخل الرمز المكون من 6 أرقام من التطبيق' : 'Enter the 6-digit code from your app'}
              </p>
            </div>

            <div className="flex justify-center">
              <input 
                type="text" 
                maxLength={6} 
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                className="text-center text-4xl font-black bg-white/5 border border-white/10 rounded-2xl py-4 px-6 w-full max-w-xs text-white tracking-[0.5em] focus:border-white/30 focus:bg-white/[0.08] transition-all outline-none"
              />
            </div>

            <div className="space-y-3 pt-6">
              <button 
                onClick={handleVerify} 
                disabled={loading || verificationCode.length !== 6}
                className="w-full py-4 bg-white disabled:opacity-50 disabled:cursor-not-allowed text-bg-primary font-black rounded-2xl transition-all shadow-lg"
              >
                {loading ? <RefreshCw className="animate-spin" size={20} /> : (isArabic ? 'تفعيل الحماية' : 'Enable 2FA')}
              </button>
              <button 
                onClick={() => setStep('setup')}
                className="w-full py-4 text-text-secondary text-sm hover:text-white transition-colors"
              >
                {isArabic ? 'رجوع للرمز' : 'Back to QR'}
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
