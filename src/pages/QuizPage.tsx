
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLocalization } from '../contexts/LocalizationContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getQuizById, addSubmission, verifyCaptcha, sendDiscordLog } from '../lib/api';
import type { Quiz, Answer, CheatAttempt } from '../types';
import { CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';
import SEO from '../components/SEO';
import { env } from '../env';
import { supabase } from '../lib/supabaseClient';

declare global {
    interface Window {
        hcaptcha: any;
    }
}

// FIX: Optimized HCaptcha Component
// 1. Uses React.memo to prevent re-rendering when parent state (timer) changes.
// 2. Properly cleans up the container on unmount.
// 3. Uses a stable callback reference.
const HCaptcha = React.memo<{ onVerify: (token: string) => void }>(({ onVerify }) => {
    const captchaRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!captchaRef.current) return;
        
        // If hCaptcha script isn't loaded yet, we wait or fail gracefully.
        // (It is loaded in index.html async).
        if (typeof window.hcaptcha === 'undefined') {
            console.warn("hCaptcha script not loaded yet.");
            return;
        }

        // Prevent double-rendering
        if (widgetIdRef.current !== null) return;

        try {
            const id = window.hcaptcha.render(captchaRef.current, {
                sitekey: env.VITE_HCAPTCHA_SITE_KEY,
                callback: onVerify,
                theme: 'dark' // Match website theme
            });
            widgetIdRef.current = id;
        } catch (e) {
            console.error("hCaptcha render failed:", e);
        }

        return () => {
            // Cleanup is tricky with hCaptcha, usually we just let the DOM node disappear.
            // We reset the ref so it can remount if user comes back.
            widgetIdRef.current = null;
        };
    }, [onVerify]);
    
    // Fixed height to prevent CLS (Cumulative Layout Shift)
    return <div ref={captchaRef} className="min-h-[78px] flex justify-center"></div>;
});

const CircularTimer: React.FC<{ timeLeft: number; timeLimit: number }> = ({ timeLeft, timeLimit }) => {
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const progress = (timeLeft / timeLimit) * circumference;
    const strokeColor = timeLeft < 10 ? '#ef4444' : '#00f2ea';

    return (
        <div className="relative w-20 h-20 flex-shrink-0">
            <svg className="w-full h-full" viewBox="0 0 70 70">
                <circle className="text-brand-light-blue" strokeWidth="5" stroke="currentColor" fill="transparent" r={radius} cx="35" cy="35" />
                <circle strokeWidth="5" strokeDasharray={circumference} strokeDashoffset={circumference - progress} strokeLinecap="round" stroke={strokeColor} fill="transparent" r={radius} cx="35" cy="35" style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset 0.5s linear, stroke 0.5s linear' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold" style={{ color: strokeColor }}>{timeLeft}</span>
            </div>
        </div>
    );
};

const QuizPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { t, language } = useLocalization();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { config } = useConfig();
  const communityName = config.COMMUNITY_NAME;
  
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Quiz State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [quizState, setQuizState] = useState<'rules' | 'taking' | 'submitted'>('rules');
  const [showQuestion, setShowQuestion] = useState(true);
  
  // Security
  const [cheatLog, setCheatLog] = useState<CheatAttempt[]>([]);
  const [hcaptchaToken, setHcaptchaToken] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !quizId) { navigate('/applies'); return; }
    const fetchQuiz = async () => {
        setIsLoading(true);
        try {
          const fetchedQuiz = await getQuizById(quizId);
          if (fetchedQuiz && fetchedQuiz.isOpen) {
              setQuiz(fetchedQuiz);
              setTimeLeft(fetchedQuiz.questions[0]?.timeLimit || 60);
          } else {
              navigate('/applies');
          }
        } catch (error) { navigate('/applies'); } 
        finally { setIsLoading(false); }
    }
    fetchQuiz();
  }, [quizId, navigate, user]);

  // Stable callback for captcha to avoid re-renders
  const handleCaptchaVerify = useCallback((token: string) => {
      setHcaptchaToken(token);
  }, []);
  
  const handleSubmit = useCallback(async (finalAnswers: Answer[]) => {
    if (!quiz || !user || isSubmitting) return;
    if (!hcaptchaToken) { showToast('الرجاء إكمال اختبار التحقق.', 'warning'); return; }
    
    setIsSubmitting(true);

    try {
      // 1. Verify Captcha on Backend
      await verifyCaptcha(hcaptchaToken);
      
      // 2. Submit Data to DB
      const submission = await addSubmission({ 
        quizId: quiz.id, 
        quizTitle: t(quiz.titleKey), 
        user_id: user.id, 
        username: user.username, 
        answers: finalAnswers, 
        submittedAt: new Date().toISOString(), 
        cheatAttempts: cheatLog,
        user_highest_role: user.highestRole?.name ?? t('member'),
        discord_id: user.discordId
      });

      // 3. Log and Notify
      // Log to DB first via sendDiscordLog logic
      const embed = {
        title: "📝 New Application Submitted",
        description: `**User:** ${user.username} (<@${user.discordId}>)\n**Quiz:** ${t(quiz.titleKey)}\n**Status:** Pending`,
        color: 0x3B82F6, // Blue
        fields: [
            { name: "Submission ID", value: submission.id, inline: true },
            { name: "Cheats Detected", value: cheatLog.length > 0 ? "⚠️ YES" : "No", inline: true }
        ],
        timestamp: new Date().toISOString()
      };
      
      // This ensures the log is saved to DB even if Discord fails
      sendDiscordLog(config, embed, 'submission', language);

      setQuizState('submitted');
      
    } catch (error) {
      const msg = (error as Error).message;
      // User friendly error for missing secret key
      if (msg.includes('missing the hCaptcha secret key')) {
          showToast('Configuration Error: hCaptcha secret not set on server. Contact Admin.', 'error');
      } else {
          showToast(msg, 'error');
      }
      
      // Reset captcha so they can try again without reloading
      if (window.hcaptcha) {
          try { window.hcaptcha.reset(); } catch (e) { /* ignore */ }
      }
      setHcaptchaToken(null);
      setIsSubmitting(false);
    }
  }, [quiz, user, t, isSubmitting, cheatLog, hcaptchaToken, showToast, config, language]);

  const handleNextQuestion = useCallback(() => {
    if (!quiz) return;
    setShowQuestion(false);
    const newAnswers = [...answers, {
        questionId: quiz.questions[currentQuestionIndex].id,
        questionText: t(quiz.questions[currentQuestionIndex].textKey),
        answer: currentAnswer,
        timeTaken: quiz.questions[currentQuestionIndex].timeLimit - timeLeft,
    }];
    setAnswers(newAnswers);
    setCurrentAnswer('');

    setTimeout(() => {
        if (currentQuestionIndex < quiz.questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setTimeLeft(quiz.questions[currentQuestionIndex + 1].timeLimit);
            setShowQuestion(true);
        } else {
            handleSubmit(newAnswers);
        }
    }, 300);
  }, [quiz, currentQuestionIndex, timeLeft, answers, currentAnswer, t, handleSubmit]);

  // Timer Effect
  useEffect(() => {
    if (quizState !== 'taking') return;
    if (timeLeft <= 0) { handleNextQuestion(); return; }
    const timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, quizState, handleNextQuestion]);

  // Cheat Detection (Tab Switching)
  useEffect(() => {
    if (quizState !== 'taking') return;
    const handleVisibilityChange = () => {
        if (document.hidden) {
            setCheatLog(prev => [...prev, { method: 'Tab Switch / Minimized', timestamp: new Date().toISOString() }]);
        }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [quizState]);

  const beginQuiz = () => {
      if (!hcaptchaToken) { showToast('الرجاء إكمال اختبار التحقق أولاً.', 'warning'); return; }
      setQuizState('taking');
  };

  if (isLoading || !quiz) return <div className="flex justify-center items-center h-screen"><Loader2 size={48} className="text-brand-cyan animate-spin" /></div>;

  return (
    <>
      <SEO title={`${communityName} - ${t(quiz.titleKey)}`} noIndex={true} description={t(quiz.descriptionKey)} />
      <div className="container mx-auto px-6 py-16 flex justify-center items-center min-h-[calc(100vh-136px)]">
        <div className="glass-panel p-8 md:p-12 w-full max-w-4xl">
            
            {/* STATE: RULES & CAPTCHA */}
            {quizState === 'rules' && (
                <div className="text-center animate-fade-in-up">
                    <h1 className="text-4xl font-bold text-white mb-4">{t(quiz.titleKey)}</h1>
                    <div className="bg-brand-dark p-6 rounded-lg text-start mb-8 border border-brand-light-blue/50">
                        <h2 className="text-2xl font-bold text-brand-cyan mb-4">{t('quiz_rules')}</h2>
                        <div className="whitespace-pre-wrap text-gray-300 leading-relaxed">{t(quiz.instructionsKey)}</div>
                    </div>
                    
                    <div className="flex justify-center mb-8">
                        {/* The HCaptcha component is now memoized and stable */}
                        {env.VITE_HCAPTCHA_SITE_KEY ? (
                            <HCaptcha onVerify={handleCaptchaVerify} />
                        ) : (
                            <div className="text-red-400 flex flex-col items-center gap-2 bg-red-500/10 p-4 rounded">
                                <AlertTriangle />
                                <p>hCaptcha Site Key not configured in .env!</p>
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={beginQuiz} 
                        disabled={!hcaptchaToken} 
                        className="bg-gradient-to-r from-primary-blue to-accent-cyan text-background-dark font-bold py-4 px-10 rounded-xl text-xl shadow-glow-blue hover:opacity-90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
                    >
                        {t('begin_quiz')}
                    </button>
                </div>
            )}

            {/* STATE: TAKING QUIZ */}
            {quizState === 'taking' && !isSubmitting && (
                 <div className={`transition-opacity duration-300 ${showQuestion ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-3xl font-bold text-white">{t('question')} {currentQuestionIndex + 1} <span className="text-gray-500 text-xl">/ {quiz.questions.length}</span></h2>
                        </div>
                        <CircularTimer timeLeft={timeLeft} timeLimit={quiz.questions[currentQuestionIndex].timeLimit} />
                    </div>
                    
                    <div className="bg-brand-dark/50 p-6 rounded-lg mb-8 border-l-4 border-brand-cyan">
                        <p className="text-xl text-white">{t(quiz.questions[currentQuestionIndex].textKey)}</p>
                    </div>

                    <textarea 
                        value={currentAnswer} 
                        onChange={(e) => setCurrentAnswer(e.target.value)} 
                        className="vixel-input text-lg h-48 focus:ring-2 focus:ring-brand-cyan" 
                        placeholder="Type your answer here..." 
                        autoFocus
                    />
                    
                    <div className="mt-8 text-end">
                        <button 
                            onClick={handleNextQuestion} 
                            disabled={!currentAnswer.trim()} 
                            className="bg-gradient-to-r from-primary-blue to-accent-cyan text-background-dark font-bold py-3 px-8 rounded-lg text-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                             {currentQuestionIndex < quiz.questions.length - 1 ? t('next_question') : t('submit_application')}
                        </button>
                    </div>
                 </div>
            )}

            {/* STATE: SUBMITTING LOADER */}
            {isSubmitting && (
                <div className="text-center py-20 animate-fade-in-up">
                    <Loader2 size={80} className="text-brand-cyan animate-spin mx-auto mb-6" />
                    <h2 className="text-2xl font-bold text-white">Saving your application...</h2>
                    <p className="text-gray-400 mt-2">Please wait, do not refresh the page.</p>
                </div>
            )}

            {/* STATE: SUBMITTED SUCCESS */}
            {quizState === 'submitted' && (
                <div className="text-center animate-fade-in-up py-10">
                    <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-green-500/50 shadow-lg shadow-green-500/20">
                        <CheckCircle size={60} className="text-green-400" />
                    </div>
                    <h1 className="text-4xl font-bold text-white mb-4">{t('application_submitted')}</h1>
                    <p className="text-lg text-text-secondary mb-10 max-w-lg mx-auto">{t('application_submitted_desc')}</p>
                    <button onClick={() => navigate('/my-applications')} className="bg-brand-dark border border-brand-cyan text-brand-cyan font-bold py-3 px-8 rounded-lg text-xl hover:bg-brand-cyan hover:text-brand-dark transition-all duration-300">
                        {t('view_my_applications')}
                    </button>
                </div>
            )}
        </div>
      </div>
    </>
  );
};
export default QuizPage;
