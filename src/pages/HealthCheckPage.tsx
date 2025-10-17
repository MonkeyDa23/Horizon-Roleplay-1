import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle, XCircle, AlertTriangle, Info, Copy, Bot } from 'lucide-react';
import { useLocalization } from '../hooks/useLocalization';
import { useConfig } from '../hooks/useConfig';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';
import { testDiscordApi, ApiError } from '../lib/api';
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

const HealthCheckPage: React.FC = () => {
  const { t } = useLocalization();
  const { config, configLoading } = useConfig();
  const { user } = useAuth();
  const [healthData, setHealthData] = useState<HealthCheckData | null>(null);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState<{ message: string; isError: boolean } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  
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
      
      checks.urls.redirect_uri = window.location.origin;
      
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
    if (!healthData || !healthData.urls.redirect_uri) return;
    navigator.clipboard.writeText(healthData.urls.redirect_uri).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRunDiscordTest = async () => {
    if (!user || !supabase) return;
    setIsTesting(true);
    setTestResult(null);
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("No active session found. Please log in again.");

        const resultMessage = await testDiscordApi(session);
        setTestResult({ message: resultMessage, isError: false });
    } catch (error) {
        if (error instanceof ApiError || error instanceof Error) {
            setTestResult({ message: error.message, isError: true });
        } else {
            setTestResult({ message: 'An unknown error occurred.', isError: true });
        }
    } finally {
        setIsTesting(false);
    }
  };

  const StatusIcon: React.FC<{ status: string }> = ({ status }) => {
    if (status.startsWith('✅')) return <CheckCircle className="inline-block mr-2 text-green-400" size={20} />;
    if (status.startsWith('❌')) return <XCircle className="inline-block mr-2 text-red-400" size={20} />;
    if (status.startsWith('⚠️')) return <AlertTriangle className="inline-block mr-2 text-yellow-400" size={20} />;
    return null;
  };
  
  const getStatusTextClass = (status: string) => {
    if (status.startsWith('❌')) return 'text-red-400';
    if (status.startsWith('⚠️')) return 'text-yellow-400';
    return 'text-white';
  };

  const ConfigItem: React.FC<{ label: string; value: string | string[] | undefined | null }> = ({ label, value }) => {
    const displayValue = Array.isArray(value) && value.length > 0 ? value.join(', ') : (value || t('health_check_not_set'));
    const valueClass = value && (!Array.isArray(value) || value.length > 0) ? "text-brand-cyan" : "text-gray-500 italic";
    return (
      <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-brand-dark p-3 rounded-md">
        <span className="font-semibold text-gray-300">{label}</span>
        <code className={`mt-1 sm:mt-0 text-sm break-all ${valueClass}`}>{displayValue}</code>
      </div>
    );
  };

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
              {/* Step 1 */}
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

              {/* Step 2 */}
              <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                  <h2 className="text-2xl font-bold text-brand-cyan mb-3">{t('health_check_step2')}</h2>
                  <p className="text-gray-300 mb-4">{t('health_check_step2_desc')}</p>
                  {configLoading ? <Loader2 className="animate-spin text-brand-cyan" /> : (
                      <div className="space-y-3">
                          <ConfigItem label={t('health_check_guild_id')} value={config.DISCORD_GUILD_ID} />
                          {/* FIX: Removed deprecated SUPER_ADMIN_ROLE_IDS and HANDLER_ROLE_IDS properties. */}
                      </div>
                  )}
              </div>

              {/* Step 3 */}
              <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                  <h2 className="text-2xl font-bold text-brand-cyan mb-3">{t('health_check_step3')}</h2>
                  <p className="text-gray-300 mb-4">{t('health_check_step3_desc')}</p>
                  {user ? (
                      <div className="space-y-4">
                          <button onClick={handleRunDiscordTest} disabled={isTesting} className="w-full bg-brand-cyan text-brand-dark font-bold py-3 px-6 rounded-md hover:bg-white transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait">
                              {isTesting ? <Loader2 className="animate-spin" /> : <Bot />}
                              <span>{isTesting ? t('health_check_test_running') : t('health_check_run_test')}</span>
                          </button>
                          {testResult && (
                              <div className={`p-4 rounded-md border ${testResult.isError ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-green-500/10 border-green-500/30 text-green-300'}`}>
                                  <h4 className="font-bold mb-2 flex items-center gap-2">
                                      {testResult.isError ? <XCircle /> : <CheckCircle />}
                                      {t('health_check_test_result')}
                                  </h4>
                                  <p>{testResult.message}</p>
                              </div>
                          )}
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