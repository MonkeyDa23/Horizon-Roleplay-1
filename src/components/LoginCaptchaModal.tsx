
import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, ShieldCheck } from 'lucide-react';
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
            } catch (e) { console.error("hCaptcha render error:", e); }
        }
        return () => {}; // No-op cleanup to prevent crashes
    }, [onVerify, sitekey]);
    
    return <div ref={captchaRef}></div>;
};

interface LoginCaptchaModalProps { isOpen: boolean; onClose: () => void; }

const LoginCaptchaModal: React.FC<LoginCaptchaModalProps> = ({ isOpen, onClose }) => {
    const { login, loading } = useAuth();
    const handleVerify = (token: string) => { onClose(); login(token); };
    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="التحقق الأمني">
            <div className="text-center">
                 <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-brand-light-blue mb-6">
                    <ShieldCheck className="w-8 h-8 text-brand-cyan"/>
                </div>
                <p className="text-gray-300 mb-6">لأسباب أمنية، يرجى إكمال اختبار التحقق للمتابعة.</p>
                <div className="flex justify-center py-2">
                    {loading ? (
                        <div className="h-[78px] flex items-center justify-center"><Loader2 size={40} className="animate-spin text-brand-cyan"/></div>
                    ) : env.VITE_HCAPTCHA_SITE_KEY ? (
                        <HCaptcha onVerify={handleVerify} sitekey={env.VITE_HCAPTCHA_SITE_KEY} />
                    ) : <p className="text-red-400 text-sm">hCaptcha key missing!</p>}
                </div>
            </div>
        </Modal>
    );
};
export default LoginCaptchaModal;
