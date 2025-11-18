// src/components/AdminGate.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useAdminGate } from '../contexts/AdminGateContext';
import { useConfig } from '../contexts/ConfigContext';
import { useLocalization } from '../contexts/LocalizationContext';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { verifyAdminPassword, verifyCaptcha, sendDiscordLog } from '../lib/api';
import { supabase } from '../lib/supabaseClient';
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
    const { t, language } = useLocalization();
    const { showToast } = useToast();
    const { user } = useAuth();
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [hcaptchaToken, setHcaptchaToken] = useState<string | null>(null);
    const hasLoggedAccess = useRef(false);

    // Effect to log admin panel access once per session
    useEffect(() => {
        if (isVerified && user && !hasLoggedAccess.current) {
            hasLoggedAccess.current = true;
            const logAccess = async () => {
                const action = `Admin ${user.username} accessed the control panel.`;
                const logType = 'admin_access';
                // Log to DB
                supabase.rpc('log_admin_action', { p_action: action, p_log_type: logType });
                
                // Log to Discord
                const embed = {
                    title: t('log_admin_panel_access_title'),
                    description: t('log_admin_panel_access_desc', { adminUsername: user.username }),
                    color: 0xFFA500, // Orange
                    author: { name: user.username, icon_url: user.avatar },
                    timestamp: new Date().toISOString()
                };
                sendDiscordLog(config, embed, 'admin', language);
            };
            logAccess();
        }
    }, [isVerified, user, t, config, language]);

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
            await verifyCaptcha(hcaptchaToken);
            const success = await verifyAdminPassword(password);
            if (success) {
                verify();
            } else {
                showToast(t('admin_gate_incorrect'), 'error');
                setPassword('');
                 if (window.hcaptcha) {
                    window.hcaptcha.reset();
                    setHcaptchaToken(null);
                }
            }
        } catch (error) {
            const errorMessage = (error as Error).message;
            if (errorMessage.includes('secret key is missing')) {
                 showToast(t('error_captcha_not_configured_user'), 'error');
            } else {
                 showToast(errorMessage, 'error');
            }
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