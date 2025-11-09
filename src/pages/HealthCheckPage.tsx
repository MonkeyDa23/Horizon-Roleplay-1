// src/pages/HealthCheckPage.tsx
import React, { useState } from 'react';
import { Loader2, CheckCircle, XCircle, AlertTriangle, HelpCircle, Server, Bot, ArrowRight, User } from 'lucide-react';
import { useLocalization } from '../hooks/useLocalization';
import { env } from '../env';
import { checkDiscordApiHealth, lookupUser } from '../lib/api';
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
    React.useEffect(() => {
        if (!hasPermission('_super_admin')) {
            navigate('/');
        }
    }, [hasPermission, navigate]);

    const handleRunBotTest = async () => {
        setIsTestingBot(true);
        setBotHealth(null);
        try {
            const result = await checkDiscordApiHealth();
            setBotHealth({ ok: true, ...result });
        } catch (error) {
            setBotHealth({ ok: false, error: (error as Error).message });
        } finally {
            setIsTestingBot(false);
        }
    };

    const handleRunSyncTest = async () => {
        if (!syncDiscordId) return;
        setIsTestingSync(true);
        setSyncResult(null);
        try {
            const result = await lookupUser(syncDiscordId);
            setSyncResult({ ok: true, data: result });
        } catch (error) {
            setSyncResult({ ok: false, error: (error as Error).message });
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
    
    if (!hasPermission('_super_admin')) return null;

    return (
        <>
            <SEO title="System Health Check" noIndex={true} description="System diagnostics for Vixel"/>
            <div className="container mx-auto px-6 py-16">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-4xl font-bold mb-2 text-center">{t('health_check_title')}</h1>
                    <p className="text-center text-gray-400 mb-12">{t('health_check_desc')}</p>
                    
                    <div className="space-y-8">
                        <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                            <h2 className="text-2xl font-bold text-brand-cyan mb-3">Step 1: Frontend Environment</h2>
                            <p className="text-gray-300 mb-4">Checks if the frontend has the necessary variables from your `.env` file to connect to Supabase and the bot.</p>
                            <div className="space-y-2">
                                <ResultItem label="VITE_SUPABASE_URL" value={env.VITE_SUPABASE_URL} good={!!env.VITE_SUPABASE_URL && env.VITE_SUPABASE_URL !== 'YOUR_SUPABASE_URL'} />
                                <ResultItem label="VITE_SUPABASE_ANON_KEY" value={env.VITE_SUPABASE_ANON_KEY} good={!!env.VITE_SUPABASE_ANON_KEY && env.VITE_SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY'} />
                                <ResultItem label="VITE_DISCORD_BOT_URL" value={env.VITE_DISCORD_BOT_URL} good={!!env.VITE_DISCORD_BOT_URL} />
                                <ResultItem label="VITE_DISCORD_BOT_API_KEY" value={env.VITE_DISCORD_BOT_API_KEY} good={!!env.VITE_DISCORD_BOT_API_KEY && env.VITE_DISCORD_BOT_API_KEY !== 'YOUR_SECRET_API_KEY'} />
                            </div>
                        </div>

                        <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                            <h2 className="text-2xl font-bold text-brand-cyan mb-3">Step 2: Bot API Connection</h2>
                            <p className="text-gray-300 mb-4">Tests if the frontend can successfully connect to your running bot's API using the URL and API key.</p>
                            <button onClick={handleRunBotTest} disabled={isTestingBot} className="w-full bg-brand-cyan text-brand-dark font-bold py-3 px-6 rounded-md hover:bg-white transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait">
                                {isTestingBot ? <Loader2 className="animate-spin" /> : null}
                                <span>{isTestingBot ? t('health_check_test_running') : t('health_check_run_test')}</span>
                            </button>
                            {botHealth && (
                                <div className="mt-4 p-4 rounded-md bg-brand-dark">
                                    <h4 className="font-bold text-lg mb-2">{t('health_check_test_result')}</h4>
                                    {botHealth.ok ? (
                                        <div className="text-green-300 space-y-2">
                                            <p className="font-bold flex items-center gap-2"><CheckCircle/> Connection Successful!</p>
                                            <p>The bot reported its status as: <code className="font-mono bg-green-900/50 px-1 rounded">{botHealth.status}</code>, logged in as <code className="font-mono bg-green-900/50 px-1 rounded">{botHealth.botUser}</code>.</p>
                                        </div>
                                    ) : (
                                        <div className="text-red-400 space-y-2">
                                            <p className="font-bold flex items-center gap-2"><XCircle/> Connection Failed</p>
                                            <p className="text-sm text-red-200 bg-red-500/10 p-2 rounded-md">{botHealth.error}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                            <h2 className="text-2xl font-bold text-brand-cyan mb-3">Step 3: User Sync Test</h2>
                            <p className="text-gray-300 mb-4">Tests if the bot can fetch a specific user's data from Discord. This requires the **Server Members Intent** to be enabled for your bot.</p>
                            
                            <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/30 mb-4">
                                <h4 className="font-bold text-blue-300 flex items-center gap-2"><HelpCircle size={18} /> {t('health_check_get_discord_id')}</h4>
                                <p className="text-sm text-blue-200 mt-1">{t('health_check_get_discord_id_steps')}</p>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-4">
                                <input type="text" value={syncDiscordId} onChange={(e) => setSyncDiscordId(e.currentTarget.value)} placeholder={t('health_check_discord_id_input')} className="w-full bg-brand-light-blue p-3 rounded-md border border-gray-600 focus:ring-brand-cyan focus:border-brand-cyan"/>
                                <button onClick={handleRunSyncTest} disabled={isTestingSync || !syncDiscordId} className="w-full sm:w-auto bg-brand-cyan text-brand-dark font-bold py-3 px-6 rounded-md hover:bg-white transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait">
                                    {isTestingSync ? <Loader2 className="animate-spin" /> : null}
                                    <span>{t('health_check_run_sync_test')}</span>
                                </button>
                            </div>
                            {syncResult && <pre className={`mt-4 bg-brand-dark p-4 rounded-md text-sm whitespace-pre-wrap ${syncResult.ok ? 'text-green-300' : 'text-red-300'}`}>{JSON.stringify(syncResult, null, 2)}</pre>}
                        </div>

                         <div className="bg-brand-dark-blue p-6 rounded-lg border-2 border-brand-light-blue shadow-lg">
                            <h2 className="text-2xl font-bold text-brand-cyan mb-3">System Flow</h2>
                            <p className="text-gray-300 mb-6">This illustrates how data flows from the user, through the website, to the bot, and to Discord.</p>
                            <div className="flex items-center justify-center gap-1 md:gap-2 flex-wrap p-4 bg-brand-dark rounded-lg text-center">
                                <div className="flex flex-col items-center p-2"><User size={28} /><span className="text-xs mt-1">User</span></div>
                                <ArrowRight className="text-gray-500" />
                                <div className="flex flex-col items-center p-2"><Server size={28} /><span className="text-xs mt-1">Website<br/>(React)</span></div>
                                <ArrowRight className="text-gray-500" />
                                <div className="flex flex-col items-center p-2"><Bot size={28} /><span className="text-xs mt-1">Your Bot<br/>(Node.js)</span></div>
                                <ArrowRight className="text-gray-500" />
                                <div className="flex flex-col items-center p-2"><svg className="w-7 h-7" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Discord</title><path fill="currentColor" d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4464.8257-.698 1.3328a18.384 18.384 0 00-8.6248 0 15.3423 15.3423 0 00-.6979-1.3328.0741.0741 0 00-.0785-.0371A19.7913 19.7913 0 003.683 4.3698a.0741.0741 0 00-.0371.1075 19.9456 19.9456 0 00-1.6368 7.5561.0741.0741 0 00.043.0842 21.054 21.054 0 005.1883 2.532.0741.0741 0 00.0882-.0276 16.592 16.592 0 00.9592-2.1558.0741.0741 0 00-.0276-.0882 17.0182 17.0182 0 01-2.4795-1.1292.0741.0741 0 01-.0148-.1011 16.3233 16.3233 0 01.2384-2.2643.0741.0741 0 01.0829-.0494 1.7431 1.7431 0 01.1011.0288 17.4363 17.4363 0 004.9123 1.6368.0741.0741 0 00.0882-.0057 18.4913 18.4913 0 008.6191 0 .0741.0741 0 00.0882.0057 17.3986 17.3986 0 004.918-.1.0741.0741 0 01.0785.0494 16.5413 16.5413 0 01.2384 2.2643.0741.0741 0 01-.0148.1011 17.032 17.032 0 01-2.4795 1.1292.0741.0741 0 00-.0276.0882 16.4571 16.4571 0 00.9592 2.1558.0741.0741 0 00.0882.0276 21.054 21.054 0 005.1883-2.532.0741.0741 0 00.043-.0842 19.9456 19.9456 0 00-1.6368-7.5561.0741.0741 0 00-.0371-.1075zM8.02 15.3312c-1.7259 0-3.1212-1.6368-3.1212-3.6484s1.3953-3.6484 3.1212-3.6484c1.7259 0 3.1212 1.6368 3.1212 3.6484s-1.3953 3.6484-3.1212 3.6484zm7.95-3.6484c0-2.0116 1.3953-3.6484 3.1212-3.6484 1.7259 0 3.1212 1.6368 3.1212 3.6484s-1.3953 3.6484-3.1212 3.6484c-1.7259 0-3.1212-1.6368-3.1212-3.6484z"/></svg><span className="text-xs mt-1">Discord<br/>API</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default HealthCheckPage;
