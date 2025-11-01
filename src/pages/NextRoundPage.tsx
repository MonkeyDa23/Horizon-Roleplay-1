// src/pages/NextRoundPage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLocalization } from '../hooks/useLocalization';
import { useAuth } from '../hooks/useAuth';
import { getQuizById } from '../lib/api';
import type { Quiz } from '../types';
import { Loader2, ArrowRightCircle } from 'lucide-react';
import SEO from '../components/SEO';
import { useConfig } from '../hooks/useConfig';
// FIX: Import the supabase client.
import { supabase } from '../lib/supabaseClient';

const NextRoundPage: React.FC = () => {
    const { quizId } = useParams<{ quizId: string }>();
    const navigate = useNavigate();
    const { t } = useLocalization();
    const { user } = useAuth();
    const { config } = useConfig();
    
    const [prevQuiz, setPrevQuiz] = useState<Quiz | null>(null);
    const [nextQuizId, setNextQuizId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            navigate('/applies');
            return;
        }
        if (!quizId) {
            navigate('/applies');
            return;
        }

        const fetchNextRoundInfo = async () => {
            setIsLoading(true);
            try {
                // We fetch the quiz that was just *completed*
                const completedQuiz = await getQuizById(quizId);
                if (!completedQuiz || !completedQuiz.info_page_content_key) {
                    // If there's no info page, something is wrong, go back to applies.
                    navigate('/applies');
                    return;
                }
                setPrevQuiz(completedQuiz);
                
                // Find the quiz that has this one as a parent
                // This is an inefficient way to do it, but without a dedicated API endpoint, it's the simplest.
                // A better approach would be a dedicated RPC `get_next_quiz_id(quiz_id)`
                // FIX: Use the imported supabase client instead of window.supabase and add a null check.
                if (!supabase) {
                    throw new Error("Supabase client is not initialized.");
                }
                const { data: nextQuiz } = await supabase
                    .from('quizzes')
                    .select('id')
                    .eq('parent_quiz_id', quizId)
                    .single();
                
                if (!nextQuiz) {
                    navigate('/my-applications'); // No next round found, maybe admin deleted it.
                    return;
                }
                setNextQuizId(nextQuiz.id);

            } catch (error) {
                console.error("Failed to fetch next round info:", error);
                navigate('/applies');
            } finally {
                setIsLoading(false);
            }
        };

        fetchNextRoundInfo();
    }, [quizId, navigate, user]);

    if (isLoading || !prevQuiz || !nextQuizId) {
        return (
            <div className="container mx-auto px-6 py-16 flex justify-center items-center h-96">
                <Loader2 size={48} className="text-brand-cyan animate-spin" />
            </div>
        );
    }

    return (
        <>
            <SEO 
                title={`${config.COMMUNITY_NAME} - ${t(prevQuiz.titleKey)}`}
                description="Application Next Round"
                noIndex={true}
            />
            <div className="container mx-auto px-6 py-16">
                <div className="max-w-3xl mx-auto bg-brand-dark-blue border border-brand-light-blue/50 rounded-lg p-8 text-center animate-slide-up">
                    <h1 className="text-3xl font-bold text-brand-cyan mb-4">Round Complete!</h1>
                    <h2 className="text-2xl font-semibold mb-6">Next up: {t(prevQuiz.titleKey)}</h2>
                    <div className="text-gray-300 mb-8 whitespace-pre-line text-left border-t border-b border-brand-light-blue/50 py-6">
                        {t(prevQuiz.info_page_content_key!)}
                    </div>
                    <Link 
                        to={`/applies/${nextQuizId}`}
                        className="inline-flex items-center justify-center gap-3 px-10 py-4 bg-brand-cyan text-brand-dark font-bold text-lg rounded-lg shadow-glow-cyan hover:bg-white hover:scale-105 transform transition-all"
                    >
                        <span>Start Next Round</span>
                        <ArrowRightCircle size={24} />
                    </Link>
                </div>
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
        </>
    );
};

export default NextRoundPage;
