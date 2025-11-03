// src/pages/HealthCheckPage.tsx
import React from 'react';
import { Loader2, CheckCircle, AlertTriangle, User, Server, Bot, ChevronRight, Share2 } from 'lucide-react';
import { useLocalization } from '../hooks/useLocalization';
import { env } from '../env';
import { checkDiscordApiHealth, troubleshootUserSync, checkFunctionSecrets, testNotification } from '../lib/api';
import SEO from '../components/SEO';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../hooks/useToast';

const HealthCheckPage: React.FC = () => {
  const { t } = useLocalization();
  const { hasPermission } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  
  const [secretsResult, setSecretsResult] = React.useState<any>(null);
  const [secretsLoading, setSecretsLoading] = React.useState(true);

  const [botHealth, setBotHealth] = React.useState<any>(null);
  const [isTestingBot, setIsTestingBot] = React.useState(false);

  const [syncDiscordId, setSyncDiscordId] = React.useState('');
  const [syncResult, setSyncResult] = React.useState<any>(null);
  const [isTestingSync, setIsTestingSync] = React.useState(false);
  
  const [testTargetId, setTestTargetId] = React.useState('');
  const [isTestingNotification, setIsTestingNotification] = React.useState(false);

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

  const handleTestNotification = async (isUser: boolean) => {
    if (!testTargetId) return;
    setIsTestingNotification(true);
    try {
        await testNotification(testTargetId, isUser);
        showToast('Test notification sent successfully!', 'success');
    } catch(e) {
        showToast((e as Error).message, 'error');
    } finally {
        setIsTestingNotification(false);
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
  
  if (!hasPermission('admin_panel')) return null;

  return (
    <>
      <SEO title={t('page_title_health_check')} noIndex={true} description={t('health_check_desc')}/>
      <div className="container mx-auto px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-2 text-center">{t('health_check_title')}</h1>
          <p className="text-center text-gray-400 mb-12">{t('health_check_desc')}</p>
          
          <div className="space-y-8">
              {/* Architecture Overview */}
              <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                  <h2 className="text-2xl font-bold text-brand-cyan mb-3 flex items-center gap-3"><Share2 size={24}/> {t('health_check_arch_title')}</h2>
                  <p className="text-gray-300 mb-6">{t('health_check_arch_desc')}</p>
                  <div className="flex items-center justify-center gap-1 md:gap-2 flex-wrap p-4 bg-brand-dark rounded-lg">
                      <div className="flex flex-col items-center text-center p-2"><User size={28} className="text-brand-cyan"/><span className="text-xs mt-1">Website</span></div>
                      <ChevronRight className="text-gray-500 flex-shrink-0" />
                      <div className="flex flex-col items-center text-center p-2"><Server size={28} className="text-brand-cyan"/><span className="text-xs mt-1">Supabase<br/>Function</span></div>
                      <ChevronRight className="text-gray-500 flex-shrink-0" />
                      <div className="flex flex-col items-center text-center p-2"><Bot size={28} className="text-brand-cyan"/><span className="text-xs mt-1">Discord Bot</span></div>
                  </div>
              </div>
            
              {/* Step 1: Frontend Env Vars */}
              <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                  <h2 className="text-2xl font-bold text-brand-cyan mb-3">{t('health_check_step1_title')}</h2>
                  <p className="text-gray-300 mb-4">{t('health_check_step1_desc')}</p>
                  <div className="space-y-2">
                      <ResultItem label="VITE_SUPABASE_URL" value={env.VITE_SUPABASE_URL} good={!!env.VITE_SUPABASE_URL && env.VITE_SUPABASE_URL !== 'YOUR_SUPABASE_URL'} />
                      <ResultItem label="VITE_SUPABASE_ANON_KEY" value={env.VITE_SUPABASE_ANON_KEY} good={!!env.VITE_SUPABASE_ANON_KEY && env.VITE_SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY'} />
                  </div>
              </div>

              {/* Step 2: Supabase Secrets */}
              <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                  <h2 className="text-2xl font-bold text-brand-cyan mb-3">{t('health_check_step2_title')}</h2>
                  <p className="text-gray-300 mb-4">{t('health_check_step2_desc')}</p>
                  {secretsLoading ? <Loader2 className="animate-spin" /> : (
                    <div className="space-y-2">
                      <ResultItem label="VITE_DISCORD_BOT_URL" value={secretsResult?.VITE_DISCORD_BOT_URL?.value} good={secretsResult?.VITE_DISCORD_BOT_URL?.found} />
                      <ResultItem label="VITE_DISCORD_BOT_API_KEY" value={secretsResult?.VITE_DISCORD_BOT_API_KEY?.value} good={secretsResult?.VITE_DISCORD_BOT_API_KEY?.found} />
                    </div>
                  )}
              </div>

              {/* Step 3: Bot Connection */}
               <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                  <h2 className="text-2xl font-bold text-brand-cyan mb-3">{t('health_check_step3_title')}</h2>
                  <p className="text-gray-300 mb-4">{t('health_check_step3_desc')}</p>
                  <button onClick={handleRunBotTest} disabled={isTestingBot} className="w-full bg-brand-cyan text-brand-dark font-bold py-3 px-6 rounded-md hover:bg-white transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait">
                      {isTestingBot ? <Loader2 className="animate-spin" /> : null}
                      <span>{isTestingBot ? t('health_check_test_running') : t('health_check_run_test')}</span>
                  </button>
                  {botHealth && <div className="mt-4 p-4 rounded-md bg-brand-dark">
                      {botHealth.error ? (
                          <div className="text-red-300"><AlertTriangle className="inline-block mr-2"/> {botHealth.error}<pre className="text-xs mt-2 whitespace-pre-wrap">{botHealth.details}</pre></div>
                      ) : (
                          <div className="text-green-300"><CheckCircle className="inline-block mr-2"/> Bot connected successfully! Guild: "{botHealth.details.guildName}"</div>
                      )}
                  </div>}
              </div>

              {/* Step 4: User Sync Test */}
              <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                  <h2 className="text-2xl font-bold text-brand-cyan mb-3">{t('health_check_step4_title')}</h2>
                  <p className="text-gray-300 mb-4">{t('health_check_step4_desc')}</p>
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                      <input type="text" value={syncDiscordId} onChange={(e) => setSyncDiscordId(e.target.value)} placeholder={t('health_check_discord_id_input')} className="w-full bg-brand-light-blue p-3 rounded-md border border-gray-600"/>
                      <button onClick={handleRunSyncTest} disabled={isTestingSync || !syncDiscordId} className="w-full sm:w-auto bg-brand-cyan text-brand-dark font-bold py-3 px-6 rounded-md hover:bg-white transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                          {isTestingSync ? <Loader2 className="animate-spin" /> : <span>{t('health_check_run_sync_test')}</span>}
                      </button>
                  </div>
                   {syncResult && <pre className="mt-4 p-4 rounded-md bg-brand-dark text-xs whitespace-pre-wrap">{JSON.stringify(syncResult, null, 2)}</pre>}
              </div>
              
               {/* Step 5: Notification Test */}
              <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                  <h2 className="text-2xl font-bold text-brand-cyan mb-3">{t('health_check_step5_title')}</h2>
                  <p className="text-gray-300 mb-4">{t('health_check_step5_desc')}</p>
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                      <input type="text" value={testTargetId} onChange={(e) => setTestTargetId(e.target.value)} placeholder="Enter Channel ID or User ID" className="w-full bg-brand-light-blue p-3 rounded-md border border-gray-600"/>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button onClick={() => handleTestNotification(false)} disabled={isTestingNotification || !testTargetId} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-md hover:bg-blue-500 disabled:opacity-60">
                            {isTestingNotification ? <Loader2 className="animate-spin" /> : t('test_channel_button')}
                        </button>
                        <button onClick={() => handleTestNotification(true)} disabled={isTestingNotification || !testTargetId} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-md hover:bg-blue-500 disabled:opacity-60">
                            {isTestingNotification ? <Loader2 className="animate-spin" /> : t('test_dm_button')}
                        </button>
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