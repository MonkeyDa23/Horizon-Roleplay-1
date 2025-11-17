import React, { useState, useEffect, useCallback, useRef } from 'react';
// FIX: Switched to namespace import for react-router-dom to resolve module resolution issues.
import * as ReactRouterDOM from 'react-router-dom';
import { useLocalization } from '../contexts/LocalizationContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
// FIX: Added 'verifyCaptcha' to imports.
import { getQuizById, addSubmission, verifyCaptcha } from '../lib/api';
import type { Quiz, Answer, CheatAttempt } from '../types';
import { CheckCircle, Loader2, ListChecks, ShieldCheck } from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';
import SEO from '../components/SEO';
import { env } from '../env';

// HCaptcha component declaration for TypeScript
declare global {
    interface Window {
        hcaptcha: any;
    }
}

const HCaptcha: React.FC<{ onVerify: (token: string) => void }> = ({ onVerify }) => {
    const captchaRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (window.hcaptcha && captchaRef.current && !widgetIdRef.current) {
            const id = window.hcaptcha.render(captchaRef.current, {
                sitekey: env.VITE_HCAPTCHA_SITE_KEY,
                callback: onVerify,
            });
            widgetIdRef.current = id;
        }
         // Cleanup function to remove the widget when the component unmounts
        return () => {
            if (widgetIdRef.current) {
                try {
                    window.hcaptcha.remove(widgetIdRef.current);
                } catch (e) {
                     console.warn("hCaptcha remove widget error", e);
                }
                widgetIdRef.current = null;
            }
        };
    }, [onVerify]);
    
    return <div ref={captchaRef}></div>;
};


const CircularTimer: React.FC<{ timeLeft: number; timeLimit: number }> = ({ timeLeft, timeLimit }) => {
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const progress = (timeLeft / timeLimit) * circumference;
    const strokeColor = timeLeft < 10 ? '#ef4444' : '#00f2ea';

    return (
        <div className="relative w-20 h-20">
            <svg className="w-full h-full" viewBox="0 0 70 70">
                <circle
                    className="text-brand-light-blue"
                    strokeWidth="5"
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx="35"
                    cy="35"
                />
                <circle
                    strokeWidth="5"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference - progress}
                    strokeLinecap="round"
                    stroke={strokeColor}
                    fill="transparent"
                    r={radius}
                    cx="35"
                    cy="35"
                    style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset 0.5s linear, stroke 0.5s linear' }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold" style={{ color: strokeColor, transition: 'color 0.5s linear' }}>{timeLeft}</span>
            </div>
        </div>
    );
};


