
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

const HCaptcha: React.FC<{ onVerify: (token: string) => void, sitekey: string }> = ({ onVerify, sitekey }) => {
    const captchaRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);

    useEffect(() => {
        // FIX: Cast window to any to access hcaptcha property
        if ((window as any).hcaptcha && captchaRef.current && !widgetIdRef.current) {
            try {
                // FIX: Cast window to any to access hcaptcha property
                const id = (window as any).hcaptcha.render(captchaRef.current, {
                    sitekey: sitekey,
                    callback: onVerify,
                });
                widgetIdRef.current = id;
            } catch (e) {}
        }
        return () => {};
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

    useEffect(() => {
        if (isVerified && user && !hasLoggedAccess.current) {
            hasLoggedAccess.current = true;
            const logAccess = async () => {
                supabase.rpc('log_admin_action', { p_action: `Admin ${user.username} accessed control panel`, p_log_type: 'admin_access' });
                sendDiscordLog(config, { title: t('log_admin_panel_access_title'), description: user.username, color: 0xFFA500 }, 'admin', language);
            };
            logAccess();
        }
    }, [isVerified, user, t, config, language]);

    if (!config.admin_password || isVerified) return <>{children}</>;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!hcaptchaToken) { showToast('Please complete captcha.', 'warning'); return; }
        setIsLoading(true);
        try {
            await verifyCaptcha(hcaptchaToken);
            const success = await verifyAdminPassword(password);
            if (success) verify();
            else {
                showToast(t('admin_gate_incorrect'), 'error');
                setPassword('');
                // FIX: Cast window to any to access hcaptcha property
                if ((window as any).hcaptcha) try { (window as any).hcaptcha.reset(); } catch {}
                setHcaptchaToken(null);
            }
        } catch (error) {
            showToast((error as Error).message, 'error');
            // FIX: Cast window to any to access hcaptcha property
            if ((window as any).hcaptcha) try { (window as any).hcaptcha.reset(); } catch {}
            setHcaptchaToken(null);
        } finally { setIsLoading(false); }
    };
    
    return (
        <Modal isOpen={true} onClose={() => {}} title={t('admin_gate_title')}>
            <div className="text-center">
                <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-brand-light-blue mb-6">
                    <KeyRound className="w-8 h-8 text-brand-cyan"/>
                </div>
                <p className="text-gray-300 mb-6">{t('admin_gate_prompt')}</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input type="password" value={password} onChange={(e) => setPassword(e.currentTarget.value)} className="vixel-input text-center text-lg tracking-widest" autoFocus />
                    <div className="flex justify-center py-2">
                        {env.VITE_HCAPTCHA_SITE_KEY ? <HCaptcha onVerify={setHcaptchaToken} sitekey={env.VITE_HCAPTCHA_SITE_KEY} /> : null}
                    </div>
                    <button type="submit" disabled={isLoading || !password || !hcaptchaToken} className="w-full bg-brand-cyan text-brand-dark font-bold py-3 rounded-lg shadow-glow-cyan hover:bg-white transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50">
                        {isLoading ? <Loader2 className="animate-spin" /> : t('admin_gate_enter')}
                    </button>
                </form>
            </div>
        </Modal>
    );
};
export default AdminGate;