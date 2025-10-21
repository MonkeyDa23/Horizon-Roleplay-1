
import React, { useState } from 'react';
import { Loader2, CheckCircle, XCircle, AlertTriangle, Info, HelpCircle } from 'lucide-react';
import { useLocalization } from '../hooks/useLocalization';
import { useAuth } from '../hooks/useAuth';
import { checkBotHealth, troubleshootUserSync, ApiError } from '../lib/api';
import SEO from '../components/SEO';
import { env } from '../env';

const HealthCheckPage: React.FC = () => {
  const { t } = useLocalization();
  const { user } = useAuth();
  
  // Step 1: Env Var Check
  const envVars = {
      VITE_DISCORD_BOT_URL: { value: env.VITE_DISCORD_BOT_URL, ok: !!env.VITE_DISCORD_BOT_URL },
      VITE_DISCORD_BOT_API_KEY: { value: env.VITE_DISCORD_BOT_API_KEY, ok: !!env.VITE_DISCORD_BOT_API_KEY ? `${env.VITE_DISCORD_BOT_API_KEY.substring(0, 4)}...` : null },
  };
  const preflightPassed = Object.values(envVars).every(v => v.ok);

  // Step 2: Bot Health Check
  const [botHealth, setBotHealth] = useState<any>(null);
  const [isTestingBot, setIsTestingBot] = useState(false);

  // Step 3: Manual Sync Test
  const [syncDiscordId, setSyncDiscordId] = useState('');
  const [syncResult, setSyncResult] = useState<{data: any, status: number} | null>(null);
  const [isTestingSync, setIsTestingSync] = useState(false);

  const handleRunBotTest = async () => {
    setIsTestingBot(true);
    setBotHealth(null);
    try {
        const result = await checkBotHealth();
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
              status: 500,
              data: { error: 'Failed to invoke Supabase function.', details: error instanceof Error ? error.message : String(error) }
          });
      } finally {
          setIsTestingSync(false);
      }
  };
  
  const BotTestResultCard: React.FC<{ result: any }> = ({ result }) => {
    if (!result) return null;
    if (!result.ok) {
        const isAuthError = result.details?.includes('401');
        return (
             <div className="mt-4 p-4 rounded-md border bg-red-500/10 border-red-500/30 text-red-300">
                <h4 className="font-bold mb-2 flex items-center gap-2"><XCircle /> {t('health_check_test_result')}</h4>
                <p className="font-semibold">{result.message}</p>
                {result.details && <p className="text-sm opacity-80 mt-2 font-mono bg-brand-dark p-2 rounded-md break-all">{result.details}</p>}
                {isAuthError && (
                    <div className="mt-4 p-3 rounded-md bg-yellow-900/40 border border-yellow-500/50 text-left">
                        <p className="font-bold text-yellow-300">Most Likely Problem:</p>
                        <p className="text-yellow-200 text-sm mt-1">The error "401 Unauthorized" means your `VITE_DISCORD_BOT_API_KEY` is incorrect. Ensure the key in your `.env` file matches the `API_SECRET_KEY` set for your bot.</p>
                    </div>
                )}
            </div>
        )
    }
    const { details } = result;
    const isMemberCountLow = details.memberCount < 2;

    return (
        <div className={`mt-4 p-4 rounded-md border ${isMemberCountLow ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
            <h4 className={`font-bold mb-3 flex items-center gap-2 ${isMemberCountLow ? 'text-yellow-300' : 'text-green-300'}`}>
                {isMemberCountLow ? <AlertTriangle /> : <CheckCircle />}
                {t('health_check_test_result')}
            </h4>
            <div className="space-y-2 text-sm">
                <p>Status: <strong className="text-white">{result.message}</strong></p>
                <p>Guild Name: <strong className="text-white">{details.guildName}</strong></p>
                <p>Bot sees members: <strong className="text-white">{details.memberCount}</strong></p>
            </div>
            {isMemberCountLow && (
                 <div className="mt-4 p-3 rounded-md bg-yellow-900/40 border border-yellow-500/50">
                    <p className="font-bold text-yellow-300">🚨 Potential Problem Found!</p>
                    <p className="text-yellow-200 text-sm mt-1">The bot connected successfully, but it can only see itself. This is a 99% confirmation that the **SERVER MEMBERS INTENT** toggle in the Discord Developer Portal is **disabled**.</p>
                    <p className="text-yellow-200 text-sm mt-2">**Solution:** Read the `README.md` file in the `discord-bot` folder for instructions on how to enable this required intent.</p>
                </div>
            )}
        </div>
    )
  }

  const SyncTestResultCard: React.FC<{ result: {data: any, status: number} }> = ({ result }) => {
      if (!result) return null;
      const { data, status } = result;
      return (
          <div className="mt-4">
              <h4 className="font-bold mb-2 flex items-center gap-2"><Info /> {t('health_check_sync_test_result')}</h4>
              <div className={`p-4 rounded-md border ${status === 200 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                  <p>HTTP Status: <strong className="text-white">{status}</strong></p>
                  <pre className="mt-2 text-xs bg-brand-dark p-2 rounded-md whitespace-pre-wrap max-h-60 overflow-y-auto">{JSON.stringify(data, null, 2)}</pre>
              </div>
              <div className="mt-4 p-4 rounded-md bg-brand-light-blue border border-brand-light-blue/50">
                  <h5 className="font-bold text-brand-cyan mb-2">{t('health_check_result_interpretation')}</h5>
                  <ul className="list-disc list-inside space-y-2 text-sm text-gray-300">
                      <li>{t('health_check_result_success')}</li>
                      <li>{t('health_check_result_404')}</li>
                      <li>{t('health_check_result_503')}</li>
                      <li>{t('health_check_result_other')}</li>
                  </ul>
              </div>
          </div>
      )
  }

  return (
    <>
      <SEO title="System Health Check" noIndex={true} description="System diagnostics for Vixel"/>
      <div className="container mx-auto px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-2 text-center">{t('health_check_title')}</h1>
          <p className="text-center text-gray-400 mb-12">{t('health_check_desc')}</p>
          
          <div className="space-y-8">

              {/* Step 1: Env Vars */}
              <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                  <h2 className="text-2xl font-bold text-brand-cyan mb-3">Step 1: Environment Variables Check</h2>
                  <p className="text-gray-300 mb-4">{t('health_check_env_vars_desc')}</p>
                  <div className="space-y-3">
                      {Object.entries(envVars).map(([key, { value, ok }]) => (
                          <div key={key} className={`flex items-center gap-3 p-3 rounded-md border ${ok ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                              {ok ? <CheckCircle className="text-green-400" /> : <XCircle className="text-red-400" />}
                              <code className="text-lg font-semibold text-white">{key}</code>
                              <span className="text-sm text-gray-400">({ok ? 'Set' : 'Missing'})</span>
                              {value && <code className="text-gray-200 ml-auto bg-brand-dark px-2 py-1 rounded-md">{value}</code>}
                          </div>
                      ))}
                  </div>
              </div>
              
              <div className={`transition-opacity duration-500 ${!preflightPassed ? 'opacity-30 pointer-events-none' : ''}`}>
                  {/* Step 2: Bot Connection Test */}
                   <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                      <h2 className="text-2xl font-bold text-brand-cyan mb-3">Step 2: Discord Bot Status Test</h2>
                      <p className="text-gray-300 mb-4">{t('health_check_step3_desc')}</p>
                      {user ? (
                          <>
                          <button onClick={handleRunBotTest} disabled={isTestingBot} className="w-full bg-brand-cyan text-brand-dark font-bold py-3 px-6 rounded-md hover:bg-white transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait">
                              {isTestingBot ? <Loader2 className="animate-spin" /> : <Info />}
                              <span>{isTestingBot ? t('health_check_test_running') : t('health_check_run_test')}</span>
                          </button>
                          <BotTestResultCard result={botHealth} />
                          </>
                      ) : (
                          <p className="text-center bg-brand-light-blue/50 p-4 rounded-md text-yellow-300">{t('health_check_login_to_test')}</p>
                      )}
                  </div>
              </div>

              <div className={`transition-opacity duration-500 ${!preflightPassed || !botHealth?.ok ? 'opacity-30 pointer-events-none' : ''}`}>
                 {/* Step 3: Manual Sync Test */}
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
                            className="w-full bg-brand-light-blue p-3 rounded border border-gray-600 focus:ring-brand-cyan focus:border-brand-cyan"
                          />
                          <button onClick={handleRunSyncTest} disabled={isTestingSync || !syncDiscordId} className="w-full sm:w-auto bg-brand-cyan text-brand-dark font-bold py-3 px-6 rounded-md hover:bg-white transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait">
                              {isTestingSync ? <Loader2 className="animate-spin" /> : null}
                              <span>{t('health_check_run_sync_test')}</span>
                          </button>
                      </div>
                      {syncResult && <SyncTestResultCard result={syncResult} />}
                  </div>
              </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default HealthCheckPage;
