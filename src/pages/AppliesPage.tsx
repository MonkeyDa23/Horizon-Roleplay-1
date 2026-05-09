/**
 * Nova Roleplay - Official Website
 * Applications Page
 */
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
  const communityName = config.COMMUNITY_NAME || 'Nova Roleplay';
  
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

  const SkeletonCard: React.FC = () => (
    <div className="glass-panel animate-pulse space-y-6">
      <div className="flex items-center gap-6">
        <div className="w-24 h-24 bg-white/5 rounded-2xl"></div>
        <div className="flex-1 space-y-3">
          <div className="h-8 bg-white/5 rounded w-3/4"></div>
          <div className="h-4 bg-white/5 rounded w-1/2"></div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-white/5 rounded w-full"></div>
        <div className="h-4 bg-white/5 rounded w-5/6"></div>
      </div>
      <div className="h-14 bg-white/5 rounded-xl w-full"></div>
    </div>
  );

  const getApplyButton = (quiz: Quiz) => {
    const activeStats = ['pending', 'under_review', 'taken'];
    const activeSubmission = userSubmissions.find(sub => 
      sub.quizId === quiz.id && activeStats.includes(sub.status)
    );

    if (activeSubmission) {
      return (
        <div className="w-full space-y-2">
          <button 
            disabled 
            className="w-full bg-yellow-500/10 text-yellow-400 font-bold py-4 px-8 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed border border-yellow-500/20"
          >
            <Clock size={20} />
            {activeSubmission.status === 'taken' || activeSubmission.status === 'under_review' ? t('status_taken') : t('status_pending')}
          </button>
          <p className="text-xs text-center text-yellow-500/50">
            لديك طلب قيد المراجعة حالياً لهذا القسم.
          </p>
        </div>
      );
    }

    if (!quiz.isOpen) {
      return (
        <button 
          disabled 
          className="w-full bg-red-500/10 text-red-400 font-bold py-4 px-8 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed border border-red-500/10"
        >
          <Lock size={20} />
          {t('application_closed')}
        </button>
      );
    }

    if (!user) {
      return (
        <button 
          disabled 
          className="w-full bg-white/5 text-text-secondary font-bold py-4 px-8 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed"
          title="Please log in to apply"
        >
          <Lock size={20} />
          {t('apply_now')}
        </button>
      );
    }

    return (
      <Link 
        to={`/applies/${quiz.id}`}
        className="w-full text-center bg-white text-brand-dark font-black py-4 px-8 rounded-xl hover:bg-white/90 transition-all duration-300 flex items-center justify-center gap-2 transform hover:scale-[1.02] shadow-xl"
      >
        {t('apply_now')}
      </Link>
    );
  };

  const openQuizzes = quizzes.filter(q => q.isOpen);
  const closedQuizzes = quizzes.filter(q => !q.isOpen);

  return (
    <>
      <SEO 
        title={`${communityName} - ${t('applies') || 'التقديمات'}`}
        description={`انضم إلينا في ${communityName} من خلال تقديم طلب في الأقسام المتاحة.`}
      />

      <div className="container-custom">
        <div className="text-center max-w-3xl mx-auto space-y-6 animate-fade-in-up">
          <div className="inline-flex p-6 bg-white/5 rounded-[32px] border border-white/10 shadow-2xl">
            <FileText className="text-primary-blue" size={40} />
          </div>
          <h1 className="text-5xl md:text-8xl font-black">{t('page_title_applies') || 'التقديمات المتاحة'}</h1>
          <p className="text-2xl text-text-secondary font-medium">ابدأ مسيرتك المهنية في مجتمعنا من خلال اختيار القسم المناسب لك.</p>
        </div>

        <div className="max-w-6xl mx-auto">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : quizzes.length > 0 ? (
            <div className="space-y-24">
              {/* Open Applications */}
              <div className="space-y-12">
                <div className="flex items-center justify-between border-b border-white/5 pb-6">
                  <h2 className="text-2xl md:text-3xl font-black text-white flex items-center gap-4">
                    <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></span>
                    التقديمات المفتوحة
                  </h2>
                  <span className="bg-green-500/10 text-green-400 px-6 py-2 rounded-full text-sm font-black border border-green-500/20">
                    {openQuizzes.length} متاح
                  </span>
                </div>

                {openQuizzes.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {openQuizzes.map((quiz, index) => (
                      <div 
                        key={quiz.id} 
                        className="glass-panel flex flex-col group hover:border-primary-blue/30 animate-stagger"
                        style={{ animationDelay: `${index * 150}ms` }}
                      >
                        <div className="flex-grow space-y-6 pb-8">
                          <div className="flex items-center gap-6">
                            <div className="p-3 bg-white/5 rounded-2xl w-24 h-24 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-blue/5 transition-colors border border-white/5">
                              {quiz.logoUrl ? (
                                <img src={quiz.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                              ) : (
                                <ImageIcon className="w-10 h-10 text-white/20" />
                              )}
                            </div>
                            <div className="space-y-1">
                              <h3 className="text-2xl font-black text-white leading-tight">{t(quiz.titleKey) || quiz.id}</h3>
                              <div className="flex items-center gap-2 text-text-secondary">
                                <Clock size={14} />
                                <span className="text-sm font-bold">{(quiz.questions || []).length} {t('questions')}</span>
                              </div>
                            </div>
                          </div>
                          <p className="text-text-secondary text-lg leading-relaxed">{t(quiz.descriptionKey)}</p>
                        </div>
                        <div className="pt-8 border-t border-white/5">
                          {getApplyButton(quiz)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20 bg-white/[0.02] rounded-[40px] border border-dashed border-white/10">
                    <p className="text-text-secondary text-xl font-bold">لا توجد تقديمات متاحة حالياً.</p>
                  </div>
                )}
              </div>

              {/* Closed Applications */}
              <div className="space-y-12">
                <div className="flex items-center justify-between border-b border-white/5 pb-6">
                  <h2 className="text-2xl md:text-3xl font-black text-white/50 flex items-center gap-4">
                    <span className="w-3 h-3 rounded-full bg-white/20"></span>
                    التقديمات المغلقة
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {closedQuizzes.map((quiz, index) => (
                    <div 
                      key={quiz.id} 
                      className="glass-panel flex flex-col opacity-50 grayscale hover:grayscale-0 transition-all duration-500 border-white/5"
                    >
                      <div className="flex items-center gap-5 mb-6">
                        <div className="p-2 bg-white/5 rounded-xl w-16 h-16 flex items-center justify-center flex-shrink-0">
                          {quiz.logoUrl ? (
                            <img src={quiz.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                          ) : (
                            <ImageIcon className="w-8 h-8" />
                          )}
                        </div>
                        <h3 className="text-xl font-bold text-white/80">{t(quiz.titleKey) || quiz.id}</h3>
                      </div>
                      <div className="mt-auto">
                        <button disabled className="w-full bg-white/5 text-white/30 py-3 rounded-xl font-bold text-sm cursor-not-allowed">
                          {t('application_closed')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center glass-panel p-20 space-y-6">
              <AlertCircle size={40} className="text-white/10 mx-auto" />
              <p className="text-2xl text-text-secondary font-bold">{t('no_applies_open')}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AppliesPage;
