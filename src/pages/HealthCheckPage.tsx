import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { useLocalization } from '../hooks/useLocalization';
import { supabase } from '../lib/supabaseClient';

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
  const [data, setData] = useState<HealthCheckData | null>(null);
  const [loading, setLoading] = useState(true);
  const [overallError, setOverallError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { t } = useLocalization();
  
  const redirectUri = data ? data.urls.redirect_uri : 'Loading...';

  const handleCopy = () => {
    if (!data || !data.urls.redirect_uri) return;
    navigator.clipboard.writeText(data.urls.redirect_uri).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };


  useEffect(() => {
    const checkHealth = async () => {
      let checks: HealthCheckData = {
          env: {},
          supabase: { status: '❌ Not Connected', error: 'Test not run' },
          urls: { redirect_uri: '' }
      };

      // 1. Check Env Vars (Client-side)
      const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
      const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;
      checks.env['VITE_SUPABASE_URL'] = supabaseUrl ? '✅ Set' : '❌ Not Set';
      checks.env['VITE_SUPABASE_ANON_KEY'] = supabaseAnonKey ? '✅ Set' : '❌ Not Set';
      
      // 2. Set Redirect URL for Supabase settings. This must be the origin of the app.
      checks.urls.redirect_uri = window.location.origin;
      
      if (!supabase) {
        checks.supabase.status = '⚠️ Disabled';
        checks.supabase.error = 'Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are not set.';
        setData(checks);
        setLoading(false);
        return;
      }

      // 3. Check Supabase Connection
      try {
        const { error } = await supabase.from('config').select('id').limit(1);
        if (error) throw error;
        checks.supabase.status = '✅ Connected';
        checks.supabase.error = null;
      } catch(e) {
        checks.supabase.status = '❌ Failed';
        if (e instanceof Error) {
            checks.supabase.error = e.message;
        } else {
            checks.supabase.error = String(e);
        }
        setOverallError("Supabase connection failed. Check your URL, Anon Key, and ensure RLS policies are correct for the 'config' table.");
      }
      
      setData(checks);
      setLoading(false);
    };

    checkHealth();
  }, []);

  const StatusIcon = ({ status }: { status: string }) => {
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


  return (
    <div className="container mx-auto px-6 py-16">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-2 text-center">{t('health_check_title')}</h1>
        <p className="text-center text-gray-400 mb-8">{t('health_check_desc')}</p>
        
        <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-cyan shadow-glow-cyan-light mb-8">
            <h2 className="text-2xl font-bold text-brand-cyan mb-3">{t('health_check_step1')}</h2>
            <p className="text-gray-300 mb-4">{t('health_check_step1_desc')}</p>
            <label className="text-gray-400 mb-2 font-semibold block">{t('health_check_uri_label')}</label>
            <div className="flex items-center gap-4 bg-brand-dark p-3 rounded-md">
            <code className="text-white text-md md:text-lg flex-grow break-all">{redirectUri}</code>
            <button onClick={handleCopy} disabled={loading || !redirectUri || redirectUri.startsWith('N/A')} className="bg-brand-cyan text-brand-dark font-bold py-1 px-3 rounded-md hover:bg-white transition-colors flex-shrink-0 disabled:opacity-50">
                {copied ? t('health_check_copied') : t('health_check_copy')}
            </button>
            </div>
            <div className="mt-4 bg-yellow-900/50 border border-yellow-500/30 p-3 rounded-md text-yellow-300 text-sm">
                <p><strong>Important:</strong> Copy this URL exactly as shown. Do not add <code>/auth/callback</code> or any other text to the end of it.</p>
            </div>
        </div>

        <h2 className="text-3xl font-bold mb-6 text-center">{t('health_check_step2')}</h2>

        {loading && (
          <div className="flex justify-center items-center py-10">
            <Loader2 size={40} className="animate-spin text-brand-cyan" />
          </div>
        )}

        {data && (
          <div className="space-y-6">
            <div className="bg-brand-dark-blue p-6 rounded-lg border border-brand-light-blue/50">
              <h3 className="text-2xl font-bold text-brand-cyan mb-4">{t('health_check_env_vars')}</h3>
              <p className="text-sm text-gray-400 mb-4">{t('health_check_env_vars_desc')}</p>
              <ul className="space-y-2">
                {Object.entries(data.env).map(([key, value]) => {
                  const statusValue = value as string;
                  return (
                    <li key={key} className={`flex items-center bg-brand-dark p-3 rounded-md ${getStatusTextClass(statusValue)}`}>
                      <StatusIcon status={statusValue} />
                      <code className="text-gray-300">{key}</code>
                      <span className="ml-auto font-semibold">{statusValue.substring(2)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            
            <div className="bg-brand-dark-blue p-6 rounded-lg border border-brand-light-blue/50">
              <h3 className="text-2xl font-bold text-brand-cyan mb-4">{t('health_check_supabase_connection')}</h3>
               <p className="text-sm text-gray-400 mb-4">{t('health_check_supabase_desc')}</p>
               <div className="bg-brand-dark p-4 rounded-md space-y-3">
                 <div className={`flex items-center ${getStatusTextClass(data.supabase.status)}`}>
                    <StatusIcon status={data.supabase.status} />
                    <span className="font-semibold text-gray-300">{t('health_check_db_status')}</span>
                    <span className="ml-2 font-bold">{data.supabase.status.substring(2)}</span>
                 </div>
                 {data.supabase.error && (
                     <div className="bg-red-900/50 border border-red-500/30 p-3 rounded-md mt-2 ml-7">
                        <p className="font-bold text-red-300">Error Details:</p>
                        <p className="text-red-300 mt-1 text-sm">{data.supabase.error}</p>
                     </div>
                 )}
               </div>
            </div>

            {overallError ? (
                 <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-6 rounded-lg">
                    <h2 className="text-xl font-bold mb-2 flex items-center"><XCircle className="mr-2"/> {t('health_check_overall_status')}: {t('health_check_error')}</h2>
                    <p>{t('health_check_error_desc')}</p>
                </div>
            ) : !supabase ? (
                <div className="bg-blue-500/10 border border-blue-500/30 text-blue-300 p-6 rounded-lg">
                    <h2 className="text-xl font-bold mb-2 flex items-center"><Info className="mr-2"/> {t('health_check_overall_status')}: {t('health_check_partial')}</h2>
                    <p>{t('health_check_partial_desc')}</p>
                </div>
            ) : (
                 <div className="bg-green-500/10 border border-green-500/30 text-green-300 p-6 rounded-lg">
                    <h2 className="text-xl font-bold mb-2 flex items-center"><CheckCircle className="mr-2"/> {t('health_check_overall_status')}: {t('health_check_success')}</h2>
                    <p>{t('health_check_success_desc')}</p>
                </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HealthCheckPage;
