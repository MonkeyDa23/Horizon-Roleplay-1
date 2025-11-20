
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLocalization } from '../contexts/LocalizationContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getQuizById, addSubmission, verifyCaptcha } from '../lib/api';
import type { Quiz, Answer, CheatAttempt } from '../types';
import { CheckCircle, Loader2, ListChecks } from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';
import SEO from '../components/SEO';
import { env } from '../env';

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
            try {
                const id = window.hcaptcha.render(captchaRef.current, {
                    sitekey: env.VITE_HCAPTCHA_SITE_KEY,
                    callback: onVerify,
                });
                widgetIdRef.current = id;
            } catch (e) {
                console.error("hCaptcha render failed:", e);
            }
        }
        return () => {
            // Defensive cleanup
            if (widgetIdRef.current && window.hcaptcha) {
               // We deliberately avoid calling .remove() here to prevent internal API crashes
               // during rapid component unmounts. We just let the DOM element disappear.
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
  
  const handleSubmit = useCallback(async (finalAnswers: Answer[]) => {
    if (!quiz || !user || isSubmitting) return;
    if (!hcaptchaToken) { showToast('الرجاء إكمال اختبار التحقق.', 'warning'); return; }
    
    setIsSubmitting(true);
    setFinalCheatLog(cheatLog);

    try {
      // 1. Verify Captcha first
      await verifyCaptcha(hcaptchaToken);
      
      // 2. Submit Data
      await addSubmission({ 
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
      setQuizState('submitted');
    } catch (error) {
      const msg = (error as Error).message;
      showToast(msg.includes('secret key') ? t('error_captcha_not_configured_user') : msg, 'error');
      
      // Safe Reset
      if (window.hcaptcha) {
          try { window.hcaptcha.reset(); } catch (e) { /* ignore */ }
      }
      setHcaptchaToken(null);
      setIsSubmitting(false);
    }
  }, [quiz, user, t, isSubmitting, cheatLog, hcaptchaToken, showToast]);

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

  useEffect(() => {
    if (quizState !== 'taking') return;
    if (timeLeft <= 0) { handleNextQuestion(); return; }
    const timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, quizState, handleNextQuestion]);

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
            {quizState === 'rules' && (
                <div className="text-center animate-fade-in-up">
                    <h1 className="text-4xl font-bold text-white mb-4">{t(quiz.titleKey)}</h1>
                    <div className="bg-brand-dark p-6 rounded-lg text-start mb-8">
                        <h2 className="text-2xl font-bold text-primary-blue mb-4">{t('quiz_rules')}</h2>
                        <div className="whitespace-pre-wrap text-text-primary">{t(quiz.instructionsKey)}</div>
                    </div>
                    <div className="flex justify-center mb-8">
                        {env.VITE_HCAPTCHA_SITE_KEY ? <HCaptcha onVerify={setHcaptchaToken} /> : <p className="text-red-400">Setup HCaptcha Key!</p>}
                    </div>
                    <button onClick={beginQuiz} disabled={!hcaptchaToken} className="bg-gradient-to-r from-primary-blue to-accent-cyan text-background-dark font-bold py-3 px-8 rounded-lg text-xl shadow-glow-blue hover:opacity-90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed">
                        {t('begin_quiz')}
                    </button>
                </div>
            )}
            {quizState === 'taking' && (
                 <div className={`transition-opacity duration-300 ${showQuestion ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-primary-blue">{t('question')} {currentQuestionIndex + 1} {t('of')} {quiz.questions.length}</h2>
                        <CircularTimer timeLeft={timeLeft} timeLimit={quiz.questions[currentQuestionIndex].timeLimit} />
                    </div>
                    <p className="text-xl text-white mb-8">{t(quiz.questions[currentQuestionIndex].textKey)}</p>
                    <textarea value={currentAnswer} onChange={(e) => setCurrentAnswer(e.target.value)} className="vixel-input text-lg h-48" placeholder="Answer here..." />
                    <div className="mt-8 text-end">
                        <button onClick={handleNextQuestion} disabled={!currentAnswer} className="bg-gradient-to-r from-primary-blue to-accent-cyan text-background-dark font-bold py-3 px-8 rounded-lg text-lg hover:opacity-90 transition-all disabled:opacity-50">
                             {currentQuestionIndex < quiz.questions.length - 1 ? t('next_question') : t('submit_application')}
                        </button>
                    </div>
                 </div>
            )}
            {isSubmitting && <div className="text-center py-12"><Loader2 size={60} className="text-brand-cyan animate-spin mx-auto mb-4" /><h2>Processing...</h2></div>}
            {quizState === 'submitted' && (
                <div className="text-center animate-fade-in-up">
                    <CheckCircle size={80} className="text-green-400 mx-auto mb-6" />
                    <h1 className="text-4xl font-bold text-white mb-4">{t('application_submitted')}</h1>
                    <p className="text-lg text-text-secondary mb-8">{t('application_submitted_desc')}</p>
                    <button onClick={() => navigate('/my-applications')} className="bg-gradient-to-r from-primary-blue to-accent-cyan text-background-dark font-bold py-3 px-8 rounded-lg text-xl hover:opacity-90 transition-all duration-300">{t('view_my_applications')}</button>
                </div>
            )}
        </div>
      </div>
    </>
  );
};
export default QuizPage;