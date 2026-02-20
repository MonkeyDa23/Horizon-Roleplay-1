import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocalization } from '../contexts/LocalizationContext';
import { getSubmissionsByUserId, forceRefreshUserProfile } from '../lib/api';
import type { QuizSubmission, SubmissionStatus, DiscordRole, MtaAccountInfo } from '../types';
import { useNavigate, Link } from 'react-router-dom';
import { 
  User as UserIcon, Loader2, FileText, ExternalLink, Shield, RefreshCw,
  Gamepad2, Users, ChevronRight, Star, CreditCard, Link2
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
      pending: { text: t('status_pending'), color: 'bg-yellow-500/20 text-yellow-400' },
      taken: { text: t('status_taken'), color: 'bg-blue-500/20 text-blue-400' },
      accepted: { text: t('status_accepted'), color: 'bg-green-500/20 text-green-400' },
      refused: { text: t('status_refused'), color: 'bg-red-500/20 text-red-400' },
    };
    const { text, color } = statusMap[status];
    return <span className={`px-3 py-1 text-sm font-bold rounded-full ${color}`}>{text}</span>;
  };

  const RoleBadge: React.FC<{ role: DiscordRole }> = ({ role }) => {
    const color = role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99aab5';
    return <span className="px-2 py-1 text-xs font-bold rounded-md text-white" style={{ backgroundColor: color + '40', border: `1px solid ${color}` }}>{role.name}</span>;
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
      <div className="container mx-auto px-6 py-24">
        <div className="max-w-5xl mx-auto">
          {/* Profile Header Card */}
          <div className="bg-brand-dark-blue rounded-2xl border border-brand-light-blue/50 p-8 mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-cyan/5 blur-[100px] rounded-full -mr-32 -mt-32"></div>
            
            <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
              <div className="relative">
                <img src={user.avatar} alt={user.username} className="w-32 h-32 rounded-2xl border-2 border-brand-cyan/20 object-cover shadow-lg shadow-brand-cyan/10" />
                <button 
                  onClick={handleRefresh}
                  disabled={isSyncing}
                  className="absolute -bottom-2 -right-2 bg-brand-light-blue p-2 rounded-lg text-white hover:bg-brand-cyan hover:text-brand-dark transition-all shadow-lg"
                  title={t('refresh_profile_tooltip')}
                >
                  {isSyncing ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
                </button>
              </div>
              
              <div className="flex-grow text-center md:text-left">
                <h1 className="text-4xl font-bold text-white">{user.username}</h1>
                <div className="mt-4 flex flex-wrap gap-2 justify-center md:justify-start">
                  <span className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full text-xs border border-white/10">
                    <UserIcon size={12} className="text-brand-cyan" />
                    ID: {user.discordId}
                  </span>
                  {user.mta_linked_at && (
                    <span className="flex items-center gap-2 bg-brand-cyan/10 px-3 py-1 rounded-full text-xs border border-brand-cyan/20 text-brand-cyan">
                      <Gamepad2 size={12} />
                      {user.mta_name || t('mta_linked')}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-center md:items-end gap-2">
                <div className="text-xs text-text-secondary uppercase tracking-wider">{t('current_balance')}</div>
                <div className="text-3xl font-bold text-brand-cyan flex items-center gap-2">
                  <CreditCard size={28} />
                  {user.balance.toLocaleString()} <span className="text-sm font-normal text-text-secondary">VXL</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="flex gap-4 mb-8 bg-brand-dark-blue/50 p-1.5 rounded-xl border border-brand-light-blue/30 w-fit">
            <button 
              onClick={() => setActiveTab('discord')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg transition-all ${
                activeTab === 'discord' 
                  ? 'bg-brand-cyan text-black font-bold shadow-lg shadow-brand-cyan/20' 
                  : 'text-text-secondary hover:text-white hover:bg-white/5'
              }`}
            >
              <UserIcon size={18} />
              {t('discord_profile')}
            </button>
            <button 
              onClick={() => setActiveTab('mta')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg transition-all ${
                activeTab === 'mta' 
                  ? 'bg-brand-cyan text-black font-bold shadow-lg shadow-brand-cyan/20' 
                  : 'text-text-secondary hover:text-white hover:bg-white/5'
              }`}
            >
              <Gamepad2 size={18} />
              {t('mta_profile')}
            </button>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'discord' ? (
              <motion.div 
                key="discord"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-8"
              >
                <div className="md:col-span-2 space-y-8">
                  {/* Discord Roles */}
                  <div className="bg-brand-dark-blue border border-brand-light-blue/50 rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                      <Star className="text-brand-cyan" />
                      {t('discord_roles')}
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {user.roles.map(role => <RoleBadge key={role.id} role={role} />)}
                    </div>
                  </div>

                  {/* Recent Applications */}
                  <div className="bg-brand-dark-blue border border-brand-light-blue/50 rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                      <FileText className="text-brand-cyan" />
                      {t('recent_applications')}
                    </h3>
                    <div className="overflow-x-auto">
                      {submissionsLoading ? (
                        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-brand-cyan" /></div>
                      ) : (
                        <table className="w-full text-right">
                          <thead className="text-text-secondary text-sm border-b border-white/10">
                            <tr>
                              <th className="pb-4 font-medium">{t('application_type')}</th>
                              <th className="pb-4 font-medium">{t('submitted_on')}</th>
                              <th className="pb-4 font-medium text-left">{t('status')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {submissions.length === 0 ? (
                              <tr><td colSpan={3} className="py-8 text-center text-text-secondary italic">{t('no_applications_submitted')}</td></tr>
                            ) : submissions.map(sub => (
                              <tr key={sub.id} className="group hover:bg-white/5 transition-colors">
                                <td className="py-4 font-bold text-white">{sub.quizTitle}</td>
                                <td className="py-4 text-sm text-text-secondary">{new Date(sub.submittedAt).toLocaleDateString()}</td>
                                <td className="py-4 text-left">{renderStatusBadge(sub.status)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-brand-dark-blue border border-brand-light-blue/50 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4">{t('account_info')}</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-text-secondary text-sm">{t('highest_role')}</span>
                        <span className="text-brand-cyan font-medium">{user.highestRole?.name || 'None'}</span>
                      </div>
                      <div className="w-full h-px bg-white/10"></div>
                      <div className="flex justify-between items-center">
                        <span className="text-text-secondary text-sm">{t('mta_status')}</span>
                        <span className={user.mta_linked_at ? "text-green-400" : "text-red-400"}>
                          {user.mta_linked_at ? t('linked') : t('not_linked')}
                        </span>
                      </div>
                    </div>
                  </div>
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
                {!user.mta_linked_at ? (
                  <div className="bg-brand-dark-blue border border-brand-light-blue/50 rounded-2xl p-12 text-center">
                    <div className="w-20 h-20 bg-brand-cyan/10 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Link2 size={40} className="text-brand-cyan" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-4">{t('mta_not_linked_title')}</h2>
                    <p className="text-text-secondary mb-8 max-w-md mx-auto">{t('mta_not_linked_desc')}</p>
                    <Link to="/link-account" className="inline-flex items-center gap-2 bg-brand-cyan text-black px-8 py-3 rounded-xl font-bold hover:shadow-lg hover:shadow-brand-cyan/20 transition-all">
                      {t('link_now')}
                      <ChevronRight size={20} />
                    </Link>
                  </div>
                ) : loadingMta ? (
                  <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-cyan" size={40} /></div>
                ) : mtaData ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-2 space-y-8">
                      {/* Character List */}
                      <div className="bg-brand-dark-blue border border-brand-light-blue/50 rounded-2xl p-6">
                        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                          <Users className="text-brand-cyan" />
                          {t('mta_characters')} ({mtaData.character_count})
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {mtaData.characters.map(char => (
                            <Link key={char.id} to={`/character/${char.id}`} className="group bg-white/5 border border-white/10 rounded-xl p-5 hover:border-brand-cyan/50 transition-all relative overflow-hidden">
                              <div className="absolute top-0 left-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ExternalLink size={16} className="text-brand-cyan" />
                              </div>
                              <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 bg-brand-cyan/10 rounded-lg flex items-center justify-center text-brand-cyan font-bold text-xl">{char.name.charAt(0)}</div>
                                <div>
                                  <div className="text-white font-bold group-hover:text-brand-cyan transition-colors">{char.name}</div>
                                  <div className="text-xs text-text-secondary">Level {char.level} • {char.job}</div>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-black/20 p-2 rounded-lg">
                                  <span className="text-text-secondary block mb-1">Cash</span>
                                  <span className="text-green-400 font-bold">${char.cash.toLocaleString()}</span>
                                </div>
                                <div className="bg-black/20 p-2 rounded-lg">
                                  <span className="text-text-secondary block mb-1">Bank</span>
                                  <span className="text-brand-cyan font-bold">${char.bank.toLocaleString()}</span>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>

                      {/* Admin Record */}
                      <div className="bg-brand-dark-blue border border-brand-light-blue/50 rounded-2xl p-6">
                        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                          <FileText className="text-brand-cyan" />
                          {t('admin_record')}
                        </h3>
                        <div className="space-y-4">
                          {mtaData.admin_record.length > 0 ? (
                            mtaData.admin_record.map((record, idx) => (
                              <div key={idx} className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                                <div className={`mt-1 p-2 rounded-lg ${record.type === 'Ban' ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                                  <Shield size={16} />
                                </div>
                                <div className="flex-1">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="font-bold text-white">
                                      {record.type} 
                                      {record.duration && record.duration !== '0' && (
                                        <span className="text-xs font-normal text-text-secondary mr-2">
                                          ({record.duration} min)
                                        </span>
                                      )}
                                    </span>
                                    <span className="text-xs text-text-secondary">{new Date(record.date).toLocaleDateString()}</span>
                                  </div>
                                  <p className="text-sm text-text-secondary mb-2">{record.reason}</p>
                                  <div className="text-xs text-brand-cyan">By: {record.admin}</div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-8 text-text-secondary italic">{t('no_admin_records')}</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="bg-brand-dark-blue border border-brand-light-blue/50 rounded-2xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4">معلومات حساب MTA</h3>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-text-secondary text-sm">اسم الحساب</span>
                            <span className="text-white font-medium">{mtaData.username}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-text-secondary text-sm">الأيدي (ID)</span>
                            <span className="text-white font-medium">#{mtaData.id}</span>
                          </div>
                          <div className="w-full h-px bg-white/10"></div>
                          <div className="flex justify-between items-center">
                            <span className="text-text-secondary text-sm">حالة الربط</span>
                            <span className="text-green-400 font-medium flex items-center gap-1">
                              <Shield size={14} />
                              مربوط بنجاح
                            </span>
                          </div>
                        </div>
                      </div>
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
