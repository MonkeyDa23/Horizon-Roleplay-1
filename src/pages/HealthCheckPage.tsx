// src/pages/HealthCheckPage.tsx
import React, { useState } from 'react';
import { Loader2, CheckCircle, XCircle, AlertTriangle, Info, HelpCircle } from 'lucide-react';
import { useLocalization } from '../hooks/useLocalization';
import { env } from '../env';
import { checkDiscordApiHealth, troubleshootUserSync } from '../lib/api';
import SEO from '../components/SEO';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const HealthCheckPage: React.FC = () => {
  const { t } = useLocalization();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  
  const [botHealth, setBotHealth] = useState<any>(null);
  const [isTestingBot, setIsTestingBot] = useState(false);

  const [syncDiscordId, setSyncDiscordId] = useState('');
  const [syncResult, setSyncResult] = useState<any>(null);
  const [isTestingSync, setIsTestingSync] = useState(false);

  // Security check
  if (!hasPermission('admin_panel')) {
      navigate('/');
      return null;
  }

  const redirectUri = window.location.origin;

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
  
  const BotTestResultCard: React.FC<{ result: any }> = ({ result }) => {
    if (!result) return null;
    if (result.error || result.status !== 'ok') {
        return (
             <div className="mt-4 p-4 rounded-md border bg-red-500/10 border-red-500/30 text-red-300">
                <h4 className="font-bold mb-2 flex items-center gap-2"><XCircle /> {t('health_check_test_result')}</h4>
                <p className="font-semibold">{result.error || result.message}</p>
                {result.details && <p className="text-sm opacity-80 mt-2 font-mono bg-brand-dark p-2 rounded-md break-all">{result.details}</p>}
                <div className="mt-4 p-3 rounded-md bg-yellow-900/40 border border-yellow-500/50 text-left">
                    <p className="font-bold text-yellow-300">Most Likely Problem:</p>
                    <p className="text-yellow-200 text-sm mt-1">This error usually means the website cannot connect to your bot. Check that the bot is running, your firewall is not blocking the port, and your `VITE_DISCORD_BOT_URL` and `VITE_DISCORD_BOT_API_KEY` are correct in both your `.env` file and Supabase secrets.</p>
                </div>
            </div>
        )
    }
    const isMemberIntentWorking = result.details.memberCount > 1;

    return (
        <div className={`mt-4 p-4 rounded-md border ${!isMemberIntentWorking ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
            <h4 className={`font-bold mb-3 flex items-center gap-2 ${!isMemberIntentWorking ? 'text-yellow-300' : 'text-green-300'}`}>
                {!isMemberIntentWorking ? <AlertTriangle /> : <CheckCircle />}
                {t('health_check_test_result')}
            </h4>
            <div className="space-y-2 text-sm">
                <p>Bot Status: <strong className="text-white">{result.status}</strong></p>
                <p>Guild Name: <strong className="text-white">{result.details.guildName}</strong></p>
                <p>Bot sees members: <strong className="text-white">{result.details.memberCount}</strong></p>
            </div>
            {!isMemberIntentWorking && (
                 <div className="mt-4 p-3 rounded-md bg-yellow-900/40 border border-yellow-500/50">
                    <p className="font-bold text-yellow-300">🚨 Potential Problem Found!</p>
                    <p className="text-yellow-200 text-sm mt-1">The connection was successful, but the bot can only see one member (itself). This is a 99% confirmation that the **SERVER MEMBERS INTENT** toggle in the Discord Developer Portal is **disabled**.</p>
                    <p className="text-yellow-200 text-sm mt-2">**Solution:** Go to your bot's page on the Discord Developer Portal, click the 'Bot' tab, enable the 'Server Members Intent' toggle, save, and then RESTART your bot.</p>
                </div>
            )}
        </div>
    )
  }

  const SyncTestResultCard: React.FC<{ result: any }> = ({ result }) => {
      if (!result) return null;
      return (
          <div className="mt-4">
              <h4 className="font-bold mb-2 flex items-center gap-2"><Info /> {t('health_check_sync_test_result')}</h4>
              <div className={`p-4 rounded-md border ${result.error ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
                  <pre className="mt-2 text-xs bg-brand-dark p-2 rounded-md whitespace-pre-wrap max-h-60 overflow-y-auto">{JSON.stringify(result, null, 2)}</pre>
              </div>
              <div className="mt-4 p-4 rounded-md bg-brand-light-blue border border-brand-light-blue/50">
                  <h5 className="font-bold text-brand-cyan mb-2">{t('health_check_result_interpretation')}</h5>
                  <div className="prose prose-sm prose-invert max-w-none" dangerouslySetInnerHTML={{__html: t('health_check_result_success') + t('health_check_result_404') + t('health_check_result_503') + t('health_check_result_other') }} />
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
                      <ResultItem label="Supabase URL" value={env.VITE_SUPABASE_URL} good={!!env.VITE_SUPABASE_URL && env.VITE_SUPABASE_URL !== 'YOUR_SUPABASE_URL'} />
                      <ResultItem label="Supabase Anon Key" value={env.VITE_SUPABASE_ANON_KEY} good={!!env.VITE_SUPABASE_ANON_KEY && env.VITE_SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY'} />
                      <ResultItem label="Bot URL" value={env.VITE_DISCORD_BOT_URL} good={!!env.VITE_DISCORD_BOT_URL && env.VITE_DISCORD_BOT_URL !== 'http://YOUR_BOT_IP_OR_DOMAIN:3000'} />
                      <ResultItem label="Bot API Key" value={env.VITE_DISCORD_BOT_API_KEY} good={!!env.VITE_DISCORD_BOT_API_KEY && env.VITE_DISCORD_BOT_API_KEY !== 'YOUR_CHOSEN_SECRET_PASSWORD_FOR_THE_BOT'} />
                  </div>
              </div>

              {/* Step 3 */}
               <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                  <h2 className="text-2xl font-bold text-brand-cyan mb-3">{t('health_check_step3')}</h2>
                  <p className="text-gray-300 mb-4">{t('health_check_step3_desc')}</p>
                  <button onClick={handleRunBotTest} disabled={isTestingBot} className="w-full bg-brand-cyan text-brand-dark font-bold py-3 px-6 rounded-md hover:bg-white transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait">
                      {isTestingBot ? <Loader2 className="animate-spin" /> : <Info />}
                      <span>{isTestingBot ? t('health_check_test_running') : t('health_check_run_test')}</span>
                  </button>
                  <BotTestResultCard result={botHealth} />
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
                        className="w-full bg-brand-light-blue p-3 rounded border border-gray-600 focus:ring-brand-cyan focus:border-brand-cyan"
                      />
                      <button onClick={handleRunSyncTest} disabled={isTestingSync || !syncDiscordId} className="w-full sm:w-auto bg-brand-cyan text-brand-dark font-bold py-3 px-6 rounded-md hover:bg-white transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait">
                          {isTestingSync ? <Loader2 className="animate-spin" /> : null}
                          <span>{t('health_check_run_sync_test')}</span>
                      </button>
                  </div>
                  <SyncTestResultCard result={syncResult} />
              </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default HealthCheckPage;
