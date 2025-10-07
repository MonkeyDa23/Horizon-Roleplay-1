import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
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
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { t } = useLocalization();
  
  const redirectUri = data ? data.urls.redirect_uri : 'Loading...';

  const handleCopy = () => {
    if (!data) return;
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
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
      checks.env['SUPABASE_URL'] = supabaseUrl ? '✅ Set' : '❌ Not Set';
      checks.env['SUPABASE_ANON_KEY'] = supabaseAnonKey ? '✅ Set' : '❌ Not Set';
      
      if (!supabaseUrl) {
        setError("Supabase URL is missing from environment variables.");
        setLoading(false);
        setData(checks);
        return;
      }
      
      // 2. Set URLs
      // Extract the project reference from the URL
      const urlParts = supabaseUrl.split('.');
      const projectRef = urlParts[0].split('//')[1];
      checks.urls.redirect_uri = projectRef 
        ? `https://{your-supabase-project-ref}.supabase.co/auth/v1/callback`
        : "Could not determine project ref from URL.";


      // 3. Check Supabase Connection
      try {
        const { error } = await supabase.from('quizzes').select('id').limit(1);
        if (error) throw error;
        checks.supabase.status = '✅ Connected';
        checks.supabase.error = null;
      } catch(e: any) {
        checks.supabase.status = '❌ Failed';
        checks.supabase.error = e.message;
        setError("Supabase connection failed. Check your URL, Anon Key, and RLS policies.");
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
            <code className="text-white text-md md:text-lg flex-grow break-all">{redirectUri.replace('{your-supabase-project-ref}', 'YOUR_PROJECT_REF')}</code>
            <button onClick={handleCopy} disabled={loading} className="bg-brand-cyan text-brand-dark font-bold py-1 px-3 rounded-md hover:bg-white transition-colors flex-shrink-0">
                {copied ? t('health_check_copied') : t('health_check_copy')}
            </button>
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
                {Object.entries(data.env).map(([key, value]) => (
                    <li key={key} className={`flex items-center bg-brand-dark p-3 rounded-md ${getStatusTextClass(value)}`}>
                      <StatusIcon status={value} />
                      <code className="text-gray-300">{key}</code>
                      <span className="ml-auto font-semibold">{value.substring(2)}</span>
                    </li>
                ))}
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

            {error ? (
                 <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-6 rounded-lg">
                    <h2 className="text-xl font-bold mb-2 flex items-center"><XCircle className="mr-2"/> {t('health_check_overall_status')}: {t('health_check_error')}</h2>
                    <p>{t('health_check_error_desc')}</p>
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
