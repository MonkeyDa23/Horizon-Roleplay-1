/**
 * Nova Roleplay - Official Website
 * Two-Factor Authentication Lock Modal
 * Copyright (c) 2024 Nova Roleplay. All rights reserved.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Key, LogOut, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocalization } from '../../contexts/LocalizationContext';

const TwoFactorModal: React.FC = () => {
    const { user, isTwoFactorVerified, verifyTwoFactor, logout } = useAuth();
    const { t, language } = useLocalization();
    const isArabic = language === 'ar';

    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    if (!user || user.is_banned || isTwoFactorVerified) return null;
    if (!user.two_factor_enabled) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (code.length < 6) return;
        
        setLoading(true);
        setError(false);
        const success = await verifyTwoFactor(code);
        if (!success) {
            setError(true);
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 backdrop-blur-2xl bg-brand-dark/95">
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="w-full max-w-md bg-white/[0.03] border border-white/10 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden"
                dir={isArabic ? 'rtl' : 'ltr'}
            >
                {/* Decorative BG */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-cyan/5 blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                
                <div className="relative z-10 text-center">
                    <div className="w-20 h-20 bg-brand-cyan/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-brand-cyan/20">
                        <ShieldCheck className="text-brand-cyan" size={40} />
                    </div>

                    <h2 className="text-3xl font-black text-white mb-3 tracking-tight">
                        {t('2fa_title')}
                    </h2>
                    <p className="text-text-secondary text-sm mb-10 leading-relaxed">
                        {isArabic 
                            ? 'هذا الحساب محمي بخاصية التحقق الثنائي. يرجى إدخال الرمز من تطبيق المصادقة الخاص بك للمتابعة.'
                            : 'This account is protected by 2FA. Please enter the code from your authenticator app to continue.'}
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="relative">
                            <input 
                                type="text"
                                maxLength={8}
                                placeholder="000 000"
                                value={code}
                                onChange={(e) => setCode(e.target.value.toUpperCase())}
                                className={`w-full text-center text-4xl font-black bg-white/5 border ${error ? 'border-red-500/50 bg-red-500/5' : 'border-white/10'} rounded-3xl py-6 px-4 text-brand-cyan tracking-[0.3em] outline-none transition-all placeholder:opacity-20`}
                                autoFocus
                            />
                            {error && (
                                <motion.div 
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="absolute -bottom-7 left-0 right-0 text-red-500 text-xs font-bold flex items-center justify-center gap-1"
                                >
                                    <AlertCircle size={14} />
                                    {t('2fa_invalid_code')}
                                </motion.div>
                            )}
                        </div>

                        <button 
                            type="submit"
                            disabled={loading || code.length < 6}
                            className="w-full py-5 bg-brand-cyan disabled:opacity-50 disabled:cursor-not-allowed text-brand-dark font-black rounded-3xl shadow-xl shadow-brand-cyan/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
                        >
                            {loading ? <RefreshCw className="animate-spin" size={24} /> : <ArrowRight size={24} />}
                            {isArabic ? 'تأكيد الرمز' : 'Verify Code'}
                        </button>
                    </form>

                    <button 
                        onClick={logout}
                        className="mt-8 flex items-center justify-center gap-2 text-text-secondary hover:text-white transition-colors text-sm font-bold mx-auto"
                    >
                        <LogOut size={18} />
                        {isArabic ? 'تسجيل الخروج والعودة' : 'Logout and return'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default TwoFactorModal;
