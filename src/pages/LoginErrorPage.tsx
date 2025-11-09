// src/pages/LoginErrorPage.tsx
import React from 'react';
import { AlertTriangle, RefreshCw, LogOut, Wrench, ChevronsRight } from 'lucide-react';
// FIX: Switched to named import for react-router-dom components as per standard usage.
import { Link } from 'react-router-dom';
import { useLocalization } from '../hooks/useLocalization';
import { useConfig } from '../hooks/useConfig';

interface LoginErrorPageProps {
  error: Error;
  onRetry: () => void;
  onLogout: () => void;
}

const ApiKeyMismatchHelp: React.FC = () => {
    const { t, dir } = useLocalization();
    return (
        <div className="bg-brand-dark p-6 rounded-lg text-left border border-brand-light-blue">
            <h2 className="font-bold text-yellow-300 text-lg">{t('login_error_api_key_title')}</h2>
            <p className="text-gray-300 mt-2 mb-4" dangerouslySetInnerHTML={{ __html: t('login_error_api_key_intro') }}></p>
            
            <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center">
                {/* Website .env */}
                <div className="md:col-span-5">
                    <p className="font-semibold text-center mb-2">{t('login_error_website_env')}</p>
                    <pre className="bg-brand-dark-blue p-3 rounded-md text-sm text-gray-300" dir="ltr">
                        <code>
                            VITE_SUPABASE_URL=...<br/>
                            VITE_SUPABASE_ANON_KEY=...<br/>
                            VITE_DISCORD_BOT_URL=...<br/>
                            <span className="bg-yellow-500/20 text-yellow-300 px-1 rounded">VITE_DISCORD_BOT_API_KEY="YourSecretKey"</span>
                        </code>
                    </pre>
                </div>
                
                {/* Arrow */}
                <div className="hidden md:flex flex-col items-center justify-center text-brand-cyan md:col-span-1">
                    <ChevronsRight size={32} className={`my-2 ${dir === 'rtl' ? 'rotate-180' : ''}`}/>
                </div>
                
                {/* Text for mobile */}
                <div className="md:hidden text-center font-bold text-brand-cyan my-2 text-lg">
                    ↓ {t('login_error_must_match')} ↓
                </div>

                {/* Bot .env */}
                <div className="md:col-span-5">
                    <p className="font-semibold text-center mb-2">{t('login_error_bot_env')}</p>
                    <pre className="bg-brand-dark-blue p-3 rounded-md text-sm text-gray-300" dir="ltr">
                        <code>
                            DISCORD_BOT_TOKEN=...<br/>
                            DISCORD_GUILD_ID=...<br/>
                            PORT=3001<br/>
                            <span className="bg-yellow-500/20 text-yellow-300 px-1 rounded">API_SECRET_KEY="YourSecretKey"</span>
                        </code>
                    </pre>
                </div>
            </div>
        </div>
    );
};


const LoginErrorPage: React.FC<LoginErrorPageProps> = ({ error, onRetry, onLogout }) => {
    const { t } = useLocalization();
    const { config } = useConfig();
    
    const getTroubleshootingContent = () => {
        const errorMessage = (error && typeof error.message === 'string') ? error.message : '';

        if (errorMessage.includes('Invalid API Key')) {
            return <ApiKeyMismatchHelp />;
        }
        
        // Fallback for other errors
        const steps: React.ReactNode[] = [];
        if (errorMessage.includes('Failed to fetch')) {
            steps.push(<div dangerouslySetInnerHTML={{ __html: t('login_error_step_fetch') }} />);
            steps.push(<div dangerouslySetInnerHTML={{ __html: t('login_error_step_url') }} />);
        } else if (errorMessage.includes('"Server Members Intent" is likely not enabled')) {
             steps.push(<div dangerouslySetInnerHTML={{ __html: t('login_error_step_intent') }} />);
        } else if (errorMessage.includes('User not found in this server')) {
            steps.push(<div dangerouslySetInnerHTML={{ __html: t('login_error_step_not_found') }} />);
        } else {
            steps.push(<div dangerouslySetInnerHTML={{ __html: t('login_error_step_unknown', { errorMessage: errorMessage || 'No error message available' }) }} />);
        }

        return (
             <div className="bg-brand-dark p-6 rounded-lg text-left space-y-4 border border-brand-light-blue">
                <h2 className="font-bold text-yellow-300 text-lg">{t('troubleshooting_steps')}</h2>
                <div className="text-gray-200 mt-1 space-y-3">
                   {steps.map((item, index) => (
                       <div key={index} className="flex items-start gap-3">
                           <span className="mt-1 font-bold text-yellow-300">{index + 1}.</span>
                           <div>{item}</div>
                       </div>
                   ))}
                </div>
            </div>
        );
    };

    const troubleshootingContent = getTroubleshootingContent();
    
    return (
        <div className="flex flex-col items-center justify-center h-screen w-screen bg-brand-dark p-6 text-center">
            <div className="bg-brand-dark-blue border-2 border-red-500/50 rounded-xl p-8 md:p-12 max-w-3xl w-full shadow-2xl shadow-black/50 animate-fade-in-up">
                <div className="mx-auto w-20 h-20 flex items-center justify-center rounded-full bg-red-500/10 border-2 border-red-500/50 mb-6">
                    <AlertTriangle className="text-red-400" size={48} />
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-red-400 mb-4">{t('login_sync_failed_title')}</h1>
                <p className="text-md text-gray-300 mb-8">
                    {t('login_sync_failed_desc')}
                </p>

                {troubleshootingContent}

                <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button
                        onClick={onLogout}
                        className="w-full sm:w-auto px-8 py-3 bg-gray-600 text-white font-bold text-lg rounded-lg hover:bg-gray-500 transform transition-all duration-300 ease-in-out flex items-center justify-center gap-3 sm:order-1 order-3"
                    >
                        <LogOut size={22}/>
                        {t('logout')}
                    </button>
                    {config.SHOW_HEALTH_CHECK && (
                         // FIX: Use named import 'Link' instead of 'ReactRouterDOM.Link'.
                         <Link
                            to="/health-check"
                            className="w-full sm:w-auto px-8 py-3 bg-yellow-600 text-white font-bold text-lg rounded-lg hover:bg-yellow-500 transform transition-all duration-300 ease-in-out flex items-center justify-center gap-3 sm:order-2 order-2"
                        >
                            <Wrench size={22}/>
                            {t('go_to_health_check_page')}
                        </Link>
                    )}
                     <button
                        onClick={onRetry}
                        className="w-full sm:w-auto px-8 py-3 bg-brand-cyan text-brand-dark font-bold text-lg rounded-lg shadow-glow-cyan hover:bg-white hover:scale-105 transform transition-all duration-300 ease-in-out flex items-center justify-center gap-3 sm:order-3 order-1"
                    >
                        <RefreshCw size={22}/>
                        {t('retry_connection')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LoginErrorPage;