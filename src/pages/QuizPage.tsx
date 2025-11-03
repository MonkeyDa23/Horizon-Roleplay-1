// src/pages/QuizPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLocalization } from '../hooks/useLocalization';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { getQuizById, addSubmission } from '../lib/api';
import type { Quiz, Answer, CheatAttempt } from '../types';
import { CheckCircle, Clock, Loader2, ListChecks } from 'lucide-react';

const QuizPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { t } = useLocalization();
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [quizState, setQuizState] = useState<'rules' | 'taking' | 'submitted'>('rules');
  const [cheatLog, setCheatLog] = useState<CheatAttempt[]>([]);

  useEffect(() => {
    if (!user) {
      navigate('/applies');
      return;
    }
    if (!quizId) {
        navigate('/applies');
        return;
    }

    const fetchQuiz = async () => {
        setIsLoading(true);
        try {
          const fetchedQuiz = await getQuizById(quizId);
          if (fetchedQuiz && fetchedQuiz.isOpen && fetchedQuiz.questions && fetchedQuiz.questions.length > 0) {
              setQuiz(fetchedQuiz);
              setTimeLeft(fetchedQuiz.questions[0].timeLimit);
              setQuizState('rules');
          } else {
              navigate('/applies');
          }
        } catch (error) {
            console.error(`Failed to fetch quiz ${quizId}`, error);
            navigate('/applies');
        } finally {
            setIsLoading(false);
        }
    }
    
    fetchQuiz();
  }, [quizId, navigate, user]);
  
  const handleSubmit = useCallback(async (finalAnswers: Answer[]) => {
    if (!quiz || !user || isSubmitting) return;

    setIsSubmitting(true);
    const submission = {
        quizId: quiz.id,
        quizTitle: t(quiz.titleKey),
        user_id: user.id,
        username: user.username,
        answers: finalAnswers,
        submittedAt: new Date().toISOString(),
        cheatAttempts: cheatLog,
        user_highest_role: user.highestRole?.name || 'Member'
    };
    
    try {
      await addSubmission(submission);
      setQuizState('submitted');
    } catch (error) {
      console.error("Submission failed:", error);
      console.error("Detailed error object:", JSON.stringify(error, null, 2));
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      showToast(`Submission Error: ${errorMessage}`, 'error');
      setIsSubmitting(false);
    }
  }, [quiz, user, t, isSubmitting, cheatLog, user?.highestRole, showToast]);

  const handleNextQuestion = useCallback(() => {
    if (!quiz) return;
    
    const currentQuestion = quiz.questions[currentQuestionIndex];
    const timeTaken = currentQuestion.timeLimit - timeLeft;
    const newAnswers = [...answers, { questionId: currentQuestion.id, questionText: t(currentQuestion.textKey), answer: currentAnswer || 'No answer (time out)', timeTaken }];
    setAnswers(newAnswers);
    setCurrentAnswer('');

    if (currentQuestionIndex < quiz.questions.length - 1) {
      const nextQuestionIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextQuestionIndex);
      setTimeLeft(quiz.questions[nextQuestionIndex].timeLimit);
    } else {
      handleSubmit(newAnswers);
    }
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
    if (quizState !== 'taking') return;

    const handleCheat = (methodKey: 'cheat_method_switched_tab' | 'cheat_method_lost_focus') => {
        // Prevent multiple rapid-fire events
        if (quizState !== 'taking') return;

        setCheatLog(prev => [...prev, { method: t(methodKey), timestamp: new Date().toISOString() }]);
        showToast(t('cheat_attempt_detected'), 'error');
        
        // Reset quiz state
        setAnswers([]);
        setCurrentAnswer('');
        setCurrentQuestionIndex(0);
        setQuizState('rules');
        if (quiz && quiz.questions.length > 0) {
            setTimeLeft(quiz.questions[0].timeLimit);
        }
    };
    
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
            handleCheat('cheat_method_switched_tab');
        }
    };

    const handleBlur = () => {
        // This brief timeout helps distinguish a real blur from one caused by a browser alert/prompt.
        setTimeout(() => {
            if (document.visibilityState === 'hidden' || !document.hasFocus()) {
                 handleCheat('cheat_method_lost_focus');
            }
        }, 200);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('blur', handleBlur);
    };
  }, [quizState, quiz, showToast, t]);
  
  const handleStartQuiz = () => {
    setQuizState('taking');
  };

  if (isLoading) {
    return (
        <div className="container mx-auto px-6 py-16 flex justify-center items-center h-96">
            <Loader2 size={48} className="text-brand-cyan animate-spin" />
        </div>
    );
  }

  if (!quiz) {
    return null;
  }
  
  if (quizState === 'submitted') {
    return (
      <div className="container mx-auto px-6 py-16 text-center animate-slide-up">
        <CheckCircle className="mx-auto text-green-400" size={80} />
        <h1 className="text-4xl font-bold mt-6 mb-4">{t('application_submitted')}</h1>
        <p className="text-lg text-gray-300 max-w-2xl mx-auto">{t('application_submitted_desc')}</p>
        
        <div className="max-w-md mx-auto bg-brand-dark-blue border border-brand-light-blue/50 rounded-lg p-6 text-left mt-10">
            <h3 className="text-xl font-bold text-brand-cyan mb-4 flex items-center gap-3"><ListChecks /> {t('cheat_attempts_report')}</h3>
            {cheatLog.length > 0 ? (
                <>
                    <p className="text-gray-300 mb-4">{t('cheat_attempts_count', { count: cheatLog.length })}</p>
                    <ul className="space-y-2 text-sm max-h-40 overflow-y-auto">
                        {cheatLog.map((attempt, index) => (
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
    )
  }

  if (quizState === 'rules') {
    return (
      <div className="container mx-auto px-6 py-16">
        <div className="max-w-3xl mx-auto bg-brand-dark-blue border border-brand-light-blue/50 rounded-lg p-8 text-center animate-slide-up">
          <h1 className="text-3xl font-bold text-brand-cyan mb-4">{t('quiz_rules')}</h1>
          <h2 className="text-2xl font-semibold mb-6">{t(quiz.titleKey)}</h2>
          <p className="text-gray-300 mb-8 whitespace-pre-line">{t(quiz.descriptionKey)}</p>
          <button onClick={handleStartQuiz} className="px-10 py-4 bg-brand-cyan text-brand-dark font-bold text-lg rounded-lg shadow-glow-cyan hover:bg-white hover:scale-105 transform transition-all">
            {t('begin_quiz')}
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / quiz.questions.length) * 100;
  
  return (
    <div className="container mx-auto px-6 py-16">
      <div className="max-w-3xl mx-auto bg-brand-dark-blue border border-brand-light-blue/50 rounded-lg p-8">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2 text-gray-300">
            <span>{t('question')} {currentQuestionIndex + 1} {t('of')} {quiz.questions.length}</span>
            <span className="flex items-center gap-2"><Clock size={16} /> {timeLeft} {t('seconds')}</span>
          </div>
          <div className="w-full bg-brand-light-blue rounded-full h-2.5">
            <div className="bg-brand-cyan h-2.5 rounded-full" style={{ width: `${progress}%`, transition: 'width 0.5s ease-in-out' }}></div>
          </div>
        </div>

        <h2 className="text-2xl md:text-3xl font-semibold mb-6 text-white">{t(currentQuestion.textKey)}</h2>
        
        <textarea
          value={currentAnswer}
          onChange={(e) => setCurrentAnswer(e.target.value)}
          className="w-full bg-brand-light-blue text-white p-4 rounded-md border border-gray-600 focus:ring-2 focus:ring-brand-cyan focus:border-brand-cyan transition-colors"
          rows={6}
          placeholder="Type your answer here..."
        />
        
        <button 
          onClick={handleNextQuestion}
          disabled={isSubmitting}
          className="mt-8 w-full bg-brand-cyan text-brand-dark font-bold py-4 rounded-lg shadow-glow-cyan hover:bg-white transition-all text-lg flex justify-center items-center disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <Loader2 size={28} className="animate-spin" />
          ) : currentQuestionIndex < quiz.questions.length - 1 ? (
            t('next_question')
          ) : (
            t('submit_application')
          )}
        </button>
      </div>
       <style>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.8s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default QuizPage;