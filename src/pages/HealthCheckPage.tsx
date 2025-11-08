


// src/pages/HealthCheckPage.tsx
import React from 'react';
import { Loader2, CheckCircle, XCircle, AlertTriangle, HelpCircle, Share2, User, Server, Database, Bot, ChevronRight } from 'lucide-react';
import { useLocalization } from '../hooks/useLocalization';
import { env } from '../env';
import { checkDiscordApiHealth, troubleshootUserSync, testHttpRequest } from '../lib/api';
import SEO from '../components/SEO';
import { useAuth } from '../hooks/useAuth';
import * as ReactRouterDOM from 'react-router-dom';

// This component is now only accessible to Super Admins and is used for diagnostics.
const HealthCheckPage: React.FC = () => {
  const { t } = useLocalization();
  const { hasPermission } = useAuth();
  const navigate = ReactRouterDOM.useNavigate();
  
  const [httpTestResult, setHttpTestResult] = React.useState<any>(null);
  const [httpTestLoading, setHttpTestLoading] = React.useState(false);

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
            message: 'Failed to connect to Bot Function.',
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
             error: 'Failed to fetch user from sync function.',
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
  // FIX: Guard against window access in non-browser environments.
  // FIX: Cast window to any to bypass potential tsconfig lib errors for 'location'.
  const redirectUri = typeof window !== 'undefined' ? (window as any).location.origin : '';

  return (
    <>
      <SEO title="System Health Check" noIndex={true} description="System diagnostics for Vixel"/>
      <div className="container mx-auto px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-2 text-center">{t('health_check_title')}</h1>
          <p className="text-center text-gray-400 mb-12">{t('health_check_desc')}</p>
          
          <div className="space-y-8">
            
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
                                </div>
                          ) : (
                              <div className="text-green-300">
                                  <p className="font-bold flex items-center gap-2"><CheckCircle size={18}/> Success! Received HTTP {httpTestResult.status}</p>
                              </div>
                          )}
                      </div>
                  )}
              </div>

              <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                  <h2 className="text-2xl font-bold text-brand-cyan mb-3">{t('health_check_step1')}</h2>
                  <p className="text-gray-300 mb-4">{t('health_check_step1_desc')}</p>
                  <label className="text-sm text-gray-400">{t('health_check_uri_label')}</label>
                  <div className="flex items-center gap-2 mt-1">
                      <input type="text" readOnly value={redirectUri} className="w-full bg-brand-dark p-2 rounded border border-gray-600 font-mono text-sm"/>
                  </div>
                   <p className="text-xs text-gray-500 mt-2">Go to <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline hover:text-brand-cyan">Supabase Dashboard</a> {'>'} Authentication {'>'} URL Configuration to add this.</p>
              </div>

              <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                  <h2 className="text-2xl font-bold text-brand-cyan mb-3">{t('health_check_env_vars')}</h2>
                  <p className="text-gray-300 mb-4">{t('health_check_env_vars_desc')}</p>
                  <div className="space-y-2">
                      <ResultItem label="VITE_SUPABASE_URL" value={env.VITE_SUPABASE_URL} good={!!env.VITE_SUPABASE_URL && env.VITE_SUPABASE_URL !== 'YOUR_SUPABASE_URL'} />
                      <ResultItem label="VITE_SUPABASE_ANON_KEY" value={env.VITE_SUPABASE_ANON_KEY} good={!!env.VITE_SUPABASE_ANON_KEY && env.VITE_SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY'} />
                  </div>
              </div>

               <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                  <h2 className="text-2xl font-bold text-brand-cyan mb-3">{t('health_check_step3')}</h2>
                  <p className="text-gray-300 mb-4">This test checks if the Supabase Function can successfully reach the Discord API using your stored Bot Token secret.</p>
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

              <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                  <h2 className="text-2xl font-bold text-brand-cyan mb-3">{t('health_check_step4')}</h2>
                  <p className="text-gray-300 mb-4">Test fetching a specific user's data from Discord via the Supabase Function.</p>
                  
                  <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/30 mb-4">
                    <h4 className="font-bold text-blue-300 flex items-center gap-2"><HelpCircle size={18} /> {t('health_check_get_discord_id')}</h4>
                    <p className="text-sm text-blue-200 mt-1">{t('health_check_get_discord_id_steps')}</p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-4">
                      <input 
                        type="text" 
                        value={syncDiscordId}
                        // FIX: Explicitly cast e.currentTarget to HTMLInputElement to resolve type error.
                        onChange={(e) => setSyncDiscordId((e.currentTarget as HTMLInputElement).value)}
                        placeholder={t('health_check_discord_id_input')}
                        className="w-full bg-brand-light-blue p-3 rounded-md border border-gray-600 focus:ring-brand-cyan focus:border-brand-cyan"
                      />
                      <button onClick={handleRunSyncTest} disabled={isTestingSync || !syncDiscordId} className="w-full sm:w-auto bg-brand-cyan text-brand-dark font-bold py-3 px-6 rounded-md hover:bg-white transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait">
                          {isTestingSync ? <Loader2 className="animate-spin" /> : null}
                          <span>{t('health_check_run_sync_test')}</span>
                      </button>
                  </div>
                  {syncResult && <pre className="mt-4 bg-brand-dark p-4 rounded-md text-sm whitespace-pre-wrap">{JSON.stringify(syncResult, null, 2)}</pre>}
              </div>

              <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                  <h2 className="text-2xl font-bold text-brand-cyan mb-3 flex items-center gap-3"><Share2 size={24}/> {t('health_check_arch_title')}</h2>
                  <p className="text-gray-300 mb-6">{t('health_check_arch_desc')}</p>
                  
                  <div className="space-y-8">
                      <div>
                          <h3 className="text-xl font-semibold text-white mb-3">{t('health_check_arch_sync_title')}</h3>
                          <div className="flex items-center justify-center gap-1 md:gap-2 flex-wrap p-4 bg-brand-dark rounded-lg">
                              <div className="flex flex-col items-center text-center p-2"><User size={28} className="text-brand-cyan"/><span className="text-xs mt-1">Website</span></div>
                              <ChevronRight className="text-gray-500 flex-shrink-0" />
                              <div className="flex flex-col items-center text-center p-2"><Server size={28} className="text-brand-cyan"/><span className="text-xs mt-1">Supabase<br/>Function</span></div>
                              <ChevronRight className="text-gray-500 flex-shrink-0" />
                              <div className="flex flex-col items-center text-center p-2"><Bot size={28} className="text-brand-cyan"/><span className="text-xs mt-1">Discord API</span></div>
                          </div>
                          <p className="text-gray-400 mt-3 text-sm">{t('health_check_arch_sync_desc')}</p>
                      </div>

                      <div>
                          <h3 className="text-xl font-semibold text-white mb-3">{t('health_check_arch_notify_title')}</h3>
                          <div className="flex items-center justify-center gap-1 md:gap-2 flex-wrap p-4 bg-brand-dark rounded-lg">
                              <div className="flex flex-col items-center text-center p-2"><Database size={28} className="text-brand-cyan"/><span className="text-xs mt-1">DB Change<br/>(RPC Call)</span></div>
                              <ChevronRight className="text-gray-500 flex-shrink-0" />
                              <div className="flex flex-col items-center text-center p-2"><Server size={28} className="text-brand-cyan"/><span className="text-xs mt-1">Supabase<br/>Function</span></div>
                              <ChevronRight className="text-gray-500 flex-shrink-0" />
                              <div className="flex flex-col items-center text-center p-2"><Bot size={28} className="text-brand-cyan"/><span className="text-xs mt-1">Discord API</span></div>
                          </div>
                          <p className="text-gray-400 mt-3 text-sm">When you perform an action, the database function handling it also invokes a Supabase function to send the notification.</p>
                      </div>
                  </div>
              </div>

          </div>
        </div>
      </div>
    </>
  );
};

export default HealthCheckPage;