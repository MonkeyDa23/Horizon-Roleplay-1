// src/components/admin/TranslationsPanel.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useToast } from '../../hooks/useToast';
import { getTranslations, saveTranslations } from '../../lib/api';
import type { Translations } from '../../types';
import { Loader2, Search } from 'lucide-react';

const TranslationsPanel: React.FC = () => {
    const { t } = useLocalization();
    const { showToast } = useToast();
    const [allTranslations, setAllTranslations] = useState<Translations>({});
    const [editableTranslations, setEditableTranslations] = useState<Translations>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchTranslations = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getTranslations();
            setAllTranslations(data);
            setEditableTranslations(JSON.parse(JSON.stringify(data))); // Deep copy
        } catch (error) {
            showToast('Failed to load translations.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchTranslations();
    }, [fetchTranslations]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await saveTranslations(editableTranslations);
            setAllTranslations(JSON.parse(JSON.stringify(editableTranslations)));
            showToast(t('save_translations'), 'success');
        } catch (error) {
            showToast((error as Error).message, 'error');
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleTranslationChange = (key: string, lang: 'en' | 'ar', value: string) => {
        setEditableTranslations(prev => ({
            ...prev,
            [key]: { ...prev[key], [lang]: value }
        }));
    };

    const filteredKeys = useMemo(() => {
        return Object.keys(editableTranslations).filter(key => 
            key.toLowerCase().includes(searchTerm.toLowerCase()) ||
            editableTranslations[key].en.toLowerCase().includes(searchTerm.toLowerCase()) ||
            editableTranslations[key].ar.toLowerCase().includes(searchTerm.toLowerCase())
        ).sort();
    }, [editableTranslations, searchTerm]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 size={40} className="text-brand-cyan animate-spin" />
            </div>
        );
    }
    
    return (
        <div className="animate-fade-in-up">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                <div className="relative w-full md:max-w-md">
                    <Search className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-400" size={20} />
                    <input 
                        type="text"
                        placeholder="Search by key or text..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-brand-light-blue p-2 pl-10 rounded-md border border-gray-600 focus:ring-brand-cyan focus:border-brand-cyan"
                    />
                </div>
                <button onClick={handleSave} disabled={isSaving} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white transition-colors min-w-[9rem] flex justify-center">
                    {isSaving ? <Loader2 className="animate-spin" /> : t('save_translations')}
                </button>
            </div>
            
            <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50 overflow-hidden">
                <div className="overflow-x-auto max-h-[65vh]">
                    <table className="w-full text-left min-w-[800px] relative">
                        <thead className="sticky top-0 border-b border-brand-light-blue/50 text-gray-300 bg-brand-dark-blue z-10">
                            <tr>
                                <th className="p-4 w-1/4">Key</th>
                                <th className="p-4 w-2/5">English</th>
                                <th className="p-4 w-2/5">العربية</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredKeys.map(key => (
                                <tr key={key} className="border-b border-brand-light-blue/50 last:border-none hover:bg-brand-light-blue/20 transition-colors">
                                    <td className="p-4 font-mono text-sm text-brand-cyan align-top pt-5">{key}</td>
                                    <td className="p-4">
                                        <textarea 
                                            value={editableTranslations[key].en}
                                            onChange={(e) => handleTranslationChange(key, 'en', e.target.value)}
                                            className="w-full bg-brand-dark p-2 rounded-md border border-gray-600 h-24 focus:ring-brand-cyan focus:border-brand-cyan"
                                        />
                                    </td>
                                    <td className="p-4">
                                         <textarea 
                                            value={editableTranslations[key].ar}
                                            onChange={(e) => handleTranslationChange(key, 'ar', e.target.value)}
                                            className="w-full bg-brand-dark p-2 rounded-md border border-gray-600 h-24 focus:ring-brand-cyan focus:border-brand-cyan"
                                            dir="rtl"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TranslationsPanel;