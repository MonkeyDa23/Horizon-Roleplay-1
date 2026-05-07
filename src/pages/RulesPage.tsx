/**
 * Nova Roleplay - Official Website
 * Rules Page
 */
import React, { useState, useEffect } from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import { getRules } from '../lib/api';
import type { RuleCategory } from '../types';
import { BookOpen, ChevronDown, Loader2, AlertTriangle } from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';
import SEO from '../components/SEO';

const RulesPage: React.FC = () => {
  const { t, dir } = useLocalization();
  const { branding } = useConfig();
  const communityName = branding.siteName || 'Nova Roleplay';
  
  const [ruleCategories, setRuleCategories] = useState<RuleCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);

  useEffect(() => {
    const fetchRules = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const rules = await getRules();
        setRuleCategories(rules);
      } catch (err) {
        console.error("Failed to fetch rules:", err);
        setError((err as Error).message || "An unknown error occurred while fetching rules.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchRules();
  }, []);

  const toggleCategory = (categoryId: string) => {
    setOpenCategoryId(prevId => (prevId === categoryId ? null : categoryId));
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center py-24">
          <Loader2 size={54} className="animate-spin opacity-20" style={{ color: branding.primaryColor }} />
        </div>
      );
    }

    if (error) {
      return (
        <div className="glass-panel p-20 text-center text-red-400">
          <AlertTriangle size={64} className="mx-auto mb-6 opacity-40" />
          <h2 className="text-3xl font-black mb-4">{t('rules_load_failed') || 'فشل تحميل القوانين'}</h2>
          <p className="opacity-80 font-medium">{error}</p>
        </div>
      );
    }

    if (ruleCategories.length === 0) {
      return (
        <div className="text-center glass-panel p-20">
          <BookOpen size={64} className="mx-auto mb-6 opacity-10" />
          <p className="text-2xl font-black text-text-secondary opacity-60">
            {t('no_rules_yet') || 'لا توجد قوانين مضافة حالياً.'}
          </p>
        </div>
      );
    }

    return ruleCategories.map((category, index) => (
      <div 
        key={category.id} 
        className="glass-panel overflow-hidden animate-stagger hover:shadow-2xl transition-all duration-500 mb-6 p-0"
        style={{ animationDelay: `${index * 100}ms` }}
      >
        <button 
          onClick={() => toggleCategory(category.id)}
          className="w-full flex justify-between items-center p-8 text-start hover:bg-white/5 transition-all duration-300 group"
          aria-expanded={openCategoryId === category.id}
        >
          <h2 className={`text-2xl md:text-3xl font-black transition-colors ${openCategoryId === category.id ? 'text-white' : 'text-text-secondary group-hover:text-white'}`} style={{ color: openCategoryId === category.id ? branding.primaryColor : undefined }}>
            {t(category.titleKey) || category.id}
          </h2>
          <div className={`p-3 rounded-2xl transition-all duration-500 ${openCategoryId === category.id ? 'bg-white/10 rotate-180' : 'bg-white/5 opacity-40'}`}>
            <ChevronDown size={28} />
          </div>
        </button>

        <div 
          className="grid transition-all duration-500 ease-in-out" 
          style={{ gridTemplateRows: openCategoryId === category.id ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <div className="px-8 pb-10 pt-4 border-t border-white/5">
              <ul className="space-y-8">
                {(category.rules || []).map((rule, idx) => (
                  <li key={rule.id} className="flex gap-8 items-start group/rule">
                    <div 
                      className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg border border-white/10 flex-shrink-0 transition-all group-hover/rule:scale-110 shadow-lg"
                      style={{ backgroundColor: `${branding.primaryColor}11`, color: branding.primaryColor }}
                    >
                      {idx + 1}
                    </div>
                    <div className="space-y-1 pt-1 flex-1">
                      <p className="text-lg md:text-xl font-bold text-white/90 leading-relaxed group-hover/rule:text-white transition-all">
                        {t(rule.textKey) || rule.id}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    ));
  };

  return (
    <>
      <SEO 
        title={`${communityName} - ${t('rules') || 'القوانين'}`} 
        description={`قوانين وتعليمات مجمع ${communityName} لضمان بيئة لعب عادلة وممتعة للجميع.`}
      />

      <div className="container-custom max-w-5xl" dir={dir}>
        <div className="text-center mb-24 animate-fade-in-up space-y-8">
          <div className="inline-block p-6 bg-white/5 rounded-[32px] border border-white/10 shadow-2xl relative group">
            <div className="absolute inset-0 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" style={{ backgroundColor: branding.primaryColor }}></div>
            <BookOpen style={{ color: branding.primaryColor }} size={54} className="relative z-10" />
          </div>
          <h1 className="text-4xl md:text-7xl font-black text-white">{t('rules_title') || 'قوانين السيرفر'}</h1>
          <p className="text-text-secondary text-xl font-medium max-w-2xl mx-auto leading-relaxed">
            {t('rules_subtitle') || 'نرجو من الجميع الالتزام بالقوانين التالية لتجنب العقوبات وضمان استمرارية المتعة للجميع.'}
          </p>
        </div>

        <div className="space-y-4">
          {renderContent()}
        </div>
      </div>
    </>
  );
};

export default RulesPage;
