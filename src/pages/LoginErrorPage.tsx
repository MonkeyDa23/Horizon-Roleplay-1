// src/pages/LoginErrorPage.tsx
import React from 'react';
import { AlertTriangle, RefreshCw, LogOut, Wrench, ChevronsRight } from 'lucide-react';
import * as ReactRouterDOM from 'react-router-dom';
import { useLocalization } from '../contexts/LocalizationContext';
import { useConfig } from '../contexts/ConfigContext';
import { env } from '../env';

interface LoginErrorPageProps {
  error: Error;
  onRetry: () => void;
  onLogout: () => void;
}

const ApiKeyMismatchHelp: React.FC = () => {
    const { t } = useLocalization();
    return (
        <div className="bg-brand-dark p-6 rounded-lg text-left border border-brand-light-blue">
            <h2 className="font-bold text-yellow-300 text-lg">{t('login_error_api_key_title')}</h2>
            <p className="text-gray-300 mt-2 mb-4" dangerouslySetInnerHTML={{ __html: t('login_error_api_key_intro').replace('in both `.env` files', 'in your website and bot environment variables') }}></p>
            <div className="bg-brand-dark-blue p-4 rounded-md text-sm text-center">
                The value for <code className="text-yellow-300">VITE_DISCORD_BOT_API_KEY</code> in your website's environment (e.g., Vercel settings) must exactly match <code className="text-yellow-300">API_SECRET_KEY</code> in your bot's <code>.env</code> file.
            </div>
        </div>
    );
};


const LoginErrorPage: React.FC<LoginErrorPageProps> = ({ error, onRetry, onLogout }) => {
    const { t } = useLocalization();
    const { config } = useConfig();
    
    const botUrl = env.VITE_DISCORD_BOT_URL;

    const getTroubleshootingContent = () => {
        const errorMessage = (error && typeof error.message === 'string') ? error.message : '';

        if (errorMessage.includes('Invalid API Key')) {
            return <ApiKeyMismatchHelp />;
        }
        
        const steps: React.ReactNode[] = [];
        if (errorMessage.includes('proxy')) {
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
             <div className="bg-brand-dark p-6 rounded-lg text-left space-y-4 border border-brand-light-blue mt-6">
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

                <div className="bg-brand-dark p-6 rounded-lg text-left border border-brand-light-blue">
                    <h2 className="font-bold text-cyan-300 text-lg mb-2 flex items-center gap-2"><Wrench size={20}/> {t('current_configuration')}</h2>
                    <p className="text-sm text-gray-400 mb-4">The website is currently trying to connect using these settings from your <code>.env</code> file. Please verify they are correct.</p>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-semibold text-gray-300">Bot URL Proxy Target:</span>
                            <code className="font-mono px-2 py-1 rounded bg-brand-dark-blue text-white">{botUrl || t('not_set')}</code>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-semibold text-gray-300">API Key Status:</span>
                            <code className="font-mono px-2 py-1 rounded bg-brand-dark-blue text-white">Handled by Server Proxy</code>
                        </div>
                    </div>
                </div>

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
                         <ReactRouterDOM.Link
                            to="/health-check"
                            className="w-full sm:w-auto px-8 py-3 bg-yellow-600 text-white font-bold text-lg rounded-lg hover:bg-yellow-500 transform transition-all duration-300 ease-in-out flex items-center justify-center gap-3 sm:order-2 order-2"
                        >
                            <Wrench size={22}/>
                            {t('go_to_health_check_page')}
                        </ReactRouterDOM.Link>
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