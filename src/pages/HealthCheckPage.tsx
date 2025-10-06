import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface HealthCheckData {
  env: Record<string, string>;
  bot: {
    status: string;
    guild_found: boolean;
    guild_name: string;
    error: string | null;
  };
  urls: {
    app_url: string;
    redirect_uri: string;
  };
}

const HealthCheckPage: React.FC = () => {
  const [data, setData] = useState<HealthCheckData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const redirectUri = data ? data.urls.redirect_uri : `${window.location.origin}/api/auth/callback`;

  const handleCopy = () => {
    navigator.clipboard.writeText(redirectUri).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };


  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('/api/health');
        const result = await response.json();
        setData(result);
        if(!response.ok) {
            setError("The server reported one or more configuration errors.");
        }
      } catch (e) {
        setError('Failed to connect to the server. Make sure it has been deployed correctly.');
        console.error(e);
      } finally {
        setLoading(false);
      }
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
        <h1 className="text-4xl font-bold mb-8 text-center">Server Health Check</h1>
        
        <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-cyan shadow-glow-cyan-light mb-8">
            <h2 className="text-2xl font-bold text-brand-cyan mb-3">1. Discord OAuth2 Redirect URI</h2>
            <p className="text-gray-300 mb-4">
            For login to work, you must add the correct Redirect URI in the Discord Developer Portal. An incorrect URI is the most common cause of login failure.
            </p>
            <label className="text-gray-400 mb-2 font-semibold block">Your Required Redirect URI:</label>
            <div className="flex items-center gap-4 bg-brand-dark p-3 rounded-md">
            <code className="text-white text-md md:text-lg flex-grow break-all">{redirectUri}</code>
            <button onClick={handleCopy} className="bg-brand-cyan text-brand-dark font-bold py-1 px-3 rounded-md hover:bg-white transition-colors flex-shrink-0">
                {copied ? 'Copied!' : 'Copy'}
            </button>
            </div>
            <p className="text-xs text-gray-400 mt-3">Go to your <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-brand-cyan underline">Discord Applications</a>, select your app, go to "OAuth2", and paste this exact URL into the "Redirects" box, then click "Save Changes".</p>
        </div>

        <h2 className="text-3xl font-bold mb-6 text-center">2. Server Diagnostics</h2>

        {loading && (
          <div className="flex justify-center items-center py-10">
            <Loader2 size={40} className="animate-spin text-brand-cyan" />
            <span className="ml-4 text-xl">Running diagnostics...</span>
          </div>
        )}
        
        {error && !data && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-6 rounded-lg">
                <h2 className="text-xl font-bold mb-2 flex items-center"><AlertTriangle /> <span className="ml-2">Connection Error</span></h2>
                <p>{error}</p>
            </div>
        )}

        {data && (
          <div className="space-y-6">
            <div className="bg-brand-dark-blue p-6 rounded-lg border border-brand-light-blue/50">
                <h3 className="text-2xl font-bold text-brand-cyan mb-4">Backend URL Configuration</h3>
                 <div className="bg-brand-dark p-3 rounded-md">
                    <p className="text-gray-400">Detected Backend URL (APP_URL):</p>
                    <code className="text-white text-lg break-all">{data.urls.app_url}</code>
                </div>
                 {data.urls.app_url.includes('vercel.app') && !process.env.APP_URL && (
                    <div className="bg-yellow-900/50 border border-yellow-500/30 p-3 rounded-md mt-4 text-yellow-300">
                        <p className="font-bold">Warning: URL Mismatch Risk</p>
                        <p className="text-sm">The backend is using an automatic Vercel URL. For your main production site, you **must** set an `APP_URL` environment variable in Vercel to your primary domain (e.g., `https://your-site.com`) to prevent login errors.</p>
                    </div>
                )}
            </div>

            <div className="bg-brand-dark-blue p-6 rounded-lg border border-brand-light-blue/50">
              <h3 className="text-2xl font-bold text-brand-cyan mb-4">Vercel Environment Variables</h3>
              <p className="text-sm text-gray-400 mb-4">Checks if the required secrets are set in your Vercel project settings.</p>
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
              <h3 className="text-2xl font-bold text-brand-cyan mb-4">Discord Bot Connection</h3>
               <p className="text-sm text-gray-400 mb-4">Tests if the server can log in with your bot token and find your guild ID.</p>
              <div className="bg-brand-dark p-4 rounded-md space-y-3">
                 <div className={`flex items-center ${getStatusTextClass(data.bot.status)}`}>
                    <StatusIcon status={data.bot.status} />
                    <span className="font-semibold text-gray-300">Bot Status:</span>
                    <span className="ml-2 font-bold">{data.bot.status.substring(2)}</span>
                 </div>
                  {data.bot.guild_name && (
                     <div className="flex items-center pl-7 text-white">
                        <StatusIcon status={data.bot.guild_found ? '✅' : '❌'} />
                        <span className="font-semibold text-gray-300">Guild Found:</span>
                        <span className="ml-2 font-bold">{data.bot.guild_name}</span>
                     </div>
                  )}
                  {data.bot.error && (
                     <div className="bg-red-900/50 border border-red-500/30 p-3 rounded-md mt-2 ml-7">
                        <p className="font-bold text-red-300">Error Details:</p>
                        <p className="text-red-300 mt-1 text-sm">{data.bot.error}</p>
                     </div>
                  )}
              </div>
            </div>

            {error ? (
                 <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-6 rounded-lg">
                    <h2 className="text-xl font-bold mb-2 flex items-center"><XCircle className="mr-2"/> Overall Status: Configuration Error</h2>
                    <p>One or more checks failed. Please review the errors above and follow the troubleshooting steps. **Login will not work until all checks are green.**</p>
                </div>
            ) : (
                 <div className="bg-green-500/10 border border-green-500/30 text-green-300 p-6 rounded-lg">
                    <h2 className="text-xl font-bold mb-2 flex items-center"><CheckCircle className="mr-2"/> Overall Status: All Systems Operational</h2>
                    <p>The server is configured correctly. If you have completed Step 1 (Redirect URI) and Step 2 (Vercel Environment Variables), the login should now work perfectly.</p>
                </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HealthCheckPage;