
// src/components/admin/QuizzesPanel.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useToast } from '../../hooks/useToast';
import { getQuizzes, saveQuiz, deleteQuiz } from '../../lib/api';
import type { Quiz, QuizQuestion } from '../../types';
import { useTranslations } from '../../hooks/useTranslations';
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

// FIX: Replaced Omit with an explicit type for broader compatibility.
type EditableQuestion = {
    id: string;
    textKey: string;
    timeLimit: number;
    textEn: string;
    textAr: string;
};

// FIX: Removed redeclaration of EditingQuizData interface.
interface EditingQuizData {
    id: string;
    titleKey: string;
    titleEn: string;
    titleAr: string;
    descriptionKey: string;
    descriptionEn: string;
    descriptionAr: string;
    isOpen: boolean;
    allowedTakeRoles: string[];
    logoUrl?: string;
    bannerUrl?: string;
    questions: EditableQuestion[];
}


const QuizzesPanel: React.FC = () => {
    const { t } = useLocalization();
    const { showToast } = useToast();
    const { translations, refreshTranslations } = useTranslations();
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [editingQuiz, setEditingQuiz] = useState<EditingQuizData | null>(null);

    const fetchQuizzes = useCallback(async () => {
        setIsLoading(true);
        try {
            setQuizzes(await getQuizzes());
        } catch (error) { showToast('Failed to load quizzes', 'error'); }
        finally { setIsLoading(false); }
    }, [showToast]);

    useEffect(() => { fetchQuizzes(); }, [fetchQuizzes]);

    const handleCreateNew = () => {
        const newId = crypto.randomUUID();
        setEditingQuiz({
            id: newId,
            titleKey: `quiz_${newId}_title`,
            titleEn: '',
            titleAr: '',
            descriptionKey: `quiz_${newId}_desc`,
            descriptionEn: '',
            descriptionAr: '',
            isOpen: false,
            questions: [],
            allowedTakeRoles: [],
            logoUrl: '',
            bannerUrl: ''
        });
    };

    const handleEdit = (quiz: Quiz) => {
        setEditingQuiz({
            id: quiz.id,
            titleKey: quiz.titleKey,
            titleEn: translations[quiz.titleKey]?.en || '',
            titleAr: translations[quiz.titleKey]?.ar || '',
            descriptionKey: quiz.descriptionKey,
            descriptionEn: translations[quiz.descriptionKey]?.en || '',
            descriptionAr: translations[quiz.descriptionKey]?.ar || '',
            isOpen: quiz.isOpen,
            allowedTakeRoles: quiz.allowedTakeRoles || [],
            logoUrl: quiz.logoUrl,
            bannerUrl: quiz.bannerUrl,
            questions: (quiz.questions || []).map(q => ({
                ...q,
                textEn: translations[q.textKey]?.en || '',
                textAr: translations[q.textKey]?.ar || '',
            }))
        });
    };

    const handleSave = async () => {
        if (!editingQuiz) return;
        setIsSaving(true);
        try {
            await saveQuiz(editingQuiz);
            setEditingQuiz(null);
            showToast('Quiz saved!', 'success');
            await refreshTranslations();
            await fetchQuizzes();
        } catch (error) {
            showToast(`Error: ${(error as Error).message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (quiz: Quiz) => {
        // FIX: Guard against window access in non-browser environments.
        if (typeof window !== 'undefined' && (window as any).confirm(`Delete "${t(quiz.titleKey)}"? This is irreversible.`)) {
            try {
                await deleteQuiz(quiz.id);
                showToast('Quiz deleted!', 'success');
                fetchQuizzes();
            } catch (error) {
                showToast(`Error: ${(error as Error).message}`, 'error');
            }
        }
    };
    
    const handleQuestionChange = (index: number, field: keyof EditingQuizData['questions'][0], value: string | number) => {
        if (!editingQuiz) return;
        const newQuestions = [...editingQuiz.questions];
        (newQuestions[index] as any)[field] = value;
        setEditingQuiz({ ...editingQuiz, questions: newQuestions });
    };

    const addQuestion = () => {
        if (!editingQuiz) return;
        const newQId = crypto.randomUUID();
        const newQuestion: EditableQuestion = { 
            id: newQId, 
            textKey: `quiz_${editingQuiz.id}_q_${newQId}_text`, 
            textEn: '', 
            textAr: '', 
            timeLimit: 60 
        };
        setEditingQuiz({ ...editingQuiz, questions: [...editingQuiz.questions, newQuestion] });
    };

    const removeQuestion = (index: number) => {
        if (!editingQuiz) return;
        const newQuestions = editingQuiz.questions.filter((_, i) => i !== index);
        setEditingQuiz({ ...editingQuiz, questions: newQuestions });
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
                                    <td className="p-4 text-gray-300">{(quiz.questions || []).length}</td>
                                    <td className="p-4 text-right">
                                        <div className="inline-flex gap-4">
                                            <button onClick={() => handleEdit(quiz)} className="text-gray-300 hover:text-brand-cyan"><Edit size={20}/></button>
                                            <button onClick={() => handleDelete(quiz)} className="text-gray-300 hover:text-red-500"><Trash2 size={20}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            {editingQuiz && <Modal isOpen={!!editingQuiz} onClose={() => setEditingQuiz(null)} title={t(editingQuiz.titleEn ? 'edit_quiz' : 'create_new_quiz')} maxWidth="3xl">
                <div className="space-y-4 text-white">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block mb-1 font-semibold text-gray-300">{t('title_en')}</label>
                            {/* FIX: Explicitly cast e.currentTarget to HTMLInputElement to access its 'value' property. */}
                            <input type="text" value={editingQuiz.titleEn} onChange={(e) => setEditingQuiz({ ...editingQuiz, titleEn: (e.currentTarget as HTMLInputElement).value })} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" />
                        </div>
                        <div>
                            <label className="block mb-1 font-semibold text-gray-300">{t('title_ar')}</label>
                            {/* FIX: Explicitly cast e.currentTarget to HTMLInputElement to access its 'value' property. */}
                            <input type="text" dir="rtl" value={editingQuiz.titleAr} onChange={(e) => setEditingQuiz({ ...editingQuiz, titleAr: (e.currentTarget as HTMLInputElement).value })} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" />
                        </div>
                    </div>
                     <div>
                        <label className="block mb-1 font-semibold text-gray-300">{t('description_en')}</label>
                        {/* FIX: Explicitly cast e.currentTarget to HTMLTextAreaElement to access its 'value' property. */}
                        <textarea value={editingQuiz.descriptionEn} onChange={(e) => setEditingQuiz({ ...editingQuiz, descriptionEn: (e.currentTarget as HTMLTextAreaElement).value })} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600 h-24" />
                    </div>
                     <div>
                        <label className="block mb-1 font-semibold text-gray-300">{t('description_ar')}</label>
                        {/* FIX: Explicitly cast e.currentTarget to HTMLTextAreaElement to access its 'value' property. */}
                        <textarea dir="rtl" value={editingQuiz.descriptionAr} onChange={(e) => setEditingQuiz({ ...editingQuiz, descriptionAr: (e.currentTarget as HTMLTextAreaElement).value })} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600 h-24" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block mb-1 font-semibold text-gray-300">{t('logo_image_url')}</label>
                            {/* FIX: Explicitly cast e.currentTarget to HTMLInputElement to access its 'value' property. */}
                            <input type="text" value={editingQuiz.logoUrl || ''} onChange={(e) => setEditingQuiz({ ...editingQuiz, logoUrl: (e.currentTarget as HTMLInputElement).value })} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" />
                        </div>
                        <div>
                            <label className="block mb-1 font-semibold text-gray-300">{t('banner_image_url')}</label>
                            {/* FIX: Explicitly cast e.currentTarget to HTMLInputElement to access its 'value' property. */}
                            <input type="text" value={editingQuiz.bannerUrl || ''} onChange={(e) => setEditingQuiz({ ...editingQuiz, bannerUrl: (e.currentTarget as HTMLInputElement).value })} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" />
                        </div>
                    </div>
                    <div>
                        <label className="block mb-1 font-semibold text-gray-300">{t('quiz_handler_roles')}</label>
                        {/* FIX: Explicitly cast e.currentTarget to HTMLInputElement to access its 'value' property. */}
                        <input type="text" placeholder="e.g. 123,456" value={(editingQuiz.allowedTakeRoles || []).join(',')} onChange={(e) => setEditingQuiz({ ...editingQuiz, allowedTakeRoles: (e.currentTarget as HTMLInputElement).value.split(',').map(s => s.trim()).filter(Boolean) })} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" />
                        <p className="text-xs text-gray-400 mt-1">{t('quiz_handler_roles_desc')}</p>
                    </div>
                     <div className="flex items-center gap-4 pt-2">
                        <label className="font-semibold text-gray-300">{t('status')}:</label>
                        <button onClick={() => setEditingQuiz({ ...editingQuiz, isOpen: !editingQuiz.isOpen })}
                            className={`px-4 py-1 rounded-full font-bold ${editingQuiz.isOpen ? 'bg-green-500/30 text-green-300' : 'bg-red-500/30 text-red-300'}`}>
                            {editingQuiz.isOpen ? t('open') : t('closed')}
                        </button>
                    </div>
                    
                    <div className="pt-4 border-t border-brand-light-blue/50">
                        <h3 className="text-xl font-bold mb-3">{t('quiz_questions')}</h3>
                        <div className="space-y-3">
                            {(editingQuiz.questions || []).map((q, index) => (
                                <div key={q.id} className="bg-brand-dark p-3 rounded-lg border border-gray-700 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="font-semibold text-gray-300">Question {index + 1}</label>
                                        <button onClick={() => removeQuestion(index)} className="text-red-500 hover:text-red-400"><Trash2 size={18} /></button>
                                    </div>
                                    {/* FIX: Explicitly cast e.currentTarget to HTMLInputElement to access its 'value' property. */}
                                    <input type="text" placeholder={t('text_en')} value={q.textEn} onChange={(e) => handleQuestionChange(index, 'textEn', (e.currentTarget as HTMLInputElement).value)} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600"/>
                                    {/* FIX: Explicitly cast e.currentTarget to HTMLInputElement to access its 'value' property. */}
                                    <input type="text" dir="rtl" placeholder={t('text_ar')} value={q.textAr} onChange={(e) => handleQuestionChange(index, 'textAr', (e.currentTarget as HTMLInputElement).value)} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600"/>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-400">{t('time_limit_seconds')}</label>
                                        {/* FIX: Explicitly cast e.currentTarget to HTMLInputElement to access its 'value' property. */}
                                        <input type="number" placeholder={t('time_limit_seconds')} value={q.timeLimit} onChange={(e) => handleQuestionChange(index, 'timeLimit', parseInt((e.currentTarget as HTMLInputElement).value) || 0)} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600"/>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button onClick={addQuestion} className="mt-4 bg-blue-500/80 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-500 transition-colors flex items-center gap-2">
                            <Plus size={18} /> {t('add_question')}
                        </button>
                    </div>

                    <div className="flex justify-end gap-4 pt-4 border-t border-brand-light-blue/50 mt-4">
                        <button onClick={() => setEditingQuiz(null)} disabled={isSaving} className="bg-gray-600 text-white font-bold py-2 px-6 rounded-md hover:bg-gray-500">Cancel</button>
                        <button onClick={handleSave} disabled={isSaving} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white min-w-[8rem] flex justify-center">
                            {isSaving ? <Loader2 className="animate-spin" /> : t('save_quiz')}
                        </button>
                    </div>
                </div>
            </Modal>}
        </Panel>
    );
};

export default QuizzesPanel;