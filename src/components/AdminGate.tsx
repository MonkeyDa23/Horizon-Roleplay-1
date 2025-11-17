// src/components/AdminGate.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useAdminGate } from '../contexts/AdminGateContext';
import { useConfig } from '../contexts/ConfigContext';
import { useLocalization } from '../contexts/LocalizationContext';
import { useToast } from '../contexts/ToastContext';
// FIX: Added 'verifyCaptcha' to imports.
import { verifyAdminPassword, verifyCaptcha } from '../lib/api';
import Modal from './Modal';
import { Loader2, KeyRound } from 'lucide-react';
import { env } from '../env';

// HCaptcha component declaration for TypeScript
declare global {
    interface Window {
        hcaptcha: any;
    }
}

const HCaptcha: React.FC<{ onVerify: (token: string) => void, sitekey: string }> = ({ onVerify, sitekey }) => {
    const captchaRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (window.hcaptcha && captchaRef.current && !widgetIdRef.current) {
            const id = window.hcaptcha.render(captchaRef.current, {
                sitekey: sitekey,
                callback: onVerify,
            });
            widgetIdRef.current = id;
        }
        // Cleanup function to remove the widget when the component unmounts
        return () => {
            if (widgetIdRef.current) {
                try {
                    window.hcaptcha.remove(widgetIdRef.current);
                } catch (e) {
                    console.warn("hCaptcha remove widget error", e);
                }
                widgetIdRef.current = null;
            }
        };
    }, [onVerify, sitekey]);
    
    return <div ref={captchaRef}></div>;
};


const AdminGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isVerified, verify } = useAdminGate();
    const { config } = useConfig();
    const { t } = useLocalization();
    const { showToast } = useToast();
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [hcaptchaToken, setHcaptchaToken] = useState<string | null>(null);

    // If no password is set in the config, or if the user is already verified, grant access.
    if (!config.admin_password || isVerified) {
        return <>{children}</>;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!hcaptchaToken) {
            showToast('الرجاء إكمال اختبار التحقق.', 'warning');
            return;
        }
        setIsLoading(true);
        try {
            // FIX: Separated captcha verification from password check. First verify captcha, then verify password.
            await verifyCaptcha(hcaptchaToken);
            const success = await verifyAdminPassword(password);
            if (success) {
                verify();
            } else {
                showToast(t('admin_gate_incorrect'), 'error');
                setPassword('');
                 if (window.hcaptcha) {
                    // Reset captcha on failure
                    window.hcaptcha.reset();
                    setHcaptchaToken(null);
                }
            }
        } catch (error) {
            showToast((error as Error).message, 'error');
             if (window.hcaptcha) {
                window.hcaptcha.reset();
                setHcaptchaToken(null);
            }
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <Modal isOpen={true} onClose={() => {}} title={t('admin_gate_title')}>
            <div className="text-center">
                <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-brand-light-blue mb-6">
                    <KeyRound className="w-8 h-8 text-brand-cyan"/>
                </div>
                <p className="text-gray-300 mb-6">{t('admin_gate_prompt')}</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="admin-password" className="sr-only">{t('admin_gate_password')}</label>
                        <input
                            id="admin-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.currentTarget.value)}
                            className="vixel-input text-center text-lg tracking-widest"
                            autoFocus
                        />
                    </div>

                    <div className="flex justify-center py-2">
                        {env.VITE_HCAPTCHA_SITE_KEY ? (
                             <HCaptcha onVerify={setHcaptchaToken} sitekey={env.VITE_HCAPTCHA_SITE_KEY} />
                        ) : (
                            <p className="text-red-400 text-sm">hCaptcha site key is not configured!</p>
                        )}
                    </div>

                    <button 
                        type="submit"
                        disabled={isLoading || !password || !hcaptchaToken}
                        className="w-full bg-brand-cyan text-brand-dark font-bold py-3 rounded-lg shadow-glow-cyan hover:bg-white transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="animate-spin" /> : t('admin_gate_enter')}
                    </button>
                </form>
            </div>
        </Modal>
    );
};

export default AdminGate;
