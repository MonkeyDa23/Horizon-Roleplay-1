/**
 * Nova Roleplay - Official Website
 * User Profile Page
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLocalization } from '../contexts/LocalizationContext';
import { useConfig } from '../contexts/ConfigContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { useToast } from '../contexts/ToastContext';
import { 
  getSubmissionsByUserId, 
  forceRefreshUserProfile, 
  getMtaAccountInfo, 
  unlinkMtaAccount,
  revalidateSession
} from '../lib/api';
import type { QuizSubmission, SubmissionStatus, DiscordRole, MtaAccountInfo, MtaCharacter } from '../types';
import { 
  User as UserIcon, 
  Loader2, 
  FileText, 
  Shield, 
  RefreshCw, 
  Gamepad2, 
  ChevronRight, 
  Star, 
  Link2, 
  ShieldCheck, 
  Wallet, 
  Landmark, 
  Trophy, 
  History, 
  X, 
  Briefcase, 
  Car, 
  Home, 
  Users 
} from 'lucide-react';
import SEO from '../components/SEO';
import { motion, AnimatePresence } from 'motion/react';
import TwoFactorSetup from '../components/profile/TwoFactorSetup';

const CharacterDetailModal = ({ character, onClose, branding, t }: { character: MtaCharacter, onClose: () => void, branding: any, t: any }) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6"
    >
      <div className="absolute inset-0 bg-brand-dark/95 backdrop-blur-2xl" onClick={onClose}></div>
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 30 }} 
        animate={{ scale: 1, opacity: 1, y: 0 }} 
        exit={{ scale: 0.9, opacity: 0, y: 30 }} 
        className="bg-white/[0.03] border border-white/10 rounded-[60px] w-full max-w-4xl max-h-[90vh] overflow-y-auto relative z-10 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)]"
      >
        <div className="sticky top-0 bg-brand-dark/80 backdrop-blur-xl border-b border-white/10 p-8 md:p-10 flex justify-between items-center z-20">
          <div className="flex items-center gap-8">
            <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center font-black text-4xl border border-white/10 shadow-inner" style={{ color: branding.primaryColor }}>
              {character.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-4xl font-black text-white">{character.name}</h2>
              <p className="font-bold text-lg opacity-60" style={{ color: branding.primaryColor }}>ID: {character.id} • {character.job}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-4 bg-white/5 rounded-3xl text-text-secondary hover:text-white hover:bg-white/10 transition-all shadow-lg">
            <X size={28} />
          </button>
        </div>

        <div className="p-8 md:p-14 space-y-12">
          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="glass-panel p-8 text-center space-y-2">
              <div className="w-14 h-14 bg-green-500/10 rounded-2xl flex items-center justify-center text-green-400 mx-auto mb-4 border border-green-500/10">
                <Wallet size={28} />
              </div>
              <div className="text-xs text-text-secondary uppercase font-black tracking-widest">{t('cash')}</div>
              <div className="text-3xl font-black text-white">${character.cash.toLocaleString()}</div>
            </div>
            <div className="glass-panel p-8 text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/5" style={{ backgroundColor: `${branding.primaryColor}22`, color: branding.primaryColor }}>
                <Landmark size={28} />
              </div>
              <div className="text-xs text-text-secondary uppercase font-black tracking-widest">{t('bank')}</div>
              <div className="text-3xl font-black text-white">${character.bank.toLocaleString()}</div>
            </div>
            <div className="glass-panel p-8 text-center space-y-2">
              <div className="w-14 h-14 bg-purple-500/10 rounded-2xl flex items-center justify-center text-purple-400 mx-auto mb-4 border border-purple-500/10">
                <Trophy size={28} />
              </div>
              <div className="text-xs text-text-secondary uppercase font-black tracking-widest">{t('playtime')}</div>
              <div className="text-3xl font-black text-white">{character.playtime_hours} {t('hours')}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-8">
              <h3 className="text-2xl font-black text-white flex items-center gap-4">
                <UserIcon size={24} style={{ color: branding.primaryColor }} />
                {t('personal_info')}
              </h3>
              <div className="space-y-6 bg-white/5 p-8 rounded-[40px] border border-white/5 shadow-inner">
                <InfoRow label={t('gender')} value={character.gender === 'Male' ? t('male') : t('female')} />
                <InfoRow label={t('age')} value={`${character.age} ${t('year')}`} />
                <InfoRow label={t('dob')} value={character.dob} />
                <InfoRow label={t('level')} value={character.level} valueColor={branding.primaryColor} />
              </div>
            </div>
            <div className="space-y-8">
              <h3 className="text-2xl font-black text-white flex items-center gap-4">
                <Briefcase size={24} style={{ color: branding.primaryColor }} />
                {t('job_and_faction')}
              </h3>
              <div className="space-y-6 bg-white/5 p-8 rounded-[40px] border border-white/5 shadow-inner">
                <InfoRow label={t('job')} value={character.job} />
                <InfoRow label={t('faction')} value={character.faction || t('not_set')} valueColor={branding.primaryColor} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-8">
              <h3 className="text-2xl font-black text-white flex items-center gap-4">
                <Car size={24} style={{ color: branding.primaryColor }} />
                {t('vehicles')} ({character.vehicles.length})
              </h3>
              <div className="space-y-4">
                {character.vehicles.length > 0 ? character.vehicles.map(v => (
                  <div key={v.id} className="p-6 bg-white/5 rounded-3xl border border-white/5 flex justify-between items-center group hover:bg-white/[0.07] transition-all">
                    <div>
                      <div className="text-xl font-bold text-white mb-1">{v.model}</div>
                      <div className="text-xs font-black uppercase text-text-secondary">ID: {v.id}</div>
                    </div>
                    <Car size={20} className="text-white/20 group-hover:text-white/50 transition-colors" />
                  </div>
                )) : (
                  <div className="text-text-secondary italic text-base p-8 bg-white/5 rounded-3xl border border-dashed border-white/10 text-center">{t('no_vehicles')}</div>
                )}
              </div>
            </div>
            <div className="space-y-8">
              <h3 className="text-2xl font-black text-white flex items-center gap-4">
                <Home size={24} style={{ color: branding.primaryColor }} />
                {t('properties')} ({character.properties.length})
              </h3>
              <div className="space-y-4">
                {character.properties.length > 0 ? character.properties.map(p => (
                  <div key={p.id} className="p-6 bg-white/5 rounded-3xl border border-white/5 flex justify-between items-center group hover:bg-white/[0.07] transition-all">
                    <div>
                      <div className="text-xl font-bold text-white mb-1">{p.name}</div>
                      <div className="text-xs font-black uppercase text-text-secondary">ID: {p.id} • ${p.cost.toLocaleString()}</div>
                    </div>
                    <Home size={20} className="text-white/20 group-hover:text-white/50 transition-colors" />
                  </div>
                )) : (
                  <div className="text-text-secondary italic text-base p-8 bg-white/5 rounded-3xl border border-dashed border-white/10 text-center">{t('no_properties')}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const InfoRow = ({ label, value, valueColor }: { label: string, value: any, valueColor?: string }) => (
  <div className="flex justify-between items-center bg-black/10 px-6 py-4 rounded-2xl">
    <span className="text-text-secondary font-medium">{label}</span>
    <span className="font-black text-lg" style={{ color: valueColor || '#fff' }}>{value}</span>
  </div>
);

const ProfilePage: React.FC = () => {
  const { user, authLoading, refreshUser, updateUser } = useAuth();
  const { t, dir } = useLocalization();
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();
  const { branding } = useConfig();
  const { showToast } = useToast();
  
  const communityName = branding.siteName || 'Nova Roleplay';
  
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [mtaAccountInfo, setMtaAccountInfo] = useState<MtaAccountInfo | null>(null);
  const [mtaAccountLoading, setMtaAccountLoading] = useState(false);
  const [mtaAccountError, setMtaAccountError] = useState<string | null>(null);
  const [mtaLinkLoading, setMtaLinkLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'discord' | 'mta'>('discord');
  const [selectedCharacter, setSelectedCharacter] = useState<MtaCharacter | null>(null);

  const fetchMtaAccountData = useCallback(async () => {
    if (!user?.mta_serial) {
      setMtaAccountInfo(null);
      return;
    }
    setMtaAccountLoading(true);
    setMtaAccountError(null);
    try {
      const info = await getMtaAccountInfo(user.mta_serial);
      setMtaAccountInfo(info);
    } catch (err) {
      console.error("MTA account fetch failed:", err);
      setMtaAccountError((err as Error).message);
      setMtaAccountInfo(null);
    } finally {
      setMtaAccountLoading(false);
    }
  }, [user?.mta_serial]);

  const handleUnlinkMta = useCallback(async () => {
    if (!user?.mta_serial) return;
    if (!window.confirm(t('confirm_unlink') || 'هل أنت متأكد من فك ربط حساب اللعبة؟')) return;
    
    setMtaLinkLoading(true);
    try {
      await unlinkMtaAccount(user.mta_serial);
      setMtaAccountInfo(null);
      await refreshUser();
      showToast(t('mta_unlink_success') || 'تم فك الربط بنجاح', 'success');
    } catch (err) {
      showToast(t('mta_unlink_error') || 'فشل فك ربط الحساب', 'error');
    } finally {
      setMtaLinkLoading(false);
    }
  }, [user?.mta_serial, refreshUser, showToast, t]);

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
      console.error("Submissions load error:", error);
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
      await forceRefreshUserProfile();
      const freshUser = await revalidateSession();
      updateUser(freshUser);
      showToast(t('profile_refresh_success') || 'تم تحديث ملفك الشخصي بنجاح', 'success');
    } catch (error) {
      showToast(t('profile_refresh_error') || 'فشل تحديث البيانات', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const renderStatusBadge = (status: SubmissionStatus) => {
    const statusMap = {
      pending: { text: t('status_pending') || 'بالانتظار', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
      taken: { text: t('status_taken') || 'قيد المراجعة', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
      accepted: { text: t('status_accepted') || 'مقبول', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
      refused: { text: t('status_refused') || 'مرفوض', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
      under_review: { text: t('status_taken') || 'قيد المراجعة', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' }
    };
    const mappedStatus = status === 'under_review' ? 'taken' : status;
    const { text, color } = statusMap[mappedStatus as keyof typeof statusMap] || statusMap.pending;
    return <span className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-full border ${color} tracking-widest`}>{text}</span>;
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-brand-dark">
        <Loader2 size={64} className="animate-spin opacity-10" style={{ color: branding.primaryColor }} />
      </div>
    );
  }

  return (
    <>
      <SEO 
        title={`${communityName} - ${t('my_profile') || 'ملفي الشخصي'}`} 
        description={`عرض إحصائيات وتقديمات ${user.username} في مجتمع ${communityName}.`}
        noIndex={true} 
      />

      <div className="min-h-screen bg-brand-dark pb-24" dir={dir}>
        <AnimatePresence>
          {selectedCharacter && (
            <CharacterDetailModal character={selectedCharacter} onClose={() => setSelectedCharacter(null)} branding={branding} t={t} />
          )}
        </AnimatePresence>

        {/* Profile Header */}
        <div className="relative h-[450px] overflow-hidden">
          <div className="absolute inset-0 z-0" style={{ background: `linear-gradient(to bottom, ${branding.primaryColor}33, transparent)` }}></div>
          <div className="absolute inset-0 backdrop-blur-3xl z-0"></div>
          
          <div className="container mx-auto px-6 h-full flex items-end pb-16 relative z-10">
            <div className="flex flex-col md:flex-row items-center md:items-end gap-10 w-full">
              <div className="relative group">
                <motion.img 
                  initial={{ scale: 0.8, opacity: 0 }} 
                  animate={{ scale: 1, opacity: 1 }} 
                  src={user.avatar} 
                  alt={user.username} 
                  className="w-40 h-40 md:w-56 md:h-56 rounded-[60px] border-8 border-brand-dark shadow-2xl object-cover" 
                />
                <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-brand-dark rounded-3xl flex items-center justify-center border-4 border-brand-dark shadow-2xl" style={{ color: branding.primaryColor }}>
                  <ShieldCheck size={32} />
                </div>
              </div>

              <div className="flex-1 text-center md:text-left space-y-6">
                <div className="space-y-2">
                  <motion.h1 
                    initial={{ y: 20, opacity: 0 }} 
                    animate={{ y: 0, opacity: 1 }} 
                    className="text-5xl md:text-8xl font-black text-white leading-none"
                  >
                    {user.username}
                  </motion.h1>
                  <div className="flex flex-wrap justify-center md:justify-start items-center gap-6 text-text-secondary font-bold text-base opacity-60">
                    <span className="flex items-center gap-2">
                      <Shield size={18} style={{ color: branding.primaryColor }} />
                      {user.email}
                    </span>
                    <span className="flex items-center gap-2">
                      <Star size={18} style={{ color: branding.primaryColor }} />
                      Nova Member
                    </span>
                  </div>
                </div>
                
                <div className="flex flex-wrap justify-center md:justify-start gap-3">
                  {user.discord_roles?.map((role: any) => {
                    const color = role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99aab5';
                    return (
                      <span key={role.id} className="px-5 py-2.5 text-xs font-black rounded-2xl text-white flex items-center gap-3 shadow-lg" style={{ backgroundColor: color + '22', border: `1px solid ${color}44` }}>
                        <div className="w-3 h-3 rounded-full shadow-inner" style={{ backgroundColor: color }}></div>
                        {role.name}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={handleRefresh} 
                  disabled={isSyncing}
                  className="px-10 py-5 bg-white/5 hover:bg-white/10 active:scale-95 text-white font-black rounded-3xl border border-white/10 transition-all flex items-center gap-4 disabled:opacity-50 shadow-2xl"
                >
                  <RefreshCw size={24} className={isSyncing ? 'animate-spin' : ''} />
                  {isSyncing ? t('syncing') : t('sync_profile')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="container mx-auto px-6 -mt-10 relative z-20">
          <div className="bg-white/[0.02] border border-white/10 rounded-[60px] p-2 backdrop-blur-3xl mb-16 flex flex-wrap gap-2 max-w-2xl">
            <button 
              onClick={() => setActiveTab('discord')} 
              className={`flex-1 py-5 px-10 rounded-[50px] font-black text-base transition-all flex items-center justify-center gap-4 ${activeTab === 'discord' ? 'bg-white text-brand-dark shadow-2xl' : 'text-text-secondary hover:text-white hover:bg-white/5'}`}
            >
              <FileText size={22} />
              {t('discord_profile') || 'معلومات الديسكورد'}
            </button>
            <button 
              onClick={() => setActiveTab('mta')} 
              className={`flex-1 py-5 px-10 rounded-[50px] font-black text-base transition-all flex items-center justify-center gap-4 ${activeTab === 'mta' ? 'bg-white text-brand-dark shadow-2xl' : 'text-text-secondary hover:text-white hover:bg-white/5'}`}
            >
              <Gamepad2 size={22} />
              {t('game_characters') || 'شخصيات اللعبة'}
            </button>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'discord' ? (
              <motion.div 
                key="discord" 
                initial={{ opacity: 0, x: -20 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: 20 }} 
                className="grid grid-cols-1 lg:grid-cols-3 gap-12"
              >
                <div className="lg:col-span-2 space-y-12">
                  <section className="glass-panel p-10 md:p-14 space-y-10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-3xl flex items-center justify-center border border-white/5 shadow-inner" style={{ backgroundColor: `${branding.primaryColor}11` }}>
                          <History size={32} style={{ color: branding.primaryColor }} />
                        </div>
                        <h2 className="text-3xl font-black text-white">{t('applications_history')}</h2>
                      </div>
                      <Link to="/applies" className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-sm font-black transition-all flex items-center gap-2 border border-white/5">
                        {t('new_application')}
                        <ChevronRight size={18} />
                      </Link>
                    </div>

                    <div className="space-y-5">
                      {submissionsLoading ? (
                        <div className="flex justify-center p-20">
                          <Loader2 size={48} className="animate-spin opacity-10" />
                        </div>
                      ) : submissions.length > 0 ? (
                        submissions.map((sub, idx) => (
                          <Link 
                            key={sub.id} 
                            to={`/submissions/${sub.id}`} 
                            className="bg-white/5 border border-white/5 hover:border-white/20 p-8 rounded-[40px] flex items-center justify-between group transition-all animate-fade-in-up" 
                            style={{ animationDelay: `${idx * 100}ms` }}
                          >
                            <div className="flex items-center gap-8">
                              <div className="w-16 h-16 rounded-[28px] bg-brand-dark/50 flex items-center justify-center border border-white/10 text-text-secondary group-hover:text-white group-hover:scale-110 transition-all">
                                <FileText size={32} />
                              </div>
                              <div>
                                <h3 className="text-2xl font-black text-white mb-2 group-hover:text-brand-cyan transition-colors">{sub.quiz_title}</h3>
                                <div className="flex items-center gap-2 text-text-secondary text-sm font-bold opacity-60">
                                  <Clock size={16} />
                                  {new Date(sub.submitted_at).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-8">
                              {renderStatusBadge(sub.status)}
                              <ChevronRight size={24} className="text-white/10 group-hover:text-white group-hover:translate-x-2 transition-all" />
                            </div>
                          </Link>
                        ))
                      ) : (
                        <div className="text-center py-24 bg-white/[0.01] rounded-[60px] border border-dashed border-white/10">
                          <FileText size={80} className="mx-auto mb-6 opacity-5" />
                          <p className="text-text-secondary text-2xl font-black">{t('no_submissions')}</p>
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                <div className="space-y-12">
                  <TwoFactorSetup />
                  
                  <section className="glass-panel p-10 md:p-14 space-y-10">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-purple-500/10 rounded-3xl flex items-center justify-center text-purple-400 border border-purple-500/10 shadow-inner">
                        <Star size={32} />
                      </div>
                      <h2 className="text-3xl font-black text-white">{t('stats')}</h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="bg-white/5 p-8 rounded-[40px] border border-white/5 shadow-inner text-center space-y-2">
                        <div className="text-text-secondary text-xs font-black uppercase tracking-widest">{t('total_apps')}</div>
                        <div className="text-4xl font-black text-white">{submissions.length}</div>
                      </div>
                      <div className="bg-white/5 p-8 rounded-[40px] border border-white/5 shadow-inner text-center space-y-2">
                        <div className="text-text-secondary text-xs font-black uppercase tracking-widest mb-1">{t('accepted_apps') || 'المقبولة'}</div>
                        <div className="text-4xl font-black text-green-400">{submissions.filter(s => s.status === 'accepted').length}</div>
                      </div>
                    </div>
                  </section>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="mta" 
                initial={{ opacity: 0, x: 20 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: -20 }} 
                className="space-y-12"
              >
                {!user?.mta_serial ? (
                  <div className="glass-panel p-24 text-center space-y-10 animate-fade-in-up">
                    <div className="w-32 h-32 bg-white/5 rounded-[50px] flex items-center justify-center mx-auto border border-white/10 group shadow-2xl">
                      <Gamepad2 size={64} className="text-text-secondary group-hover:scale-110 transition-transform" />
                    </div>
                    <div className="max-w-2xl mx-auto space-y-6">
                      <h2 className="text-5xl font-black text-white">{t('no_characters_found') || 'لا يوجد حساب مرتبط'}</h2>
                      <p className="text-text-secondary text-xl font-medium leading-relaxed opacity-60">
                        {t('play_to_create_character') || 'يجب عليك الربط من داخل اللعبة لتتمكن من رؤية شخصياتك هنا.'}
                      </p>
                      <div className="pt-6">
                      </div>
                    </div>
                  </div>
                ) : mtaAccountLoading ? (
                  <div className="glass-panel p-32 text-center space-y-10">
                    <Loader2 size={100} className="animate-spin mx-auto opacity-10" style={{ color: branding.primaryColor }} />
                    <p className="text-text-secondary text-2xl font-black">{t('loading_mta_data')}</p>
                  </div>
                ) : mtaAccountError ? (
                  <div className="glass-panel p-20 text-center space-y-10 max-w-4xl mx-auto border-red-500/20 bg-red-500/5">
                    <div className="w-24 h-24 bg-red-500/10 rounded-[40px] flex items-center justify-center text-red-500 mx-auto border border-red-500/10">
                      <Shield size={48} />
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-3xl font-black text-white">{t('mta_error_title') || 'خطأ في جلب البيانات'}</h3>
                      <p className="text-text-secondary text-xl opacity-80">{mtaAccountError}</p>
                    </div>
                    <div className="pt-6">
                      <button onClick={fetchMtaAccountData} className="px-12 py-5 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl transition-all border border-white/10 shadow-xl">
                        {t('retry')}
                      </button>
                    </div>
                  </div>
                ) : mtaAccountInfo ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    <div className="lg:col-span-2 space-y-12">
                      <section className="glass-panel p-10 md:p-14 space-y-14">
                        <div className="flex items-center gap-8">
                          <div className="w-16 h-16 rounded-3xl flex items-center justify-center shadow-inner border border-white/5" style={{ backgroundColor: `${branding.primaryColor}11` }}>
                            <Users size={32} style={{ color: branding.primaryColor }} />
                          </div>
                          <h2 className="text-4xl font-black text-white">{t('characters')} ({mtaAccountInfo.characters.length})</h2>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {mtaAccountInfo.characters.map((char, idx) => (
                            <button 
                              key={char.id} 
                              onClick={() => setSelectedCharacter(char)} 
                              className="bg-white/5 border border-white/5 hover:border-white/20 p-10 rounded-[50px] flex items-center gap-8 group transition-all text-left animate-fade-in-up shadow-xl"
                              style={{ animationDelay: `${idx * 150}ms` }}
                            >
                              <div className="w-20 h-20 bg-brand-dark/50 rounded-3xl flex items-center justify-center text-3xl font-black border border-white/10 text-white group-hover:scale-110 group-hover:rotate-6 transition-all">
                                {char.name.charAt(0)}
                              </div>
                              <div className="flex-1 space-y-1">
                                <h3 className="text-2xl font-black text-white group-hover:text-brand-cyan transition-colors">{char.name}</h3>
                                <p className="text-sm font-bold opacity-60" style={{ color: branding.primaryColor }}>{char.job}</p>
                              </div>
                              <ChevronRight size={28} className="text-white/10 group-hover:text-white group-hover:translate-x-2 transition-all" />
                            </button>
                          ))}
                        </div>
                      </section>
                    </div>

                    <div className="space-y-12">
                      <section className="glass-panel p-10 md:p-14 space-y-10 bg-red-500/5 border-red-500/20">
                        <div className="flex items-center gap-6">
                          <div className="w-16 h-16 bg-red-500/10 rounded-3xl flex items-center justify-center text-red-500 shadow-inner">
                            <AlertTriangle size={32} />
                          </div>
                          <h2 className="text-2xl font-black text-white">منطقة خطرة</h2>
                        </div>
                        <p className="text-text-secondary text-lg font-medium leading-relaxed opacity-60">{t('mta_unlink_warning') || 'تحذير: فك الربط سيؤدي إلى فقدان إمكانية الوصول لبياناتك من خلال الموقع حالياً.'}</p>
                        <button 
                          onClick={handleUnlinkMta} 
                          disabled={mtaLinkLoading}
                          className="w-full py-5 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-black rounded-3xl border border-red-500/20 transition-all flex items-center justify-center gap-4 disabled:opacity-50 shadow-2xl"
                        >
                          {mtaLinkLoading ? <Loader2 size={24} className="animate-spin" /> : <Link2 size={24} />}
                          {t('unlink_mta_account') || 'إلغاء ربط الحساب'}
                        </button>
                      </section>

                      <section className="glass-panel p-10 md:p-14 space-y-10">
                        <div className="flex items-center gap-6">
                          <div className="w-16 h-16 rounded-3xl flex items-center justify-center shadow-inner border border-white/5" style={{ backgroundColor: `${branding.primaryColor}22` }}>
                            <Trophy size={32} style={{ color: branding.primaryColor }} />
                          </div>
                          <h3 className="text-white font-black text-2xl">{t('general_stats')}</h3>
                        </div>
                        <div className="space-y-8">
                          <div className="flex justify-between items-center bg-white/5 p-6 rounded-3xl">
                            <span className="text-text-secondary font-bold">{t('total_wealth')}</span>
                            <span className="text-green-400 font-black text-2xl">
                              ${mtaAccountInfo.characters.reduce((acc, char) => acc + char.cash + char.bank, 0).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between items-center bg-white/5 p-6 rounded-3xl">
                            <span className="text-text-secondary font-bold">{t('highest_level')}</span>
                            <span className="font-black text-2xl" style={{ color: branding.primaryColor }}>
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
