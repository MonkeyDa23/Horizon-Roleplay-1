// src/pages/LoginErrorPage.tsx
import React from 'react';
import { AlertTriangle, RefreshCw, LogOut, Wrench } from 'lucide-react';
import { ApiError } from '../lib/api';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface LoginErrorPageProps {
  error: Error;
  onRetry: () => void;
  onLogout: () => void;
}

const LoginErrorPage: React.FC<LoginErrorPageProps> = ({ error, onRetry, onLogout }) => {
    const navigate = ReactRouterDOM.useNavigate();
    const { hasPermission } = useAuth();
    
    const getTroubleshootingSteps = () => {
        const steps: React.ReactNode[] = [];
        const errorMessage = (error && typeof error.message === 'string') ? error.message.toLowerCase() : '';

        if (errorMessage.includes('discord api error (403)')) {
             steps.push(<>The Discord API rejected the request. This is almost always caused by the <strong>"Server Members Intent" being disabled</strong>. Go to your bot's settings in the Discord Developer Portal, enable it, and then invite the bot to your server again.</>);
        } else if (errorMessage.includes('invalid or has been reset')) {
            steps.push(<>The Discord API rejected the request because the token is invalid. Please ensure the <code>DISCORD_BOT_TOKEN</code> secret in your Supabase project is correct and has not been reset.</>);
        } else if (errorMessage.includes('not found') || (error instanceof ApiError && error.status === 404)) {
            steps.push(<>The bot reported that your Discord user was <strong>not found in the server</strong>. If you recently joined, please wait a few minutes and try again. Ensure you are a member of the correct Discord server specified in the website's configuration.</>);
        } else if (errorMessage.includes('discord_guild_id is not configured')) {
            steps.push(<>The website doesn't know which Discord server to check. Please go to the <strong>Admin Panel {'>'} Appearance</strong> page and set the correct <strong>Discord Guild ID</strong>.</>);
        } else if (errorMessage.includes('failed to fetch') || errorMessage.includes('connection refused')) {
             steps.push(<>The Supabase function failed to connect to the Discord API. This could be a temporary network issue with Supabase or Discord. Please try again in a moment.</>);
        } else {
            steps.push(<>An unexpected error occurred. The full error message is: <code className="text-xs bg-brand-dark p-1 rounded">{(error && error.message) ? error.message : 'No error message available'}</code>. Please check the browser console and your Supabase Edge Function logs for more details.</>);
        }
        return steps;
    };

    const advice = getTroubleshootingSteps();
    
    const handleGoToHealthCheck = () => {
        navigate('/health-check');
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen w-screen bg-brand-dark p-6 text-center">
            <div className="bg-brand-dark-blue border-2 border-red-500/50 rounded-xl p-8 md:p-12 max-w-3xl w-full shadow-2xl shadow-black/50 animate-fade-in-up">
                <div className="mx-auto w-20 h-20 flex items-center justify-center rounded-full bg-red-500/10 border-2 border-red-500/50 mb-6">
                    <AlertTriangle className="text-red-400" size={48} />
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-red-400 mb-4">Login Synchronization Failed</h1>
                <p className="text-md text-gray-300 mb-8">
                    We couldn't synchronize your profile with Discord after you logged in. This usually happens because of a configuration issue between the website and the Discord API.
                </p>

                {hasPermission('_super_admin') && (
                    <div className="bg-brand-dark p-6 rounded-lg text-left space-y-4 border-2 border-brand-cyan/50 mb-8">
                        <h2 className="font-bold text-brand-cyan text-lg flex items-center gap-2">
                            <Wrench size={20} />
                            Admin Diagnostic Tool
                        </h2>
                        <p className="text-gray-300">
                            The <strong>System Health Check</strong> page can test your entire setup and pinpoint the exact problem.
                        </p>
                        <button
                            onClick={handleGoToHealthCheck}
                            className="w-full px-8 py-3 bg-brand-cyan text-brand-dark font-bold text-lg rounded-lg shadow-glow-cyan hover:bg-white transform transition-all duration-300 ease-in-out"
                        >
                            Go to Health Check
                        </button>
                    </div>
                )}


                <div className="bg-brand-dark p-6 rounded-lg text-left space-y-4 border border-brand-light-blue">
                    <h2 className="font-bold text-yellow-300 text-lg">Troubleshooting Steps:</h2>
                    <div className="text-gray-200 mt-1 space-y-3">
                       {advice.map((item, index) => (
                           <div key={index} className="flex items-start gap-3">
                               <span className="mt-1 font-bold text-yellow-300">{index + 1}.</span>
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
