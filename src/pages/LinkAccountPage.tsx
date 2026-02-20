
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocalization } from '../contexts/LocalizationContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabaseClient';
import SEO from '../components/SEO';
import { motion } from 'motion/react';
import { Link2, ShieldCheck, AlertCircle, Loader2, CheckCircle2, ExternalLink } from 'lucide-react';

const LinkAccountPage: React.FC = () => {
    const { user, refreshUser } = useAuth();
    const { t } = useLocalization();
    const { showToast } = useToast();
    
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleLink = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code || code.length < 5) {
            showToast('الرجاء إدخال كود صحيح', 'warning');
            return;
        }

        setIsLoading(true);
        try {
            const { data, error } = await supabase.rpc('link_mta_account', {
                p_code: code.trim(),
                p_discord_id: user?.id
            });

            if (error) throw error;

            if (data && data.success) {
                // 1. Refresh user to get the new mta_serial
                await refreshUser?.();
                
                // 2. Fetch MTA Account Name from our API using the serial
                // Note: We'll get the serial from the refreshed user object
                const { data: profileData } = await supabase.from('profiles').select('mta_serial').eq('id', user?.id).single();
                
                if (profileData?.mta_serial) {
                    try {
                        const mtaResponse = await fetch(`/api/mta/account/${profileData.mta_serial}`);
                        if (mtaResponse.ok) {
                            const mtaAccount = await mtaResponse.json();
                            if (mtaAccount.username) {
                                // 3. Update Supabase profile with the MTA username
                                await supabase.from('profiles').update({ mta_name: mtaAccount.username }).eq('id', user?.id);
                                await refreshUser?.();
                            }
                        }
                    } catch (err) {
                        console.error('Error fetching MTA name:', err);
                    }
                }

                setIsSuccess(true);
                showToast('تم ربط الحساب بنجاح!', 'success');
            } else {
                showToast(data?.message || 'الكود غير صحيح أو منتهي الصلاحية', 'error');
            }
        } catch (error) {
            console.error('Linking error:', error);
            showToast('حدث خطأ أثناء محاولة الربط', 'error');
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
            <SEO title="ربط حساب MTA" description="اربط حسابك في لعبة MTA مع حسابك في الديسكورد والموقع" />
            
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
                                    <h1 className="text-3xl font-black text-white tracking-tight">ربط حساب اللعبة</h1>
                                    <p className="text-gray-400 text-sm font-medium">اربط حسابك في MTA مع Discord</p>
                                </div>
                            </div>

                            {user.mta_serial ? (
                                <div className="text-center py-4">
                                    <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-8 border border-green-500/30">
                                        <CheckCircle2 className="text-green-400 w-14 h-14" />
                                    </div>
                                    <h2 className="text-3xl font-black text-white mb-3 tracking-tight">حسابك مربوط بنجاح!</h2>
                                    <p className="text-gray-400 mb-10">حسابك مرتبط حالياً بحساب اللعبة التالي:</p>
                                    
                                    <div className="bg-brand-dark px-8 py-6 rounded-3xl font-black text-3xl text-brand-cyan border border-white/5 mb-10 shadow-inner">
                                        {user.mta_name || 'جاري التحميل...'}
                                    </div>

                                    <div className="space-y-4 mb-10">
                                        <div className="flex justify-between items-center p-5 bg-white/5 rounded-2xl border border-white/5">
                                            <span className="text-gray-400 font-bold text-sm">حالة الربط:</span>
                                            <span className="text-green-400 font-black text-sm flex items-center gap-2">
                                                <ShieldCheck size={18} /> مربوط
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center p-5 bg-white/5 rounded-2xl border border-white/5">
                                            <span className="text-gray-400 font-bold text-sm">تاريخ الربط:</span>
                                            <span className="text-white font-black text-sm font-mono">
                                                {user.mta_linked_at ? new Date(user.mta_linked_at).toLocaleDateString('en-GB') : 'غير متوفر'}
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
                                    <h2 className="text-4xl font-black text-white mb-4 tracking-tight">تم الربط بنجاح!</h2>
                                    <p className="text-gray-400 mb-10 leading-relaxed">يمكنك الآن العودة إلى اللعبة والضغط على زر التحديث لرؤية معلوماتك.</p>
                                    <button 
                                        onClick={() => setIsSuccess(false)}
                                        className="px-12 py-4 bg-brand-cyan text-brand-dark font-black rounded-2xl hover:bg-white transition-all shadow-2xl shadow-brand-cyan/20"
                                    >
                                        إغلاق
                                    </button>
                                </motion.div>
                            ) : (
                                <div className="space-y-10">
                                    <div className="bg-brand-cyan/5 border border-brand-cyan/20 rounded-3xl p-8">
                                        <h3 className="text-brand-cyan font-black mb-4 flex items-center gap-3 text-lg">
                                            <ShieldCheck size={22} /> كيف تحصل على الكود؟
                                        </h3>
                                        <ol className="list-decimal list-inside text-gray-300 space-y-3 text-sm font-medium">
                                            <li>ادخل إلى سيرفر MTA الخاص بنا.</li>
                                            <li>اضغط على زر <kbd className="bg-brand-dark px-3 py-1 rounded-lg border border-white/10 text-white font-mono">F5</kbd> لفتح قائمة الربط.</li>
                                            <li>اضغط على زر "توليد الكود" وانسخه.</li>
                                            <li>ضع الكود في الحقل أدناه واضغط على "ربط الحساب".</li>
                                        </ol>
                                    </div>

                                    <form onSubmit={handleLink} className="space-y-8">
                                        <div>
                                            <label className="block text-gray-400 text-xs font-black uppercase tracking-widest mb-3 mr-1">كود الربط</label>
                                            <input 
                                                type="text" 
                                                value={code}
                                                onChange={(e) => setCode(e.target.value)}
                                                placeholder="VXL-XXXXX-XXXXX"
                                                className="w-full bg-brand-dark border border-white/10 rounded-3xl px-8 py-5 text-white focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 transition-all outline-none text-center font-mono text-xl tracking-[0.2em] placeholder:opacity-20"
                                                disabled={isLoading}
                                            />
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
                                                    ربط الحساب الآن
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
                                <h4 className="text-white font-black mb-2 tracking-tight">أمان عالي</h4>
                                <p className="text-gray-400 text-xs leading-relaxed">يتم ربط حسابك بالـ Serial الخاص بجهازك لضمان عدم سرقة الحساب.</p>
                            </div>
                        </div>
                        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 flex items-start gap-5">
                            <div className="w-12 h-12 rounded-2xl bg-brand-cyan/20 flex items-center justify-center flex-shrink-0">
                                <ExternalLink className="text-brand-cyan" size={24} />
                            </div>
                            <div>
                                <h4 className="text-white font-black mb-2 tracking-tight">تزامن لحظي</h4>
                                <p className="text-gray-400 text-xs leading-relaxed">بمجرد الربط ستظهر معلوماتك في اللعبة وفي الموقع فوراً.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default LinkAccountPage;
