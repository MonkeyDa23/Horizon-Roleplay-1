/**
 * Nova Roleplay - Official Website
 * Link Account Page
 * Copyright (c) 2024 Nova Roleplay. All rights reserved.
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocalization } from '../contexts/LocalizationContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabaseClient';
import SEO from '../components/SEO';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, ShieldCheck, AlertCircle, Loader2, CheckCircle2, ExternalLink, User, MessageSquare, ChevronRight, Gamepad2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const LinkAccountPage: React.FC = () => {
    const { user, refreshUser } = useAuth();
    const { t } = useLocalization();
    const { showToast } = useToast();
    
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLink = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code || code.trim() === '') {
            showToast('يرجى إدخال كود صحيح', 'warning');
            return;
        }

        setIsLoading(true);
        try {
            const { data, error } = await supabase.rpc('link_mta_account_with_temp_code', {
                p_code: code.trim(),
                p_user_id: user?.id
            });

            if (error) throw error;

            if (data.success) {
                showToast(data.message, 'success');
                await refreshUser?.();
            } else {
                showToast(data.message, 'error');
            }
        } catch (err) {
            console.error('Linking error:', err);
            showToast((err as Error).message || 'حدث خطأ أثناء الربط', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    if (!user) {
        return (
            <div className="container mx-auto px-6 py-24 text-center font-['Cairo']" dir="rtl">
                <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-6" />
                <h1 className="text-3xl font-bold mb-4">يجب تسجيل الدخول أولاً</h1>
                <p className="text-gray-400 mb-8">يرجى تسجيل الدخول عبر ديسكورد لتتمكن من التحقق من حالة الربط.</p>
            </div>
        );
    }

    return (
        <>
            <SEO title="حالة الربط" description="تحقق من حالة ربط حسابك في Nova Roleplay" />
            
            <div className="container mx-auto px-6 py-16 font-['Cairo']" dir="rtl">
                <div className="max-w-3xl mx-auto">
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-brand-dark-blue/40 border border-white/10 rounded-[50px] p-10 md:p-16 backdrop-blur-xl shadow-2xl relative overflow-hidden"
                    >
                        <div className="absolute -top-24 -right-24 w-64 h-64 bg-brand-cyan/10 rounded-full blur-3xl"></div>
                        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-brand-purple/10 rounded-full blur-3xl"></div>

                        <div className="relative z-10">
                            <div className="flex flex-col items-center text-center mb-12">
                                <div className="relative mb-8">
                                    <div className="absolute inset-0 bg-brand-cyan blur-3xl opacity-20 animate-pulse" />
                                    <img 
                                        src={user.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'} 
                                        alt="Avatar" 
                                        className="relative w-40 h-40 rounded-[40px] border-4 border-brand-dark shadow-2xl object-cover"
                                    />
                                    {user.mta_linked_at && (
                                        <div className="absolute -bottom-3 -right-3 w-12 h-12 bg-green-500 rounded-2xl border-4 border-brand-dark flex items-center justify-center shadow-xl">
                                            <CheckCircle2 size={24} className="text-white" />
                                        </div>
                                    )}
                                </div>
                                <h2 className="text-4xl font-black text-white mb-3">{user.username}</h2>
                                <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                                    <MessageSquare size={16} className="text-brand-cyan" />
                                    <p className="text-gray-400 font-mono text-sm">Discord ID: {user.discordId}</p>
                                </div>
                            </div>

                            {user.mta_linked_at ? (
                                <div className="space-y-10">
                                    <div className="bg-green-500/5 border border-green-500/20 p-10 rounded-[40px] text-center">
                                        <div className="w-20 h-20 bg-green-500/10 text-green-400 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-green-500/20">
                                            <ShieldCheck size={40} />
                                        </div>
                                        <h3 className="text-3xl font-black text-white mb-4">حسابك مربوط بالكامل</h3>
                                        <p className="text-gray-400 leading-relaxed max-w-md mx-auto">لقد تم التحقق من هويتك بنجاح. يمكنك الآن الوصول إلى إحصائياتك وشخصياتك عبر الملف الشخصي.</p>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="bg-white/5 p-8 rounded-3xl border border-white/5 text-center group hover:border-brand-cyan/30 transition-all">
                                            <span className="block text-gray-500 text-xs font-black uppercase tracking-widest mb-2">اسم الحساب في اللعبة</span>
                                            <span className="text-2xl font-black text-white">{user.mta_name || '...'}</span>
                                        </div>
                                        <div className="bg-white/5 p-8 rounded-3xl border border-white/5 text-center group hover:border-brand-cyan/30 transition-all">
                                            <span className="block text-gray-500 text-xs font-black uppercase tracking-widest mb-2">تاريخ التوثيق</span>
                                            <span className="text-2xl font-black text-white font-mono">
                                                {user.mta_linked_at ? new Date(user.mta_linked_at).toLocaleDateString('ar-EG') : '...'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row gap-6">
                                        <Link 
                                            to="/profile"
                                            className="flex-1 flex items-center justify-center gap-3 p-6 bg-brand-cyan text-brand-dark rounded-3xl font-black text-lg transition-all hover:-translate-y-1 shadow-2xl shadow-brand-cyan/30"
                                        >
                                            <User size={24} />
                                            انتقل لملفك الشخصي
                                            <ChevronRight size={20} />
                                        </Link>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-10">
                                    <div className="bg-amber-500/5 border border-amber-500/20 p-10 rounded-[40px] text-center">
                                        <div className="w-20 h-20 bg-amber-500/10 text-amber-500 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-amber-500/20">
                                            <Gamepad2 size={40} />
                                        </div>
                                        <h3 className="text-3xl font-black text-white mb-4">لم يتم الربط بعد</h3>
                                        <p className="text-gray-400 leading-relaxed max-w-md mx-auto">يرجى الدخول إلى سيرفر Nova Roleplay واستخدام أمر <code className="bg-white/5 px-2 py-1 rounded text-brand-cyan">/link</code> للحصول على كود التوثيق.</p>
                                        <p className="text-gray-500 text-sm mt-6">يتم الربط حصرياً من داخل اللعبة عبر الديسكورد لضمان أعلى مستويات الأمان.</p>
                                    </div>
                                    
                                    <div className="bg-white/5 p-8 rounded-3xl border border-white/5 text-center">
                                        <p className="text-gray-400">بمجرد إتمام عملية الربط في اللعبة، ستظهر بياناتك هنا تلقائياً.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>

                    <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-white/[0.03] border border-white/10 rounded-[40px] p-10 flex items-start gap-6 group hover:bg-white/[0.05] transition-all">
                            <div className="w-16 h-16 rounded-3xl bg-brand-purple/20 flex items-center justify-center flex-shrink-0 text-brand-purple group-hover:scale-110 transition-transform">
                                <ShieldCheck size={32} />
                            </div>
                            <div>
                                <h4 className="text-white font-black text-xl mb-3">حماية الحساب</h4>
                                <p className="text-gray-500 text-sm leading-relaxed">نظام التوثيق يمنع أي محاولة دخول غير مصرح بها لحسابك في اللعبة.</p>
                            </div>
                        </div>
                        <div className="bg-white/[0.03] border border-white/10 rounded-[40px] p-10 flex items-start gap-6 group hover:bg-white/[0.05] transition-all">
                            <div className="w-16 h-16 rounded-3xl bg-brand-cyan/20 flex items-center justify-center flex-shrink-0 text-brand-cyan group-hover:scale-110 transition-transform">
                                <MessageSquare size={32} />
                            </div>
                            <div>
                                <h4 className="text-white font-black text-xl mb-3">مزامنة الرتب</h4>
                                <p className="text-gray-500 text-sm leading-relaxed">احصل على رتبك في الديسكورد تلقائياً بناءً على منصبك في اللعبة.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default LinkAccountPage;
