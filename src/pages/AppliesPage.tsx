import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLocalization } from '../hooks/useLocalization';
import { useAuth } from '../hooks/useAuth';
import { getQuizzes, getSubmissionsByUserId } from '../lib/api';
import type { Quiz, QuizSubmission } from '../types';
import { FileText, Lock, Check } from 'lucide-react';

const AppliesPage: React.FC = () => {
  const { t } = useLocalization();
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [userSubmissions, setUserSubmissions] = useState<QuizSubmission[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const fetchedQuizzes = await getQuizzes();
            setQuizzes(fetchedQuizzes);

            if (user) {
                const fetchedSubmissions = await getSubmissionsByUserId(user.id);
                setUserSubmissions(fetchedSubmissions);
            }
        } catch (error) {
            console.error("Failed to fetch application data:", error);
        } finally {
            setIsLoading(false);
        }
    };
    fetchData();
  }, [user]);
  
  const SkeletonLoader: React.FC = () => (
    <>
      {[...Array(2)].map((_, i) => (
        <div key={i} className="bg-brand-dark-blue border border-brand-light-blue/50 rounded-lg p-6 flex flex-col md:flex-row justify-between items-center gap-4 animate-pulse">
          <div className="w-full">
            <div className="h-8 bg-brand-light-blue rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-brand-light-blue rounded w-full"></div>
            <div className="h-4 bg-brand-light-blue rounded w-5/6 mt-2"></div>
          </div>
          <div className="flex-shrink-0 mt-4 md:mt-0 w-full md:w-40">
            <div className="h-12 bg-brand-light-blue rounded-md"></div>
          </div>
        </div>
      ))}
    </>
  );

  const getApplyButton = (quiz: Quiz) => {
      const hasApplied = userSubmissions.some(sub => sub.quizId === quiz.id);

      if (hasApplied) {
        return (
          <button disabled className="bg-green-500/20 text-green-300 font-bold py-3 px-8 rounded-md flex items-center gap-2 cursor-not-allowed">
            <Check size={16} />
            {t('already_applied')}
          </button>
        );
      }
      
      if (!quiz.isOpen) {
        return (
          <button disabled className="bg-gray-700 text-gray-400 font-bold py-3 px-8 rounded-md flex items-center gap-2 cursor-not-allowed">
            <Lock size={16} />
            {t('application_closed')}
          </button>
        );
      }

      if (!user) {
        return (
          <button disabled className="bg-gray-600 text-gray-300 font-bold py-3 px-8 rounded-md flex items-center gap-2 cursor-not-allowed" title="Please log in to apply">
            <Lock size={16} />
            {t('apply_now')}
          </button>
        );
      }

      return (
        <Link 
          to={`/applies/${quiz.id}`}
          className="bg-brand-cyan text-brand-dark font-bold py-3 px-8 rounded-md hover:bg-white hover:shadow-glow-cyan transition-all duration-300 flex items-center gap-2"
        >
          {t('apply_now')}
        </Link>
      );
  };

  return (
    <div className="container mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <div className="inline-block p-4 bg-brand-light-blue rounded-full mb-4">
          <FileText className="text-brand-cyan" size={48} />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4">{t('page_title_applies')}</h1>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        {isLoading ? (
          <SkeletonLoader />
        ) : quizzes.length > 0 ? (
          quizzes.map(quiz => (
            <div key={quiz.id} className={`bg-brand-dark-blue border border-brand-light-blue/50 rounded-lg p-6 flex flex-col md:flex-row justify-between items-center gap-4 transition-all duration-300 ${quiz.isOpen ? 'hover:shadow-glow-cyan-light' : 'opacity-60'}`}>
              <div>
                <h2 className={`text-2xl font-bold ${quiz.isOpen ? 'text-brand-cyan' : 'text-gray-400'}`}>{t(quiz.titleKey)}</h2>
                <p className="text-gray-300 mt-2">{t(quiz.descriptionKey)}</p>
              </div>
              <div className="flex-shrink-0 mt-4 md:mt-0">
                {getApplyButton(quiz)}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center bg-brand-dark-blue border border-brand-light-blue/50 rounded-lg p-10">
            <p className="text-2xl text-gray-400">{t('no_applies_open')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppliesPage;