const QuizPage: React.FC = () => {
  // FIX: Use namespace import 'ReactRouterDOM.useParams'.
  const { quizId } = ReactRouterDOM.useParams<{ quizId: string }>();
  // FIX: Use namespace import 'ReactRouterDOM.useNavigate'.
  const navigate = ReactRouterDOM.useNavigate();
  const { t } = useLocalization();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { config } = useConfig();
  const communityName = config.COMMUNITY_NAME;
  
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [quizState, setQuizState] = useState<'rules' | 'taking' | 'submitted'>('rules');
  const [showQuestion, setShowQuestion] = useState(true);
  const [cheatLog, setCheatLog] = useState<CheatAttempt[]>([]);
  const [finalCheatLog, setFinalCheatLog] = useState<CheatAttempt[]>([]);
  const [hcaptchaToken, setHcaptchaToken] = useState<string | null>(null);


  useEffect(() => {
    if (!user) { navigate('/applies'); return; }
    if (!quizId) { navigate('/applies'); return; }

    const fetchQuiz = async () => {
        setIsLoading(true);
        try {
          const fetchedQuiz = await getQuizById(quizId);
          if (fetchedQuiz && fetchedQuiz.isOpen && Array.isArray(fetchedQuiz.questions) && fetchedQuiz.questions.length > 0) {
              setQuiz(fetchedQuiz);
              setTimeLeft(fetchedQuiz.questions[0].timeLimit);
              setQuizState('rules');
          } else {
              navigate('/applies');
          }
        } catch (error) { 
            console.error(`Failed to fetch quiz ${quizId}`, error); 
            navigate('/applies');
        } finally { setIsLoading(false); }
    }
    
    fetchQuiz();
  }, [quizId, navigate, user]);
  
  const handleSubmit = useCallback(async (finalAnswers: Answer[]) => {
    if (!quiz || !user || isSubmitting || !hcaptchaToken) {
        if (!hcaptchaToken) showToast('الرجاء إكمال اختبار التحقق.', 'warning');
        return;
    };
    setIsSubmitting(true);
    setFinalCheatLog(cheatLog);
    const submissionData = { 
        quizId: quiz.id, 
        quizTitle: t(quiz.titleKey), 
        user_id: user.id, 
        username: user.username, 
        answers: finalAnswers, 
        submittedAt: new Date().toISOString(), 
        cheatAttempts: cheatLog,
        user_highest_role: user.highestRole?.name ?? t('member'),
        discord_id: user.discordId
    };
    try {
      // FIX: Separated captcha verification from submission. First verify captcha, then submit.
      await verifyCaptcha(hcaptchaToken);
      await addSubmission(submissionData);
      setQuizState('submitted');
    } catch (error) {
      console.error("Failed to submit application:", error);
      showToast((error as Error).message, 'error');
      setIsSubmitting(false);
       if (window.hcaptcha) {
            window.hcaptcha.reset();
            setHcaptchaToken(null);
        }
    }
  }, [quiz, user, t, isSubmitting, cheatLog, hcaptchaToken, showToast]);


  const handleNextQuestion = useCallback(() => {
    if (!quiz) return;
    setShowQuestion(false);
    const timeTaken = quiz.questions[currentQuestionIndex].timeLimit - timeLeft;

    const newAnswers = [...answers, {
        questionId: quiz.questions[currentQuestionIndex].id,
        questionText: t(quiz.questions[currentQuestionIndex].textKey),
        answer: currentAnswer,
        timeTaken: timeTaken,
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
    }, 500);
  }, [quiz, currentQuestionIndex, timeLeft, answers, currentAnswer, t, handleSubmit]);


  useEffect(() => {
    if (quizState !== 'taking') return;
    
    if (timeLeft <= 0) {
      handleNextQuestion();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, quizState, handleNextQuestion]);

  useEffect(() => {
      if (quizState !== 'taking') return;
      const logCheat = (method: string) => {
          showToast(t('cheat_attempt_detected'), 'warning');
          setCheatLog(prev => [...prev, { method: t(method), timestamp: new Date().toISOString() }]);
      };
      
      const handleVisibilityChange = () => {
          if (document.hidden) { logCheat('cheat_method_switched_tab'); }
      };
      const handleBlur = () => { logCheat('cheat_method_lost_focus'); };
      
      window.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('blur', handleBlur);
      return () => {
          window.removeEventListener('visibilitychange', handleVisibilityChange);
          window.removeEventListener('blur', handleBlur);
      };
  }, [quizState, t, showToast]);

  const beginQuiz = () => {
      if (!hcaptchaToken) {
          showToast('الرجاء إكمال اختبار التحقق أولاً.', 'warning');
          return;
      }
      setQuizState('taking');
  };

  if (isLoading || !quiz) {
    return <div className="flex justify-center items-center h-screen"><Loader2 size={48} className="text-brand-cyan animate-spin" /></div>;
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];
  
  return (
    <>
      <SEO title={`${communityName} - ${t(quiz.titleKey)}`} noIndex={true} description={t(quiz.descriptionKey)} />
      <div className="container mx-auto px-6 py-16 flex justify-center items-center min-h-[calc(100vh-136px)]">
        <div className="glass-panel p-8 md:p-12 w-full max-w-4xl">
            {quizState === 'rules' && (
                <div className="text-center animate-fade-in-up">
                    <h1 className="text-4xl font-bold text-white mb-4">{t(quiz.titleKey)}</h1>
                    <p className="text-lg text-text-secondary mb-8">{t(quiz.descriptionKey)}</p>
                    <div className="bg-brand-dark p-6 rounded-lg border border-border-color text-start mb-8">
                        <h2 className="text-2xl font-bold text-primary-blue mb-4">{t('quiz_rules')}</h2>
                        <div className="whitespace-pre-wrap text-text-primary leading-relaxed">
                            {t(quiz.instructionsKey)}
                        </div>
                    </div>
                    <div className="flex justify-center mb-8">
                        {env.VITE_HCAPTCHA_SITE_KEY ? (
                            <HCaptcha onVerify={setHcaptchaToken} />
                        ) : (
                             <p className="text-red-400 text-sm">hCaptcha site key is not configured!</p>
                        )}
                    </div>
                    <button onClick={beginQuiz} disabled={!hcaptchaToken} className="bg-gradient-to-r from-primary-blue to-accent-cyan text-background-dark font-bold py-3 px-8 rounded-lg text-xl shadow-glow-blue hover:opacity-90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed">
                        {t('begin_quiz')}
                    </button>
                </div>
            )}
            
            {quizState === 'taking' && (
                 <div className={`transition-opacity duration-500 ${showQuestion ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-primary-blue mb-4 md:mb-0">
                            {t('question')} {currentQuestionIndex + 1} {t('of')} {quiz.questions.length}
                        </h2>
                        <CircularTimer timeLeft={timeLeft} timeLimit={currentQuestion.timeLimit} />
                    </div>
                    <p className="text-xl md:text-2xl text-white mb-8 min-h-[6rem]">{t(currentQuestion.textKey)}</p>
                    <textarea
                        value={currentAnswer}
                        onChange={(e) => setCurrentAnswer(e.target.value)}
                        className="vixel-input text-lg h-48"
                        placeholder="اكتب إجابتك هنا..."
                    />
                    <div className="mt-8 text-end">
                        <button onClick={handleNextQuestion} disabled={!currentAnswer} className="bg-gradient-to-r from-primary-blue to-accent-cyan text-background-dark font-bold py-3 px-8 rounded-lg text-lg hover:opacity-90 transition-all duration-300 disabled:opacity-50">
                             {currentQuestionIndex < quiz.questions.length - 1 ? t('next_question') : t('submit_application')}
                        </button>
                    </div>
                 </div>
            )}

            {isSubmitting && (
                <div className="text-center animate-fade-in-up flex flex-col items-center">
                    <Loader2 size={48} className="text-brand-cyan animate-spin mb-4" />
                    <h2 className="text-2xl font-bold">Submitting...</h2>
                </div>
            )}

             {quizState === 'submitted' && (
                <div className="text-center animate-fade-in-up">
                    <CheckCircle size={80} className="text-green-400 mx-auto mb-6" />
                    <h1 className="text-4xl font-bold text-white mb-4">{t('application_submitted')}</h1>
                    <p className="text-lg text-text-secondary mb-8">{t('application_submitted_desc')}</p>

                    {finalCheatLog.length > 0 && (
                         <div className="bg-brand-dark p-6 rounded-lg border border-border-color text-start mb-8 max-w-lg mx-auto">
                            <h2 className="text-xl font-bold text-yellow-400 mb-4 flex items-center gap-3"><ListChecks /> {t('cheat_attempts_report')}</h2>
                            <p className="text-text-secondary mb-3">{t('cheat_attempts_count', { count: finalCheatLog.length })}</p>
                             <ul className="list-disc list-inside space-y-1 text-text-primary text-sm">
                                {finalCheatLog.map((attempt, i) => (
                                    <li key={i}>{attempt.method} at {new Date(attempt.timestamp).toLocaleTimeString()}</li>
                                ))}
                             </ul>
                        </div>
                    )}

                    <button onClick={() => navigate('/my-applications')} className="bg-gradient-to-r from-primary-blue to-accent-cyan text-background-dark font-bold py-3 px-8 rounded-lg text-xl hover:opacity-90 transition-all duration-300">
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