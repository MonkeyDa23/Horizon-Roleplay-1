import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLocalization } from '../hooks/useLocalization';
import { getSubmissionsByUserId } from '../lib/api';
import type { QuizSubmission, SubmissionStatus } from '../types';
import { useNavigate } from 'react-router-dom';
import { User as UserIcon, Loader2, FileText, ExternalLink } from 'lucide-react';
import { useConfig } from '../hooks/useConfig';
import SEO from '../components/SEO';

const ProfilePage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLocalization();
  const navigate = useNavigate();
  const { config } = useConfig();
  const communityName = config.COMMUNITY_NAME;
  
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);

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

  const renderUserRole = () => {
    if (!user) return null;

    if (user.highestRole && user.highestRole.name !== '@everyone') {
        const role = user.highestRole;
        const style = {
            backgroundColor: `${role.color === '#000000' ? '#2f3136' : role.color}30`,
            borderColor: role.color === '#000000' ? '#99aab5' : role.color,
            color: role.color === '#000000' ? '#ffffff' : role.color,
        };
        return <span className="px-3 py-1 text-sm font-bold rounded-full border" style={style}>{role.name}</span>;
    }
    if (user.isAdmin) {
        return <span className="px-3 py-1 text-sm font-bold rounded-full bg-brand-cyan/20 text-brand-cyan">{t('admin')}</span>;
    }
    return <span className="px-3 py-1 text-sm font-bold rounded-full bg-gray-500/20 text-gray-300">{t('member')}</span>;
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
          <div className="lg:col-span-1">
              <div className="bg-brand-dark-blue p-6 rounded-lg border border-brand-light-blue/50 text-center shadow-lg">
                  <img 
                      src={user.avatar} 
                      alt={user.username}
                      className="w-32 h-32 rounded-full mx-auto border-4 border-brand-cyan shadow-glow-cyan-light"
                  />
                  <h2 className="text-3xl font-bold mt-4">{user.username}</h2>
                  <div className="mt-2 min-h-[28px] flex items-center justify-center">
                    {renderUserRole()}
                  </div>
                  
                  {user.discordRoles && user.discordRoles.length > 0 && (
                      <div className="mt-6 pt-4 border-t border-brand-light-blue/50">
                          <h4 className="font-bold text-gray-300 mb-3">{t('discord_roles')}</h4>
                          <div className="flex flex-wrap justify-center gap-2">
                              {user.discordRoles
                                .filter(role => role.name !== '@everyone')
                                .map(role => (
                                  <span 
                                      key={role.id}
                                      className="px-2.5 py-1 text-xs font-semibold rounded-full border"
                                      style={{
                                          backgroundColor: `${role.color === '#000000' ? '#2f3136' : role.color}4D`,
                                          borderColor: role.color === '#000000' ? '#99aab5' : role.color,
                                          color: role.color === '#000000' ? '#ffffff' : role.color,
                                      }}
                                  >
                                      {role.name}
                                  </span>
                              ))}
                          </div>
                      </div>
                  )}

                  <a 
                      href={`https://discord.com/users/${user.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-6 inline-flex items-center gap-2 bg-[#5865F2] text-white font-bold py-2 px-4 rounded-md hover:bg-[#4f5bda] transition-colors"
                      >
                      <ExternalLink size={16} />
                      {t('view_on_discord')}
                  </a>
                  <div className="mt-6 space-y-3 text-gray-300 text-sm">
                      <div className="flex flex-col items-center">
                          <span className="font-semibold text-gray-400">{t('user_id')}</span>
                          <code className="text-xs bg-brand-dark px-2 py-1 rounded mt-1">{user.id}</code>
                      </div>
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