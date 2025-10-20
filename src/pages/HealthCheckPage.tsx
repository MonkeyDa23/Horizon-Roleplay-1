import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle, XCircle, AlertTriangle, Info, Copy, Bot } from 'lucide-react';
import { useLocalization } from '../hooks/useLocalization';
import { useConfig } from '../hooks/useConfig';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';
import { checkBotHealth, ApiError } from '../lib/api';
import SEO from '../components/SEO';

interface HealthCheckData {
  env: Record<string, string>;
  supabase: {
    status: string;
    error: string | null;
  };
  urls: {
    redirect_uri: string;
  };
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
  const [healthData, setHealthData] = useState<HealthCheckData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  
  const [botHealth, setBotHealth] = useState<any>(null);
  const [isTestingBot, setIsTestingBot] = useState(false);

  const redirectUri = healthData ? healthData.urls.redirect_uri : 'Loading...';

  useEffect(() => {
    const checkHealth = async () => {
      let checks: HealthCheckData = {
          env: {},
          supabase: { status: '❌ Not Connected', error: 'Test not run' },
          urls: { redirect_uri: '' }
      };

      const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
      const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;
      checks.env['VITE_SUPABASE_URL'] = supabaseUrl ? '✅ Set' : '❌ Not Set';
      checks.env['VITE_SUPABASE_ANON_KEY'] = supabaseAnonKey ? '✅ Set' : '❌ Not Set';
      
      checks.urls.redirect_uri = `${window.location.origin}/auth/callback`;
      
      if (!supabase) {
        checks.supabase.status = '⚠️ Disabled';
        checks.supabase.error = 'Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are not set.';
        setHealthData(checks);
        setLoading(false);
        return;
      }

      try {
        const { error } = await supabase.from('config').select('id').limit(1);
        if (error) throw error;
        checks.supabase.status = '✅ Connected';
        checks.supabase.error = null;
      } catch(e) {
        checks.supabase.status = '❌ Failed';
        checks.supabase.error = e instanceof Error ? e.message : String(e);
      }
      
      setHealthData(checks);
      setLoading(false);
    };

    checkHealth();
  }, []);

  const handleCopy = () => {
    if (!redirectUri) return;
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

  const StatusIcon: React.FC<{ status: string }> = ({ status }) => {
    if (status.startsWith('✅')) return <CheckCircle className="inline-block mr-2 text-green-400" size={20} />;
    if (status.startsWith('❌')) return <XCircle className="inline-block mr-2 text-red-400" size={20} />;
    if (status.startsWith('⚠️')) return <AlertTriangle className="inline-block mr-2 text-yellow-400" size={20} />;
    return null;
  };

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
        return (
             <div className="p-4 rounded-md border bg-red-500/10 border-red-500/30 text-red-300">
                <h4 className="font-bold mb-2 flex items-center gap-2"><XCircle /> Test Failed</h4>
                <p className="font-semibold">{botHealth.message}</p>
                <p className="text-sm opacity-80 mt-1">{botHealth.details}</p>
            </div>
        )
    }
    const { details } = botHealth;
    const isIntentProblem = details.memberCount <= 2;

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
            </div>
            {isIntentProblem && (
                 <div className="mt-4 p-3 rounded-md bg-yellow-900/40 border border-yellow-500/50">
                    <p className="font-bold text-yellow-300">🚨 Likely Problem Found!</p>
                    <p className="text-yellow-200 text-sm mt-1">The bot can only see itself (and maybe one other member). This is a classic sign that the **Server Members Intent** is disabled for your bot in the Discord Developer Portal. Please enable it and restart the bot.</p>
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
                  <h2 className="text-2xl font-bold text-brand-cyan mb-3">{t('health_check_step1')}</h2>
                  <p className="text-gray-300 mb-4">{t('health_check_step1_desc')}</p>
                  <label className="text-gray-400 mb-2 font-semibold block">{t('health_check_uri_label')}</label>
                  <div className="flex items-center gap-4 bg-brand-dark p-3 rounded-md">
                  <code className="text-white text-md md:text-lg flex-grow break-all">{redirectUri}</code>
                  <button onClick={handleCopy} disabled={loading || !redirectUri} className="bg-brand-cyan text-brand-dark font-bold py-1 px-3 rounded-md hover:bg-white transition-colors flex-shrink-0 disabled:opacity-50">
                      {copied ? t('health_check_copied') : t('health_check_copy')}
                  </button>
                  </div>
              </div>

              <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                  <h2 className="text-2xl font-bold text-brand-cyan mb-3">{t('health_check_step2')}</h2>
                  <p className="text-gray-300 mb-4">{t('health_check_step2_desc')}</p>
                  {configLoading ? <Loader2 className="animate-spin text-brand-cyan" /> : (
                      <div className="space-y-3">
                          <ConfigItem label={t('health_check_guild_id')} value={config.DISCORD_GUILD_ID} />
                      </div>
                  )}
              </div>

              <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                  <h2 className="text-2xl font-bold text-brand-cyan mb-3">{t('health_check_step3')}</h2>
                  <p className="text-gray-300 mb-4">{t('health_check_step3_desc')}</p>
                  {user ? (
                      <div className="space-y-4">
                          <button onClick={handleRunBotTest} disabled={isTestingBot} className="w-full bg-brand-cyan text-brand-dark font-bold py-3 px-6 rounded-md hover:bg-white transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait">
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
        </div>
      </div>
    </>
  );
};

export default HealthCheckPage;