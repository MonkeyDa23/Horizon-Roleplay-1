// src/pages/AppliesPage.tsx
import React, { useState, useEffect } from 'react';
// FIX: Fix "no exported member" errors from 'react-router-dom' by switching to a namespace import.
import * as ReactRouterDOM from 'react-router-dom';
import { useLocalization } from '../hooks/useLocalization';
import { useAuth } from '../hooks/useAuth';
import { getQuizzes, getSubmissionsByUserId } from '../lib/api';
import type { Quiz, QuizSubmission } from '../types';
import { FileText, Lock, Check, Image as ImageIcon } from 'lucide-react';
import { useConfig } from '../hooks/useConfig';
import SEO from '../components/SEO';

const AppliesPage: React.FC = () => {
  const { t } = useLocalization();
  const { user } = useAuth();
  const { config } = useConfig();
  const communityName = config.COMMUNITY_NAME;
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
                const userSubmissions = await getSubmissionsByUserId(user.id);
                setUserSubmissions(userSubmissions);
            }
        } catch (error) {
            console.error("Failed to fetch application data:", error);
        } finally {
            setIsLoading(false);
        }
    };
    fetchData();
  }, [user]);
  
  const SkeletonCard: React.FC = () => (
    <div className="bg-brand-dark-blue border border-brand-light-blue/50 rounded-lg p-6 animate-pulse">
       <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-brand-light-blue rounded-lg"></div>
          <div className="w-full">
            <div className="h-8 bg-brand-light-blue rounded w-3/4 mb-2"></div>
             <div className="h-4 bg-brand-light-blue rounded w-1/2"></div>
          </div>
       </div>
        <div className="h-4 bg-brand-light-blue rounded w-full mb-2"></div>
        <div className="h-4 bg-brand-light-blue rounded w-5/6 mb-6"></div>
        <div className="h-12 bg-brand-light-blue rounded-md mt-auto"></div>
    </div>
  );

  const getApplyButton = (quiz: Quiz) => {
      const hasAppliedInCurrentSeason = quiz.lastOpenedAt
        ? userSubmissions.some(sub => 
            sub.quizId === quiz.id && 
            new Date(sub.submittedAt) >= new Date(quiz.lastOpenedAt!)
          )
        : userSubmissions.some(sub => sub.quizId === quiz.id);

      if (hasAppliedInCurrentSeason) {
        return (
          <button disabled className="w-full bg-green-500/20 text-green-300 font-bold py-3 px-8 rounded-md flex items-center justify-center gap-2 cursor-not-allowed">
            <Check size={20} />
            {t('already_applied')}
          </button>
        );
      }
      
      if (!quiz.isOpen) {
        return (
          <button disabled className="w-full bg-gray-700/80 text-gray-400 font-bold py-3 px-8 rounded-md flex items-center justify-center gap-2 cursor-not-allowed">
            <Lock size={20} />
            {t('application_closed')}
          </button>
        );
      }

      if (!user) {
        return (
          <button disabled className="w-full bg-gray-600 text-gray-300 font-bold py-3 px-8 rounded-md flex items-center justify-center gap-2 cursor-not-allowed" title="Please log in to apply">
            <Lock size={20} />
            {t('apply_now')}
          </button>
        );
      }

      return (
        <ReactRouterDOM.Link 
          to={`/applies/${quiz.id}`}
          className="w-full text-center bg-brand-cyan text-brand-dark font-bold py-3 px-8 rounded-md hover:bg-white hover:shadow-glow-cyan transition-all duration-300 flex items-center justify-center gap-2"
        >
          {t('apply_now')}
        </ReactRouterDOM.Link>
      );
  };

  const getTotalQuestions = (quiz: Quiz) => {
    return (quiz.rounds || []).reduce((acc, round) => acc + (round.questions || []).length, 0);
  };

  return (
    <>
      <SEO 
        title={`${communityName} - ${t('applies')}`}
        description={`Apply to join official factions like the Police Department or EMS on the ${communityName} server. View all open applications here.`}
        keywords={`apply, applications, jobs, police, ems, medic, faction, ${communityName.toLowerCase()}`}
      />
      <div className="container mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <div className="inline-block p-4 bg-brand-light-blue rounded-full mb-4">
            <FileText className="text-brand-cyan" size={48} />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t('page_title_applies')}</h1>
        </div>

        <div className="max-w-5xl mx-auto">
          {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <SkeletonCard />
                  <SkeletonCard />
              </div>
          ) : quizzes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {quizzes.map(quiz => (
                  <div key={quiz.id} className={`relative bg-brand-dark-blue border border-brand-light-blue/50 rounded-lg p-6 flex flex-col transition-all duration-300 ${quiz.isOpen ? 'hover:shadow-glow-cyan hover:-translate-y-1' : 'opacity-70'}`}>
                    {!quiz.isOpen && (
                      <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                        <span className="text-2xl font-bold text-white tracking-widest uppercase border-2 border-white px-4 py-2 rounded-md -rotate-12">
                          {t('closed')}
                        </span>
                      </div>
                    )}
                    <div className="flex-grow">
                          <div className="flex items-center gap-4 mb-4">
                              <div className="p-2 bg-brand-light-blue rounded-lg w-16 h-16 flex items-center justify-center flex-shrink-0">
                                  {quiz.logoUrl ? (
                                      <img src={quiz.logoUrl} alt={`${t(quiz.titleKey)} Logo`} className="w-full h-full object-contain" />
                                  ) : (
                                      <ImageIcon className="w-8 h-8 text-brand-cyan" />
                                  )}
                              </div>
                              <div>
                                  <h2 className="text-2xl font-bold text-white">{t(quiz.titleKey)}</h2>
                                  <p className="text-sm text-gray-400">{getTotalQuestions(quiz)} {t('questions')}</p>
                              </div>
                          </div>
                          <p className="text-gray-300 mb-6 min-h-[40px]">{t(quiz.descriptionKey)}</p>
                    </div>
                    <div className="mt-auto">
                          {getApplyButton(quiz)}
                    </div>
                  </div>
              ))}
              </div>
          ) : (
            <div className="text-center bg-brand-dark-blue border border-brand-light-blue/50 rounded-lg p-10">
              <p className="text-2xl text-gray-400">{t('no_applies_open')}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AppliesPage;