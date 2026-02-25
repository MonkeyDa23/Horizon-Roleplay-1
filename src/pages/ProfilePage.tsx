import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocalization } from '../contexts/LocalizationContext';
import { getSubmissionsByUserId, forceRefreshUserProfile, getMtaAccountInfo, unlinkMtaAccount } from '../lib/api';
import type { QuizSubmission, SubmissionStatus, DiscordRole, MtaAccountInfo } from '../types';
import { useNavigate, Link } from 'react-router-dom';
import { 
  User as UserIcon, Loader2, FileText, ExternalLink, Shield, RefreshCw,
  Gamepad2, Users, ChevronRight, Star, CreditCard, Link2, LogOut, ShieldCheck,
  Wallet, Landmark, Trophy, History, Settings, Bell, AlertCircle, Car, Home
} from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';
import SEO from '../components/SEO';
import { useToast } from '../contexts/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';

const ProfilePage: React.FC = () => {
  const { user, loading: authLoading, updateUser } = useAuth();
  const { t } = useLocalization();
  const navigate = useNavigate();
  const { config } = useConfig();
  const { showToast } = useToast();
  const communityName = config.COMMUNITY_NAME;
  
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const [mtaAccountInfo, setMtaAccountInfo] = useState<MtaAccountInfo | null>(null);
  const [mtaAccountLoading, setMtaAccountLoading] = useState(false);
  const [mtaAccountError, setMtaAccountError] = useState<string | null>(null);

  const [isMtaLinked, setIsMtaLinked] = useState<boolean | null>(null);
  const [mtaLinkLoading, setMtaLinkLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<'discord' | 'mta'>('discord');

  const fetchMtaAccountData = useCallback(async () => {
      if (!user?.mta_serial) {
          setMtaAccountInfo(null);
          setIsMtaLinked(false);
          return;
      }

      setMtaAccountLoading(true);
      setMtaAccountError(null);
      try {
          const info = await getMtaAccountInfo(user.mta_serial);
          setMtaAccountInfo(info);
          setIsMtaLinked(true);
      } catch (err) {
          console.error("Failed to fetch MTA account info:", err);
          setMtaAccountError((err as Error).message);
          setMtaAccountInfo(null);
          setIsMtaLinked(false);
      } finally {
          setMtaAccountLoading(false);
      }
  }, [user?.mta_serial]);

  const handleUnlinkMta = useCallback(async () => {
      if (!user?.mta_serial) return;

      if (!window.confirm('هل أنت متأكد من رغبتك في إلغاء ربط الحساب؟')) return;

      setMtaLinkLoading(true);
      try {
          await unlinkMtaAccount(user.mta_serial);
          await forceRefreshUserProfile();
          setIsMtaLinked(false);
          setMtaAccountInfo(null);
          showToast('تم إلغاء ربط الحساب بنجاح', 'success');
      } catch (err) {
          console.error("Failed to unlink MTA account:", err);
          showToast('فشل إلغاء ربط الحساب', 'error');
      } finally {
          setMtaLinkLoading(false);
      }
  }, [user?.mta_serial, showToast]);

  useEffect(() => {
      if (user?.mta_serial) {
          fetchMtaAccountData();
      }
  }, [fetchMtaAccountData, user?.mta_serial]);

  const fetchSubmissions = useCallback(async () => {
    if (!user) return;
    setSubmissionsLoading(true);
    try {
      const userSubmissions = await getSubmissionsByUserId(user.id);
      setSubmissions(userSubmissions);
    } catch (error) {
      console.error("Failed to fetch user submissions", error);
    } finally {
      setSubmissionsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/');
      return;
    }

    if (user) {
      fetchSubmissions();
    }
  }, [user, authLoading, navigate, fetchSubmissions]);

  const handleRefresh = async () => {
    setIsSyncing(true);
    try {
        const { user: freshUser } = await forceRefreshUserProfile();
        updateUser(freshUser);
        showToast('تم تحديث البيانات بنجاح', 'success');
    } catch (error) {
        showToast('فشل تحديث البيانات', 'error');
    } finally {
        setIsSyncing(false);
    }
  };

  const renderStatusBadge = (status: SubmissionStatus) => {
    const statusMap = {
      pending: { text: 'قيد المراجعة', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
      taken: { text: 'تم الاستلام', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
      accepted: { text: 'مقبول', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
      refused: { text: 'مرفوض', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
    };
    const { text, color } = statusMap[status];
    return <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full border ${color}`}>{text}</span>;
  };

  const RoleBadge: React.FC<{ role: DiscordRole }> = ({ role }) => {
    const color = role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99aab5';
    return (
      <span 
        className="px-4 py-2 text-xs font-bold rounded-xl text-white flex items-center gap-2" 
        style={{ backgroundColor: color + '15', border: `1px solid ${color}30` }}
      >
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></div>
        {role.name}
      </span>
    );
  };
  
  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-brand-dark">
        <Loader2 size={48} className="text-brand-cyan animate-spin" />
      </div>
    );
  }

  return (
    <>
      <SEO 
        title={`${communityName} - ملفي الشخصي`}
        description={`الملف الشخصي للمستخدم ${user.username}.`}
        noIndex={true}
      />
      
      <div className="min-h-screen bg-brand-dark font-['Cairo'] pb-24" dir="rtl">
        {/* Profile Hero Header */}
        <div className="relative h-80 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-brand-cyan/20 to-brand-dark z-0"></div>
          <div className="absolute inset-0 backdrop-blur-3xl z-0"></div>
          
          <div className="container mx-auto px-6 h-full flex items-end pb-12 relative z-10">
            <div className="flex flex-col md:flex-row items-center md:items-end gap-8 w-full">
              <div className="relative group">
                <motion.img 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  src={user.avatar} 
                  alt={user.username} 
                  className="w-32 h-32 md:w-40 md:h-40 rounded-[40px] border-4 border-brand-dark shadow-2xl object-cover" 
                />
                <button 
                  onClick={handleRefresh}
                  disabled={isSyncing}
                  className="absolute -bottom-2 -right-2 bg-brand-cyan p-3 rounded-2xl text-brand-dark hover:bg-white transition-all shadow-xl"
                >
                  {isSyncing ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
                </button>
              </div>
              
              <div className="flex-1 text-center md:text-right">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-2">{user.username}</h1>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                    <span className="text-brand-cyan/60 font-mono text-sm">ID: {user.discordId}</span>
                    <div className="h-4 w-px bg-white/10 hidden md:block"></div>
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${user.mta_linked_at ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                      {user.mta_linked_at ? 'مربوط باللعبة' : 'غير مربوط'}
                    </span>
                  </div>
                </motion.div>
              </div>

              <div className="flex gap-4">
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-[32px] flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-[10px] text-text-secondary uppercase font-black tracking-widest mb-1">الرصيد الحالي</div>
                    <div className="text-3xl font-black text-brand-cyan tracking-tight">
                      {user.balance.toLocaleString()} <span className="text-xs font-normal text-text-secondary">VXL</span>
                    </div>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-brand-cyan/20 flex items-center justify-center">
                    <CreditCard className="text-brand-cyan" size={28} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-6 mt-8">
          {/* Tabs Navigation */}
          <div className="flex items-center gap-2 bg-white/5 p-2 rounded-3xl border border-white/10 w-fit mb-12">
            <button 
              onClick={() => setActiveTab('discord')}
              className={`px-8 py-3 rounded-2xl text-sm font-black transition-all ${
                activeTab === 'discord' ? 'bg-brand-cyan text-brand-dark shadow-lg shadow-brand-cyan/20' : 'text-text-secondary hover:text-white'
              }`}
            >
              حساب الديسكورد
            </button>
            <button 
              onClick={() => setActiveTab('mta')}
              className={`px-8 py-3 rounded-2xl text-sm font-black transition-all ${
                activeTab === 'mta' ? 'bg-brand-cyan text-brand-dark shadow-lg shadow-brand-cyan/20' : 'text-text-secondary hover:text-white'
              }`}
            >
              حساب اللعبة (MTA)
            </button>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'discord' ? (
              <motion.div 
                key="discord"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8"
              >
                <div className="lg:col-span-8 space-y-8">
                  {/* Roles Section */}
                  <section className="bg-white/[0.03] border border-white/10 rounded-[40px] p-8 md:p-10">
                    <div className="flex items-center gap-4 mb-10">
                      <div className="w-12 h-12 rounded-2xl bg-brand-purple/20 flex items-center justify-center text-brand-purple">
                        <Star size={24} />
                      </div>
                      <div>
                        <h2 className="text-2xl font-black text-white">الرتب والأوسمة</h2>
                        <p className="text-text-secondary text-sm">الرتب التي تمتلكها في سيرفر الديسكورد</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      {user.roles.length > 0 ? (
                        user.roles.map(role => <RoleBadge key={role.id} role={role} />)
                      ) : (
                        <div className="text-text-secondary italic">لا توجد رتب لعرضها</div>
                      )}
                    </div>
                  </section>

                  {/* Applications Section */}
                  <section className="bg-white/[0.03] border border-white/10 rounded-[40px] p-8 md:p-10">
                    <div className="flex items-center gap-4 mb-10">
                      <div className="w-12 h-12 rounded-2xl bg-brand-cyan/20 flex items-center justify-center text-brand-cyan">
                        <FileText size={24} />
                      </div>
                      <div>
                        <h2 className="text-2xl font-black text-white">التقديمات الأخيرة</h2>
                        <p className="text-text-secondary text-sm">تاريخ تقديماتك في السيرفر</p>
                      </div>
                    </div>
                    
                    {submissionsLoading ? (
                      <div className="flex justify-center py-12"><Loader2 className="animate-spin text-brand-cyan" /></div>
                    ) : submissions.length === 0 ? (
                      <div className="text-center py-16 bg-black/20 rounded-[32px] border border-white/5">
                        <div className="text-text-secondary italic mb-2">لم تقم بتقديم أي طلبات بعد</div>
                        <Link to="/apply" className="text-brand-cyan text-sm font-bold hover:underline">قدم الآن من هنا</Link>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {submissions.map(sub => (
                          <div key={sub.id} className="flex items-center justify-between p-6 bg-white/5 rounded-[24px] border border-white/5 hover:border-brand-cyan/30 transition-all group">
                            <div className="flex items-center gap-5">
                              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-text-secondary group-hover:text-brand-cyan transition-colors">
                                <FileText size={20} />
                              </div>
                              <div>
                                <div className="font-black text-white text-lg group-hover:text-brand-cyan transition-colors">{sub.quizTitle}</div>
                                <div className="text-xs text-text-secondary mt-1">{new Date(sub.submittedAt).toLocaleDateString('ar-EG')}</div>
                              </div>
                            </div>
                            {renderStatusBadge(sub.status)}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                <div className="lg:col-span-4 space-y-8">
                  <section className="bg-white/[0.03] border border-white/10 rounded-[40px] p-8">
                    <h3 className="text-xs font-black text-text-secondary uppercase tracking-[0.2em] mb-8">معلومات الحساب</h3>
                    <div className="space-y-8">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <Shield size={18} className="text-brand-cyan" />
                          <span className="text-text-secondary text-sm">أعلى رتبة</span>
                        </div>
                        <span className="text-white font-black">{user.highestRole?.name || 'لا يوجد'}</span>
                      </div>
                      <div className="h-px bg-white/5"></div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <Link2 size={18} className="text-brand-cyan" />
                          <span className="text-text-secondary text-sm">حالة الربط</span>
                        </div>
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${user.mta_linked_at ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                          {user.mta_linked_at ? 'مربوط' : 'غير مربوط'}
                        </span>
                      </div>
                    </div>
                  </section>
                  
                  <section className="bg-gradient-to-br from-brand-cyan/10 to-transparent border border-brand-cyan/20 rounded-[40px] p-8">
                    <h3 className="text-white font-black text-xl mb-4">هل تحتاج لمساعدة؟</h3>
                    <p className="text-text-secondary text-sm leading-relaxed mb-8">إذا واجهت أي مشكلة في حسابك أو في عملية الربط، لا تتردد في فتح تذكرة دعم فني في الديسكورد.</p>
                    <a href="https://discord.gg/vixel" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-brand-cyan text-brand-dark font-black text-sm hover:bg-white transition-all">
                      الدعم الفني
                      <ExternalLink size={16} />
                    </a>
                  </section>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="mta"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                {!user.mta_serial ? (
                  <div className="bg-white/[0.03] border border-white/10 rounded-[50px] p-20 text-center">
                    <div className="w-24 h-24 bg-brand-cyan/10 rounded-[32px] flex items-center justify-center mx-auto mb-10 border border-brand-cyan/20">
                      <Gamepad2 size={48} className="text-brand-cyan" />
                    </div>
                    <h2 className="text-4xl font-black text-white mb-6 tracking-tight">حساب اللعبة غير مربوط</h2>
                    <p className="text-text-secondary mb-8 max-w-md mx-auto leading-relaxed text-lg">يرجى الدخول إلى سيرفر Florida Roleplay واستخدام أمر <code className="bg-white/5 px-2 py-1 rounded text-brand-cyan">/link</code> للحصول على كود التوثيق وإتمام الربط من داخل اللعبة.</p>
                    <div className="bg-brand-cyan/5 border border-brand-cyan/20 p-6 rounded-3xl inline-block">
                        <p className="text-brand-cyan font-bold">يتم الربط حصرياً من داخل اللعبة لضمان الأمان</p>
                    </div>
                  </div>
                ) : mtaAccountLoading ? (
                  <div className="flex justify-center py-24"><Loader2 className="animate-spin text-brand-cyan" size={48} /></div>
                ) : mtaAccountError ? (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-10 rounded-[40px] text-center">
                    <AlertCircle size={48} className="mx-auto mb-4" />
                    <h3 className="text-xl font-black mb-2">حدث خطأ أثناء جلب البيانات</h3>
                    <p className="opacity-70">{mtaAccountError}</p>
                    <button onClick={fetchMtaAccountData} className="mt-6 text-white underline font-bold">إعادة المحاولة</button>
                  </div>
                ) : mtaAccountInfo ? (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-8 space-y-8">
                      {/* Characters Grid */}
                      <section className="bg-white/[0.03] border border-white/10 rounded-[40px] p-8 md:p-10">
                        <div className="flex items-center justify-between mb-12">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-brand-cyan/20 flex items-center justify-center text-brand-cyan">
                              <Users size={24} />
                            </div>
                            <div>
                              <h2 className="text-2xl font-black text-white">الشخصيات</h2>
                              <p className="text-text-secondary text-sm">قائمة شخصياتك في السيرفر</p>
                            </div>
                          </div>
                          <span className="bg-brand-cyan/10 text-brand-cyan px-4 py-2 rounded-xl text-sm font-black border border-brand-cyan/20">
                            {mtaAccountInfo.character_count} شخصيات
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          {mtaAccountInfo.characters.map(char => (
                            <div key={char.id} className="group bg-black/30 border border-white/5 rounded-[32px] p-8 hover:border-brand-cyan/40 transition-all relative overflow-hidden">
                              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-cyan/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2"></div>
                              
                              <div className="flex items-center gap-5 mb-8 relative z-10">
                                <div className="w-16 h-16 bg-brand-cyan/10 rounded-2xl flex items-center justify-center text-brand-cyan font-black text-3xl border border-brand-cyan/20">
                                  {char.name.charAt(0)}
                                </div>
                                <div>
                                  <div className="text-xl font-black text-white group-hover:text-brand-cyan transition-colors">{char.name}</div>
                                  <div className="text-xs text-text-secondary uppercase tracking-widest font-black mt-1">
                                    {char.job_name || 'عاطل'} • {char.faction_name || 'بدون منظمة'}
                                  </div>
                                  <div className="text-[10px] text-brand-cyan/60 font-bold mt-1">
                                    مستوى {char.level} • {char.age} سنة ({char.dob})
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4 relative z-10">
                                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                  <div className="flex items-center gap-2 text-[10px] text-text-secondary uppercase font-black mb-2">
                                    <Wallet size={12} />
                                    كاش
                                  </div>
                                  <div className="text-green-400 font-black text-lg">${char.cash.toLocaleString()}</div>
                                </div>
                                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                  <div className="flex items-center gap-2 text-[10px] text-text-secondary uppercase font-black mb-2">
                                    <Landmark size={12} />
                                    البنك
                                  </div>
                                  <div className="text-brand-cyan font-black text-lg">${char.bank.toLocaleString()}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>

                      {/* Admin Record */}
                      <section className="bg-white/[0.03] border border-white/10 rounded-[40px] p-8 md:p-10">
                        <div className="flex items-center gap-4 mb-10">
                          <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center text-red-400">
                            <History size={24} />
                          </div>
                          <div>
                            <h2 className="text-2xl font-black text-white">السجل الإداري</h2>
                            <p className="text-text-secondary text-sm">تاريخ العقوبات الإدارية (آخر 10)</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {mtaAccountInfo.admin_record.length > 0 ? (
                            mtaAccountInfo.admin_record.map((record, idx) => (
                              <div key={idx} className="flex items-start gap-6 p-6 rounded-[24px] bg-black/20 border border-white/5">
                                <div className={`p-4 rounded-2xl flex-shrink-0 ${record.type === 'Ban' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                                  <Shield size={24} />
                                </div>
                                <div className="flex-1">
                                  <div className="flex justify-between items-start mb-3">
                                    <div>
                                      <span className="font-black text-white text-xl uppercase tracking-tight">
                                        {record.type === 'Ban' ? 'حظر' : record.type === 'Kick' ? 'طرد' : record.type === 'Warn' ? 'تحذير' : record.type}
                                      </span>
                                      {record.duration && record.duration !== '0' && (
                                        <span className="text-xs font-black text-text-secondary mr-4 bg-white/5 px-3 py-1 rounded-lg">
                                          {record.duration} دقيقة
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-xs font-mono text-text-secondary">{new Date(record.date).toLocaleDateString('ar-EG')}</span>
                                  </div>
                                  <p className="text-text-secondary text-sm leading-relaxed mb-4 p-4 bg-white/5 rounded-xl border border-white/5">{record.reason}</p>
                                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-brand-cyan">
                                    <UserIcon size={12} />
                                    بواسطة الأدمن: {record.admin}
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-20 bg-black/20 rounded-[32px] border border-white/5">
                              <ShieldCheck size={48} className="mx-auto text-green-500/30 mb-4" />
                              <div className="text-text-secondary font-bold">سجلك نظيف! لا توجد عقوبات إدارية</div>
                            </div>
                          )}
                        </div>
                      </section>
                    </div>

                    <div className="lg:col-span-4 space-y-8">
                      {/* Vehicles & Properties */}
                      <section className="bg-white/[0.03] border border-white/10 rounded-[40px] p-8">
                        <div className="flex items-center gap-4 mb-8">
                          <div className="w-10 h-10 rounded-xl bg-brand-cyan/20 flex items-center justify-center text-brand-cyan">
                            <Car size={20} />
                          </div>
                          <h3 className="text-xs font-black text-text-secondary uppercase tracking-[0.2em]">المركبات</h3>
                        </div>
                        <div className="space-y-4">
                          {mtaAccountInfo.vehicles && mtaAccountInfo.vehicles.length > 0 ? (
                            mtaAccountInfo.vehicles.map(vehicle => (
                              <div key={vehicle.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex justify-between items-center">
                                <div>
                                  <div className="text-white font-bold">{vehicle.model}</div>
                                  <div className="text-[10px] text-brand-cyan font-black uppercase tracking-widest">
                                    {vehicle.plate} • ID: {vehicle.id}
                                  </div>
                                </div>
                                <Car size={16} className="text-white/20" />
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-8 text-text-secondary text-sm italic">لا توجد مركبات مسجلة</div>
                          )}
                        </div>
                      </section>

                      <section className="bg-white/[0.03] border border-white/10 rounded-[40px] p-8">
                        <div className="flex items-center gap-4 mb-8">
                          <div className="w-10 h-10 rounded-xl bg-brand-cyan/20 flex items-center justify-center text-brand-cyan">
                            <Home size={20} />
                          </div>
                          <h3 className="text-xs font-black text-text-secondary uppercase tracking-[0.2em]">العقارات</h3>
                        </div>
                        <div className="space-y-4">
                          {mtaAccountInfo.properties && mtaAccountInfo.properties.length > 0 ? (
                            mtaAccountInfo.properties.map(prop => (
                              <div key={prop.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex justify-between items-center">
                                <div>
                                  <div className="text-white font-bold">{prop.name}</div>
                                  <div className="text-[10px] text-brand-cyan font-black uppercase tracking-widest">
                                    {prop.address} • ID: {prop.id}
                                  </div>
                                </div>
                                <Home size={16} className="text-white/20" />
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-8 text-text-secondary text-sm italic">لا توجد عقارات مسجلة</div>
                          )}
                        </div>
                      </section>

                      <section className="bg-white/[0.03] border border-white/10 rounded-[40px] p-8">
                        <h3 className="text-xs font-black text-text-secondary uppercase tracking-[0.2em] mb-8">بيانات الحساب</h3>
                        <div className="space-y-8">
                          <div className="flex justify-between items-center">
                            <span className="text-text-secondary text-sm">اسم الحساب</span>
                            <span className="text-white font-black">{mtaAccountInfo.username}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-text-secondary text-sm">رقم الحساب</span>
                            <span className="text-white font-black">#{mtaAccountInfo.id}</span>
                          </div>
                          <div className="h-px bg-white/5"></div>
                        </div>
                        
                        <div className="mt-12">
                          <button 
                            onClick={handleUnlinkMta}
                            disabled={mtaLinkLoading}
                            className="flex items-center justify-center gap-3 w-full py-5 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all font-black text-sm group"
                          >
                            {mtaLinkLoading ? <Loader2 className="animate-spin" size={20} /> : <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />}
                            إلغاء ربط الحساب
                          </button>
                        </div>
                      </section>

                      <section className="bg-brand-cyan/5 border border-brand-cyan/10 rounded-[40px] p-8">
                        <div className="flex items-center gap-4 mb-6">
                          <div className="w-12 h-12 rounded-2xl bg-brand-cyan/20 flex items-center justify-center text-brand-cyan">
                            <Trophy size={24} />
                          </div>
                          <h3 className="text-white font-black text-xl">إحصائيات عامة</h3>
                        </div>
                        <div className="space-y-6">
                          <div className="flex justify-between items-center">
                            <span className="text-text-secondary text-sm">إجمالي الثروة</span>
                            <span className="text-green-400 font-black">
                              ${mtaAccountInfo.characters.reduce((acc, char) => acc + char.cash + char.bank, 0).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-text-secondary text-sm">أعلى مستوى</span>
                            <span className="text-brand-cyan font-black">
                              {Math.max(...mtaAccountInfo.characters.map(c => c.level), 0)}
                            </span>
                          </div>
                        </div>
                      </section>
                    </div>
                  </div>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
};

export default ProfilePage;
