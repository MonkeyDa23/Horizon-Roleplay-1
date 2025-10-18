import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLocalization } from '../hooks/useLocalization';
import { getSubmissionsByUserId, forceRefreshUserProfile } from '../lib/api';
import type { QuizSubmission, SubmissionStatus, DiscordRole } from '../types';
import { useNavigate } from 'react-router-dom';
import { User as UserIcon, Loader2, FileText, ExternalLink, Shield, RefreshCw } from 'lucide-react';
import { useConfig } from '../hooks/useConfig';
import SEO from '../components/SEO';
import { useToast } from '../hooks/useToast';

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
    }
  }, [user, authLoading, navigate]);

  const handleRefresh = async () => {
    setIsSyncing(true);
    try {
        const { user: freshUser, syncError } = await forceRefreshUserProfile();
        updateUser(freshUser); // Update the global state
        showToast(t('profile_synced_success'), 'success');
        if (syncError) {
            showToast(syncError, 'warning');
        }
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
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    const textColor = brightness > 125 ? 'text-black' : 'text-white';

    return <span className={`px-2 py-1 text-xs font-bold rounded-md ${textColor}`} style={{ backgroundColor: color }}>{role.name}</span>;
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
        description="Your user profile and application history."
        noIndex={true}
      />
      <div className="container mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <div className="inline-block p-4 bg-brand-light-blue rounded-full mb-4">
            <UserIcon className="text-brand-cyan" size={48} />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t('my_profile')}</h1>
        </div>
        
        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-8">
              <div className="relative bg-brand-dark-blue p-6 rounded-lg border border-brand-light-blue/50 text-center shadow-lg">
                  <button 
                      onClick={handleRefresh} 
                      disabled={isSyncing} 
                      title={t('refresh_profile_tooltip')}
                      className="absolute top-4 end-4 text-gray-400 hover:text-brand-cyan transition-colors disabled:cursor-wait disabled:text-gray-600"
                  >
                      <RefreshCw size={20} className={isSyncing ? 'animate-spin' : ''} />
                  </button>
                  <img 
                      src={user.avatar} 
                      alt={user.username}
                      className="w-32 h-32 rounded-full mx-auto border-4 border-brand-cyan shadow-glow-cyan-light"
                  />
                  <h2 className="text-3xl font-bold mt-4">{user.username}</h2>
                  <div className="mt-2 min-h-[28px] flex items-center justify-center">
                    {user.highestRole ? <RoleBadge role={user.highestRole} /> : <span className="px-3 py-1 text-sm font-bold rounded-full bg-gray-500/20 text-gray-300">{t('member')}</span>}
                  </div>
                  
                  <a 
                      href={`https://discord.com/users/${user.discordId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-6 inline-flex items-center gap-2 bg-[#5865F2] text-white font-bold py-2 px-4 rounded-md hover:bg-[#4f5bda] transition-colors"
                      >
                      <ExternalLink size={16} />
                      {t('view_on_discord')}
                  </a>
                  <div className="mt-6 pt-4 border-t border-brand-light-blue/50 space-y-3 text-gray-300 text-sm">
                      <div className="flex flex-col items-center">
                          <span className="font-semibold text-gray-400">{t('user_id')}</span>
                          <code className="text-xs bg-brand-dark px-2 py-1 rounded mt-1">{user.discordId}</code>
                      </div>
                  </div>
              </div>
              <div className="bg-brand-dark-blue p-6 rounded-lg border border-brand-light-blue/50 shadow-lg">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-3"><Shield className="text-brand-cyan" /> {t('discord_roles')}</h3>
                <div className="flex flex-wrap gap-2">
                  {user.roles && user.roles.length > 0 ? (
                    user.roles.map(role => <RoleBadge key={role.id} role={role} />)
                  ) : (
                    <p className="text-gray-400 text-sm">{t('member')}</p>
                  )}
                </div>
              </div>
          </div>

          <div className="lg:col-span-2">
              <h3 className="text-2xl font-bold mb-4 flex items-center gap-3">
                  <FileText className="text-brand-cyan" />
                  {t('recent_applications')}
              </h3>
              <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50">
                  <div className="overflow-x-auto">
                  {submissionsLoading ? (
                      <div className="flex justify-center items-center h-48">
                          <Loader2 size={40} className="text-brand-cyan animate-spin" />
                      </div>
                  ) : (
                      <table className="w-full text-left min-w-[500px]">
                      <thead className="border-b border-brand-light-blue/50 text-gray-300">
                          <tr>
                          <th className="p-4">{t('application_type')}</th>
                          <th className="p-4">{t('submitted_on')}</th>
                          <th className="p-4">{t('status')}</th>
                          </tr>
                      </thead>
                      <tbody>
                          {submissions.length === 0 ? (
                          <tr>
                              <td colSpan={3} className="p-8 text-center text-gray-400">
                              {t('no_applications_submitted')}
                              </td>
                          </tr>
                          ) : submissions.map((sub, index) => (
                          <tr key={sub.id} className={`border-b border-brand-light-blue/50 ${index === submissions.length - 1 ? 'border-none' : ''}`}>
                              <td className="p-4 font-semibold">{sub.quizTitle}</td>
                              <td className="p-4 text-sm text-gray-400">{new Date(sub.submittedAt).toLocaleDateString()}</td>
                              <td className="p-4">{renderStatusBadge(sub.status)}</td>
                          </tr>
                          ))}
                      </tbody>
                      </table>
                  )}
                  </div>
              </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProfilePage;