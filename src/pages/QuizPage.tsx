import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLocalization } from '../hooks/useLocalization';
import { useAuth } from '../hooks/useAuth';
import { getQuizById, addSubmission } from '../lib/api';
import type { Quiz, Answer } from '../types';
import { CheckCircle, Clock, Loader2 } from 'lucide-react';

const QuizPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { t } = useLocalization();
  const { user } = useAuth();
  
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [quizState, setQuizState] = useState<'rules' | 'taking' | 'submitted'>('rules');

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
          if (fetchedQuiz && fetchedQuiz.isOpen) {
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
    if (!quiz || !user) return;
    const submission = {
        quizId: quiz.id,
        quizTitle: t(quiz.titleKey),
        userId: user.id,
        username: user.username,
        answers: finalAnswers,
        submittedAt: new Date().toISOString(),
    };
    
    await addSubmission(submission);
    setQuizState('submitted');
  }, [quiz, user, t]);

  // Timer logic
  const handleNextQuestion = useCallback(() => {
    if (!quiz) return;
    
    const currentQuestion = quiz.questions[currentQuestionIndex];
    const newAnswers = [...answers, { questionId: currentQuestion.id, questionText: t(currentQuestion.textKey), answer: currentAnswer || 'No answer (time out)' }];
    setAnswers(newAnswers);
    setCurrentAnswer('');

    if (currentQuestionIndex < quiz.questions.length - 1) {
      const nextQuestionIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextQuestionIndex);
      setTimeLeft(quiz.questions[nextQuestionIndex].timeLimit);
    } else {
      handleSubmit(newAnswers);
    }
  }, [quiz, currentQuestionIndex, answers, currentAnswer, t, handleSubmit]);
  
  useEffect(() => {
    if (quizState !== 'taking' || !quiz) return;
    if (timeLeft <= 0) {
      handleNextQuestion();
      return;
    }
    const timerId = setInterval(() => setTimeLeft(prevTime => prevTime - 1), 1000);
    return () => clearInterval(timerId);
  }, [timeLeft, quizState, quiz, handleNextQuestion]);
  
  // Prevent leaving page during quiz
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (quizState === 'taking') {
        e.preventDefault();
        e.returnValue = 'Are you sure you want to leave? Your progress will be lost.';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [quizState]);

  // Security: Reset quiz if user switches tabs
  useEffect(() => {
    const handleVisibilityChange = () => {
      // Check if the page is hidden AND the user is actively taking the quiz.
      if (document.visibilityState === 'hidden' && quizState === 'taking') {
        alert("You have switched away from the quiz tab. To ensure fairness, your application attempt has been cancelled.");
        navigate('/applies');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup the event listener when the component unmounts or dependencies change.
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [quizState, navigate]);
  
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
    return null; // Should have been redirected
  }
  
  if (quizState === 'submitted') {
    return (
      <div className="container mx-auto px-6 py-16 text-center animate-slide-up">
        <CheckCircle className="mx-auto text-green-400" size={80} />
        <h1 className="text-4xl font-bold mt-6 mb-4">{t('application_submitted')}</h1>
        <p className="text-lg text-gray-300 max-w-2xl mx-auto">{t('application_submitted_desc')}</p>
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
          className="mt-8 w-full bg-brand-cyan text-brand-dark font-bold py-4 rounded-lg shadow-glow-cyan hover:bg-white transition-all text-lg"
        >
          {currentQuestionIndex < quiz.questions.length - 1 ? t('next_question') : t('submit_application')}
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
