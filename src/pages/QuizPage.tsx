import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLocalization } from '../contexts/LocalizationContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getQuizById, addSubmission, verifyCaptcha, logSubmissionAction } from '../lib/api';
import type { Quiz, Answer, CheatAttempt } from '../types';
import { CheckCircle, Loader2, AlertCircle, Shield, ChevronRight } from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';
import SEO from '../components/SEO';
import { env } from '../env';

const HCaptcha = React.memo<{ onVerify: (token: string) => void }>(({ onVerify }) => {
    const captchaRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    
    useEffect(() => {
        if (!captchaRef.current || typeof (window as any).hcaptcha === 'undefined' || widgetIdRef.current) return;
        try {
            const id = (window as any).hcaptcha.render(captchaRef.current, {
                sitekey: env.VITE_HCAPTCHA_SITE_KEY,
                callback: onVerify,
                theme: 'dark'
            });
            widgetIdRef.current = id;
        } catch (e) {
            console.error('HCaptcha render error:', e);
        }
        return () => { widgetIdRef.current = null; };
    }, [onVerify]);
    return <div ref={captchaRef} className="min-h-[78px] flex justify-center"></div>;
});

const CircularTimer: React.FC<{ timeLeft: number; timeLimit: number }> = ({ timeLeft, timeLimit }) => {
    const { branding } = useConfig();
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const progress = (timeLeft / timeLimit) * circumference;
    const strokeColor = timeLeft < 10 ? '#ef4444' : (branding.primaryColor || '#00f2ea');
    return (
        <div className="relative w-20 h-20 flex-shrink-0">
            <svg className="w-full h-full" viewBox="0 0 70 70">
                <circle className="text-white/10" strokeWidth="5" stroke="currentColor" fill="transparent" r={radius} cx="35" cy="35" />
                <circle strokeWidth="5" strokeDasharray={circumference} strokeDashoffset={circumference - progress} strokeLinecap="round" stroke={strokeColor} fill="transparent" r={radius} cx="35" cy="35" style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset 0.5s linear, stroke 0.5s linear' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black font-mono" style={{ color: strokeColor }}>{timeLeft}</span>
            </div>
        </div>
    );
};

const QuizPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { t, dir } = useLocalization();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { branding } = useConfig();
  
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
  const [hcaptchaToken, setHcaptchaToken] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  useEffect(() => {
    if (!user || !quizId) { navigate('/applies'); return; }
    const fetchQuiz = async () => {
        setIsLoading(true);
        try {
          const fetchedQuiz = await getQuizById(quizId);
          if (fetchedQuiz && fetchedQuiz.isOpen) {
              setQuiz(fetchedQuiz);
              const draftKey = `vixel_quiz_draft_${user.id}_${quizId}`;
              const savedDraft = localStorage.getItem(draftKey);
              
              if (savedDraft) {
                  try {
                      const parsed = JSON.parse(savedDraft);
                      setAnswers(parsed.answers || []);
                      setCurrentQuestionIndex(parsed.currentQuestionIndex || 0);
                      setTimeLeft(fetchedQuiz.questions[parsed.currentQuestionIndex || 0]?.timeLimit || 60);
                      
                      if (parsed.currentQuestionIndex > 0) {
                          setQuizState('taking'); 
                          setDraftRestored(true);
                          showToast(t('draft_restored_msg'), 'info');
                      } else {
                          setTimeLeft(fetchedQuiz.questions[0]?.timeLimit || 60);
                      }
                  } catch (e) {
                      setTimeLeft(fetchedQuiz.questions[0]?.timeLimit || 60);
                  }
              } else {
                  setTimeLeft(fetchedQuiz.questions[0]?.timeLimit || 60);
              }

          } else navigate('/applies');
        } catch (error) { navigate('/applies'); } 
        finally { setIsLoading(false); }
    }
    fetchQuiz();
  }, [quizId, navigate, user, showToast, t]);

  useEffect(() => {
      if (quizState === 'taking' && user && quiz) {
          const draftKey = `vixel_quiz_draft_${user.id}_${quiz.id}`;
          const draftData = {
              answers,
              currentQuestionIndex,
              timestamp: Date.now()
          };
          localStorage.setItem(draftKey, JSON.stringify(draftData));
      }
  }, [answers, currentQuestionIndex, quizState, user, quiz]);

  const clearDraft = useCallback(() => {
      if (user && quiz) {
          const draftKey = `vixel_quiz_draft_${user.id}_${quiz.id}`;
          localStorage.removeItem(draftKey);
          setDraftRestored(false);
      }
  }, [user, quiz]);

  const handleCaptchaVerify = useCallback((token: string) => { setHcaptchaToken(token); }, []);
  
  const handleSubmit = useCallback(async (finalAnswers: Answer[]) => {
    if (!quiz || !user || isSubmitting) return;
    if (!hcaptchaToken && !draftRestored) { showToast(t('complete_captcha_msg'), 'warning'); return; }
    
    setIsSubmitting(true);

    try {
      if (hcaptchaToken) {
          await verifyCaptcha(hcaptchaToken);
      }
      
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

      clearDraft();

      await logSubmissionAction(
          branding.siteName,
          user, 
          submission, 
          'NEW'
      );

      setQuizState('submitted');
      
    } catch (error) {
      showToast((error as Error).message, 'error');
      if ((window as any).hcaptcha) {
          try { (window as any).hcaptcha.reset(); } catch (resetErr) { console.error('HCaptcha reset error:', resetErr); }
      }
      setHcaptchaToken(null);
      setIsSubmitting(false);
    }
  }, [quiz, user, t, isSubmitting, cheatLog, hcaptchaToken, showToast, branding.siteName, draftRestored, clearDraft]);

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
      if (!hcaptchaToken) { showToast(t('complete_captcha_msg'), 'warning'); return; }
      setQuizState('taking');
  };

  if (isLoading || !quiz) return <div className="flex justify-center items-center h-screen"><Loader2 size={48} className="animate-spin" style={{ color: branding.primaryColor }} /></div>;

  return (
    <>
      <SEO title={`${branding.siteName} - ${t(quiz.titleKey)}`} noIndex={true} description={t(quiz.descriptionKey)} />
      <div className="container mx-auto px-6 py-24 flex justify-center items-center min-h-[calc(100vh-136px)]" dir={dir}>
        <div className="bg-white/[0.03] border border-white/10 p-8 md:p-12 w-full max-w-4xl rounded-[50px] relative overflow-hidden backdrop-blur-xl shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: branding.primaryColor }}></div>
            
            {quizState === 'rules' && (
                <div className="text-center animate-fade-in-up">
                    <h1 className="text-4xl font-black text-white mb-6 tracking-tight">{t(quiz.titleKey)}</h1>
                    
                    {answers.length > 0 && (
                        <div className="bg-blue-500/10 border border-blue-500/20 p-6 rounded-[32px] mb-8 flex items-center justify-center gap-4 text-blue-200">
                            <AlertCircle className="flex-shrink-0" />
                            <span className="font-bold">{t('draft_restore_notice', { count: currentQuestionIndex + 1 })}</span>
                        </div>
                    )}

                    <div className="bg-black/40 p-8 md:p-10 rounded-[40px] text-start mb-10 border border-white/5 shadow-inner">
                        <h2 className="text-2xl font-black mb-6 flex items-center gap-3" style={{ color: branding.primaryColor }}>
                          <Shield size={24} />
                          {t('quiz_rules')}
                        </h2>
                        <div className="whitespace-pre-wrap text-text-secondary leading-relaxed opacity-90">{t(quiz.instructionsKey)}</div>
                    </div>
                    <div className="flex justify-center mb-10 scale-110">
                        {env.VITE_HCAPTCHA_SITE_KEY ? <HCaptcha onVerify={handleCaptchaVerify} /> : <p className="text-red-400">Config Error</p>}
                    </div>
                    <button 
                      onClick={beginQuiz} 
                      disabled={!hcaptchaToken} 
                      className="px-12 py-5 rounded-2xl text-xl font-black text-brand-dark hover:scale-105 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed group"
                      style={{ backgroundColor: branding.primaryColor, boxShadow: hcaptchaToken ? `0 20px 40px -10px ${branding.primaryColor}44` : 'none' }}
                    >
                        {answers.length > 0 ? t('resume_application') : t('begin_quiz')}
                        <ChevronRight className={`inline ml-2 group-hover:translate-x-1 transition-transform ${dir === 'rtl' ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            )}

            {quizState === 'taking' && !isSubmitting && (
                 <div className={`transition-opacity duration-300 ${showQuestion ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="flex justify-between items-center mb-10">
                        <h2 className="text-3xl font-black text-white">{t('question')} {currentQuestionIndex + 1} <span className="text-text-secondary text-xl opacity-40 ml-2">/ {quiz.questions.length}</span></h2>
                        <CircularTimer timeLeft={timeLeft} timeLimit={quiz.questions[currentQuestionIndex].timeLimit} />
                    </div>
                    <div className="bg-black/30 p-8 rounded-[38px] mb-10 border-r-8" style={{ borderRightColor: branding.primaryColor }}>
                        <p className="text-2xl font-bold text-white leading-relaxed">{t(quiz.questions[currentQuestionIndex].textKey)}</p>
                    </div>
                    <textarea 
                      value={currentAnswer} 
                      onChange={(e) => setCurrentAnswer(e.target.value)} 
                      className="w-full bg-white/5 border-2 border-white/10 rounded-[40px] p-8 text-xl text-white focus:outline-none transition-all placeholder:text-white/20 min-h-[300px]" 
                      style={{ focusBorderColor: branding.primaryColor }}
                      placeholder={t('answer_placeholder')} 
                      autoFocus 
                    />
                    <div className="mt-12 flex justify-end">
                        <button 
                          onClick={handleNextQuestion} 
                          disabled={!currentAnswer.trim()} 
                          className="px-10 py-5 rounded-2xl text-lg font-black text-brand-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 shadow-xl"
                          style={{ backgroundColor: branding.primaryColor, boxShadow: currentAnswer.trim() ? `0 20px 40px -10px ${branding.primaryColor}44` : 'none' }}
                        >
                             {currentQuestionIndex < quiz.questions.length - 1 ? t('next_question') : t('submit_application')}
                        </button>
                    </div>
                 </div>
            )}

            {isSubmitting && (
                <div className="text-center py-24 animate-fade-in-up">
                    <Loader2 size={80} className="animate-spin mx-auto mb-8 opacity-20" style={{ color: branding.primaryColor }} />
                    <h2 className="text-3xl font-black text-white tracking-tight">{t('submitting_msg')}</h2>
                    <p className="text-text-secondary mt-2">{t('please_wait')}</p>
                </div>
            )}

            {quizState === 'submitted' && (
                <div className="text-center animate-fade-in-up py-16">
                    <div className="w-24 h-24 bg-green-500/10 rounded-[32px] flex items-center justify-center mx-auto mb-8 border-2 border-green-500/20 shadow-2xl">
                        <CheckCircle size={60} className="text-green-400" />
                    </div>
                    <h1 className="text-5xl font-black text-white mb-6 tracking-tighter">{t('application_submitted')}</h1>
                    <p className="text-xl text-text-secondary mb-12 max-w-lg mx-auto opacity-80 leading-relaxed font-medium">{t('application_submitted_desc')}</p>
                    <button 
                      onClick={() => navigate('/my-applications')} 
                      className="px-10 py-5 rounded-2xl text-xl font-black hover:bg-white transition-all duration-300 shadow-xl border border-white/10 text-brand-dark"
                      style={{ backgroundColor: branding.primaryColor }}
                    >
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
