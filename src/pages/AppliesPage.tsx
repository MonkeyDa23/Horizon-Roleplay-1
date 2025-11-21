
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLocalization } from '../contexts/LocalizationContext';
import { useAuth } from '../contexts/AuthContext';
import { getQuizzes, getSubmissionsByUserId } from '../lib/api';
import type { Quiz, QuizSubmission } from '../types';
import { FileText, Lock, Check, Image as ImageIcon, Clock, AlertCircle } from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';
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
    <div className="glass-panel p-6 animate-pulse">
       <div className="flex items-center gap-4 mb-4">
          <div className="w-20 h-20 bg-background-light rounded-lg"></div>
          <div className="w-full">
            <div className="h-8 bg-background-light rounded w-3/4 mb-2"></div>
             <div className="h-4 bg-background-light rounded w-1/2"></div>
          </div>
       </div>
        <div className="h-4 bg-background-light rounded w-full mb-2"></div>
        <div className="h-4 bg-background-light rounded w-5/6 mb-6"></div>
        <div className="h-12 bg-background-light rounded-md mt-auto"></div>
    </div>
  );

  const getApplyButton = (quiz: Quiz) => {
      // 1. STRICT CHECK: Does user have an active submission (Pending or Taken)?
      // Even if the quiz was closed and reopened, if the user has a pending/taken request, they CANNOT apply again.
      const activeSubmission = userSubmissions.find(sub => 
        sub.quizId === quiz.id && 
        (sub.status === 'pending' || sub.status === 'taken')
      );

      if (activeSubmission) {
        return (
          <div className="w-full">
              <button disabled className="w-full bg-yellow-500/10 text-yellow-400 font-bold py-3 px-8 rounded-lg flex items-center justify-center gap-2 cursor-not-allowed border border-yellow-500/30">
                <Clock size={20} />
                {activeSubmission.status === 'taken' ? t('status_taken') : t('status_pending')}
              </button>
              <p className="text-xs text-center text-yellow-500/70 mt-2">
                  لا يمكنك التقديم مرة أخرى حتى يتم اتخاذ قرار بشأن طلبك الحالي.
              </p>
          </div>
        );
      }

      // 2. Check if user was already accepted/refused in the CURRENT season (optional, prevents spamming after rejection)
      const hasFinishedInCurrentSeason = quiz.lastOpenedAt
        ? userSubmissions.some(sub => 
            sub.quizId === quiz.id && 
            new Date(sub.submittedAt) >= new Date(quiz.lastOpenedAt!)
          )
        : false;

      if (hasFinishedInCurrentSeason) {
         return (
          <button disabled className="w-full bg-green-500/20 text-green-300 font-bold py-3 px-8 rounded-lg flex items-center justify-center gap-2 cursor-not-allowed">
            <Check size={20} />
            {t('already_applied')}
          </button>
        );
      }
      
      if (!quiz.isOpen) {
        return (
          <button disabled className="w-full bg-red-500/10 text-red-400 font-bold py-3 px-8 rounded-lg flex items-center justify-center gap-2 cursor-not-allowed border border-red-500/20">
            <Lock size={20} />
            {t('application_closed')}
          </button>
        );
      }

      if (!user) {
        return (
          <button disabled className="w-full bg-text-secondary/20 text-text-secondary font-bold py-3 px-8 rounded-lg flex items-center justify-center gap-2 cursor-not-allowed" title="Please log in to apply">
            <Lock size={20} />
            {t('apply_now')}
          </button>
        );
      }

      return (
        <Link 
          to={`/applies/${quiz.id}`}
          className="w-full text-center bg-gradient-to-r from-primary-blue to-accent-cyan text-background-dark font-bold py-3 px-8 rounded-lg hover:opacity-90 transition-all duration-300 flex items-center justify-center gap-2 transform hover:scale-105 shadow-glow-blue"
        >
          {t('apply_now')}
        </Link>
      );
  };

  return (
    <>
      <SEO 
        title={`${communityName} - ${t('applies')}`}
        description={`Apply to join official factions like the Police Department or EMS on the ${communityName} server. View all open applications here.`}
        keywords={`apply, applications, jobs, police, ems, medic, faction, ${communityName.toLowerCase()}`}
      />
      <div className="container mx-auto px-6 py-16">
        <div className="text-center mb-16 animate-fade-in-up">
          <div className="inline-block p-4 bg-background-light rounded-full mb-4 border-2 border-border-color shadow-lg">
            <FileText className="text-primary-blue" size={48} />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">{t('page_title_applies')}</h1>
        </div>

        <div className="max-w-5xl mx-auto">
          {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <SkeletonCard />
                  <SkeletonCard />
              </div>
          ) : quizzes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {quizzes.map((quiz, index) => (
                  <div key={quiz.id} className={`relative glass-panel p-8 flex flex-col transition-all duration-300 group ${quiz.isOpen ? 'hover:shadow-glow-blue hover:-translate-y-2' : 'opacity-80 grayscale-[0.5]'} animate-stagger`} style={{ animationDelay: `${index * 150}ms` }}>
                    {!quiz.isOpen && (
                      <div className="absolute top-4 right-4 z-10">
                        <span className="flex items-center gap-1 text-xs font-bold text-red-400 bg-red-900/30 px-2 py-1 rounded border border-red-500/30">
                          <Lock size={12} /> {t('closed')}
                        </span>
                      </div>
                    )}
                    <div className="flex-grow">
                          <div className="flex items-center gap-5 mb-5">
                              <div className="p-2 glass-panel rounded-xl w-24 h-24 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-blue/10 transition-colors">
                                  {quiz.logoUrl ? (
                                      <img src={quiz.logoUrl} alt={`${t(quiz.titleKey)} Logo`} className="w-full h-full object-contain" />
                                  ) : (
                                      <ImageIcon className="w-10 h-10 text-primary-blue" />
                                  )}
                              </div>
                              <div>
                                  <h2 className="text-2xl font-bold text-white leading-tight">{t(quiz.titleKey)}</h2>
                                  <p className="text-sm text-text-secondary mt-1">{(quiz.questions || []).length} {t('questions')}</p>
                              </div>
                          </div>
                          <p className="text-text-secondary mb-6 min-h-[40px] text-base leading-relaxed">{t(quiz.descriptionKey)}</p>
                    </div>
                    <div className="mt-auto pt-6 border-t border-border-color">
                          {getApplyButton(quiz)}
                    </div>
                  </div>
              ))}
              </div>
          ) : (
            <div className="text-center glass-panel p-10 flex flex-col items-center">
              <AlertCircle size={48} className="text-text-secondary mb-4"/>
              <p className="text-2xl text-text-secondary">{t('no_applies_open')}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AppliesPage;
