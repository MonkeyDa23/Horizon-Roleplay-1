import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocalization } from '../contexts/LocalizationContext';
import { getSubmissionsByUserId, forceRefreshUserProfile } from '../lib/api';
import type { QuizSubmission, SubmissionStatus, DiscordRole, MtaAccountInfo } from '../types';
import { useNavigate, Link } from 'react-router-dom';
import { 
  User as UserIcon, Loader2, FileText, ExternalLink, Shield, RefreshCw,
  Gamepad2, Users, ChevronRight, Star, CreditCard, Link2, LogOut, Car, Home, Info
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
  const [activeTab, setActiveTab] = useState<'discord' | 'mta'>('discord');
  const [mtaData, setMtaData] = useState<MtaAccountInfo | null>(null);
  const [loadingMta, setLoadingMta] = useState(false);

  const fetchMtaData = useCallback(async () => {
    if (!user?.mta_serial) return;
    setLoadingMta(true);
    try {
      const res = await fetch(`/api/mta/account/${user.mta_serial}`);
      if (res.ok) {
        const data = await res.json();
        setMtaData(data);
      }
    } catch (err) {
      console.error("Failed to fetch MTA data:", err);
    } finally {
      setLoadingMta(false);
    }
  }, [user?.mta_serial]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/');
      return;
    }

    if (user) {
      const fetchSubmissions = async () => {
        setSubmissionsLoading(true);
        try {
          const userSubmissions = await getSubmissionsByUserId(user.id);
          setSubmissions(userSubmissions);
        } catch (error) {
          console.error("Failed to fetch user submissions for profile", error);
        } finally {
          setSubmissionsLoading(false);
        }
      };
      fetchSubmissions();
      
      if (user.mta_serial && activeTab === 'mta') {
        fetchMtaData();
      }
    }
  }, [user, authLoading, navigate, activeTab, fetchMtaData]);

  const handleRefresh = async () => {
    setIsSyncing(true);
    try {
        const { user: freshUser, syncError } = await forceRefreshUserProfile();
        updateUser(freshUser);
        showToast(t('profile_synced_success'), 'success');
        if (syncError) {
            showToast(syncError, 'warning');
        }
        if (freshUser.mta_serial) fetchMtaData();
    } catch (error) {
        showToast(t('profile_synced_error'), 'error');
        console.error(error);
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
    return <span className={`px-3 py-1 text-xs font-bold rounded-full border ${color}`}>{text}</span>;
  };

  const RoleBadge: React.FC<{ role: DiscordRole }> = ({ role }) => {
    const color = role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99aab5';
    return <span className="px-3 py-1 text-xs font-bold rounded-lg text-white" style={{ backgroundColor: color + '20', border: `1px solid ${color}40` }}>{role.name}</span>;
  };
  
  if (authLoading || !user) {
    return (
      <div className="container mx-auto px-6 py-16 flex justify-center items-center h-96">
        <Loader2 size={48} className="text-brand-cyan animate-spin" />
      </div>
    );
  }

  return (
    <>
      <SEO 
        title={`${communityName} - ${t('my_profile')}`}
        description={`User profile for ${user.username}. View your roles and recent applications.`}
        noIndex={true}
      />
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Top Header Section */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12">
            <div className="flex items-center gap-6">
              <div className="relative group">
                <img 
                  src={user.avatar} 
                  alt={user.username} 
                  className="w-24 h-24 rounded-3xl border-2 border-brand-cyan/30 object-cover shadow-2xl transition-transform group-hover:scale-105" 
                />
                <button 
                  onClick={handleRefresh}
                  disabled={isSyncing}
                  className="absolute -bottom-2 -right-2 bg-brand-cyan p-2 rounded-xl text-brand-dark hover:bg-white transition-all shadow-xl"
                >
                  {isSyncing ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                </button>
              </div>
              <div>
                <h1 className="text-4xl font-black text-white tracking-tighter mb-2">{user.username}</h1>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-text-secondary font-mono">ID: {user.discordId}</span>
                  {user.mta_linked_at && (
                    <span className="px-2 py-0.5 rounded bg-brand-cyan/10 text-brand-cyan text-[10px] font-bold uppercase tracking-widest border border-brand-cyan/20">
                      {user.mta_name || 'MTA Linked'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-3xl">
              <div className="text-right">
                <div className="text-[10px] text-text-secondary uppercase font-bold tracking-widest mb-1">{t('current_balance_label')}</div>
                <div className="text-2xl font-black text-brand-cyan tracking-tight">
                  {user.balance.toLocaleString()} <span className="text-xs font-normal text-text-secondary">VXL</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-brand-cyan/20 flex items-center justify-center">
                <CreditCard className="text-brand-cyan" size={24} />
              </div>
            </div>
          </div>

          {/* Main Navigation Tabs */}
          <div className="flex border-b border-white/10 mb-12">
            <button 
              onClick={() => setActiveTab('discord')}
              className={`pb-4 px-8 text-sm font-bold transition-all relative ${
                activeTab === 'discord' ? 'text-brand-cyan' : 'text-text-secondary hover:text-white'
              }`}
            >
              {t('discord_profile')}
              {activeTab === 'discord' && (
                <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-cyan" />
              )}
            </button>
            <button 
              onClick={() => setActiveTab('mta')}
              className={`pb-4 px-8 text-sm font-bold transition-all relative ${
                activeTab === 'mta' ? 'text-brand-cyan' : 'text-text-secondary hover:text-white'
              }`}
            >
              {t('mta_profile')}
              {activeTab === 'mta' && (
                <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-cyan" />
              )}
            </button>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'discord' ? (
              <motion.div 
                key="discord"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8"
              >
                <div className="lg:col-span-8 space-y-8">
                  {/* Discord Roles Section */}
                  <section className="bg-white/[0.02] border border-white/5 rounded-3xl p-8">
                    <div className="flex items-center gap-3 mb-8">
                      <Star className="text-brand-cyan" size={20} />
                      <h2 className="text-xl font-bold text-white">{t('discord_roles')}</h2>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {user.roles.map(role => <RoleBadge key={role.id} role={role} />)}
                    </div>
                  </section>

                  {/* Applications Section */}
                  <section className="bg-white/[0.02] border border-white/5 rounded-3xl p-8">
                    <div className="flex items-center gap-3 mb-8">
                      <FileText className="text-brand-cyan" size={20} />
                      <h2 className="text-xl font-bold text-white">{t('recent_applications')}</h2>
                    </div>
                    {submissionsLoading ? (
                      <div className="flex justify-center py-12"><Loader2 className="animate-spin text-brand-cyan" /></div>
                    ) : submissions.length === 0 ? (
                      <div className="text-center py-12 text-text-secondary italic bg-black/20 rounded-2xl">{t('no_applications_submitted')}</div>
                    ) : (
                      <div className="space-y-4">
                        {submissions.map(sub => (
                          <div key={sub.id} className="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/5 hover:border-brand-cyan/30 transition-all group">
                            <div>
                              <div className="font-bold text-white group-hover:text-brand-cyan transition-colors">{sub.quizTitle}</div>
                              <div className="text-xs text-text-secondary mt-1">{new Date(sub.submittedAt).toLocaleDateString()}</div>
                            </div>
                            {renderStatusBadge(sub.status)}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                <div className="lg:col-span-4 space-y-8">
                  <section className="bg-white/[0.02] border border-white/5 rounded-3xl p-8">
                    <h3 className="text-sm font-bold text-text-secondary uppercase tracking-widest mb-6">{t('account_info')}</h3>
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <span className="text-text-secondary text-sm">{t('highest_role')}</span>
                        <span className="text-brand-cyan font-bold">{user.highestRole?.name || 'None'}</span>
                      </div>
                      <div className="h-px bg-white/10"></div>
                      <div className="flex justify-between items-center">
                        <span className="text-text-secondary text-sm">{t('mta_status_label')}</span>
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${user.mta_linked_at ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                          {user.mta_linked_at ? t('linked') : t('not_linked')}
                        </span>
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
                className="space-y-8"
              >
                {!user.mta_linked_at ? (
                  <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-16 text-center">
                    <div className="w-24 h-24 bg-brand-cyan/10 rounded-full flex items-center justify-center mx-auto mb-8">
                      <Link2 size={48} className="text-brand-cyan" />
                    </div>
                    <h2 className="text-3xl font-black text-white mb-4 tracking-tight">{t('mta_not_linked_title')}</h2>
                    <p className="text-text-secondary mb-10 max-w-md mx-auto leading-relaxed">{t('mta_not_linked_desc')}</p>
                    <Link to="/link-account" className="inline-flex items-center gap-3 bg-brand-cyan text-brand-dark px-10 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-white transition-all shadow-2xl shadow-brand-cyan/20">
                      {t('link_now')}
                      <ChevronRight size={20} />
                    </Link>
                  </div>
                ) : loadingMta ? (
                  <div className="flex justify-center py-24"><Loader2 className="animate-spin text-brand-cyan" size={48} /></div>
                ) : mtaData ? (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-8 space-y-8">
                      {/* Character Grid */}
                      <section className="bg-white/[0.02] border border-white/5 rounded-3xl p-8">
                        <div className="flex items-center justify-between mb-8">
                          <div className="flex items-center gap-3">
                            <Users className="text-brand-cyan" size={20} />
                            <h2 className="text-xl font-bold text-white">{t('mta_characters')}</h2>
                          </div>
                          <span className="bg-brand-cyan/10 text-brand-cyan px-3 py-1 rounded-full text-xs font-bold">{mtaData.character_count}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          {mtaData.characters.map(char => (
                            <Link key={char.id} to={`/character/${char.id}`} className="group bg-black/20 border border-white/5 rounded-2xl p-6 hover:border-brand-cyan/50 transition-all">
                              <div className="flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 bg-brand-cyan/20 rounded-2xl flex items-center justify-center text-brand-cyan font-black text-2xl">{char.name.charAt(0)}</div>
                                <div>
                                  <div className="text-lg font-bold text-white group-hover:text-brand-cyan transition-colors">{char.name}</div>
                                  <div className="text-xs text-text-secondary uppercase tracking-widest font-bold">{char.job} • LVL {char.level}</div>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                  <div className="text-[10px] text-text-secondary uppercase font-bold mb-1">Cash</div>
                                  <div className="text-green-400 font-bold">${char.cash.toLocaleString()}</div>
                                </div>
                                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                  <div className="text-[10px] text-text-secondary uppercase font-bold mb-1">Bank</div>
                                  <div className="text-brand-cyan font-bold">${char.bank.toLocaleString()}</div>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </section>

                      {/* Admin History */}
                      <section className="bg-white/[0.02] border border-white/5 rounded-3xl p-8">
                        <div className="flex items-center gap-3 mb-8">
                          <Shield className="text-brand-cyan" size={20} />
                          <h2 className="text-xl font-bold text-white">{t('admin_record')}</h2>
                        </div>
                        <div className="space-y-4">
                          {mtaData.admin_record.length > 0 ? (
                            mtaData.admin_record.map((record, idx) => (
                              <div key={idx} className="flex items-start gap-5 p-6 rounded-2xl bg-black/20 border border-white/5">
                                <div className={`p-3 rounded-xl ${record.type === 'Ban' ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                                  <Shield size={20} />
                                </div>
                                <div className="flex-1">
                                  <div className="flex justify-between items-start mb-2">
                                    <div>
                                      <span className="font-black text-white text-lg uppercase tracking-tight">
                                        {record.type}
                                      </span>
                                      {record.duration && record.duration !== '0' && (
                                        <span className="text-xs font-bold text-text-secondary ml-3 bg-white/5 px-2 py-0.5 rounded">
                                          {record.duration} MIN
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-xs font-mono text-text-secondary">{new Date(record.date).toLocaleDateString()}</span>
                                  </div>
                                  <p className="text-sm text-text-secondary leading-relaxed mb-4">{record.reason}</p>
                                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-brand-cyan">
                                    <UserIcon size={12} />
                                    By: {record.admin}
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-12 text-text-secondary italic bg-black/20 rounded-2xl">{t('no_admin_records')}</div>
                          )}
                        </div>
                      </section>
                    </div>

                    <div className="lg:col-span-4 space-y-8">
                      <section className="bg-white/[0.02] border border-white/5 rounded-3xl p-8">
                        <h3 className="text-sm font-bold text-text-secondary uppercase tracking-widest mb-6">{t('mta_account_info')}</h3>
                        <div className="space-y-6">
                          <div className="flex justify-between items-center">
                            <span className="text-text-secondary text-sm">{t('mta_username')}</span>
                            <span className="text-white font-bold">{mtaData.username}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-text-secondary text-sm">{t('mta_id')}</span>
                            <span className="text-white font-bold">#{mtaData.id}</span>
                          </div>
                          <div className="h-px bg-white/10"></div>
                          <div className="flex justify-between items-center">
                            <span className="text-text-secondary text-sm">{t('mta_status')}</span>
                            <span className="text-green-400 font-bold flex items-center gap-2">
                              <Shield size={14} />
                              {t('mta_linked_success')}
                            </span>
                          </div>
                        </div>
                        
                        <div className="mt-10">
                          <Link 
                            to="/link-account" 
                            className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all font-bold text-sm"
                          >
                            <LogOut size={18} />
                            {t('unlink_account')}
                          </Link>
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
