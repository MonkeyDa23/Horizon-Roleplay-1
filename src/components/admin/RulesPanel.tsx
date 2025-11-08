


// src/components/admin/RulesPanel.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useToast } from '../../hooks/useToast';
import { getRules, saveRules } from '../../lib/api';
import type { RuleCategory, Rule } from '../../types';
import { useTranslations } from '../../hooks/useTranslations';
import { Loader2, Plus, GripVertical, Trash2 } from 'lucide-react';

interface EditableRule extends Rule {
    textEn: string;
    textAr: string;
}
// FIX: Replaced Omit with an explicit type definition to fix compatibility issues.
interface EditableRuleCategory {
    id: string;
    titleKey: string;
    position: number;
    titleEn: string;
    titleAr: string;
    rules: EditableRule[];
}

const RulesPanel: React.FC = () => {
    const { t } = useLocalization();
    const { showToast } = useToast();
    const { translations, loading: translationsLoading, refreshTranslations } = useTranslations();
    const [categories, setCategories] = useState<EditableRuleCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const fetchRules = useCallback(async () => {
        if (translationsLoading) return;
        setIsLoading(true);
        try {
            const fetchedRules = await getRules();
            const editableData = fetchedRules.map(cat => ({
                ...cat,
                titleEn: translations[cat.titleKey]?.en || '',
                titleAr: translations[cat.titleKey]?.ar || '',
                rules: (cat.rules || []).map(rule => ({
                    ...rule,
                    textEn: translations[rule.textKey]?.en || '',
                    textAr: translations[rule.textKey]?.ar || '',
                }))
            }));
            setCategories(editableData);
        } catch (error) {
            showToast('Failed to load rules.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showToast, translations, translationsLoading]);

    useEffect(() => {
        fetchRules();
    }, [fetchRules]);
    
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const positionedCategories = categories.map((cat, index) => ({ ...cat, position: index }));
            await saveRules(positionedCategories);
            await refreshTranslations();
            showToast(t('rules_updated_success'), 'success');
        } catch (error) {
            showToast((error as Error).message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCategoryChange = (index: number, field: 'titleEn' | 'titleAr', value: string) => {
        const newCategories = [...categories];
        newCategories[index] = { ...newCategories[index], [field]: value };
        setCategories(newCategories);
    };

    const handleRuleChange = (catIndex: number, ruleIndex: number, field: 'textEn' | 'textAr', value: string) => {
        const newCategories = [...categories];
        newCategories[catIndex].rules[ruleIndex] = { ...newCategories[catIndex].rules[ruleIndex], [field]: value };
        setCategories(newCategories);
    };
    
    const addCategory = () => {
        const newId = crypto.randomUUID();
        const newCategory: EditableRuleCategory = {
            id: newId,
            titleKey: `rule_cat_${newId}_title`,
            titleEn: 'New Category',
            titleAr: 'قسم جديد',
            position: categories.length,
            rules: [],
        };
        setCategories([...categories, newCategory]);
    };
    
    const deleteCategory = (index: number) => {
        setCategories(categories.filter((_, i) => i !== index));
    };
    
    const addRule = (catIndex: number) => {
        const newId = crypto.randomUUID();
        const newRule: EditableRule = { 
            id: newId, 
            textKey: `rule_${newId}_text`,
            textEn: 'New rule text.',
            textAr: 'نص قانون جديد.'
        };
        const newCategories = [...categories];
        newCategories[catIndex].rules.push(newRule);
        setCategories(newCategories);
    };
    
    const deleteRule = (catIndex: number, ruleIndex: number) => {
        const newCategories = [...categories];
        newCategories[catIndex].rules = newCategories[catIndex].rules.filter((_, i) => i !== ruleIndex);
        setCategories(newCategories);
    };

    if (isLoading || translationsLoading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 size={40} className="text-brand-cyan animate-spin" />
            </div>
        );
    }
    
    return (
        <div className="animate-fade-in-up">
            <div className="flex justify-between items-center mb-6">
                <p className="text-gray-400">Manage rule categories and their contents below.</p>
                <div className="flex gap-4">
                     <button onClick={addCategory} className="bg-blue-500/80 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-500 transition-colors flex items-center gap-2">
                        <Plus size={18} /> Add Category
                    </button>
                    <button onClick={handleSave} disabled={isSaving} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white transition-colors min-w-[9rem] flex justify-center">
                        {isSaving ? <Loader2 className="animate-spin" /> : t('save_rules')}
                    </button>
                </div>
            </div>
            
            <div className="space-y-6">
                {categories.map((category, catIndex) => (
                    <div key={category.id} className="bg-brand-dark-blue p-4 rounded-lg border border-brand-light-blue/50">
                        <div className="flex items-center gap-3 mb-4 p-2 bg-brand-light-blue/50 rounded-md">
                            <GripVertical className="cursor-grab text-gray-500" />
                             <div className="flex-grow grid grid-cols-2 gap-3">
                                {/* FIX: Use e.currentTarget.value to correctly access the input's value. */}
                                <input type="text" value={category.titleEn} onChange={(e) => handleCategoryChange(catIndex, 'titleEn', e.currentTarget.value)} placeholder="Category Title (EN)" className="w-full bg-transparent text-xl font-bold text-white focus:outline-none"/>
                                {/* FIX: Use e.currentTarget.value to correctly access the input's value. */}
                                <input type="text" dir="rtl" value={category.titleAr} onChange={(e) => handleCategoryChange(catIndex, 'titleAr', e.currentTarget.value)} placeholder="عنوان القسم (AR)" className="w-full bg-transparent text-xl font-bold text-white focus:outline-none"/>
                             </div>
                            <button onClick={() => deleteCategory(catIndex)} className="text-red-500 hover:text-red-400"><Trash2 size={20} /></button>
                        </div>
                        <div className="space-y-3 pl-8">
                            {category.rules.map((rule, ruleIndex) => (
                                <div key={rule.id} className="flex items-start gap-2">
                                    <span className="text-gray-500 font-bold pt-2">{ruleIndex + 1}.</span>
                                    <div className="w-full grid grid-cols-2 gap-2">
                                        {/* FIX: Use e.currentTarget.value to correctly access the textarea's value. */}
                                        <textarea value={rule.textEn} onChange={(e) => handleRuleChange(catIndex, ruleIndex, 'textEn', e.currentTarget.value)} placeholder="Rule Text (EN)" className="w-full bg-brand-dark p-2 rounded-md border border-gray-600 focus:ring-brand-cyan focus:border-brand-cyan h-20"/>
                                        {/* FIX: Use e.currentTarget.value to correctly access the textarea's value. */}
                                        <textarea dir="rtl" value={rule.textAr} onChange={(e) => handleRuleChange(catIndex, ruleIndex, 'textAr', e.currentTarget.value)} placeholder="نص القانون (AR)" className="w-full bg-brand-dark p-2 rounded-md border border-gray-600 focus:ring-brand-cyan focus:border-brand-cyan h-20"/>
                                    </div>
                                    <button onClick={() => deleteRule(catIndex, ruleIndex)} className="text-red-500 hover:text-red-400 pt-2"><Trash2 size={18} /></button>
                                </div>
                            ))}
                            <button onClick={() => addRule(catIndex)} className="text-sm text-brand-cyan hover:text-white font-semibold flex items-center gap-1">
                                <Plus size={16} /> Add Rule
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RulesPanel;
