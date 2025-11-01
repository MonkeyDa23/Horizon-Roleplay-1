// src/components/admin/QuizzesPanel.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useToast } from '../../hooks/useToast';
import { getQuizzes, saveQuiz, deleteQuiz } from '../../lib/api';
import type { Quiz, QuizRound, QuizQuestion } from '../../types';
import { useTranslations } from '../../hooks/useTranslations';
import Modal from '../Modal';
import { Loader2, Plus, Edit, Trash2, GripVertical, ArrowDown, ArrowUp } from 'lucide-react';

// Extended types for the editor state
interface EditingQuestion extends QuizQuestion { textEn: string; textAr: string; }
interface EditingRound extends Omit<QuizRound, 'questions'> { titleEn: string; titleAr: string; questions: EditingQuestion[]; }
interface EditingQuizData extends Omit<Quiz, 'rounds'> {
    titleEn: string; titleAr: string;
    descriptionEn: string; descriptionAr: string;
    rounds: EditingRound[];
    infoPageContentKey?: string | null;
    infoPageContentEn?: string; infoPageContentAr?: string;
}

const Panel: React.FC<{ children: React.ReactNode; isLoading: boolean, loadingText: string }> = ({ children, isLoading, loadingText }) => {
    if (isLoading) return <div className="flex flex-col gap-4 justify-center items-center py-20 min-h-[300px]"><Loader2 size={40} className="text-brand-cyan animate-spin" /><p className="text-gray-400">{loadingText}</p></div>;
    return <div className="animate-fade-in-up">{children}</div>;
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
        try { setQuizzes(await getQuizzes()); } 
        catch (error) { showToast('Failed to load quizzes', 'error'); }
        finally { setIsLoading(false); }
    }, [showToast]);

    useEffect(() => { fetchQuizzes(); }, [fetchQuizzes]);

    const handleCreateNew = () => {
        const newId = crypto.randomUUID();
        setEditingQuiz({
            id: newId,
            titleKey: `quiz_${newId}_title`, titleEn: '', titleAr: '',
            descriptionKey: `quiz_${newId}_desc`, descriptionEn: '', descriptionAr: '',
            infoPageContentKey: `quiz_${newId}_infopage`, infoPageContentEn: '', infoPageContentAr: '',
            isOpen: false, rounds: [], allowedTakeRoles: [],
            logoUrl: '', bannerUrl: '', parent_quiz_id: null
        });
    };

    const handleEdit = (quiz: Quiz) => {
        setEditingQuiz({
            id: quiz.id,
            titleKey: quiz.titleKey, titleEn: translations[quiz.titleKey]?.en || '', titleAr: translations[quiz.titleKey]?.ar || '',
            descriptionKey: quiz.descriptionKey, descriptionEn: translations[quiz.descriptionKey]?.en || '', descriptionAr: translations[quiz.descriptionKey]?.ar || '',
            infoPageContentKey: quiz.info_page_content_key || `quiz_${quiz.id}_infopage`,
            infoPageContentEn: quiz.info_page_content_key ? translations[quiz.info_page_content_key]?.en || '' : '',
            infoPageContentAr: quiz.info_page_content_key ? translations[quiz.info_page_content_key]?.ar || '' : '',
            isOpen: quiz.isOpen, allowedTakeRoles: quiz.allowedTakeRoles || [],
            logoUrl: quiz.logoUrl, bannerUrl: quiz.bannerUrl, parent_quiz_id: quiz.parent_quiz_id,
            rounds: (quiz.rounds || []).map(round => ({
                ...round,
                titleEn: translations[round.titleKey]?.en || '', titleAr: translations[round.titleKey]?.ar || '',
                questions: (round.questions || []).map(q => ({
                    ...q, textEn: translations[q.textKey]?.en || '', textAr: translations[q.textKey]?.ar || ''
                }))
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
        } catch (error) { showToast(`Error: ${(error as Error).message}`, 'error'); }
        finally { setIsSaving(false); }
    };

    const handleDelete = async (quiz: Quiz) => {
        if (window.confirm(`Delete "${t(quiz.titleKey)}"? This is irreversible.`)) {
            try { await deleteQuiz(quiz.id); showToast('Quiz deleted!', 'success'); fetchQuizzes(); }
            catch (error) { showToast(`Error: ${(error as Error).message}`, 'error'); }
        }
    };
    
    // State updaters for nested structure
    const updateQuizField = (field: keyof EditingQuizData, value: any) => setEditingQuiz(prev => prev ? { ...prev, [field]: value } : null);
    const updateRoundField = (rIdx: number, field: keyof EditingRound, value: any) => setEditingQuiz(prev => {
        if (!prev) return null;
        const newRounds = [...prev.rounds];
        (newRounds[rIdx] as any)[field] = value;
        return { ...prev, rounds: newRounds };
    });
    const updateQuestionField = (rIdx: number, qIdx: number, field: keyof EditingQuestion, value: any) => setEditingQuiz(prev => {
        if (!prev) return null;
        const newRounds = [...prev.rounds];
        const newQuestions = [...newRounds[rIdx].questions];
        (newQuestions[qIdx] as any)[field] = value;
        newRounds[rIdx] = { ...newRounds[rIdx], questions: newQuestions };
        return { ...prev, rounds: newRounds };
    });
    const moveItem = (list: any[], from: number, to: number) => {
        const newList = [...list]; const [item] = newList.splice(from, 1); newList.splice(to, 0, item); return newList;
    };
    const addRound = () => setEditingQuiz(prev => {
        if (!prev) return null;
        const newRoundId = crypto.randomUUID();
        return { ...prev, rounds: [...prev.rounds, { titleKey: `quiz_${prev.id}_r_${newRoundId}_title`, titleEn: '', titleAr: '', questions: [] }] };
    });
    const deleteRound = (rIdx: number) => setEditingQuiz(prev => prev ? { ...prev, rounds: prev.rounds.filter((_, i) => i !== rIdx) } : null);
    const addQuestion = (rIdx: number) => setEditingQuiz(prev => {
        if (!prev) return null;
        const newQId = crypto.randomUUID();
        const newRounds = [...prev.rounds];
        newRounds[rIdx] = { ...newRounds[rIdx], questions: [...newRounds[rIdx].questions, { id: newQId, textKey: `q_${newQId}_text`, textEn: '', textAr: '', timeLimit: 60 }] };
        return { ...prev, rounds: newRounds };
    });
    const deleteQuestion = (rIdx: number, qIdx: number) => setEditingQuiz(prev => {
        if (!prev) return null;
        const newRounds = [...prev.rounds];
        newRounds[rIdx] = { ...newRounds[rIdx], questions: newRounds[rIdx].questions.filter((_, i) => i !== qIdx) };
        return { ...prev, rounds: newRounds };
    });
    
    return (
        <Panel isLoading={isLoading} loadingText="Loading quizzes...">
            <div className="flex justify-end mb-6"><button onClick={handleCreateNew} className="bg-brand-cyan text-brand-dark font-bold py-2 px-4 rounded-md hover:bg-white transition-all flex items-center gap-2"><Plus size={20} /> {t('create_new_quiz')}</button></div>
            <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50 overflow-hidden"><div className="overflow-x-auto">
                <table className="w-full text-left min-w-[600px]"><thead className="border-b border-brand-light-blue/50 text-gray-300 bg-brand-light-blue/30"><tr><th className="p-4">{t('quiz_title')}</th><th className="p-4">{t('status')}</th><th className="p-4">{t('questions')}</th><th className="p-4 text-right">{t('actions')}</th></tr></thead>
                    <tbody>{quizzes.map((quiz) => (<tr key={quiz.id} className="border-b border-brand-light-blue/50 last:border-none hover:bg-brand-light-blue/20 transition-colors">
                        <td className="p-4 font-semibold text-white">{t(quiz.titleKey)}</td>
                        <td className="p-4"><span className={`px-3 py-1 text-sm font-bold rounded-full ${quiz.isOpen ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{quiz.isOpen ? t('open') : t('closed')}</span></td>
                        <td className="p-4 text-gray-300">{(quiz.rounds || []).reduce((acc, r) => acc + (r.questions || []).length, 0)}</td>
                        <td className="p-4 text-right"><div className="inline-flex gap-4"><button onClick={() => handleEdit(quiz)} className="text-gray-300 hover:text-brand-cyan"><Edit size={20}/></button><button onClick={() => handleDelete(quiz)} className="text-gray-300 hover:text-red-500"><Trash2 size={20}/></button></div></td>
                    </tr>))}</tbody>
                </table>
            </div></div>
            {editingQuiz && <Modal isOpen={!!editingQuiz} onClose={() => setEditingQuiz(null)} title={t(editingQuiz.titleEn ? 'edit_quiz' : 'create_new_quiz')} maxWidth="4xl">
                <div className="space-y-4 text-white">
                    {/* General Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block mb-1 font-semibold text-gray-300">{t('title_en')}</label><input type="text" value={editingQuiz.titleEn} onChange={(e) => updateQuizField('titleEn', e.target.value)} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" /></div>
                        <div><label className="block mb-1 font-semibold text-gray-300">{t('title_ar')}</label><input type="text" dir="rtl" value={editingQuiz.titleAr} onChange={(e) => updateQuizField('titleAr', e.target.value)} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" /></div>
                    </div>
                     <div><label className="block mb-1 font-semibold text-gray-300">{t('description_en')}</label><textarea value={editingQuiz.descriptionEn} onChange={(e) => updateQuizField('descriptionEn', e.target.value)} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600 h-24" /></div>
                     <div><label className="block mb-1 font-semibold text-gray-300">{t('description_ar')}</label><textarea dir="rtl" value={editingQuiz.descriptionAr} onChange={(e) => updateQuizField('descriptionAr', e.target.value)} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600 h-24" /></div>
                    
                    {/* Rounds Editor */}
                    <div className="pt-4 border-t border-brand-light-blue/50">
                        <h3 className="text-xl font-bold mb-3">Rounds</h3>
                        <div className="space-y-4">
                            {editingQuiz.rounds.map((round, rIdx) => (
                                <div key={rIdx} className="bg-brand-dark p-4 rounded-lg border border-gray-700">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="flex flex-col"><button onClick={() => updateQuizField('rounds', moveItem(editingQuiz.rounds, rIdx, rIdx - 1))} disabled={rIdx === 0} className="disabled:opacity-20"><ArrowUp size={16}/></button><button onClick={() => updateQuizField('rounds', moveItem(editingQuiz.rounds, rIdx, rIdx + 1))} disabled={rIdx === editingQuiz.rounds.length - 1} className="disabled:opacity-20"><ArrowDown size={16}/></button></div>
                                        <div className="flex-grow grid grid-cols-2 gap-3">
                                            <input type="text" value={round.titleEn} onChange={(e) => updateRoundField(rIdx, 'titleEn', e.target.value)} placeholder={`Round ${rIdx + 1} Title (EN)`} className="w-full bg-brand-light-blue text-lg font-bold p-2 rounded border border-gray-600"/>
                                            <input type="text" dir="rtl" value={round.titleAr} onChange={(e) => updateRoundField(rIdx, 'titleAr', e.target.value)} placeholder={`عنوان الجولة ${rIdx + 1} (AR)`} className="w-full bg-brand-light-blue text-lg font-bold p-2 rounded border border-gray-600"/>
                                        </div>
                                        <button onClick={() => deleteRound(rIdx)} className="text-red-500 hover:text-red-400"><Trash2 size={20} /></button>
                                    </div>
                                    <div className="pl-8 space-y-3">
                                        {round.questions.map((q, qIdx) => (
                                            <div key={qIdx} className="bg-brand-dark p-3 rounded-lg border border-gray-600 space-y-2">
                                                <div className="flex justify-between items-center"><label className="font-semibold text-gray-300">Question {qIdx + 1}</label><button onClick={() => deleteQuestion(rIdx, qIdx)} className="text-red-500 hover:text-red-400"><Trash2 size={18} /></button></div>
                                                <input type="text" placeholder={t('text_en')} value={q.textEn} onChange={(e) => updateQuestionField(rIdx, qIdx, 'textEn', e.target.value)} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600"/>
                                                <input type="text" dir="rtl" placeholder={t('text_ar')} value={q.textAr} onChange={(e) => updateQuestionField(rIdx, qIdx, 'textAr', e.target.value)} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600"/>
                                                <div><label className="block text-sm font-semibold text-gray-400">{t('time_limit_seconds')}</label><input type="number" value={q.timeLimit} onChange={(e) => updateQuestionField(rIdx, qIdx, 'timeLimit', parseInt(e.target.value) || 0)} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600"/></div>
                                            </div>
                                        ))}
                                        <button onClick={() => addQuestion(rIdx)} className="mt-2 text-sm text-brand-cyan hover:text-white font-semibold flex items-center gap-1"><Plus size={16} /> Add Question</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button onClick={addRound} className="mt-4 bg-blue-500/80 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-500 transition-colors flex items-center gap-2"><Plus size={18} /> Add Round</button>
                    </div>

                    <div className="flex justify-end gap-4 pt-4 border-t border-brand-light-blue/50 mt-4">
                        <button onClick={() => setEditingQuiz(null)} disabled={isSaving} className="bg-gray-600 text-white font-bold py-2 px-6 rounded-md hover:bg-gray-500">Cancel</button>
                        <button onClick={handleSave} disabled={isSaving} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white min-w-[8rem] flex justify-center">{isSaving ? <Loader2 className="animate-spin" /> : t('save_quiz')}</button>
                    </div>
                </div>
            </Modal>}
        </Panel>
    );
};

export default QuizzesPanel;
