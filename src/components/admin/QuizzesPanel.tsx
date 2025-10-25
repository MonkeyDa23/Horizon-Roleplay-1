// src/components/admin/QuizzesPanel.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useToast } from '../../hooks/useToast';
import { getQuizzes, saveQuiz, deleteQuiz } from '../../lib/api';
import type { Quiz, QuizQuestion } from '../../types';
import Modal from '../Modal';
import { Loader2, Plus, Edit, Trash2 } from 'lucide-react';

const Panel: React.FC<{ children: React.ReactNode; isLoading: boolean, loadingText: string }> = ({ children, isLoading, loadingText }) => {
    if (isLoading) {
        return (
            <div className="flex flex-col gap-4 justify-center items-center py-20 min-h-[300px]">
                <Loader2 size={40} className="text-brand-cyan animate-spin" />
                <p className="text-gray-400">{loadingText}</p>
            </div>
        );
    }
    return <div className="animate-fade-in-up">{children}</div>;
}

const QuizzesPanel: React.FC = () => {
    const { t } = useLocalization();
    const { showToast } = useToast();
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);

    const fetchQuizzes = useCallback(async () => {
        setIsLoading(true);
        try {
            setQuizzes(await getQuizzes());
        } catch (error) { showToast('Failed to load quizzes', 'error'); }
        finally { setIsLoading(false); }
    }, [showToast]);

    useEffect(() => { fetchQuizzes(); }, [fetchQuizzes]);

    const handleCreateNew = () => setEditingQuiz({
        id: '', titleKey: '', descriptionKey: '', isOpen: false, questions: [],
        allowedTakeRoles: [], logoUrl: '', bannerUrl: ''
    });

    const handleSave = async () => {
        if (!editingQuiz) return;
        setIsSaving(true);
        try {
            await saveQuiz(editingQuiz);
            setEditingQuiz(null);
            showToast('Quiz saved!', 'success');
            fetchQuizzes();
        } catch (error) {
            showToast(`Error: ${(error as Error).message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (quiz: Quiz) => {
        if (window.confirm(`Delete "${t(quiz.titleKey)}"? This is irreversible.`)) {
            try {
                await deleteQuiz(quiz.id);
                showToast('Quiz deleted!', 'success');
                fetchQuizzes();
            } catch (error) {
                showToast(`Error: ${(error as Error).message}`, 'error');
            }
        }
    };
    
    return (
        <Panel isLoading={isLoading} loadingText="Loading quizzes...">
            <div className="flex justify-end mb-6">
                <button onClick={handleCreateNew} className="bg-brand-cyan text-brand-dark font-bold py-2 px-4 rounded-md hover:bg-white transition-all flex items-center gap-2">
                    <Plus size={20} /> {t('create_new_quiz')}
                </button>
            </div>
            <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50 overflow-hidden">
                 <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[600px]">
                        <thead className="border-b border-brand-light-blue/50 text-gray-300 bg-brand-light-blue/30">
                            <tr>
                                <th className="p-4">{t('quiz_title')}</th>
                                <th className="p-4">{t('status')}</th>
                                <th className="p-4">{t('questions')}</th>
                                <th className="p-4 text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {quizzes.map((quiz) => (
                                <tr key={quiz.id} className="border-b border-brand-light-blue/50 last:border-none hover:bg-brand-light-blue/20 transition-colors">
                                    <td className="p-4 font-semibold text-white">{t(quiz.titleKey)}</td>
                                    <td className="p-4">
                                        <span className={`px-3 py-1 text-sm font-bold rounded-full ${quiz.isOpen ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                            {quiz.isOpen ? t('open') : t('closed')}
                                        </span>
                                    </td>
                                    <td className="p-4 text-gray-300">{quiz.questions.length}</td>
                                    <td className="p-4 text-right">
                                        <div className="inline-flex gap-4">
                                            <button onClick={() => setEditingQuiz(JSON.parse(JSON.stringify(quiz)))} className="text-gray-300 hover:text-brand-cyan"><Edit size={20}/></button>
                                            <button onClick={() => handleDelete(quiz)} className="text-gray-300 hover:text-red-500"><Trash2 size={20}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            {editingQuiz && <Modal isOpen={!!editingQuiz} onClose={() => setEditingQuiz(null)} title={t(editingQuiz.id ? 'edit_quiz' : 'create_new_quiz')}>
                <p>Quiz editor coming soon.</p>
            </Modal>}
        </Panel>
    );
};

export default QuizzesPanel;
