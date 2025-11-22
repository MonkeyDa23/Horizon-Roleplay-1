
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLocalization } from '../contexts/LocalizationContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getQuizById, addSubmission, verifyCaptcha, sendDiscordLog } from '../lib/api';
import type { Quiz, Answer, CheatAttempt } from '../types';
import { CheckCircle, Loader2, AlertTriangle, Clock } from 'lucide-react';
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
        } catch (e) {}
        return () => { widgetIdRef.current = null; };
    }, [onVerify]);
    return <div ref={captchaRef} className="min-h-[78px] flex justify-center"></div>;
});

const CircularTimer: React.FC<{ timeLeft: number; timeLimit: number }> = ({ timeLeft, timeLimit }) => {
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const progress = Math.max(0, (timeLeft / timeLimit) * circumference);
    const isCritical = timeLeft <= 10;
    const strokeColor = isCritical ? '#ef4444' : '#00f2ea';
    
    return (
        <div className="relative w-24 h-24 flex-shrink-0 drop-shadow-lg">
            <svg className="w-full h-full rotate-[-90deg]" viewBox="0 0 80 80">
                {/* Background Circle */}
                <circle cx="40" cy="40" r={radius} stroke="rgba(255,255,255,0.1)" strokeWidth="6" fill="transparent" />
                {/* Progress Circle */}
                <circle 
                    cx="40" cy="40" r={radius} 
                    stroke={strokeColor} 
                    strokeWidth="6" 
                    fill="transparent" 
                    strokeDasharray={circumference} 
                    strokeDashoffset={circumference - progress} 
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease' }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-bold tabular-nums transition-colors ${isCritical ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                    {timeLeft}
                </span>
                <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Sec</span>
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

  // Refs to access current state in event listeners without triggering re-renders
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentQuestionIndexRef = useRef(currentQuestionIndex);

  useEffect(() => {
      currentQuestionIndexRef.current = currentQuestionIndex;
  }, [currentQuestionIndex]);

  useEffect(() => {
    if (!user || !quizId) { navigate('/applies'); return; }
    const fetchQuiz = async () => {
        setIsLoading(true);
        try {
          const fetchedQuiz = await getQuizById(quizId);
          if (fetchedQuiz && fetchedQuiz.isOpen) {
              setQuiz(fetchedQuiz);
          } else navigate('/applies');
        } catch (error) { navigate('/applies'); } 
        finally { setIsLoading(false); }
    }
    fetchQuiz();
  }, [quizId, navigate, user]);

  const handleCaptchaVerify = useCallback((token: string) => { setHcaptchaToken(token); }, []);
  
  const handleSubmit = useCallback(async (finalAnswers: Answer[]) => {
    if (!quiz || !user || isSubmitting) return;
    if (!hcaptchaToken) { showToast('الرجاء إكمال اختبار التحقق.', 'warning'); return; }
    
    setIsSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      await verifyCaptcha(hcaptchaToken);
      
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

      const hasCheated = cheatLog.length > 0;
      const adminLink = `${window.location.origin}/admin/submissions/${submission.id}`;
      const roleName = user.highestRole?.name || 'عضو';
      
      const adminEmbed = {
        title: "📝 تقديم جديد وصل!",
        description: `قام **${user.username}** بإرسال تقديم جديد.`,
        color: hasCheated ? 0xEF4444 : 0x3B82F6, 
        thumbnail: { url: user.avatar },
        fields: [
            { name: "👤 الاسم", value: user.username, inline: true },
            { name: "🔰 الرتبة", value: roleName, inline: true },
            { name: "📄 التقديم", value: t(quiz.titleKey), inline: true },
            { name: "⚠️ حالة الغش", value: hasCheated ? `**مشبوه (${cheatLog.length})**` : "نظيف", inline: true },
            { name: "🔗 الرابط", value: `[**عرض التقديم في لوحة التحكم**](${adminLink})` }
        ],
        timestamp: new Date().toISOString(),
        footer: { text: "نظام التقديمات الذكي" }
      };
      sendDiscordLog(config, adminEmbed, 'submission');

      const userReceiptEmbed = {
          title: `✅ تم استلام تقديمك بنجاح`,
          description: `تم استلام طلبك وهو الآن قيد الانتظار للمراجعة.`,
          color: 0x22C55E,
          thumbnail: { url: user.avatar },
          fields: [
              { name: "👤 الاسم", value: user.username, inline: true },
              { name: "📄 التقديم", value: t(quiz.titleKey), inline: true },
              { name: "📅 التاريخ", value: new Date().toLocaleDateString('en-GB'), inline: true }
          ],
          timestamp: new Date().toISOString(),
          footer: { text: config.COMMUNITY_NAME }
      };
      sendDiscordLog(config, userReceiptEmbed, 'dm', user.discordId);

      setQuizState('submitted');
      
    } catch (error) {
      showToast((error as Error).message, 'error');
      if ((window as any).hcaptcha) try { (window as any).hcaptcha.reset(); } catch (e) {}
      setHcaptchaToken(null);
      setIsSubmitting(false);
    }
  }, [quiz, user, t, isSubmitting, cheatLog, hcaptchaToken, showToast, config]);

  const handleNextQuestion = useCallback((isTimeout: boolean = false) => {
    if (!quiz) return;
    setShowQuestion(false);
    
    if (timerRef.current) clearInterval(timerRef.current);

    // --- STRICT TIMEOUT LOGIC ---
    // If timeout, we MUST save whatever is in currentAnswer (even if partial).
    // We flag it as timeout.
    const finalAnswerText = currentAnswer.trim() || (isTimeout ? t('answer_timeout') : "");
    const isFlaggedTimeout = isTimeout && !finalAnswerText.includes(t('answer_timeout')); // Only flag as partial timeout if they actually wrote something

    const newAnswers = [...answers, {
        questionId: quiz.questions[currentQuestionIndex].id,
        questionText: t(quiz.questions[currentQuestionIndex].textKey),
        answer: finalAnswerText,
        timeTaken: quiz.questions[currentQuestionIndex].timeLimit - (isTimeout ? 0 : timeLeft),
        isTimeout: isTimeout
    }];
    
    setAnswers(newAnswers);
    setCurrentAnswer('');

    setTimeout(() => {
        if (currentQuestionIndex < quiz.questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            const nextTime = quiz.questions[currentQuestionIndex + 1].timeLimit;
            setTimeLeft(nextTime);
            setShowQuestion(true);
            
            timerRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        if (timerRef.current) clearInterval(timerRef.current);
                        return 0; 
                    }
                    return prev - 1;
                });
            }, 1000);

        } else {
            handleSubmit(newAnswers);
        }
    }, 400);
  }, [quiz, currentQuestionIndex, timeLeft, answers, currentAnswer, t, handleSubmit]);

  useEffect(() => {
      if (quizState === 'taking' && timeLeft === 0) {
          handleNextQuestion(true);
      }
  }, [timeLeft, quizState, handleNextQuestion]);

  useEffect(() => {
      if (quizState === 'taking' && quiz && currentQuestionIndex === 0 && !timerRef.current) {
          setTimeLeft(quiz.questions[0].timeLimit);
          timerRef.current = setInterval(() => {
              setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
          }, 1000);
      }
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [quizState, quiz]);

  // --- ADVANCED ANTI-CHEAT ---
  useEffect(() => {
    if (quizState !== 'taking') return;

    const logCheat = (methodKey: string) => {
        const timestamp = new Date().toISOString();
        const currentQ = currentQuestionIndexRef.current + 1;
        const details = t('during_question', { num: currentQ });

        setCheatLog(prev => {
            // Rate limit log to prevent spamming same event
            const lastLog = prev[prev.length - 1];
            if (lastLog && lastLog.method === t(methodKey) && (new Date().getTime() - new Date(lastLog.timestamp).getTime() < 2000)) {
                return prev;
            }
            return [...prev, { method: t(methodKey), timestamp, details }];
        });
    };

    const handleVisibilityChange = () => {
        if (document.hidden) logCheat('cheat_method_switched_tab');
    };

    const handleBlur = () => {
        logCheat('cheat_method_blur');
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);

    return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("blur", handleBlur);
    };
  }, [quizState, t]);

  const beginQuiz = () => {
      if (!hcaptchaToken) { showToast('الرجاء إكمال اختبار التحقق أولاً.', 'warning'); return; }
      setQuizState('taking');
  };

  if (isLoading || !quiz) return <div className="flex justify-center items-center h-screen"><Loader2 size={48} className="text-brand-cyan animate-spin" /></div>;

  return (
    <>
      <SEO title={`${config.COMMUNITY_NAME} - ${t(quiz.titleKey)}`} noIndex={true} description={t(quiz.descriptionKey)} />
      <div className="container mx-auto px-6 py-16 flex justify-center items-center min-h-[calc(100vh-136px)]">
        <div className="glass-panel p-8 md:p-12 w-full max-w-4xl relative overflow-hidden">
            
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-cyan to-transparent opacity-50"></div>

            {quizState === 'rules' && (
                <div className="text-center animate-fade-in-up">
                    <h1 className="text-4xl font-bold text-white mb-4">{t(quiz.titleKey)}</h1>
                    <div className="bg-brand-dark p-6 rounded-lg text-start mb-8 border border-brand-light-blue/50 relative">
                        <div className="absolute -top-3 left-6 bg-brand-dark px-2 text-brand-cyan font-bold text-sm flex items-center gap-2 border border-brand-cyan/30 rounded">
                            <AlertTriangle size={14} /> {t('quiz_rules')}
                        </div>
                        <div className="whitespace-pre-wrap text-gray-300 leading-relaxed pt-2">{t(quiz.instructionsKey)}</div>
                    </div>
                    <div className="flex justify-center mb-8">
                        {env.VITE_HCAPTCHA_SITE_KEY ? <HCaptcha onVerify={handleCaptchaVerify} /> : <p className="text-red-400">Config Error: Missing Captcha Key</p>}
                    </div>
                    <button onClick={beginQuiz} disabled={!hcaptchaToken} className="bg-gradient-to-r from-primary-blue to-accent-cyan text-background-dark font-bold py-4 px-10 rounded-xl text-xl shadow-glow-blue hover:opacity-90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 w-full sm:w-auto">
                        {t('begin_quiz')}
                    </button>
                </div>
            )}

            {quizState === 'taking' && !isSubmitting && (
                 <div className={`transition-all duration-500 ease-out ${showQuestion ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <h2 className="text-xl text-gray-400 font-medium mb-1">{t('question')} {currentQuestionIndex + 1} {t('of')} {quiz.questions.length}</h2>
                            <div className="w-48 h-2 bg-brand-dark rounded-full overflow-hidden">
                                <div className="h-full bg-brand-cyan transition-all duration-500" style={{ width: `${((currentQuestionIndex + 1) / quiz.questions.length) * 100}%` }}></div>
                            </div>
                        </div>
                        <CircularTimer timeLeft={timeLeft} timeLimit={quiz.questions[currentQuestionIndex].timeLimit} />
                    </div>
                    
                    <div className="bg-brand-dark/50 p-6 rounded-xl mb-8 border-l-4 border-brand-cyan shadow-inner">
                        <p className="text-2xl text-white font-semibold leading-relaxed">{t(quiz.questions[currentQuestionIndex].textKey)}</p>
                    </div>
                    
                    <div className="relative">
                        <textarea 
                            value={currentAnswer} 
                            onChange={(e) => setCurrentAnswer(e.target.value)} 
                            className="vixel-input text-lg h-48 focus:ring-2 focus:ring-brand-cyan bg-brand-dark/80 border-gray-700" 
                            placeholder="اكتب إجابتك هنا بوضوح..." 
                            autoFocus 
                        />
                        <div className="absolute bottom-4 left-4 text-xs text-gray-500">
                            {currentAnswer.length} chars
                        </div>
                    </div>

                    <div className="mt-8 text-end">
                        <button onClick={() => handleNextQuestion(false)} disabled={!currentAnswer.trim()} className="bg-gradient-to-r from-primary-blue to-accent-cyan text-background-dark font-bold py-3 px-10 rounded-lg text-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-glow-cyan">
                             {currentQuestionIndex < quiz.questions.length - 1 ? t('next_question') : t('submit_application')}
                        </button>
                    </div>
                 </div>
            )}

            {isSubmitting && (
                <div className="text-center py-20 animate-fade-in-up">
                    <div className="relative inline-block mb-6">
                        <div className="absolute inset-0 bg-brand-cyan blur-xl opacity-20 rounded-full"></div>
                        <Loader2 size={80} className="text-brand-cyan animate-spin relative z-10" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">جاري إرسال التقديم...</h2>
                    <p className="text-gray-400">يرجى الانتظار، نقوم بمعالجة إجاباتك.</p>
                </div>
            )}

            {quizState === 'submitted' && (
                <div className="text-center animate-fade-in-up py-6">
                    <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-green-500/50 shadow-lg shadow-green-500/20">
                        <CheckCircle size={60} className="text-green-400" />
                    </div>
                    <h1 className="text-4xl font-bold text-white mb-4">{t('application_submitted')}</h1>
                    <p className="text-lg text-text-secondary mb-10 max-w-lg mx-auto">{t('application_submitted_desc')}</p>
                    
                    {/* Cheat Warning for User */}
                    {cheatLog.length > 0 && (
                        <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-lg mb-8 max-w-md mx-auto text-left">
                            <h3 className="text-red-400 font-bold flex items-center gap-2 mb-2">
                                <AlertTriangle size={20} />
                                {t('cheat_user_warning_title')}
                            </h3>
                            <p className="text-sm text-red-200">
                                {t('cheat_user_warning_msg', { count: cheatLog.length })}
                            </p>
                        </div>
                    )}

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
