import React, { useState, useEffect } from 'react';
import { useLocalization } from '../hooks/useLocalization';
import { getRules } from '../lib/api';
import type { RuleCategory } from '../types';
import { BookOpen, ChevronDown, Loader2 } from 'lucide-react';

const RulesPage: React.FC = () => {
  const { t } = useLocalization();
  const [ruleCategories, setRuleCategories] = useState<RuleCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);

  useEffect(() => {
    const fetchRules = async () => {
      setIsLoading(true);
      try {
        const rules = await getRules();
        setRuleCategories(rules);
        // Automatically open the first category if it exists
        if (rules.length > 0) {
          setOpenCategoryId(rules[0].id);
        }
      } catch (error) {
        console.error("Failed to fetch rules:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRules();
  }, []);
  
  const toggleCategory = (categoryId: string) => {
    setOpenCategoryId(prevId => (prevId === categoryId ? null : categoryId));
  };

  return (
    <div className="container mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <div className="inline-block p-4 bg-brand-light-blue rounded-full mb-4">
          <BookOpen className="text-brand-cyan" size={48} />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold">{t('page_title_rules')}</h1>
      </div>
      
      <div className="max-w-4xl mx-auto space-y-4">
        {isLoading ? (
           <div className="flex justify-center items-center py-20">
              <Loader2 size={40} className="text-brand-cyan animate-spin" />
           </div>
        ) : ruleCategories.length > 0 ? (
          ruleCategories.map((category) => (
            <div key={category.id} className="bg-brand-dark-blue border border-brand-light-blue/50 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full flex justify-between items-center p-6 text-left hover:bg-brand-light-blue/50 transition-colors duration-300"
                aria-expanded={openCategoryId === category.id}
              >
                <h2 className="text-2xl font-bold text-brand-cyan">{t(category.titleKey)}</h2>
                <ChevronDown 
                  size={28} 
                  className={`text-gray-400 transition-transform duration-300 ${openCategoryId === category.id ? 'rotate-180' : ''}`} 
                />
              </button>
              {openCategoryId === category.id && (
                <div className="px-6 pb-6 animate-fade-in-down">
                  <ol className="list-decimal list-inside space-y-4 text-gray-300 text-lg marker:text-brand-cyan marker:font-bold">
                    {category.rules.map((rule) => (
                      <li key={rule.id} className="pl-2">
                        {t(rule.textKey)}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center bg-brand-dark-blue border border-brand-light-blue/50 rounded-lg p-10">
            <p className="text-2xl text-gray-400">{t('no_rules_yet')}</p>
          </div>
        )}
      </div>
       <style>{`
        @keyframes fade-in-down {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-down {
          animation: fade-in-down 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default RulesPage;
