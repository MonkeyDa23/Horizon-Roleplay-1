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
}

const HealthCheckPage: React.FC = () => {
  const [data, setData] = useState<HealthCheckData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    return null;
  };

  return (
    <div className="container mx-auto px-6 py-16">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-2 text-center">Server Health Check</h1>
        <p className="text-gray-400 mb-8 text-center">
          This page checks the server's connection to Discord and its configuration.
        </p>
        
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
              <h2 className="text-2xl font-bold text-brand-cyan mb-4">Environment Variables</h2>
              <p className="text-sm text-gray-400 mb-4">Checks if the required secrets are set in your Vercel project settings.</p>
              <ul className="space-y-2">
                {Object.entries(data.env).map(([key, value]) => (
                  <li key={key} className="flex items-center bg-brand-dark p-3 rounded-md">
                    <StatusIcon status={value} />
                    <code className="text-gray-300">{key}</code>
                    <span className="ml-auto font-semibold">{value.split(' ')[1]}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-brand-dark-blue p-6 rounded-lg border border-brand-light-blue/50">
              <h2 className="text-2xl font-bold text-brand-cyan mb-4">Discord Bot Connection</h2>
               <p className="text-sm text-gray-400 mb-4">Tests if the server can log in with your bot token and find your guild ID.</p>
              <div className="bg-brand-dark p-4 rounded-md space-y-3">
                 <div className="flex items-center">
                    <StatusIcon status={data.bot.status} />
                    <span className="font-semibold text-gray-300">Bot Status:</span>
                    <span className="ml-2">{data.bot.status}</span>
                 </div>
                  {data.bot.guild_name !== 'N/A' && (
                     <div className="flex items-center pl-7">
                        <span className="font-semibold text-gray-300">Found Guild:</span>
                        <span className="ml-2 text-white font-bold">{data.bot.guild_name}</span>
                     </div>
                  )}
                  {data.bot.error && (
                     <div className="bg-red-900/50 p-3 rounded-md mt-2 ml-7">
                        <p className="font-bold text-red-300">Error Details:</p>
                        <p className="text-red-300 mt-1">{data.bot.error}</p>
                     </div>
                  )}
              </div>
            </div>

            {error ? (
                 <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-6 rounded-lg">
                    <h2 className="text-xl font-bold mb-2 flex items-center"><XCircle className="mr-2"/> Overall Status: Configuration Error</h2>
                    <p>One or more checks failed. Please review the errors above and follow the troubleshooting steps to resolve the issue. The login will not work until all checks pass.</p>
                </div>
            ) : (
                 <div className="bg-green-500/10 border border-green-500/30 text-green-300 p-6 rounded-lg">
                    <h2 className="text-xl font-bold mb-2 flex items-center"><CheckCircle className="mr-2"/> Overall Status: All Systems Operational</h2>
                    <p>The server is configured correctly and connected to Discord. If login is still failing, the final step is to double-check your Discord Developer Portal settings for the correct **Redirect URI**.</p>
                </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HealthCheckPage;
