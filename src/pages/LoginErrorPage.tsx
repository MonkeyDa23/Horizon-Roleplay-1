// src/pages/LoginErrorPage.tsx
import React from 'react';
import { AlertTriangle, RefreshCw, LogOut } from 'lucide-react';

interface LoginErrorPageProps {
  error: Error;
  onRetry: () => void;
  onLogout: () => void;
}

const LoginErrorPage: React.FC<LoginErrorPageProps> = ({ error, onRetry, onLogout }) => {
    
    const getTroubleshootingSteps = () => {
        const steps: React.ReactNode[] = [];
        const errorMessage = (error && typeof error.message === 'string') ? error.message : '';

        if (errorMessage.includes('Failed to fetch')) {
            steps.push(<>The website could not connect to the bot's API. <strong>Is the bot running?</strong> Check your bot's console for errors.</>);
            steps.push(<>Ensure the <code>VITE_DISCORD_BOT_URL</code> in your website's <code>.env</code> file is correct (e.g., <code>http://localhost:3001</code>).</>);
        } else if (errorMessage.includes('Invalid API Key')) {
            steps.push(<>The API key is incorrect. Ensure <code>VITE_DISCORD_BOT_API_KEY</code> in the website's <code>.env</code> file <strong>exactly matches</strong> <code>API_SECRET_KEY</code> in the bot's <code>.env</code> file.</>);
        } else if (errorMessage.includes('"Server Members Intent" is likely not enabled')) {
             steps.push(<>The Discord API rejected the request. This is almost always caused by the <strong>"Server Members Intent" being disabled</strong>. Go to your bot's settings in the Discord Developer Portal and enable it.</>);
        } else if (errorMessage.includes('User not found in this server')) {
            steps.push(<>The bot reported that your Discord user was <strong>not found in the server</strong>. Ensure you are a member of the correct Discord server specified by <code>DISCORD_GUILD_ID</code> in the bot's <code>.env</code> file.</>);
        } else {
            steps.push(<>An unexpected error occurred. The full error message is: <code className="text-xs bg-brand-dark p-1 rounded">{errorMessage || 'No error message available'}</code>. Please check the browser console and your bot's console logs for more details.</>);
        }
        return steps;
    };

    const advice = getTroubleshootingSteps();
    
    return (
        <div className="flex flex-col items-center justify-center h-screen w-screen bg-brand-dark p-6 text-center">
            <div className="bg-brand-dark-blue border-2 border-red-500/50 rounded-xl p-8 md:p-12 max-w-3xl w-full shadow-2xl shadow-black/50 animate-fade-in-up">
                <div className="mx-auto w-20 h-20 flex items-center justify-center rounded-full bg-red-500/10 border-2 border-red-500/50 mb-6">
                    <AlertTriangle className="text-red-400" size={48} />
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-red-400 mb-4">Login Synchronization Failed</h1>
                <p className="text-md text-gray-300 mb-8">
                    We couldn't synchronize your profile with Discord after you logged in. This usually happens because of a configuration issue between the website and the Discord bot.
                </p>

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
