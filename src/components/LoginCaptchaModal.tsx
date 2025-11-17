// src/components/LoginCaptchaModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, ShieldCheck } from 'lucide-react';
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


interface LoginCaptchaModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const LoginCaptchaModal: React.FC<LoginCaptchaModalProps> = ({ isOpen, onClose }) => {
    const { login, loading } = useAuth();

    const handleVerify = (token: string) => {
        // Supabase Attack Protection handles verification.
        // We just need to pass the token to the login function.
        // The modal is closed, and the login() call will trigger the loading state in the AuthContext,
        // which will show a spinner on the main login button before redirect.
        onClose();
        login(token);
    };
    
    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="التحقق الأمني">
            <div className="text-center">
                 <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-brand-light-blue mb-6">
                    <ShieldCheck className="w-8 h-8 text-brand-cyan"/>
                </div>
                <p className="text-gray-300 mb-6">
                    لأسباب أمنية، يرجى إكمال اختبار التحقق التالي للمتابعة.
                </p>
                <div className="flex justify-center py-2">
                    {loading ? (
                        <div className="h-[78px] flex items-center justify-center">
                            <Loader2 size={40} className="animate-spin text-brand-cyan"/>
                        </div>
                    ) : env.VITE_HCAPTCHA_SITE_KEY ? (
                        <HCaptcha onVerify={handleVerify} sitekey={env.VITE_HCAPTCHA_SITE_KEY} />
                    ) : (
                        <p className="text-red-400 text-sm">hCaptcha site key is not configured!</p>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default LoginCaptchaModal;