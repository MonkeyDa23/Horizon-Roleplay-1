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
                                    <th className="p-4">{t('--- START OF FILE src/pages/AuthCallbackPage.tsx ------ START OF FILE .env.tsx ------ START OF FILE api/index.js ------ START OF FILE src/.env.tsx ------ START OF FILE src/components/icons/Logo.tsx ------ START OF FILE src/pages/HealthCheckPage.tsx ---

// src/pages/HealthCheckPage.tsx
import React from 'react';
import { Loader2, CheckCircle, XCircle, AlertTriangle, HelpCircle, Share2, User, Server, Database, Bot, Webhook, ChevronRight } from 'lucide-react';
import { useLocalization } from '../hooks/useLocalization';
import { env } from '../env';
import { checkDiscordApiHealth, troubleshootUserSync, checkFunctionSecrets, testHttpRequest } from '../lib/api';
import SEO from '../components/SEO';
import { useAuth } from '../hooks/useAuth';
// FIX: Fix "no exported member" errors from 'react-router-dom' by switching to a namespace import.
import * as ReactRouterDOM from 'react-router-dom';

const HealthCheckPage: React.FC = () => {
  const { t } = useLocalization();
  const { hasPermission } = useAuth();
  const navigate = ReactRouterDOM.useNavigate();
  
  const [httpTestResult, setHttpTestResult] = React.useState<any>(null);
  const [httpTestLoading, setHttpTestLoading] = React.useState(false);

  const [secretsResult, setSecretsResult] = React.useState<any>(null);
  const [secretsLoading, setSecretsLoading] = React.useState(true);

  const [botHealth, setBotHealth] = React.useState<any>(null);
  const [isTestingBot, setIsTestingBot] = React.useState(false);

  const [syncDiscordId, setSyncDiscordId] = React.useState('');
  const [syncResult, setSyncResult] = React.useState<any>(null);
  const [isTestingSync, setIsTestingSync] = React.useState(false);

  // Security check
  React.useEffect(() => {
    if (!hasPermission('_super_admin')) {
      navigate('/');
    }
  }, [hasPermission, navigate]);
  
  React.useEffect(() => {
    const runCheck = async () => {
      setSecretsLoading(true);
      try {
        setSecretsResult(await checkFunctionSecrets());
      } catch (e) {
        setSecretsResult({ error: (e as Error).message });
      } finally {
        setSecretsLoading(false);
      }
    };
    runCheck();
  }, []);

  const handleHttpTest = async () => {
    setHttpTestLoading(true);
    setHttpTestResult(null);
    try {
        const result = await testHttpRequest();
        setHttpTestResult(result);
    } catch (e) {
        setHttpTestResult({ error: (e as Error).message });
    } finally {
        setHttpTestLoading(false);
    }
  };

  const handleRunBotTest = async () => {
    setIsTestingBot(true);
    setBotHealth(null);
    try {
        const result = await checkDiscordApiHealth();
        setBotHealth(result);
    } catch (error) {
        setBotHealth({
            ok: false,
            message: 'Failed to invoke Supabase function.',
            details: error instanceof Error ? error.message : String(error)
        });
    } finally {
        setIsTestingBot(false);
    }
  };

  const handleRunSyncTest = async () => {
      if (!syncDiscordId) return;
      setIsTestingSync(true);
      setSyncResult(null);
      try {
          const result = await troubleshootUserSync(syncDiscordId);
          setSyncResult(result);
      } catch (error) {
           setSyncResult({ 
             error: 'Failed to invoke Supabase function.',
             details: error instanceof Error ? error.message : String(error)
           });
      } finally {
          setIsTestingSync(false);
      }
  };
  
  const ResultItem: React.FC<{label: string; value: string | null | undefined; good: boolean;}> = ({ label, value, good }) => (
    <div className={`p-3 rounded-md flex justify-between items-center text-sm ${good ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
        <span className="font-semibold text-gray-300">{label}:</span>
        <code className={`font-mono px-2 py-1 rounded ${good ? 'text-green-300' : 'text-red-300'}`}>
            {value || 'NOT SET'}
        </code>
    </div>
  );
  
  if (!hasPermission('_super_admin')) {
      return null;
  }
  const redirectUri = window.location.origin;

  return (
    <>
      <SEO title="System Health Check" noIndex={true} description="System diagnostics for Vixel"/>
      <div className="container mx-auto px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-2 text-center">{t('health_check_title')}</h1>
          <p className="text-center text-gray-400 mb-12">{t('health_check_desc')}</p>
          
          <div className="space-y-8">
            
              {/* Step 0: Outbound HTTP */}
              <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                  <h2 className="text-2xl font-bold text-brand-cyan mb-3">{t('health_check_step0')}</h2>
                  <p className="text-gray-300 mb-4">{t('health_check_step0_desc')}</p>
                  <button onClick={handleHttpTest} disabled={httpTestLoading} className="w-full bg-brand-cyan text-brand-dark font-bold py-3 px-6 rounded-md hover:bg-white transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait">
                      {httpTestLoading ? <Loader2 className="animate-spin" /> : null}
                      <span>{t('health_check_run_http_test')}</span>
                  </button>
                  {httpTestResult && (
                      <div className="mt-4 p-4 rounded-md bg-brand-dark">
                          <h4 className="font-bold text-lg mb-2">{t('health_check_test_result')}</h4>
                          {httpTestResult.error ? (
                                <div className="text-red-400">
                                    <p className="font-bold flex items-center gap-2"><AlertTriangle size={18}/> {httpTestResult.error}</p>
                                    <pre className="text-xs whitespace-pre-wrap mt-2">{httpTestResult.error}</pre>
                                </div>
                          ) : (
                              <div className="text-green-300">
                                  <p className="font-bold flex items-center gap-2"><CheckCircle size={18}/> Success! Received HTTP {httpTestResult.status}</p>
                                  <p className="text-xs text-gray-400 mt-2">This confirms the `http` extension is working and your database can make outbound requests.</p>
                              </div>
                          )}
                      </div>
                  )}
              </div>

              {/* Step 0.5 */}
              <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                  <h2 className="text-2xl font-bold text-brand-cyan mb-3">{t('health_check_step0_5')}</h2>
                  <p className="text-gray-300 mb-4">{t('health_check_step0_5_desc')}</p>
                  {secretsLoading ? <Loader2 className="animate-spin" /> : (
                    <div className="space-y-2">
                      <ResultItem label="DISCORD_BOT_TOKEN" value={secretsResult?.DISCORD_BOT_TOKEN?.value} good={secretsResult?.DISCORD_BOT_TOKEN?.found} />
                    </div>
                  )}
              </div>

              {/* Step 1 */}
              <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                  <h2 className="text-2xl font-bold text-brand-cyan mb-3">{t('health_check_step1')}</h2>
                  <p className="text-gray-300 mb-4">{t('health_check_step1_desc')}</p>
                  <label className="text-sm text-gray-400">{t('health_check_uri_label')}</label>
                  <div className="flex items-center gap-2 mt-1">
                      <input type="text" readOnly value={redirectUri} className="w-full bg-brand-dark p-2 rounded border border-gray-600 font-mono text-sm"/>
                  </div>
                   <p className="text-xs text-gray-500 mt-2">Go to <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline hover:text-brand-cyan">Supabase Dashboard</a> {'>'} Authentication {'>'} URL Configuration to add this.</p>
              </div>

              {/* Step 2 */}
              <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                  <h2 className="text-2xl font-bold text-brand-cyan mb-3">{t('health_check_env_vars')}</h2>
                  <p className="text-gray-300 mb-4">{t('health_check_env_vars_desc')}</p>
                  <div className="space-y-2">
                      <ResultItem label="VITE_SUPABASE_URL" value={env.VITE_SUPABASE_URL} good={!!env.VITE_SUPABASE_URL && env.VITE_SUPABASE_URL !== 'YOUR_SUPABASE_URL'} />
                      <ResultItem label="VITE_SUPABASE_ANON_KEY" value={env.VITE_SUPABASE_ANON_KEY} good={!!env.VITE_SUPABASE_ANON_KEY && env.VITE_SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY'} />
                  </div>
              </div>

              {/* Step 3 */}
               <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                  <h2 className="text-2xl font-bold text-brand-cyan mb-3">{t('health_check_step3')}</h2>
                  <p className="text-gray-300 mb-4">This test verifies that the `DISCORD_BOT_TOKEN` is valid by making a direct request to the Discord API.</p>
                  <button onClick={handleRunBotTest} disabled={isTestingBot} className="w-full bg-brand-cyan text-brand-dark font-bold py-3 px-6 rounded-md hover:bg-white transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait">
                      {isTestingBot ? <Loader2 className="animate-spin" /> : null}
                      <span>{isTestingBot ? t('health_check_test_running') : t('health_check_run_test')}</span>
                  </button>
                  {botHealth && (
                    <div className="mt-4 p-4 rounded-md bg-brand-dark">
                         <h4 className="font-bold text-lg mb-2">{t('health_check_test_result')}</h4>
                         {botHealth.ok ? (
                            <div className="text-green-300 space-y-2">
                                <p className="font-bold flex items-center gap-2"><CheckCircle/> {botHealth.message}</p>
                                <p>Bot User: <code className="text-sm">{botHealth.bot.username} ({botHealth.bot.id})</code></p>
                            </div>
                         ) : (
                            <div className="text-red-400 space-y-2">
                                <p className="font-bold flex items-center gap-2"><XCircle/> {botHealth.message}</p>
                                <p className="text-sm text-red-200 bg-red-500/10 p-2 rounded-md">{botHealth.details}</p>
                            </div>
                         )}
                    </div>
                  )}
              </div>

              {/* Step 4 */}
              <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                  <h2 className="text-2xl font-bold text-brand-cyan mb-3">{t('health_check_step4')}</h2>
                  <p className="text-gray-300 mb-4">Test fetching a specific user's data directly from the Discord API.</p>
                  
                  <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/30 mb-4">
                    <h4 className="font-bold text-blue-300 flex items-center gap-2"><HelpCircle size={18} /> {t('health_check_get_discord_id')}</h4>
                    <p className="text-sm text-blue-200 mt-1">{t('health_check_get_discord_id_steps')}</p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-4">
                      <input 
                        type="text" 
                        value={syncDiscordId}
                        onChange={(e) => setSyncDiscordId(e.target.value)}
                        placeholder={t('health_check_discord_id_input')}
                        className="w-full bg-brand-light-blue p-3 rounded-md border border-gray-600 focus:ring-brand-cyan focus:border-brand-cyan"
                      />
                      <button onClick={handleRunSyncTest} disabled={isTestingSync || !syncDiscordId} className="w-full sm:w-auto bg-brand-cyan text-brand-dark font-bold py-3 px-6 rounded-md hover:bg-white transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait">
                          {isTestingSync ? <Loader2 className="animate-spin" /> : null}
                          <span>{t('health_check_run_sync_test')}</span>
                      </button>
                  </div>
              </div>

              {/* Architecture Overview */}
              <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                  <h2 className="text-2xl font-bold text-brand-cyan mb-3 flex items-center gap-3"><Share2 size={24}/> {t('health_check_arch_title')}</h2>
                  <p className="text-gray-300 mb-6">This illustrates the new bot-less data flow, which prioritizes security and reliability by communicating directly with APIs.</p>
                  
                  <div className="space-y-8">
                      {/* Flow 1: User Sync / Data Fetch */}
                      <div>
                          <h3 className="text-xl font-semibold text-white mb-3">{t('health_check_arch_sync_title')}</h3>
                          <div className="flex items-center justify-center gap-1 md:gap-2 flex-wrap p-4 bg-brand-dark rounded-lg">
                              <div className="flex flex-col items-center text-center p-2"><User size={28} className="text-brand-cyan"/><span className="text-xs mt-1">Website</span></div>
                              <ChevronRight className="text-gray-500 flex-shrink-0" />
                              <div className="flex flex-col items-center text-center p-2"><Server size={28} className="text-brand-cyan"/><span className="text-xs mt-1">Supabase<br/>Function</span></div>
                              <ChevronRight className="text-gray-500 flex-shrink-0" />
                              <div className="flex flex-col items-center text-center p-2"><Bot size={28} className="text-brand-cyan"/><span className="text-xs mt-1">Discord API</span></div>
                          </div>
                          <p className="text-gray-400 mt-3 text-sm">To fetch your data (like roles), the website calls a secure Supabase Function, which uses the bot token to securely request the latest information directly from the Discord API.</p>
                      </div>

                      {/* Flow 2: Notifications */}
                      <div>
                          <h3 className="text-xl font-semibold text-white mb-3">{t('health_check_arch_notify_title')}</h3>
                          <div className="flex items-center justify-center gap-1 md:gap-2 flex-wrap p-4 bg-brand-dark rounded-lg">
                              <div className="flex flex-col items-center text-center p-2"><User size={28} className="text-brand-cyan"/><span className="text-xs mt-1">Action (e.g. submit)</span></div>
                              <ChevronRight className="text-gray-500 flex-shrink-0" />
                              <div className="flex flex-col items-center text-center p-2"><Database size={28} className="text-brand-cyan"/><span className="text-xs mt-1">Supabase DB<br/>(Trigger)</span></div>
                              <ChevronRight className="text-gray-500 flex-shrink-0" />
                              <div className="flex flex-col items-center text-center p-2"><Server size={28} className="text-brand-cyan"/><span className="text-xs mt-1">Proxy<br/>Function</span></div>
                              <ChevronRight className="text-gray-500 flex-shrink-0" />
                              <div className="flex flex-col items-center text-center p-2"><Webhook size={28} className="text-brand-cyan"/><span className="text-xs mt-1">Discord API<br/>(Webhook/DM)</span></div>
                          </div>
                          <p className="text-gray-400 mt-3 text-sm">When data is saved to the database, a "trigger" automatically calls the `discord-proxy` function. This function reads config from the DB (like webhook URLs) and uses the bot token to send the notification to Discord.</p>
                      </div>
                  </div>
              </div>

          </div>
        </div>
      </div>
    </>
  );
};

export default HealthCheckPage;application_type')}</th>
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
// FIX: Add missing default export.
export default ProfilePage;
