import React, { useState, useEffect } from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import { getRules } from '../lib/api';
import type { RuleCategory } from '../types';
import { BookOpen, ChevronDown, Loader2 } from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';
import SEO from '../components/SEO';

const RulesPage: React.FC = () => {
  const { t } = useLocalization();
  const { config } = useConfig();
  const communityName = config.COMMUNITY_NAME;
  const [ruleCategories, setRuleCategories] = useState<RuleCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);

  useEffect(() => {
    const fetchRules = async () => {
      setIsLoading(true);
      try {
        const rules = await getRules();
        setRuleCategories(rules);
        if (rules.length > 0) {
            setOpenCategoryId(rules[0].id); // Open the first category by default
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
    <>
      <SEO 
        title={`${communityName} - ${t('rules')}`}
        description={`Official server rules and community guidelines for ${communityName}. Make sure you are familiar with our rules to ensure a fun and fair roleplay experience.`}
        keywords={`rules, server rules, guidelines, community guidelines, ${communityName.toLowerCase()}`}
      />
      <div className="container mx-auto px-6 py-16">
        <div className="text-center mb-16 animate-fade-in-up">
          <div className="inline-block p-4 bg-background-light rounded-full mb-4 border-2 border-border-color shadow-lg">
            <BookOpen className="text-primary-blue" size={48} />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{t('page_title_rules')}</h1>
        </div>
        
        <div className="max-w-4xl mx-auto space-y-4">
          {isLoading ? (
            <div className="flex justify-center items-center py-20">
                <Loader2 size={40} className="text-primary-blue animate-spin" />
            </div>
          ) : ruleCategories.length > 0 ? (
            ruleCategories.map((category, index) => (
              <div key={category.id} className="glass-panel overflow-hidden animate-stagger hover:shadow-glow-blue-light" style={{ animationDelay: `${index * 100}ms`, opacity: 0 }}>
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="w-full flex justify-between items-center p-6 text-left hover:bg-white/5 transition-colors duration-300"
                  aria-expanded={openCategoryId === category.id}
                >
                  <h2 className="text-2xl font-bold text-primary-blue">{t(category.titleKey)}</h2>
                  <ChevronDown 
                    size={28} 
                    className={`text-text-secondary transition-transform duration-300 ${openCategoryId === category.id ? 'rotate-180 text-primary-blue' : ''}`} 
                  />
                </button>
                <div 
                    className="grid transition-all duration-500 ease-in-out"
                    style={{ gridTemplateRows: openCategoryId === category.id ? '1fr' : '0fr' }}
                >
                    <div className="overflow-hidden">
                        <div className="px-6 pb-6 pt-2 border-t border-border-color">
                            <ol className="list-decimal list-inside space-y-4 text-text-primary text-lg marker:text-primary-blue marker:font-bold">
                            {(category.rules || []).map((rule) => (
                                <li key={rule.id} className="pl-2 leading-relaxed">
                                  <span className="text-text-secondary">{t(rule.textKey)}</span>
                                </li>
                            ))}
                            </ol>
                        </div>
                    </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center glass-panel p-10">
              <p className="text-2xl text-text-secondary">{t('no_rules_yet')}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default RulesPage;