import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocalization } from '../contexts/LocalizationContext';
import { getSubmissionsByUserId, forceRefreshUserProfile, getMtaAccountInfo, unlinkMtaAccount } from '../lib/api';
import type { QuizSubmission, SubmissionStatus, DiscordRole, MtaAccountInfo, MtaCharacter } from '../types';
import { useNavigate } from 'react-router-dom';
import { 
  User as UserIcon, Loader2, FileText, Shield, RefreshCw,
  Gamepad2, ChevronRight, Star, Link2, ShieldCheck,
  Wallet, Landmark, Trophy, History, X,
  Briefcase, Car, Home, Users
} from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';
import SEO from '../components/SEO';
import { useToast } from '../contexts/ToastContext';
import { motion, AnimatePresence } from 'motion/react';
import TwoFactorSetup from '../components/profile/TwoFactorSetup';
import { useCurrency } from '../contexts/CurrencyContext';

const ProfilePage: React.FC = () => {
  const { user, authLoading, refreshUser } = useAuth() as any;
  const { t, dir } = useLocalization();
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();
  const { branding } = useConfig();
  const { showToast } = useToast();
  const communityName = branding.siteName;
  
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const [mtaAccountInfo, setMtaAccountInfo] = useState<MtaAccountInfo | null>(null);
  const [mtaAccountLoading, setMtaAccountLoading] = useState(false);
  const [mtaAccountError, setMtaAccountError] = useState<string | null>(null);

  const [mtaLinkLoading, setMtaLinkLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<'discord' | 'mta'>('discord');
  const [selectedCharacter, setSelectedCharacter] = useState<MtaCharacter | null>(null);

  const CharacterDetailModal = ({ character, onClose }: { character: MtaCharacter, onClose: () => void }) => {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6"
      >
        <div className="absolute inset-0 bg-brand-dark/90 backdrop-blur-xl" onClick={onClose}></div>
        
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-white/[0.03] border border-white/10 rounded-[40px] w-full max-w-4xl max-h-[90vh] overflow-y-auto relative z-10 shadow-2xl"
        >
          <div className="sticky top-0 bg-brand-dark/80 backdrop-blur-md border-b border-white/10 p-6 md:p-8 flex justify-between items-center z-20">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center font-black text-3xl border border-white/10" style={{ color: branding.primaryColor }}>
                {character.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-3xl font-black text-white tracking-tight">{character.name}</h2>
                <p className="font-bold text-sm" style={{ color: branding.primaryColor }}>ID: {character.id} • {character.job}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-3 bg-white/5 rounded-2xl text-text-secondary hover:text-white hover:bg-white/10 transition-all">
              <X size={24} />
            </button>
          </div>

          <div className="p-6 md:p-10 space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/5 border border-white/5 p-6 rounded-[32px] text-center">
                <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center text-green-400 mx-auto mb-4">
                  <Wallet size={24} />
                </div>
                <div className="text-[10px] text-text-secondary uppercase font-black tracking-widest mb-1">{t('cash')}</div>
                <div className="text-2xl font-black text-white">${character.cash.toLocaleString()}</div>
              </div>
              <div className="bg-white/5 border border-white/5 p-6 rounded-[32px] text-center">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${branding.primaryColor}22`, color: branding.primaryColor }}>
                  <Landmark size={24} />
                </div>
                <div className="text-[10px] text-text-secondary uppercase font-black tracking-widest mb-1">{t('bank')}</div>
                <div className="text-2xl font-black text-white">${character.bank.toLocaleString()}</div>
              </div>
              <div className="bg-white/5 border border-white/5 p-6 rounded-[32px] text-center">
                <div className="w-12 h-12 bg-brand-purple/10 rounded-2xl flex items-center justify-center text-brand-purple mx-auto mb-4">
                  <Trophy size={24} />
                </div>
                <div className="text-[10px] text-text-secondary uppercase font-black tracking-widest mb-1">{t('playtime')}</div>
                <div className="text-2xl font-black text-white">{character.playtime_hours} {t('hours')}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <h3 className="text-xl font-black text-white flex items-center gap-3">
                  <UserIcon size={20} style={{ color: branding.primaryColor }} />
                  {t('personal_info')}
                </h3>
                <div className="space-y-4 bg-white/5 p-6 rounded-[32px] border border-white/5">
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary text-sm">{t('gender')}</span>
                    <span className="text-white font-bold">{character.gender === 'Male' ? t('male') : t('female')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary text-sm">{t('age')}</span>
                    <span className="text-white font-bold">{character.age} {t('year')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary text-sm">{t('dob')}</span>
                    <span className="text-white font-bold">{character.dob}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary text-sm">{t('level')}</span>
                    <span className="font-black" style={{ color: branding.primaryColor }}>{character.level}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-xl font-black text-white flex items-center gap-3">
                  <Briefcase size={20} style={{ color: branding.primaryColor }} />
                  {t('job_and_faction')}
                </h3>
                <div className="space-y-4 bg-white/5 p-6 rounded-[32px] border border-white/5">
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary text-sm">{t('job')}</span>
                    <span className="text-white font-bold">{character.job}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary text-sm">{t('faction')}</span>
                    <span className="font-black" style={{ color: branding.primaryColor }}>{character.faction}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <h3 className="text-xl font-black text-white flex items-center gap-3">
                  <Car size={20} style={{ color: branding.primaryColor }} />
                  {t('vehicles')} ({character.vehicles.length})
                </h3>
                <div className="space-y-3">
                  {character.vehicles.length > 0 ? character.vehicles.map(v => (
                    <div key={v.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex justify-between items-center group transition-all">
                      <div>
                        <div className="text-white font-bold">{v.model}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: branding.primaryColor }}>ID: {v.id}</div>
                      </div>
                      <Car size={16} className="text-white/20" />
                    </div>
                  )) : (
                    <div className="text-text-secondary italic text-sm p-4 bg-white/5 rounded-2xl border border-white/5 text-center">{t('no_vehicles')}</div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-xl font-black text-white flex items-center gap-3">
                  <Home size={20} style={{ color: branding.primaryColor }} />
                  {t('properties')} ({character.properties.length})
                </h3>
                <div className="space-y-3">
                  {character.properties.length > 0 ? character.properties.map(p => (
                    <div key={p.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex justify-between items-center group transition-all">
                      <div>
                        <div className="text-white font-bold">{p.name}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: branding.primaryColor }}>ID: {p.id} • ${p.cost.toLocaleString()}</div>
                      </div>
                      <Home size={16} className="text-white/20" />
                    </div>
                  )) : (
                    <div className="text-text-secondary italic text-sm p-4 bg-white/5 rounded-2xl border border-white/5 text-center">{t('no_properties')}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  };

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
      setMtaAccountError((err as Error).message);
      setMtaAccountInfo(null);
    } finally {
      setMtaAccountLoading(false);
    }
  }, [user?.mta_serial]);

  const handleUnlinkMta = useCallback(async () => {
    if (!user?.mta_serial) return;
    if (!window.confirm(t('confirm_unlink'))) return;

    setMtaLinkLoading(true);
    try {
      await unlinkMtaAccount(user.mta_serial);
      setMtaAccountInfo(null);
      await refreshUser();
      showToast(t('mta_unlink_success'), 'success');
    } catch (err) {
      showToast(t('mta_unlink_error'), 'error');
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
      console.error(error);
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
        await refreshUser();
        showToast(t('profile_refresh_success'), 'success');
    } catch (error) {
        showToast(t('profile_refresh_error'), 'error');
    } finally {
        setIsSyncing(false);
    }
  };

  const renderStatusBadge = (status: SubmissionStatus) => {
    const statusMap = {
      pending: { text: t('status_pending'), color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
      taken: { text: t('status_taken'), color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
      accepted: { text: t('status_accepted'), color: 'bg-green-500/20 text-green-400 border-green-500/30' },
      refused: { text: t('status_refused'), color: 'bg-red-500/20 text-red-400 border-red-500/30' },
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
        <Loader2 size={48} className="animate-spin" style={{ color: branding.primaryColor }} />
      </div>
    );
  }

  return (
    <>
      <SEO 
        title={`${communityName} - ${t('my_profile')}`}
        description={t('profile_description', { username: user.username })}
        noIndex={true}
      />
      
      <div className="min-h-screen bg-brand-dark pb-24" dir={dir}>
        <AnimatePresence>
          {selectedCharacter && (
            <CharacterDetailModal 
              character={selectedCharacter} 
              onClose={() => setSelectedCharacter(null)} 
            />
          )}
        </AnimatePresence>
        
        <div className="relative h-80 overflow-hidden">
          <div className="absolute inset-0 z-0" style={{ background: `linear-gradient(to bottom, ${branding.primaryColor}33, transparent)` }}></div>
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
                <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-brand-dark rounded-2xl flex items-center justify-center border-4 border-brand-dark shadow-xl" style={{ color: branding.primaryColor }}>
                  <ShieldCheck size={24} />
                </div>
              </div>
              
              <div className="flex-1 text-center md:text-left space-y-4">
                <div className="space-y-1">
                  <motion.h1 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="text-4xl md:text-6xl font-black text-white tracking-tighter"
                  >
                    {user.username}
                  </motion.h1>
                  <p className="text-text-secondary font-bold tracking-wide uppercase text-xs flex items-center justify-center md:justify-start gap-2">
                    <Shield size={14} style={{ color: branding.primaryColor }} />
                    {user.email}
                  </p>
                </div>
                
                <div className="flex flex-wrap justify-center md:justify-start gap-3">
                  {user.discord_roles?.map((role: any) => (
                    <RoleBadge key={role.id} role={role} />
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={handleRefresh}
                  disabled={isSyncing}
                  className="px-8 py-4 bg-white/5 hover:bg-white/10 active:scale-95 text-white font-black rounded-2xl border border-white/10 transition-all flex items-center gap-3 disabled:opacity-50"
                >
                  <RefreshCw size={20} className={isSyncing ? 'animate-spin' : ''} />
                  {isSyncing ? t('syncing') : t('sync_profile')}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-6 -mt-8 relative z-20">
          <div className="bg-white/[0.02] border border-white/10 rounded-[48px] p-2 backdrop-blur-xl mb-12 flex flex-wrap gap-2">
            <button 
              onClick={() => setActiveTab('discord')}
              className={`flex-1 py-4 px-8 rounded-[40px] font-black text-sm transition-all flex items-center justify-center gap-3 ${activeTab === 'discord' ? 'bg-white text-brand-dark shadow-xl' : 'text-text-secondary hover:text-white hover:bg-white/5'}`}
            >
              <FileText size={20} />
              {t('discord_profile')}
            </button>
            <button 
              onClick={() => setActiveTab('mta')}
              className={`flex-1 py-4 px-8 rounded-[40px] font-black text-sm transition-all flex items-center justify-center gap-3 ${activeTab === 'mta' ? 'bg-white text-brand-dark shadow-xl' : 'text-text-secondary hover:text-white hover:bg-white/5'}`}
            >
              <Gamepad2 size={20} />
              {t('game_characters')}
            </button>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'discord' ? (
              <motion.div 
                key="discord"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-8"
              >
                <div className="lg:col-span-2 space-y-8">
                  <section className="bg-white/[0.03] border border-white/10 rounded-[48px] p-10">
                    <div className="flex items-center justify-between mb-10">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${branding.primaryColor}22` }}>
                          <History size={24} style={{ color: branding.primaryColor }} />
                        </div>
                        <h2 className="text-2xl font-black text-white tracking-tight">{t('applications_history')}</h2>
                      </div>
                      <Link to="/quiz" className="text-sm font-bold opacity-60 hover:opacity-100 transition-opacity flex items-center gap-2" style={{ color: branding.primaryColor }}>
                        {t('new_application')}
                        <ChevronRight size={16} />
                      </Link>
                    </div>

                    <div className="space-y-4">
                      {submissionsLoading ? (
                        <div className="flex justify-center p-12">
                          <Loader2 size={32} className="animate-spin text-white/20" />
                        </div>
                      ) : submissions.length > 0 ? (
                        submissions.map((sub) => (
                          <Link 
                            key={sub.id}
                            to={`/submissions/${sub.id}`}
                            className="bg-white/5 border border-white/5 hover:border-white/20 p-6 rounded-[32px] flex items-center justify-between group transition-all"
                          >
                            <div className="flex items-center gap-6">
                              <div className="w-12 h-12 rounded-2xl bg-brand-dark/50 flex items-center justify-center border border-white/10 text-text-secondary group-hover:text-white transition-colors">
                                <FileText size={24} />
                              </div>
                              <div>
                                <h3 className="text-white font-bold mb-1">{sub.quiz_title}</h3>
                                <p className="text-xs text-text-secondary">{new Date(sub.submitted_at).toLocaleDateString()}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-6">
                              {renderStatusBadge(sub.status)}
                              <ChevronRight size={20} className="text-white/10 group-hover:text-white group-hover:translate-x-1 transition-all" />
                            </div>
                          </Link>
                        ))
                      ) : (
                        <div className="text-center py-20 bg-white/5 rounded-[32px] border border-dashed border-white/10">
                          <FileText size={48} className="mx-auto mb-4 text-white/5" />
                          <p className="text-text-secondary font-bold">{t('no_submissions')}</p>
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                <div className="space-y-8">
                  <TwoFactorSetup />
                  
                  <section className="bg-white/[0.03] border border-white/10 rounded-[48px] p-10">
                    <div className="flex items-center gap-4 mb-8">
                      <div className="w-12 h-12 bg-brand-purple/10 rounded-2xl flex items-center justify-center text-brand-purple">
                        <Star size={24} />
                      </div>
                      <h2 className="text-2xl font-black text-white tracking-tight">{t('stats')}</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/5 p-6 rounded-[32px] border border-white/5">
                        <div className="text-text-secondary text-[10px] font-black uppercase tracking-widest mb-1">{t('total_apps')}</div>
                        <div className="text-2xl font-black text-white">{submissions.length}</div>
                      </div>
                      <div className="bg-white/5 p-6 rounded-[32px] border border-white/5">
                        <div className="text-text-secondary text-[10px] font-black uppercase tracking-widest mb-1">{t('accepted_apps')}</div>
                        <div className="text-2xl font-black text-green-400">{submissions.filter(s => s.status === 'accepted').length}</div>
                      </div>
                    </div>
                  </section>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="mta"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-12"
              >
                {!user?.mta_serial ? (
                  <div className="bg-white/[0.03] border border-white/10 rounded-[48px] p-16 text-center space-y-8">
                    <div className="w-24 h-24 bg-white/5 rounded-[40px] flex items-center justify-center mx-auto border border-white/10 group">
                      <Gamepad2 size={48} className="text-text-secondary group-hover:scale-110 transition-transform" />
                    </div>
                    <div className="max-w-2xl mx-auto space-y-4">
                      <h2 className="text-4xl font-black text-white tracking-tight">{t('no_characters_found')}</h2>
                      <p className="text-text-secondary text-lg leading-relaxed">{t('play_to_create_character')}</p>
                    </div>
                  </div>
                ) : mtaAccountLoading ? (
                  <div className="bg-white/[0.03] border border-white/10 rounded-[48px] p-24 text-center">
                    <Loader2 size={48} className="animate-spin mx-auto mb-4" style={{ color: branding.primaryColor }} />
                    <p className="text-text-secondary font-black">{t('loading_mta_data')}</p>
                  </div>
                ) : mtaAccountError ? (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-[48px] p-16 text-center space-y-6">
                    <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="w-20 h-20 bg-red-500/10 rounded-[32px] flex items-center justify-center text-red-500 mx-auto">
                      <Shield size={40} />
                    </motion.div>
                    <div className="max-w-md mx-auto">
                      <h3 className="text-2xl font-black text-white mb-2">{t('mta_error_title')}</h3>
                      <p className="text-text-secondary mb-8">{mtaAccountError}</p>
                      <button onClick={fetchMtaAccountData} className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all border border-white/10">
                        {t('retry')}
                      </button>
                    </div>
                  </div>
                ) : mtaAccountInfo ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                      <section className="bg-white/[0.03] border border-white/10 rounded-[48px] p-10">
                        <div className="flex items-center gap-4 mb-10">
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${branding.primaryColor}22` }}>
                            <Users size={24} style={{ color: branding.primaryColor }} />
                          </div>
                          <h2 className="text-2xl font-black text-white tracking-tight">{t('characters')} ({mtaAccountInfo.characters.length})</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {mtaAccountInfo.characters.map((char) => (
                            <button 
                              key={char.id}
                              onClick={() => setSelectedCharacter(char)}
                              className="bg-white/5 border border-white/5 hover:border-white/20 p-8 rounded-[40px] flex items-center gap-6 group transition-all text-left"
                            >
                              <div className="w-16 h-16 bg-brand-dark/50 rounded-2xl flex items-center justify-center text-2xl font-black border border-white/10 text-white group-hover:scale-105 transition-transform">
                                {char.name.charAt(0)}
                              </div>
                              <div className="flex-1">
                                <h3 className="text-white font-bold text-lg mb-1 group-hover:text-brand-cyan transition-colors">{char.name}</h3>
                                <p className="text-xs text-text-secondary font-medium">{char.job}</p>
                              </div>
                              <ChevronRight size={20} className="text-white/10 group-hover:text-white transition-all" />
                            </button>
                          ))}
                        </div>
                      </section>
                    </div>

                    <div className="space-y-8">
                      <section className="bg-red-500/5 border border-red-500/10 rounded-[48px] p-10 space-y-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500">
                            <Shield size={24} />
                          </div>
                          <h2 className="text-xl font-black text-white">{t('dangerous_area')}</h2>
                        </div>
                        <p className="text-text-secondary text-sm leading-relaxed">{t('mta_unlink_warning')}</p>
                        <button 
                          onClick={handleUnlinkMta}
                          disabled={mtaLinkLoading}
                          className="w-full py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-black rounded-2xl border border-red-500/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                          {mtaLinkLoading ? <Loader2 size={20} className="animate-spin" /> : <Link2 size={20} />}
                          {t('unlink_mta_account')}
                        </button>
                      </section>

                      <section className="bg-white/[0.03] border border-white/10 rounded-[48px] p-10">
                        <div className="flex items-center gap-4 mb-6">
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${branding.primaryColor}22` }}>
                            <Trophy size={24} style={{ color: branding.primaryColor }} />
                          </div>
                          <h3 className="text-white font-black text-xl">{t('general_stats')}</h3>
                        </div>
                        <div className="space-y-6">
                          <div className="flex justify-between items-center">
                            <span className="text-text-secondary text-sm">{t('total_wealth')}</span>
                            <span className="text-green-400 font-black">
                              ${mtaAccountInfo.characters.reduce((acc, char) => acc + char.cash + char.bank, 0).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-text-secondary text-sm">{t('highest_level')}</span>
                            <span className="font-black" style={{ color: branding.primaryColor }}>
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
