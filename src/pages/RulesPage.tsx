/**
 * Florida Roleplay - Official Website
 * Rules Page
 * Copyright (c) 2024 Florida Roleplay. All rights reserved.
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
  const communityName = branding.siteName;
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
        setOpenCategoryId(null); // Ensure all categories are closed by default
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
            <Loader2 size={48} className="animate-spin opacity-20" style={{ color: branding.primaryColor }} />
        </div>
      );
    }
    if (error) {
      return (
        <div className="bg-red-500/10 border border-red-500/20 p-20 rounded-[50px] text-center text-red-400 font-bold">
          <AlertTriangle size={64} className="mx-auto mb-6 opacity-40" />
          <h2 className="text-3xl font-black mb-4">{t('rules_load_failed')}</h2>
          <p className="opacity-80">{error}</p>
        </div>
      );
    }
    if (ruleCategories.length === 0) {
      return (
        <div className="text-center bg-white/[0.03] border border-white/10 p-20 rounded-[50px]">
          <BookOpen size={64} className="mx-auto mb-6 opacity-10" />
          <p className="text-2xl font-black text-text-secondary opacity-60 tracking-tight">{t('no_rules_yet')}</p>
        </div>
      );
    }
    return ruleCategories.map((category, index) => (
      <div key={category.id} className="bg-white/[0.03] border border-white/10 rounded-[40px] overflow-hidden animate-stagger hover:shadow-2xl transition-all duration-500 px-2 pt-2 mb-4" style={{ animationDelay: `${index * 100}ms` }}>
        <button
          onClick={() => toggleCategory(category.id)}
          className="w-full flex justify-between items-center p-8 rounded-[32px] text-start hover:bg-white/5 transition-all duration-300 group"
          aria-expanded={openCategoryId === category.id}
        >
          <h2 className="text-2xl font-black transition-colors" style={{ color: openCategoryId === category.id ? branding.primaryColor : 'white' }}>{t(category.titleKey)}</h2>
          <div className={`p-4 rounded-2xl transition-all duration-500 ${openCategoryId === category.id ? 'bg-white/10 rotate-180' : 'bg-white/5 opacity-40'}`}>
            <ChevronDown size={28} style={{ color: openCategoryId === category.id ? branding.primaryColor : 'white' }} />
          </div>
        </button>
        <div 
            className="grid transition-all duration-500 ease-in-out"
            style={{ gridTemplateRows: openCategoryId === category.id ? '1fr' : '0fr' }}
        >
            <div className="overflow-hidden">
                <div className="px-10 pb-10 pt-4">
                    <ol className="list-none space-y-6">
                    {(category.rules || []).map((rule, idx) => (
                        <li key={rule.id} className="flex gap-6 items-start group/rule">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm border border-white/10 flex-shrink-0 transition-all group-hover/rule:border-transparent" style={{ backgroundColor: `${branding.primaryColor}11`, color: branding.primaryColor }}>
                            {idx + 1}
                          </div>
                          <span className="text-lg font-medium text-text-secondary leading-relaxed opacity-80 group-hover/rule:opacity-100 group-hover/rule:text-white transition-all pt-1">{t(rule.textKey)}</span>
                        </li>
                    ))}
                    </ol>
                </div>
            </div>
        </div>
      </div>
    ));
  };

  return (
    <>
      <SEO 
        title={`${communityName} - ${t('rules')}`}
        description={t('rules_seo_desc', { communityName })}
        keywords={`rules, server rules, guidelines, community guidelines, ${(communityName || "").toLowerCase()}`}
      />
      <div className="container mx-auto px-6 py-24 max-w-[1000px]" dir={dir}>
        <div className="text-center mb-24 animate-fade-in-up">
          <div className="inline-block p-6 bg-white/5 rounded-[32px] mb-8 border border-white/10 shadow-2xl relative">
            <div className="absolute inset-0 blur-2xl opacity-20" style={{ backgroundColor: branding.primaryColor }}></div>
            <BookOpen style={{ color: branding.primaryColor }} size={48} className="relative z-10" />
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white">{t('rules_title')}</h1>
          <p className="text-text-secondary text-xl mt-4 font-medium opacity-60 tracking-tight">{t('rules_subtitle')}</p>
        </div>
        
        <div className="space-y-2">
          {renderContent()}
        </div>
      </div>
    </>
  );
};

export default RulesPage;
