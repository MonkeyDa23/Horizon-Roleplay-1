


import React, { useState, useEffect, useCallback } from 'react';
// FIX: Fix "no exported member" errors from 'react-router-dom' by switching to a namespace import.
import * as ReactRouterDOM from 'react-router-dom';
import { useLocalization } from '../hooks/useLocalization';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { getQuizById, addSubmission } from '../lib/api';
import type { Quiz, Answer, CheatAttempt } from '../types';
import { CheckCircle, Loader2, ListChecks } from 'lucide-react';
import { useConfig } from '../hooks/useConfig';
import SEO from '../components/SEO';

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
  const { quizId } = ReactRouterDOM.useParams<{ quizId: string }>();
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
    if (!quiz || !user || isSubmitting) return;
    setIsSubmitting(true);
    setFinalCheatLog(cheatLog);
    const submission = { 
        quizId: quiz.id, 
        quizTitle: t(quiz.titleKey), 
        user_id: user.id, 
        username: user.username, 
        answers: finalAnswers, 
        submittedAt: new Date().toISOString(), 
        cheatAttempts: cheatLog,
        user_highest_role: user.highestRole?.name ?? t('member')
    };
    try {
      await addSubmission(submission);
      setQuizState('submitted');
    } catch (error) {
      console.error("Failed to submit application:", error);
      // FIX: Guard against window access for browser-specific 'alert'.
      if (typeof window !== 'undefined') {
        (window as any).alert("An error occurred while submitting your application. Please try again.");
      }
      setIsSubmitting(false);
    }
  }, [quiz, user, t, isSubmitting, cheatLog]);

  const handleNextQuestion = useCallback(() => {
    if (!quiz) return;
    
    setShowQuestion(false);

    setTimeout(() => {
        const currentQuestion = quiz.questions[currentQuestionIndex];
        // FIX: Add missing 'timeTaken' property to the answer object.
        const timeTaken = currentQuestion.timeLimit - timeLeft;
        const newAnswers = [...answers, { questionId: currentQuestion.id, questionText: t(currentQuestion.textKey), answer: currentAnswer || 'No answer (time out)', timeTaken }];
        setAnswers(newAnswers);
        setCurrentAnswer('');

        if (currentQuestionIndex < quiz.questions.length - 1) {
            const nextQuestionIndex = currentQuestionIndex + 1;
            setCurrentQuestionIndex(nextQuestionIndex);
            setTimeLeft(quiz.questions[nextQuestionIndex].timeLimit);
            setShowQuestion(true);
        } else {
            handleSubmit(newAnswers);
        }
    }, 500);
  }, [quiz, currentQuestionIndex, answers, currentAnswer, t, handleSubmit, timeLeft]);
  
  useEffect(() => {
    if (quizState !== 'taking' || !quiz) return;
    if (timeLeft <= 0) {
      handleNextQuestion();
      return;
    }
    const timerId = setInterval(() => setTimeLeft(prevTime => prevTime - 1), 1000);
    return () => clearInterval(timerId);
  }, [timeLeft, quizState, quiz, handleNextQuestion]);
  
  useEffect(() => {
    // FIX: Guard against document access in non-browser environments.
    if (quizState !== 'taking' || typeof document === 'undefined') return;

    const handleCheat = (method: string) => {
        setCheatLog(prev => [...prev, { method, timestamp: new Date().toISOString() }]);
        showToast(t('cheat_attempt_detected'), 'error');
        
        setAnswers([]);
        setCurrentAnswer('');
        setCurrentQuestionIndex(0);
        setQuizState('rules');
        if (quiz) {
            setTimeLeft(quiz.questions[0].timeLimit);
        }
    };

    const handleVisibilityChange = () => {
        // FIX: Guard against document access in non-browser environments.
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
            handleCheat(t('cheat_method_switched_tab'));
        }
    };

    // FIX: Guard against document access in non-browser environments.
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
        // FIX: Guard against document access in non-browser environments.
        if (typeof document !== 'undefined') {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
        }
    };
  }, [quizState, quiz, showToast, t]);
  
  const pageTitle = quiz ? t(quiz.titleKey) : t('applies');

  if (isLoading) {
    return ( <div className="container mx-auto px-6 py-16 flex justify-center items-center h-96"> <Loader2 size={48} className="text-brand-cyan animate-spin" /> </div> );
  }

  if (!quiz) return null;
  
  if (quizState === 'submitted') {
    return (
      <>
        <SEO 
          title={`${communityName} - ${t('application_submitted')}`}
          description="Application submitted successfully."
          noIndex={true}
        />
        <div className="container mx-auto px-6 py-16 text-center animate-slide-up">
          <CheckCircle className="mx-auto text-green-400" size={80} />
          <h1 className="text-4xl font-bold mt-6 mb-4">{t('application_submitted')}</h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">{t('application_submitted_desc')}</p>
          
          <div className="max-w-md mx-auto bg-brand-dark-blue border border-brand-light-blue/50 rounded-lg p-6 text-left mt-10">
              <h3 className="text-xl font-bold text-brand-cyan mb-4 flex items-center gap-3"><ListChecks /> {t('cheat_attempts_report')}</h3>
              {finalCheatLog.length > 0 ? (
                  <>
                      <p className="text-gray-300 mb-4">{t('cheat_attempts_count', { count: finalCheatLog.length })}</p>
                      <ul className="space-y-2 text-sm max-h-40 overflow-y-auto">
                          {finalCheatLog.map((attempt, index) => (
                              <li key={index} className="bg-brand-dark p-2 rounded-md">
                                  <span className="font-semibold text-red-400">{attempt.method}</span>
                                  <span className="text-gray-400 text-xs ml-2">({new Date(attempt.timestamp).toLocaleString()})</span>
                              </li>
                          ))}
                      </ul>
                  </>
              ) : (
                  <p className="text-green-300">{t('no_cheat_attempts')}</p>
              )}
          </div>

          <button onClick={() => navigate('/my-applications')} className="mt-10 px-8 py-3 bg-brand-cyan text-brand-dark font-bold rounded-lg hover:bg-white transition-colors">
              {t('view_my_applications')}
          </button>
        </div>
      </>
    )
  }

  if (quizState === 'rules') {
    return (
      <>
        <SEO 
          title={`${communityName} - ${pageTitle}`}
          description={`Application form for ${pageTitle}. Please read the instructions carefully before starting.`}
          noIndex={true}
        />
        <div className="container mx-auto px-6 py-16">
          <div className="max-w-3xl mx-auto bg-brand-dark-blue border border-brand-light-blue/50 rounded-lg animate-slide-up overflow-hidden">
            {quiz.bannerUrl && (
              <div className="relative h-48 bg-cover bg-center" style={{ backgroundImage: `url(${quiz.bannerUrl})` }}>
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-4">
                  {quiz.logoUrl && (
                    <img src={quiz.logoUrl} alt="Quiz Logo" className="max-h-24 object-contain" />
                  )}
                </div>
              </div>
            )}
            <div className="p-8 text-center">
                <h1 className="text-3xl font-bold text-brand-cyan mb-4">{t('quiz_rules')}</h1>
                <h2 className="text-2xl font-semibold mb-6">{t(quiz.titleKey)}</h2>
                <p className="text-gray-300 mb-8 whitespace-pre-line">{t(quiz.descriptionKey)}</p>
                <button onClick={() => setQuizState('taking')} className="px-10 py-4 bg-brand-cyan text-brand-dark font-bold text-lg rounded-lg shadow-glow-cyan hover:bg-white hover:scale-105 transform transition-all">
                  {t('begin_quiz')}
                </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / quiz.questions.length) * 100;
  
  return (
    <>
      <SEO 
        title={`${communityName} - ${pageTitle}`}
        description={`Application form for ${pageTitle}. Please read the instructions carefully before starting.`}
        noIndex={true}
      />
      <div className="container mx-auto px-6 py-16">
        <div className="max-w-3xl mx-auto bg-brand-dark-blue border border-brand-light-blue/50 rounded-lg p-8">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2 text-gray-300">
              <span>{t('question')} {currentQuestionIndex + 1} {t('of')} {quiz.questions.length}</span>
              <CircularTimer timeLeft={timeLeft} timeLimit={currentQuestion.timeLimit} />
            </div>
            <div className="w-full bg-brand-light-blue rounded-full h-2.5">
              <div className="bg-brand-cyan h-2.5 rounded-full" style={{ width: `${progress}%`, transition: 'width 0.5s ease-in-out' }}></div>
            </div>
          </div>
          
          <div className="min-h-[280px]">
            {showQuestion && (
              <div className="animate-question-fade-in">
                <h2 className="text-2xl md:text-3xl font-semibold mb-6 text-white">{t(currentQuestion.textKey)}</h2>
                <textarea
                  value={currentAnswer}
                  // FIX: Explicitly cast e.currentTarget to HTMLTextAreaElement to resolve type error on 'value' property.
                  onChange={(e) => setCurrentAnswer((e.currentTarget as HTMLTextAreaElement).value)}
                  className="w-full bg-brand-light-blue text-white p-4 rounded-md border border-gray-600 focus:ring-2 focus:ring-brand-cyan focus:border-brand-cyan transition-colors"
                  rows={6}
                  placeholder="Type your answer here..."
                />
              </div>
            )}
          </div>
          
          <button 
            onClick={handleNextQuestion}
            disabled={!showQuestion || (isSubmitting && currentQuestionIndex === quiz.questions.length - 1)}
            className="mt-8 w-full bg-brand-cyan text-brand-dark font-bold py-4 rounded-lg shadow-glow-cyan hover:bg-white transition-all text-lg flex justify-center items-center disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting && currentQuestionIndex === quiz.questions.length - 1 ? (
              <Loader2 size={28} className="animate-spin" />
            ) : currentQuestionIndex < quiz.questions.length - 1 ? (
              t('next_question')
            ) : (
              t('submit_application')
            )}
          </button>
        </div>
        <style>{`
          @keyframes slide-up { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
          .animate-slide-up { animation: slide-up 0.8s ease-out forwards; }
          @keyframes question-fade-in { from { opacity: 0; } to { opacity: 1; } }
          .animate-question-fade-in { animation: question-fade-in 0.5s ease-out forwards; }
        `}</style>
      </div>
    </>
  );
};

export default QuizPage;