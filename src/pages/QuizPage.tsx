/**
 * Nova Roleplay - Official Website
 * Quiz (Application) Page
 */
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
    return () => {
      widgetIdRef.current = null;
    };
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
    <div className="relative w-24 h-24 flex-shrink-0">
      <svg className="w-full h-full" viewBox="0 0 70 70">
        <circle className="text-white/5" strokeWidth="6" stroke="currentColor" fill="transparent" r={radius} cx="35" cy="35" />
        <circle 
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          stroke={strokeColor}
          fill="transparent"
          r={radius}
          cx="35"
          cy="35"
          style={{ 
            transform: 'rotate(-90deg)', 
            transformOrigin: 'center', 
            transition: 'stroke-dashoffset 0.5s linear, stroke 0.5s linear' 
          }}
        />
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
    if (!user || !quizId) {
      navigate('/applies');
      return;
    }

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
        } else {
          navigate('/applies');
        }
      } catch (error) {
        navigate('/applies');
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuiz();
  }, [quizId, navigate, user, showToast, t]);

  useEffect(() => {
    if (quizState === 'taking' && user && quiz) {
      const draftKey = `vixel_quiz_draft_${user.id}_${quiz.id}`;
      const draftData = { answers, currentQuestionIndex, timestamp: Date.now() };
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

  const handleCaptchaVerify = useCallback((token: string) => {
    setHcaptchaToken(token);
  }, []);

  const handleSubmit = useCallback(async (finalAnswers: Answer[]) => {
    if (!quiz || !user || isSubmitting) return;

    // CAPTCHA is MANDATORY for all submissions to prevent spam/bypasses
    if (!hcaptchaToken) {
      showToast(t('complete_captcha_msg'), 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      await verifyCaptcha(hcaptchaToken);
      
      const submission = await addSubmission({
        quizId: quiz.id,
        quizTitle: t(quiz.titleKey) || quiz.id,
        user_id: user.id,
        username: user.username,
        answers: finalAnswers,
        submittedAt: new Date().toISOString(),
        cheatAttempts: cheatLog,
        user_highest_role: user.highestRole?.name ?? t('member'),
        discord_id: user.discordId
      });

      clearDraft();
      await logSubmissionAction(branding.siteName, user, submission, 'NEW');
      setQuizState('submitted');
    } catch (error) {
      showToast((error as Error).message, 'error');
      if ((window as any).hcaptcha) {
        try { 
          (window as any).hcaptcha.reset(); 
        } catch (e) {
          console.error('HCaptcha reset error:', e);
        }
      }
      setHcaptchaToken(null);
      setIsSubmitting(false);
    }
  }, [quiz, user, t, isSubmitting, cheatLog, hcaptchaToken, showToast, branding.siteName, clearDraft]);

  const handleNextQuestion = useCallback(() => {
    if (!quiz) return;
    
    setShowQuestion(false);
    const newAnswers = [...answers, {
      questionId: quiz.questions[currentQuestionIndex].id,
      questionText: t(quiz.questions[currentQuestionIndex].textKey) || quiz.questions[currentQuestionIndex].textKey,
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
    if (timeLeft <= 0) {
      handleNextQuestion();
      return;
    }
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
    if (!hcaptchaToken) {
      showToast(t('complete_captcha_msg'), 'warning');
      return;
    }
    setQuizState('taking');
  };

  if (isLoading || !quiz) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 size={64} className="animate-spin opacity-20" style={{ color: branding.primaryColor }} />
      </div>
    );
  }

  return (
    <>
      <SEO 
        title={`${branding.siteName} - ${t(quiz.titleKey) || 'التقديم'}`} 
        noIndex={true} 
        description={t(quiz.descriptionKey)} 
      />

      <div className="container mx-auto px-6 py-24 flex justify-center items-center min-h-[calc(100vh-136px)]" dir={dir}>
        <div className="glass-panel p-8 md:p-16 w-full max-w-5xl relative overflow-hidden backdrop-blur-3xl shadow-2xl border-white/10 rounded-[60px]">
          <div className="absolute top-0 left-0 w-full h-2" style={{ backgroundColor: branding.primaryColor }}></div>
          
          {quizState === 'rules' && (
            <div className="text-center animate-fade-in-up space-y-10">
              <h1 className="text-4xl md:text-6xl font-black text-white">{t(quiz.titleKey) || quiz.id}</h1>
              
              {answers.length > 0 && (
                <div className="bg-blue-500/10 border border-blue-500/20 p-8 rounded-[38px] flex items-center justify-center gap-6 text-blue-200">
                  <AlertCircle className="flex-shrink-0" size={32} />
                  <span className="font-bold text-lg">لديك مسودة محفوظة لهذه الأسئلة. يمكنك إكمالها الآن.</span>
                </div>
              )}

              <div className="bg-black/30 p-10 md:p-14 rounded-[50px] text-start border border-white/5 shadow-inner">
                <h2 className="text-3xl font-black text-white flex items-center gap-4 mb-8">
                  <Shield size={32} style={{ color: branding.primaryColor }} />
                  تحذيرات وقوانين التقديم
                </h2>
                <div className="whitespace-pre-wrap text-text-secondary text-xl leading-relaxed opacity-90 border-r-2 pr-8" style={{ borderColor: branding.primaryColor }}>
                  {t(quiz.instructionsKey) || 'يرجى قراءة الأسئلة بعناية والإجابة عليها بصدق. سيتم مراقبة أي محاولة غش.'}
                </div>
              </div>

              <div className="flex flex-col items-center gap-10">
                <div className="scale-125">
                  {env.VITE_HCAPTCHA_SITE_KEY ? (
                    <HCaptcha onVerify={handleCaptchaVerify} />
                  ) : (
                    <p className="text-red-400 font-bold">تنبيه: خدمة التحقق لم يتم تفعيلها بشكل صحيح.</p>
                  )}
                </div>

                <button 
                  onClick={beginQuiz} 
                  disabled={!hcaptchaToken}
                  className="px-16 py-6 rounded-3xl text-2xl font-black transition-all shadow-2xl disabled:opacity-30 disabled:grayscale group flex items-center gap-4"
                  style={{ backgroundColor: branding.primaryColor, color: '#000' }}
                >
                  {answers.length > 0 ? t('resume_application') : t('begin_quiz')}
                  <ChevronRight className={`group-hover:translate-x-2 transition-transform ${dir === 'rtl' ? 'rotate-180 group-hover:-translate-x-2' : ''}`} />
                </button>
              </div>
            </div>
          )}

          {quizState === 'taking' && !isSubmitting && (
            <div className={`transition-opacity duration-300 ${showQuestion ? 'opacity-100' : 'opacity-0'} space-y-12`}>
              <div className="flex justify-between items-center bg-white/5 p-8 rounded-[40px] border border-white/5">
                <h2 className="text-3xl md:text-4xl font-black text-white">
                  السؤال <span style={{ color: branding.primaryColor }}>{currentQuestionIndex + 1}</span>
                  <span className="text-text-secondary text-2xl opacity-40 ml-4">من {quiz.questions.length}</span>
                </h2>
                <CircularTimer timeLeft={timeLeft} timeLimit={quiz.questions[currentQuestionIndex].timeLimit} />
              </div>

              <div className="space-y-4">
                <p className="text-2xl font-bold text-white/60 uppercase tracking-widest">{t('question')}</p>
                <div className="bg-black/20 p-10 rounded-[48px] border-r-8 shadow-inner" style={{ borderRightColor: branding.primaryColor }}>
                  <p className="text-2xl md:text-4xl font-black text-white leading-relaxed">{t(quiz.questions[currentQuestionIndex].textKey) || quiz.questions[currentQuestionIndex].textKey}</p>
                </div>
              </div>

              <div className="space-y-6">
                <p className="text-2xl font-bold text-white/60 uppercase tracking-widest">{t('answers')}</p>
                <textarea 
                  value={currentAnswer} 
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  className="w-full bg-white/5 border-2 border-white/10 rounded-[40px] p-10 text-2xl text-white focus:outline-none transition-all placeholder:text-white/10 min-h-[350px] shadow-inner focus:border-white/20"
                  placeholder={t('answer_placeholder') || 'اكتب إجابتك هنا بوضوح...'}
                  autoFocus
                />
              </div>

              <div className="pt-8 flex justify-end">
                <button 
                  onClick={handleNextQuestion} 
                  disabled={!currentAnswer.trim()}
                  className="px-14 py-6 rounded-3xl text-2xl font-black transition-all disabled:opacity-20 disabled:grayscale shadow-2xl"
                  style={{ backgroundColor: branding.primaryColor, color: '#000' }}
                >
                  {currentQuestionIndex < quiz.questions.length - 1 ? t('next_question') : t('submit_application')}
                </button>
              </div>
            </div>
          )}

          {isSubmitting && (
            <div className="text-center py-32 animate-fade-in-up space-y-10">
              <Loader2 size={100} className="animate-spin mx-auto opacity-10" style={{ color: branding.primaryColor }} />
              <h2 className="text-4xl font-black text-white">{t('submitting_msg') || 'جاري إرسال طلبك...'}</h2>
              <p className="text-text-secondary text-xl font-medium">{t('please_wait') || 'يرجى عدم إغلاق الصفحة.'}</p>
            </div>
          )}

          {quizState === 'submitted' && (
            <div className="text-center animate-fade-in-up py-20 space-y-10">
              <div className="w-32 h-32 bg-green-500/10 rounded-[48px] flex items-center justify-center mx-auto border-2 border-green-500/20 shadow-2xl">
                <CheckCircle size={80} className="text-green-400" />
              </div>
              <div className="space-y-4">
                <h1 className="text-5xl md:text-7xl font-black text-white">{t('application_submitted')}</h1>
                <p className="text-2xl text-text-secondary max-w-2xl mx-auto font-medium leading-relaxed">
                  {t('application_submitted_desc') || 'لقد استلمنا طلبك بنجاح! سيتم مراجعته من قبل الفريق المختص والرد عليك قريباً.'}
                </p>
              </div>
              <button 
                onClick={() => navigate('/my-applications')}
                className="px-12 py-6 rounded-3xl text-2xl font-black transition-all hover:scale-105 shadow-2xl bg-white text-brand-dark"
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
