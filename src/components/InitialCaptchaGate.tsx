import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { env } from '../env';
import { verifyCaptcha } from '../lib/api';

const HCaptcha: React.FC<{ onVerify: (token: string) => void, sitekey: string }> = ({ onVerify, sitekey }) => {
    const captchaRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);

    useEffect(() => {
        if ((window as any).hcaptcha && captchaRef.current && !widgetIdRef.current) {
            try {
                const id = (window as any).hcaptcha.render(captchaRef.current, {
                    sitekey: sitekey,
                    callback: onVerify,
                });
                widgetIdRef.current = id;
            } catch (e) { console.error("hCaptcha render error:", e); }
        }
        return () => {};
    }, [onVerify, sitekey]);
    
    return <div ref={captchaRef} className="flex justify-center flex-col items-center"></div>;
};

export const InitialCaptchaGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isVerified, setIsVerified] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const checkSession = async () => {
            try {
                const res = await fetch('/api/captcha-session');
                const data = await res.json();
                if (data.verified) {
                    setIsVerified(true);
                }
            } catch (err) {
                console.error("Failed to check session", err);
            }
        };
        checkSession();
    }, []);

    const handleVerify = async (token: string) => {
        setVerifying(true);
        setError(null);
        try {
            const res = await fetch('/api/captcha-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            const data = await res.json();
            
            if (data.success) {
                setIsVerified(true);
            } else {
                throw new Error(data.error || 'فشل التحقق، يرجى المحاولة مرة أخرى.');
            }
        } catch (err: any) {
            setError(err.message || 'خطأ في الاتصال بالخادم.');
            if ((window as any).hcaptcha) {
               try { (window as any).hcaptcha.reset(); } catch (e) { /* ignore */ }
            }
        } finally {
            setVerifying(false);
        }
    };

    if (isVerified) return <>{children}</>;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-brand-dark/95 backdrop-blur-md" dir="rtl">
            <div className="bg-brand-dark/50 p-12 rounded-[40px] border border-white/10 shadow-2xl flex flex-col items-center max-w-md w-full text-center">
                <div className="w-20 h-20 bg-brand-cyan/20 rounded-full flex items-center justify-center mb-6">
                    <ShieldCheck size={40} className="text-brand-cyan" />
                </div>
                <h2 className="text-2xl font-black text-white mb-2">حماية ضد الروبوتات</h2>
                <p className="text-gray-400 mb-8 leading-relaxed">
                    يرجى إكمال اختبار التحقق للتأكد من أنك إنسان ولست برنامج آلي (روبوت). هذا الإجراء لحماية مجتمعنا.
                </p>
                
                {verifying ? (
                    <div className="h-[78px] flex justify-center items-center">
                        <Loader2 className="animate-spin text-brand-cyan" size={40} />
                    </div>
                ) : env.VITE_HCAPTCHA_SITE_KEY ? (
                    <div className="flex flex-col items-center">
                        <HCaptcha onVerify={handleVerify} sitekey={env.VITE_HCAPTCHA_SITE_KEY} />
                        {error && <p className="text-red-400 mt-4 text-sm font-medium">{error}</p>}
                    </div>
                ) : (
                    <p className="text-red-400">مفتاح hCaptcha غير متوفر في متغيرات البيئة.</p>
                )}
            </div>
        </div>
    );
};
