
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocalization } from '../contexts/LocalizationContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabaseClient';
import SEO from '../components/SEO';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, ShieldCheck, AlertCircle, Loader2, CheckCircle2, ExternalLink, LogOut, KeyRound, Copy } from 'lucide-react';

const LinkAccountPage: React.FC = () => {
    const { user, refreshUser } = useAuth();
    const { t } = useLocalization();
    const { showToast } = useToast();
    
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [linkCode, setLinkCode] = useState<string | null>(null);
    const [cooldownMessage, setCooldownMessage] = useState<string | null>(null);

    const handleGenerateCode = async () => {
        if (!user?.mta_serial) {
            showToast(t('link_account.no_serial_found'), 'error');
            return;
        }

        setIsLoading(true);
        setCooldownMessage(null);
        try {
            const response = await axios.post('/api/mta/generate-code', { serial: user.mta_serial });
            const data = response.data;

            if (data.success) {
                setLinkCode(data.code);
            } else {
                setCooldownMessage(data.message || t('link_account.generate_code_error'));
                setLinkCode(null);
            }
        } catch (err: any) {
            if (err.response && err.response.status === 429) {
                setCooldownMessage(err.response.data.message || t('link_account.cooldown_error'));
            } else {
                showToast(t('link_account.generate_code_error'), 'error');
            }
            console.error('Generate code error:', err);
        } finally {
            setIsLoading(false);
        }
    };

        const handleLink = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code || code.trim() === '') {
            showToast(t('link_account.enter_valid_code'), 'warning');
            return;
        }

        setIsLoading(true);
        try {
            // The new RPC function takes the code and the user's profile ID
            const { data, error } = await supabase.rpc('link_mta_account_with_temp_code', {
                p_code: code.trim(),
                p_user_id: user?.id
            });

            if (error) throw error;

            if (data.success) {
                showToast(data.message, 'success');
                await refreshUser?.(); // Refresh user context to get new MTA data
                setIsSuccess(true);
            } else {
                showToast(data.message, 'error');
            }
        } catch (err) {
            console.error('Linking error:', err);
            showToast((err as Error).message || t('link_account.link_error'), 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUnlink = async () => {
        if (!window.confirm(t('unlink_confirm'))) return;
        
        setIsLoading(true);
        try {
            const response = await fetch('/api/mta/unlink', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serial: user?.mta_serial })
            });

            if (response.ok) {
                showToast(t('unlink_success'), 'success');
                await refreshUser?.();
            } else {
                showToast('فشل إلغاء الربط', 'error');
            }
        } catch (error) {
            console.error('Unlink error:', error);
            showToast('حدث خطأ أثناء محاولة إلغاء الربط', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    if (!user) {
        return (
            <div className="container mx-auto px-6 py-24 text-center">
                <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-6" />
                <h1 className="text-3xl font-bold mb-4">يجب تسجيل الدخول أولاً</h1>
                <p className="text-gray-400 mb-8">يرجى تسجيل الدخول عبر ديسكورد لتتمكن من ربط حسابك في اللعبة.</p>
            </div>
        );
    }

    return (
        <>
            <SEO title={t('link_account.title')} description={t('link_account.description')} />
            
            <div className="container mx-auto px-6 py-16">
                <div className="max-w-2xl mx-auto">
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-brand-dark-blue/40 border border-white/10 rounded-[32px] p-8 md:p-12 backdrop-blur-xl shadow-2xl relative overflow-hidden"
                    >
                        {/* Decorative background glow */}
                        <div className="absolute -top-24 -right-24 w-48 h-48 bg-brand-cyan/10 rounded-full blur-3xl"></div>
                        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-brand-purple/10 rounded-full blur-3xl"></div>

                        <div className="relative z-10">
                            <div className="flex items-center gap-4 mb-10">
                                <div className="w-16 h-16 rounded-2xl bg-brand-cyan/20 flex items-center justify-center border border-brand-cyan/30">
                                    <Link2 className="text-brand-cyan w-9 h-9" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-black text-white tracking-tight">{t('link_account.main_title')}</h1>
                                    <p className="text-gray-400 text-sm font-medium">{t('link_account.subtitle')}</p>
                                </div>
                            </div>

                            {user.is_mta_linked ? (
                                <div className="text-center py-4">
                                    <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-8 border border-green-500/30">
                                        <CheckCircle2 className="text-green-400 w-14 h-14" />
                                    </div>
                                    <h2 className="text-3xl font-black text-white mb-3 tracking-tight">{t('link_account.already_linked_title')}</h2>
                                    <p className="text-gray-400 mb-10">{t('link_account.already_linked_subtitle')}</p>
                                    
                                    <div className="bg-brand-dark px-8 py-6 rounded-3xl font-black text-3xl text-brand-cyan border border-white/5 mb-10 shadow-inner">
                                        {user.mta_name || '...'}
                                    </div>

                                    <div className="space-y-4 mb-10">
                                        <div className="flex justify-between items-center p-5 bg-white/5 rounded-2xl border border-white/5">
                                            <span className="text-gray-400 font-bold text-sm">{t('link_account.status_label')}</span>
                                            <span className="text-green-400 font-black text-sm flex items-center gap-2">
                                                <ShieldCheck size={18} /> {t('link_account.status_linked')}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center p-5 bg-white/5 rounded-2xl border border-white/5">
                                            <span className="text-gray-400 font-bold text-sm">{t('link_account.linked_since_label')}</span>
                                            <span className="text-white font-black text-sm font-mono">
                                                {user.mta_linked_at ? new Date(user.mta_linked_at).toLocaleDateString('en-GB') : t('general.not_available')}
                                            </span>
                                        </div>
                                    </div>

                                    <button 
                                        onClick={handleUnlink}
                                        disabled={isLoading}
                                        className="w-full py-4 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2"
                                    >
                                        {isLoading ? <Loader2 className="animate-spin" /> : <><LogOut size={18} /> {t('unlink_account')}</>}
                                    </button>
                                </div>
                            ) : isSuccess ? (
                                <motion.div 
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="text-center py-12"
                                >
                                    <CheckCircle2 className="w-24 h-24 text-green-400 mx-auto mb-8" />
                                    <h2 className="text-4xl font-black text-white mb-4 tracking-tight">{t('link_account.success_title')}</h2>
                                    <p className="text-gray-400 mb-10 leading-relaxed">{t('link_account.success_subtitle')}</p>
                                    <button 
                                        onClick={() => setIsSuccess(false)}
                                        className="px-12 py-4 bg-brand-cyan text-brand-dark font-black rounded-2xl hover:bg-white transition-all shadow-2xl shadow-brand-cyan/20"
                                    >
                                        {t('general.close')}
                                    </button>
                                </motion.div>
                            ) : (
                                <div className="space-y-10">
                                    <div className="bg-brand-cyan/5 border border-brand-cyan/20 rounded-3xl p-8 text-center">
                                        {linkCode ? (
                                            <div className="space-y-6">
                                                <div>
                                                    <h3 className="text-brand-cyan font-black mb-3 text-lg">{t('link_account.your_code_is')}</h3>
                                                    <div 
                                                        className="bg-brand-dark px-6 py-5 rounded-2xl font-black text-4xl text-white border border-white/10 shadow-inner tracking-[0.2em] cursor-pointer"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(linkCode);
                                                            showToast(t('general.copied'), 'info');
                                                        }}
                                                    >
                                                        {linkCode}
                                                    </div>
                                                </div>
                                                <p className="text-gray-400 text-xs font-medium">{t('link_account.code_usage_instructions')}</p>
                                            </div>
                                        ) : cooldownMessage ? (
                                            <div className="py-6">
                                                <AlertCircle className="text-yellow-400 w-12 h-12 mx-auto mb-4" />
                                                <h3 className="text-yellow-400 font-black mb-2">{t('link_account.cooldown_title')}</h3>
                                                <p className="text-gray-300 font-medium">{cooldownMessage}</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-6">
                                                <h3 className="text-brand-cyan font-black mb-2 text-lg">{t('link_account.ready_to_link')}</h3>
                                                <p className="text-gray-400 text-sm font-medium max-w-sm mx-auto">{t('link_account.press_button_to_get_code')}</p>
                                                <button 
                                                    onClick={handleGenerateCode}
                                                    disabled={isLoading}
                                                    className="w-full bg-brand-cyan text-brand-dark font-black py-4 rounded-2xl shadow-lg shadow-brand-cyan/20 hover:bg-white transition-all flex items-center justify-center gap-3"
                                                >
                                                    {isLoading ? <Loader2 className="animate-spin" /> : <KeyRound />}
                                                    {t('link_account.generate_code_button')}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <form onSubmit={handleLink} className="space-y-8">
                                        <div>
                                            <label className="block text-gray-400 text-xs font-black uppercase tracking-widest mb-3 mr-1">{t('link_account.code_label')}</label>
                                            <div className="relative">
                                                <input 
                                                    type="text" 
                                                    value={code}
                                                    onChange={(e) => setCode(e.target.value)}
                                                    placeholder="VXL-XXXXX-XXXXX"
                                                    className="w-full bg-brand-dark border border-white/10 rounded-3xl px-8 py-5 text-white focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 transition-all outline-none text-center font-mono text-xl tracking-[0.2em] placeholder:opacity-20 pr-14"
                                                    disabled={isLoading}
                                                />
                                                <AnimatePresence>
                                                {code && (
                                                    <motion.button
                                                        type="button"
                                                        onClick={() => { 
                                                            navigator.clipboard.writeText(code);
                                                            showToast(t('general.copied'), 'info');
                                                        }}
                                                        initial={{ opacity: 0, scale: 0.8 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        exit={{ opacity: 0, scale: 0.8 }}
                                                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-white transition-colors"
                                                    >
                                                        <Copy size={20} />
                                                    </motion.button>
                                                )}
                                                </AnimatePresence>
                                            </div>
                                        </div>

                                        <button 
                                            type="submit"
                                            disabled={isLoading || !code}
                                            className="w-full bg-brand-cyan text-brand-dark font-black py-5 rounded-3xl shadow-2xl shadow-brand-cyan/30 hover:bg-white transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest"
                                        >
                                            {isLoading ? (
                                                <Loader2 className="animate-spin" />
                                            ) : (
                                                <>
                                                    <Link2 size={22} />
                                                    {t('link_account.submit_button')}
                                                </>
                                            )}
                                        </button>
                                    </form>
                                </div>
                            )}
                        </div>
                    </motion.div>

                    <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 flex items-start gap-5">
                            <div className="w-12 h-12 rounded-2xl bg-brand-purple/20 flex items-center justify-center flex-shrink-0">
                                <ShieldCheck className="text-brand-purple" size={24} />
                            </div>
                            <div>
                                <h4 className="text-white font-black mb-2 tracking-tight">{t('link_account.feature_1_title')}</h4>
                                <p className="text-gray-400 text-xs leading-relaxed">{t('link_account.feature_1_desc')}</p>
                            </div>
                        </div>
                        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 flex items-start gap-5">
                            <div className="w-12 h-12 rounded-2xl bg-brand-cyan/20 flex items-center justify-center flex-shrink-0">
                                <ExternalLink className="text-brand-cyan" size={24} />
                            </div>
                            <div>
                                <h4 className="text-white font-black mb-2 tracking-tight">{t('link_account.feature_2_title')}</h4>
                                <p className="text-gray-400 text-xs leading-relaxed">{t('link_account.feature_2_desc')}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default LinkAccountPage;
