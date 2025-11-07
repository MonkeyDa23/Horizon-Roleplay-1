// src/pages/ProfilePage.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLocalization } from '../hooks/useLocalization';
import { getSubmissionsByUserId, forceRefreshUserProfile } from '../lib/api';
import type { QuizSubmission, SubmissionStatus, DiscordRole } from '../types';
// FIX: Fix "no exported member" errors from 'react-router-dom' by switching to a namespace import.
import * as ReactRouterDOM from 'react-router-dom';
import { User as UserIcon, Loader2, FileText, ExternalLink, Shield, RefreshCw } from 'lucide-react';
import { useConfig } from '../hooks/useConfig';
import SEO from '../components/SEO';
import { useToast } from '../hooks/useToast';

const ProfilePage: React.FC = () => {
  const { user, loading: authLoading, updateUser } = useAuth();
  const { t } = useLocalization();
  const navigate = ReactRouterDOM.useNavigate();
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
        description={`User profile for ${user.username}. View your roles and recent applications.`}
        noIndex={true}
      />
      <div className="container mx-auto px-6 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Profile Card */}
          <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50 p-8 mb-8 flex flex-col md:flex-row items-center gap-8">
            <div className="relative">
              <img src={user.avatar} alt={user.username} className="w-32 h-32 rounded-full border-4 border-brand-cyan shadow-glow-cyan" />
              <button 
                onClick={handleRefresh}
                disabled={isSyncing}
                className="absolute -bottom-2 -right-2 bg-brand-light-blue p-2 rounded-full text-white hover:bg-brand-cyan hover:text-brand-dark transition-colors"
                title={t('refresh_profile_tooltip')}
              >
                {isSyncing ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
              </button>
            </div>
            <div className="flex-grow text-center md:text-left">
              <h1 className="text-4xl font-bold text-white">{user.username}</h1>
              {user.highestRole && <div className="mt-2"><RoleBadge role={user.highestRole} /></div>}
              <div className="mt-4 flex flex-wrap gap-2 justify-center md:justify-start">
                {user.roles.map(role => <RoleBadge key={role.id} role={role} />)}
              </div>
              <p className="text-sm text-gray-500 mt-4 flex items-center justify-center md:justify-start gap-2">
                <UserIcon size={14} /> {t('user_id')}: {user.discordId}
                <a href={`https://discord.com/users/${user.discordId}`} target="_blank" rel="noopener noreferrer" className="hover:text-brand-cyan"><ExternalLink size={14} /></a>
              </p>
            </div>
          </div>

          {/* Recent Applications */}
          <div>
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3"><FileText /> {t('recent_applications')}</h2>
            <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50 overflow-hidden">
                <div className="overflow-x-auto">
                     {submissionsLoading ? (
                         <div className="flex justify-center items-center h-48">
                            <Loader2 size={40} className="text-brand-cyan animate-spin" />
                         </div>
                     ) : (
                        <table className="w-full text-left min-w-[600px]">
                            <thead className="border-b border-brand-light-blue/50 text-gray-300">
                                <tr>
                                    <th className="p-4">{t('application_type')}</th>
                                    <th className="p-4">{t('submitted_on')}</th>
                                    <th className="p-4">{t('status')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {submissions.length === 0 ? (
                                    <tr><td colSpan={3} className="p-8 text-center text-gray-400">{t('no_applications_submitted')}</td></tr>
                                ) : submissions.map(sub => (
                                    <tr key={sub.id} className="border-b border-brand-light-blue/50 last:border-none">
                                        <td className="p-4 font-semibold">{sub.quizTitle}</td>
                                        <td className="p-4 text-sm text-gray-400">{new Date(sub.submittedAt).toLocaleString()}</td>
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
