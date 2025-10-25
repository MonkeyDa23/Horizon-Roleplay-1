// src/components/admin/RulesPanel.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useToast } from '../../hooks/useToast';
import { getRules, saveRules } from '../../lib/api';
import type { RuleCategory, Rule } from '../../types';
import { Loader2, Plus, GripVertical, Trash2 } from 'lucide-react';

const RulesPanel: React.FC = () => {
    const { t } = useLocalization();
    const { showToast } = useToast();
    const [categories, setCategories] = useState<RuleCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const fetchRules = useCallback(async () => {
        setIsLoading(true);
        try {
            const fetchedRules = await getRules();
            setCategories(fetchedRules);
        } catch (error) {
            showToast('Failed to load rules.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchRules();
    }, [fetchRules]);
    
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const positionedCategories = categories.map((cat, index) => ({ ...cat, position: index }));
            await saveRules(positionedCategories);
            showToast(t('rules_updated_success'), 'success');
        } catch (error) {
            showToast((error as Error).message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCategoryChange = (index: number, field: 'titleKey', value: string) => {
        const newCategories = [...categories];
        newCategories[index] = { ...newCategories[index], [field]: value };
        setCategories(newCategories);
    };

    const handleRuleChange = (catIndex: number, ruleIndex: number, value: string) => {
        const newCategories = [...categories];
        newCategories[catIndex].rules[ruleIndex] = { ...newCategories[catIndex].rules[ruleIndex], textKey: value };
        setCategories(newCategories);
    };
    
    const addCategory = () => {
        const newCategory: RuleCategory = {
            id: `cat_${Date.now()}`,
            titleKey: 'new_category_title',
            position: categories.length,
            rules: [],
        };
        setCategories([...categories, newCategory]);
    };
    
    const deleteCategory = (index: number) => {
        setCategories(categories.filter((_, i) => i !== index));
    };
    
    const addRule = (catIndex: number) => {
        const newRule: Rule = { id: `rule_${Date.now()}`, textKey: 'new_rule_text' };
        const newCategories = [...categories];
        newCategories[catIndex].rules.push(newRule);
        setCategories(newCategories);
    };
    
    const deleteRule = (catIndex: number, ruleIndex: number) => {
        const newCategories = [...categories];
        newCategories[catIndex].rules = newCategories[catIndex].rules.filter((_, i) => i !== ruleIndex);
        setCategories(newCategories);
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 size={40} className="text-brand-cyan animate-spin" />
            </div>
        );
    }
    
    return (
        <div className="animate-fade-in-up">
            <div className="flex justify-between items-center mb-6">
                <p className="text-gray-400">Drag and drop categories to re-order them.</p>
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
                            <input 
                                type="text"
                                value={category.titleKey}
                                onChange={(e) => handleCategoryChange(catIndex, 'titleKey', e.target.value)}
                                placeholder="Category Title Key"
                                className="w-full bg-transparent text-xl font-bold text-brand-cyan focus:outline-none"
                            />
                            <button onClick={() => deleteCategory(catIndex)} className="text-red-500 hover:text-red-400"><Trash2 size={20} /></button>
                        </div>
                        <div className="space-y-3 pl-8">
                            {category.rules.map((rule, ruleIndex) => (
                                <div key={rule.id} className="flex items-center gap-2">
                                    <span className="text-gray-500 font-bold">{ruleIndex + 1}.</span>
                                    <input 
                                        type="text"
                                        value={rule.textKey}
                                        onChange={(e) => handleRuleChange(catIndex, ruleIndex, e.target.value)}
                                        placeholder="Rule Text Key"
                                        className="w-full bg-brand-dark p-2 rounded-md border border-gray-600 focus:ring-brand-cyan focus:border-brand-cyan"
                                    />
                                    <button onClick={() => deleteRule(catIndex, ruleIndex)} className="text-red-500 hover:text-red-400"><Trash2 size={18} /></button>
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