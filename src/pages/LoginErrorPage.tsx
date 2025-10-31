// src/pages/LoginErrorPage.tsx
import React from 'react';
import { AlertTriangle, RefreshCw, LogOut } from 'lucide-react';
import { ApiError } from '../lib/api';

interface LoginErrorPageProps {
  error: Error;
  onRetry: () => void;
  onLogout: () => void;
}

const LoginErrorPage: React.FC<LoginErrorPageProps> = ({ error, onRetry, onLogout }) => {
    
    let title = "Login Synchronization Failed";
    let advice: React.ReactNode[] = [];

    const getTroubleshootingSteps = () => {
        const steps = [];
        if (error instanceof ApiError) {
             switch (error.status) {
                case 401:
                case 403:
                    steps.push(<>The website's request was rejected by the bot. This is almost always an <strong>API Key mismatch</strong>. Ensure the <code>API_SECRET_KEY</code> in your bot's <code>config.json</code> exactly matches the <code>VITE_DISCORD_BOT_API_KEY</code> secret in your Supabase project.</>);
                    break;
                case 404:
                    steps.push(<>The bot reported that your Discord user was <strong>not found in the server</strong>. If you recently joined, please wait a few minutes and try again. Ensure you are a member of the correct Discord server specified in the bot's configuration.</>);
                    break;
                case 503:
                    steps.push(<>The bot could not get your roles, which is required for permissions. This is typically caused by the <strong>"Server Members Intent" being disabled</strong>. Go to your bot's settings in the Discord Developer Portal and enable it.</>);
                    break;
                default:
                     steps.push(<>The bot returned an unexpected error (Status: {error.status}). Check the bot's logs on your server for more details. Use <code>pm2 logs vixel-bot</code> if you are using PM2.</>);
            }
        } else if (error.message.includes('Failed to fetch')) {
             steps.push(<>The website could not reach the Discord bot at all. Please check the following:</>);
             steps.push(
                <ul className="list-disc list-inside pl-4 space-y-1">
                    <li>Is the bot running on your server? (Check with <code>pm2 status</code>).</li>
                    <li>Is the <code>VITE_DISCORD_BOT_URL</code> in your Supabase secrets correct? (e.g., <code>http://YOUR_IP:14355</code>).</li>
                    <li>Is the port (default 14355) open in your server's firewall?</li>
                </ul>
             );
        } else {
            steps.push(<>An unexpected error occurred. Please check the browser console and the bot's logs for more details.</>);
        }
        return steps;
    };

    advice = getTroubleshootingSteps();

    return (
        <div className="flex flex-col items-center justify-center h-screen w-screen bg-brand-dark p-6 text-center">
            <div className="bg-brand-dark-blue border-2 border-red-500/50 rounded-xl p-8 md:p-12 max-w-3xl w-full shadow-2xl shadow-black/50 animate-fade-in-up">
                <div className="mx-auto w-20 h-20 flex items-center justify-center rounded-full bg-red-500/10 border-2 border-red-500/50 mb-6">
                    <AlertTriangle className="text-red-400" size={48} />
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-red-400 mb-4">{title}</h1>
                <p className="text-md text-gray-300 mb-8">
                    We couldn't synchronize your profile with Discord after you logged in. This usually happens because of a configuration issue between the website and the backend bot.
                </p>

                <div className="bg-brand-dark p-6 rounded-lg text-left space-y-4 border border-brand-light-blue">
                    <h2 className="font-bold text-brand-cyan text-lg">How to Fix:</h2>
                    <div className="text-gray-200 mt-1 space-y-3">
                       {advice.map((item, index) => (
                           <div key={index} className="flex items-start gap-3">
                               <span className="mt-1 font-bold text-brand-cyan">{index + 1}.</span>
                               <div>{item}</div>
                           </div>
                       ))}
                    </div>
                </div>

                <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button
                        onClick={onLogout}
                        className="w-full sm:w-auto px-8 py-3 bg-gray-600 text-white font-bold text-lg rounded-lg hover:bg-gray-500 transform transition-all duration-300 ease-in-out flex items-center justify-center gap-3"
                    >
                        <LogOut size={22}/>
                        Logout
                    </button>
                     <button
                        onClick={onRetry}
                        className="w-full sm:w-auto px-8 py-3 bg-brand-cyan text-brand-dark font-bold text-lg rounded-lg shadow-glow-cyan hover:bg-white hover:scale-105 transform transition-all duration-300 ease-in-out flex items-center justify-center gap-3"
                    >
                        <RefreshCw size={22}/>
                        Retry Connection
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LoginErrorPage;