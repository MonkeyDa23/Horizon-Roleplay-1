// src/pages/HealthCheckPage.tsx
import React from 'react';
import { Loader2, CheckCircle, XCircle, AlertTriangle, HelpCircle } from 'lucide-react';
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
    if (!hasPermission('admin_panel')) {
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
        const errorMessage = (e as Error).message;
        if (errorMessage.includes('http_status_reason')) {
             setHttpTestResult({ 
                error: "Your database schema is outdated!",
                details: "The function 'test_http_request' in your database is causing this error. To fix this, you must update your database schema.\n\n1. Go to your Supabase Project -> SQL Editor.\n2. Copy the entire content of the file `src/lib/database_schema.ts`.\n3. Paste it into a new query and click RUN."
            });
        } else {
            setHttpTestResult({ error: errorMessage });
        }
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
  
  if (!hasPermission('admin_panel')) {
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
                                    {httpTestResult.details ? (
                                        <pre className="mt-2 text-sm whitespace-pre-wrap font-sans text-red-200 bg-red-500/10 p-3 rounded-md">{httpTestResult.details}</pre>
                                    ) : (
                                        <pre className="text-xs whitespace-pre-wrap mt-2">{httpTestResult.error}</pre>
                                    )}
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
                      <ResultItem label="VITE_DISCORD_BOT_URL" value={secretsResult?.VITE_DISCORD_BOT_URL?.value} good={secretsResult?.VITE_DISCORD_BOT_URL?.found} />
                      <ResultItem label="VITE_DISCORD_BOT_API_KEY" value={secretsResult?.VITE_DISCORD_BOT_API_KEY?.value} good={secretsResult?.VITE_DISCORD_BOT_API_KEY?.found} />
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
                      <ResultItem label="VITE_DISCORD_BOT_URL" value={env.VITE_DISCORD_BOT_URL} good={!!env.VITE_DISCORD_BOT_URL && env.VITE_DISCORD_BOT_URL !== 'http://YOUR_BOT_IP_OR_DOMAIN:3000'} />
                      <ResultItem label="VITE_DISCORD_BOT_API_KEY" value={env.VITE_DISCORD_BOT_API_KEY} good={!!env.VITE_DISCORD_BOT_API_KEY && env.VITE_DISCORD_BOT_API_KEY !== 'YOUR_CHOSEN_SECRET_PASSWORD_FOR_THE_BOT'} />
                  </div>
              </div>

              {/* Step 3 */}
               <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                  <h2 className="text-2xl font-bold text-brand-cyan mb-3">{t('health_check_step3')}</h2>
                  <p className="text-gray-300 mb-4">{t('health_check_step3_desc')}</p>
                  <button onClick={handleRunBotTest} disabled={isTestingBot} className="w-full bg-brand-cyan text-brand-dark font-bold py-3 px-6 rounded-md hover:bg-white transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait">
                      {isTestingBot ? <Loader2 className="animate-spin" /> : null}
                      <span>{isTestingBot ? t('health_check_test_running') : t('health_check_run_test')}</span>
                  </button>
              </div>

              {/* Step 4 */}
              <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                  <h2 className="text-2xl font-bold text-brand-cyan mb-3">{t('health_check_step4')}</h2>
                  <p className="text-gray-300 mb-4">{t('health_check_step4_desc')}</p>
                  
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
          </div>
        </div>
      </div>
    </>
  );
};

export default HealthCheckPage;