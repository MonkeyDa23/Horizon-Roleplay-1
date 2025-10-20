
import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle, XCircle, AlertTriangle, Info, Copy, Bot, KeyRound, TestTube2 } from 'lucide-react';
import { useLocalization } from '../hooks/useLocalization';
import { useConfig } from '../hooks/useConfig';
import { useAuth } from '../hooks/useAuth';
import { checkBotHealth, ApiError, checkFunctionSecrets, troubleshootUserSync } from '../lib/api';
import SEO from '../components/SEO';

interface SecretsHealth {
    VITE_DISCORD_BOT_URL: { found: boolean; value: string | null };
    VITE_DISCORD_BOT_API_KEY: { found: boolean; value: string | null };
}

const ChannelCheckItem: React.FC<{ channel: any; name: string }> = ({ channel, name }) => {
  const isOk = channel.status.startsWith('✅');
  return (
    <div className={`p-3 rounded-md border text-sm ${isOk ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
      <div className="flex justify-between items-center">
        <span className="font-semibold text-gray-200">{name}</span>
        <span className={`font-bold ${isOk ? 'text-green-400' : 'text-red-400'}`}>{channel.status}</span>
      </div>
      <div className="text-xs mt-1">
        <code className="text-gray-400">{channel.id}</code>
        {channel.name && <span className="text-gray-300 ml-2">(#{channel.name})</span>}
      </div>
      {channel.error && <p className="text-red-300/80 mt-1 text-xs">{channel.error}</p>}
    </div>
  );
};

const HealthCheckPage: React.FC = () => {
  const { t } = useLocalization();
  const { config, configLoading } = useConfig();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const redirectUri = `${window.location.origin}/auth/callback`;

  const [secretsHealth, setSecretsHealth] = useState<SecretsHealth | null>(null);
  const [secretsLoading, setSecretsLoading] = useState(true);
  const [secretsError, setSecretsError] = useState<string | null>(null);

  const [botHealth, setBotHealth] = useState<any>(null);
  const [isTestingBot, setIsTestingBot] = useState(false);

  const [syncTestId, setSyncTestId] = useState('');
  const [syncTestResult, setSyncTestResult] = useState<any>(null);
  const [isTestingSync, setIsTestingSync] = useState(false);
  
  const preflightCheckPassed = secretsHealth && secretsHealth.VITE_DISCORD_BOT_URL.found && secretsHealth.VITE_DISCORD_BOT_API_KEY.found;

  useEffect(() => {
    const runSecretsCheck = async () => {
        setSecretsLoading(true);
        setSecretsError(null);
        try {
            const result = await checkFunctionSecrets();
            setSecretsHealth(result);
        } catch (error) {
            setSecretsError(error instanceof Error ? error.message : "An unknown error occurred.");
            console.error("Secrets check failed:", error);
        } finally {
            setSecretsLoading(false);
        }
    };
    runSecretsCheck();
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(redirectUri).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  
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
      if (!syncTestId) return;
      setIsTestingSync(true);
      setSyncTestResult(null);
      try {
          const result = await troubleshootUserSync(syncTestId);
          setSyncTestResult(result);
      } catch (error) {
          setSyncTestResult({ error: 'Caught a critical error in the API handler.', details: error });
      } finally {
          setIsTestingSync(false);
      }
  }
  
  const ConfigItem: React.FC<{ label: string; value: string | undefined | null }> = ({ label, value }) => {
    const displayValue = value || t('health_check_not_set');
    const valueClass = value ? "text-brand-cyan" : "text-gray-500 italic";
    return (
      <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-brand-dark p-3 rounded-md">
        <span className="font-semibold text-gray-300">{label}</span>
        <code className={`mt-1 sm:mt-0 text-sm break-all ${valueClass}`}>{displayValue}</code>
      </div>
    );
  };
  
  const BotHealthResult = () => {
    if (!botHealth) return null;
    if (!botHealth.ok) {
        const isConnectionRefused = botHealth.details?.includes('Connection refused');
        return (
             <div className="p-4 rounded-md border bg-red-500/10 border-red-500/30 text-red-300">
                <h4 className="font-bold mb-2 flex items-center gap-2"><XCircle /> Test Failed</h4>
                <p className="font-semibold">{botHealth.message}</p>
                {botHealth.details && (
                  <p className="text-sm opacity-80 mt-2 font-mono bg-brand-dark p-2 rounded-md break-all">
                      {botHealth.details}
                  </p>
                )}
                
                {isConnectionRefused && (
                    <div className="mt-4 p-3 rounded-md bg-yellow-900/40 border border-yellow-500/50 text-left">
                        <p className="font-bold text-yellow-300 flex items-center gap-2"><AlertTriangle size={18} /> Tip: "Connection Refused" is a common setup issue!</p>
                        <p className="text-yellow-200 text-sm mt-2">This error means your website's backend successfully reached your bot's server address, but the server **actively rejected** the connection. Here are the most likely causes:</p>
                        <ul className="list-decimal list-inside text-yellow-200 text-sm mt-2 space-y-1 pl-2">
                            <li><strong>The bot application is not running.</strong> Check your hosting provider's logs to see if the bot has crashed or failed to start.</li>
                            <li><strong>A firewall is blocking the port.</strong> Ensure the port your bot is using (e.g., 3001) is open to public traffic in your server's firewall settings.</li>
                            <li><strong>Incorrect Bot URL in Supabase.</strong> Double-check the <code className="bg-yellow-900/80 px-1 rounded">VITE_DISCORD_BOT_URL</code> secret in your Supabase project settings.</li>
                        </ul>
                    </div>
                )}
            </div>
        )
    }
    const { details } = botHealth;
    const isIntentProblem = details.memberCount <= 2;
    const hasIntentFlag = details.intents?.guildMembers === true;

    return (
        <div className={`p-4 rounded-md border ${isIntentProblem ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
            <h4 className={`font-bold mb-3 flex items-center gap-2 ${isIntentProblem ? 'text-yellow-300' : 'text-green-300'}`}>
                {isIntentProblem ? <AlertTriangle /> : <CheckCircle />}
                {t('health_check_test_result')}
            </h4>
            <div className="space-y-2 text-sm">
                <p className="flex justify-between"><span>Guild Name:</span> <strong className="text-white">{details.guildName}</strong></p>
                <p className="flex justify-between"><span>Guild ID:</span> <code className="text-white">{details.guildId}</code></p>
                <p className="flex justify-between"><span>Bot sees members:</span> <strong className="text-white">{details.memberCount}</strong></p>
                <p className="flex justify-between items-center">
                    <span>Server Members Intent:</span> 
                    {hasIntentFlag ? 
                        <span className="font-bold text-green-400 flex items-center gap-1"><CheckCircle size={14}/> Enabled in Bot</span> : 
                        <span className="font-bold text-red-400 flex items-center gap-1"><XCircle size={14}/> Disabled in Bot</span>
                    }
                </p>
            </div>
            
            {!hasIntentFlag && (
                 <div className="mt-4 p-3 rounded-md bg-red-900/40 border border-red-500/50">
                    <p className="font-bold text-red-300">🚨 CRITICAL ERROR!</p>
                    <p className="text-red-200 text-sm mt-1">The bot's code is not requesting the **Server Members Intent**. This is a configuration error in the bot's startup code. Please ensure the bot is initialized with `GatewayIntentBits.GuildMembers`.</p>
                </div>
            )}

            {isIntentProblem && hasIntentFlag && (
                 <div className="mt-4 p-3 rounded-md bg-yellow-900/40 border border-yellow-500/50">
                    <p className="font-bold text-yellow-300">🚨 Most Likely Problem Found!</p>
                    <p className="text-yellow-200 text-sm mt-1">The bot is correctly requesting the Members Intent, but it can only see itself. This means the **Server Members Intent** toggle in the Discord Developer Portal is almost certainly **disabled**.</p>
                    <p className="text-yellow-200 text-sm mt-2">**Solution:** Go to your bot's page in the Discord Developer Portal, go to the "Bot" tab, enable the "Server Members Intent" toggle, save, and **restart your bot application.**</p>
                </div>
            )}
             
            {details.channels && (
                <div className="mt-4 pt-4 border-t border-brand-light-blue/50">
                    <h5 className="font-bold mb-2 text-gray-200">{t('health_check_log_channels')}</h5>
                    <div className="space-y-2">
                        <ChannelCheckItem channel={details.channels.submissions} name={t('health_check_submissions_channel')} />
                        <ChannelCheckItem channel={details.channels.audit} name={t('health_check_audit_channel')} />
                    </div>
                </div>
            )}
        </div>
    )
  }

  const SyncTestResult = () => {
      if (!syncTestResult) return null;

      const getInterpretation = () => {
          if (syncTestResult.status === 200) return <p dangerouslySetInnerHTML={{ __html: t('health_check_result_success')}} />;
          if (syncTestResult.status === 404) return <p dangerouslySetInnerHTML={{ __html: t('health_check_result_404')}} />;
          if (syncTestResult.status === 503) return <p dangerouslySetInnerHTML={{ __html: t('health_check_result_503')}} />;
          return <p dangerouslySetInnerHTML={{ __html: t('health_check_result_other')}} />;
      };

      const resultColor = syncTestResult.status === 200 ? 'border-green-500/30' : 'border-red-500/30';

      return (
          <div className={`mt-4 p-4 rounded-lg border ${resultColor}`}>
              <h4 className="font-bold mb-2 text-gray-200">{t('health_check_sync_test_result')}</h4>
              <pre className="bg-brand-dark p-3 rounded-md text-xs text-white overflow-auto">
                  {JSON.stringify(syncTestResult, null, 2)}
              </pre>
              <div className="mt-4 pt-4 border-t border-brand-light-blue/50">
                  <h5 className="font-bold text-brand-cyan mb-2">{t('health_check_result_interpretation')}</h5>
                  <div className="text-sm text-gray-300 space-y-2 prose">
                      {getInterpretation()}
                  </div>
              </div>
          </div>
      )
  }

  const PreFlightCheck = () => {
      if (secretsLoading) return <div className="flex justify-center p-8"><Loader2 size={32} className="animate-spin text-brand-cyan" /></div>;

      const SecretStatus: React.FC<{ name: string; data: SecretsHealth[keyof SecretsHealth] | undefined }> = ({ name, data }) => {
          return (
              <div className={`p-4 rounded-md border ${data?.found ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                  <div className="flex items-center gap-3">
                      {data?.found ? <CheckCircle className="text-green-400" /> : <XCircle className="text-red-400" />}
                      <code className="text-lg font-semibold text-white">{name}</code>
                  </div>
                  <div className="pl-8 text-sm mt-1">
                      <p className={data?.found ? 'text-green-300' : 'text-red-300'}>
                          Status: <strong>{data?.found ? 'Found' : 'NOT FOUND'}</strong>
                      </p>
                      {data?.value && <p className="text-gray-400">Value: <code className="text-gray-200">{data.value}</code></p>}
                  </div>
              </div>
          )
      };

      if (secretsError || !preflightCheckPassed) {
          return (
              <div className="bg-red-900/50 p-6 rounded-lg border-2 border-red-500/50 shadow-lg">
                  <h2 className="text-2xl font-bold text-red-300 mb-3 flex items-center gap-3"><AlertTriangle /> Pre-flight Check FAILED</h2>
                  <p className="text-red-200 mb-4">The Supabase Functions are missing critical secrets. These must be set for authentication and bot communication to work. This is the most common cause of all errors.</p>
                  
                  <div className="space-y-4 my-6">
                      <SecretStatus name="VITE_DISCORD_BOT_URL" data={secretsHealth?.VITE_DISCORD_BOT_URL} />
                      <SecretStatus name="VITE_DISCORD_BOT_API_KEY" data={secretsHealth?.VITE_DISCORD_BOT_API_KEY} />
                  </div>
                  
                  <h3 className="text-xl font-bold text-yellow-300 mb-2">How to Fix</h3>
                  <ol className="list-decimal list-inside text-yellow-200 space-y-2">
                      <li>Go to your Supabase Project Dashboard.</li>
                      <li>Click the **Settings** icon (gear ⚙️) in the sidebar.</li>
                      <li>Click on **"Edge Functions"**.</li>
                      <li>In the **"Secrets"** section, click **"+ Add a new secret"**.</li>
                      <li>Add the missing secrets from above with their correct values. Make sure the names are an exact match.</li>
                      <li>Wait 1-2 minutes for the secrets to apply, then refresh this page.</li>
                  </ol>
              </div>
          );
      }
      
      return (
           <div className="bg-green-900/50 p-6 rounded-lg border-2 border-green-500/50 shadow-lg">
              <h2 className="text-2xl font-bold text-green-300 mb-2 flex items-center gap-3"><CheckCircle /> Pre-flight Check Passed</h2>
              <p className="text-green-200">Your Supabase Functions have the necessary secrets. You can now proceed with other diagnostic steps.</p>
          </div>
      );
  }

  return (
    <>
      <SEO 
        title="System Health Check"
        description="System health check and diagnostics page for server administrators."
        noIndex={true}
      />
      <div className="container mx-auto px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-2 text-center">{t('health_check_title')}</h1>
          <p className="text-center text-gray-400 mb-12">{t('health_check_desc')}</p>
          
          <div className="space-y-8">
              <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                  <h2 className="text-2xl font-bold text-brand-cyan mb-3 flex items-center gap-3"><KeyRound /> Step 0: Pre-flight Secrets Check</h2>
                  <PreFlightCheck />
              </div>

              <div className={`transition-opacity duration-500 ${!preflightCheckPassed ? 'opacity-30 pointer-events-none' : ''}`}>
                <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                    <h2 className="text-2xl font-bold text-brand-cyan mb-3">{t('health_check_step1')}</h2>
                    <p className="text-gray-300 mb-4">{t('health_check_step1_desc')}</p>
                    <label className="text-gray-400 mb-2 font-semibold block">{t('health_check_uri_label')}</label>
                    <div className="flex items-center gap-4 bg-brand-dark p-3 rounded-md">
                    <code className="text-white text-md md:text-lg flex-grow break-all">{redirectUri}</code>
                    <button onClick={handleCopy} className="bg-brand-cyan text-brand-dark font-bold py-1 px-3 rounded-md hover:bg-white transition-colors flex-shrink-0">
                        {copied ? t('health_check_copied') : t('health_check_copy')}
                    </button>
                    </div>
                </div>
              </div>

              <div className={`transition-opacity duration-500 ${!preflightCheckPassed ? 'opacity-30 pointer-events-none' : ''}`}>
                <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                    <h2 className="text-2xl font-bold text-brand-cyan mb-3">{t('health_check_step2')}</h2>
                    <p className="text-gray-300 mb-4">{t('health_check_step2_desc')}</p>
                    {configLoading ? <Loader2 className="animate-spin text-brand-cyan" /> : (
                        <div className="space-y-3">
                            <ConfigItem label={t('health_check_guild_id')} value={config.DISCORD_GUILD_ID} />
                        </div>
                    )}
                </div>
              </div>

              <div className={`transition-opacity duration-500 ${!preflightCheckPassed ? 'opacity-30 pointer-events-none' : ''}`}>
                <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                    <h2 className="text-2xl font-bold text-brand-cyan mb-3">{t('health_check_step3')}</h2>
                    <p className="text-gray-300 mb-4">{t('health_check_step3_desc')}</p>
                    {user ? (
                        <div className="space-y-4">
                            <button onClick={handleRunBotTest} disabled={isTestingBot || !preflightCheckPassed} className="w-full bg-brand-cyan text-brand-dark font-bold py-3 px-6 rounded-md hover:bg-white transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait">
                                {isTestingBot ? <Loader2 className="animate-spin" /> : <Bot />}
                                <span>{isTestingBot ? t('health_check_test_running') : t('health_check_run_test')}</span>
                            </button>
                            <BotHealthResult />
                        </div>
                    ) : (
                        <div className="text-center bg-brand-light-blue/50 p-4 rounded-md text-yellow-300">
                            {t('health_check_login_to_test')}
                        </div>
                    )}
                </div>
              </div>

              {/* NEW DIAGNOSTIC TOOL */}
              <div className={`transition-opacity duration-500 ${!preflightCheckPassed ? 'opacity-30 pointer-events-none' : ''}`}>
                <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-cyan/50 shadow-lg">
                    <h2 className="text-2xl font-bold text-brand-cyan mb-3 flex items-center gap-3"><TestTube2 /> {t('health_check_step4')}</h2>
                    <p className="text-gray-300 mb-4">{t('health_check_step4_desc')}</p>
                    
                    <div className="bg-brand-dark p-3 rounded-md text-sm mb-4">
                      <p className="font-bold text-brand-cyan mb-1">{t('health_check_get_discord_id')}</p>
                      <p className="text-gray-300">{t('health_check_get_discord_id_steps')}</p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch gap-2">
                        <input 
                            type="text"
                            value={syncTestId}
                            onChange={(e) => setSyncTestId(e.target.value)}
                            placeholder={t('health_check_discord_id_input')}
                            className="flex-grow bg-brand-light-blue p-3 rounded border border-gray-600 focus:ring-brand-cyan focus:border-brand-cyan placeholder-gray-500"
                        />
                        <button onClick={handleRunSyncTest} disabled={isTestingSync || !syncTestId || !preflightCheckPassed} className="bg-brand-cyan text-brand-dark font-bold py-3 px-6 rounded-md hover:bg-white transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait">
                            {isTestingSync ? <Loader2 className="animate-spin" /> : <TestTube2 />}
                            <span>{isTestingSync ? t('health_check_test_running') : t('health_check_run_sync_test')}</span>
                        </button>
                    </div>

                    <SyncTestResult />
                </div>
              </div>

          </div>
        </div>
      </div>
    </>
  );
};

export default HealthCheckPage;
