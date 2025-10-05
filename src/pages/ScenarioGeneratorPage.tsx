import React, { useState } from 'react';
import { useLocalization } from '../hooks/useLocalization';
import { GoogleGenAI, Type } from "@google/genai";
import { Sparkles, Loader2, Wand2, Dices, BookOpen, Users, Play } from 'lucide-react';

interface ParsedScenario {
  title: string;
  synopsis: string;
  roles: string[];
  kickoff: string;
}

const ScenarioGeneratorPage: React.FC = () => {
  const { t } = useLocalization();
  const [keywords, setKeywords] = useState('');
  const [scenario, setScenario] = useState<ParsedScenario | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setScenario(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const prompt = `You are a creative storyteller for a Multi Theft Auto (MTA) roleplaying server called 'Horizon VRoleplay'. Generate a compelling roleplay scenario based on the following keywords: "${keywords}". If no keywords are provided, create a general-purpose, engaging scenario. Keep the tone immersive and suitable for a serious roleplay environment.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: "A catchy title for the scenario."
              },
              synopsis: {
                type: Type.STRING,
                description: "A brief 2-4 sentence summary of the scenario."
              },
              roles: {
                type: Type.ARRAY,
                items: {
                  type: Type.STRING
                },
                description: "A list of 3-5 key roles for players (e.g., 'Lead Detective')."
              },
              kickoff: {
                type: Type.STRING,
                description: "A short paragraph describing the initial event that starts the roleplay for the players."
              }
            },
            required: ["title", "synopsis", "roles", "kickoff"]
          }
        }
      });

      const jsonText = response.text.trim();
      const parsed: ParsedScenario = JSON.parse(jsonText);
      
      setScenario(parsed);

    } catch (err) {
      console.error("Gemini API error or parsing error:", err);
      setError(t('scenario_error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <div className="inline-block p-4 bg-brand-light-blue rounded-full mb-4">
          <Sparkles className="text-brand-cyan" size={48} />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4">{t('page_title_scenarios')}</h1>
        <p className="text-lg text-gray-300 max-w-3xl mx-auto">{t('scenarios_intro')}</p>
      </div>

      <div className="max-w-2xl mx-auto">
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder={t('keywords_placeholder')}
            className="flex-grow bg-brand-light-blue text-white py-3 px-4 rounded-lg border-2 border-brand-light-blue focus:border-brand-cyan focus:outline-none focus:ring-0 transition-colors"
            disabled={isLoading}
          />
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="bg-brand-cyan text-brand-dark font-bold py-3 px-6 rounded-md hover:bg-white hover:shadow-glow-cyan transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait"
          >
            {isLoading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>{t('generating')}</span>
              </>
            ) : (
              <>
                <Wand2 size={20} />
                <span>{t('generate_scenario')}</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mt-8 text-center bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-lg">
            {error}
          </div>
        )}

        {scenario && (
           <div className="mt-10 bg-brand-dark-blue border border-brand-light-blue/50 rounded-lg p-8 animate-fade-in space-y-6">
              <div>
                <h2 className="flex items-center gap-3 text-3xl font-bold text-brand-cyan">
                  <Dices size={28} />
                  {scenario.title}
                </h2>
              </div>
          
              <div className="space-y-2">
                <h3 className="flex items-center gap-2 text-xl font-semibold text-white border-b-2 border-brand-light-blue pb-2">
                  <BookOpen size={20} />
                  Synopsis
                </h3>
                <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{scenario.synopsis}</p>
              </div>
          
              <div className="space-y-2">
                 <h3 className="flex items-center gap-2 text-xl font-semibold text-white border-b-2 border-brand-light-blue pb-2">
                  <Users size={20} />
                  Suggested Roles
                </h3>
                <ul className="list-disc list-inside text-gray-300 space-y-1 ps-2">
                  {scenario.roles.map((role, index) => (
                    <li key={index}>{role}</li>
                  ))}
                </ul>
              </div>
              
              <div className="space-y-2">
                 <h3 className="flex items-center gap-2 text-xl font-semibold text-white border-b-2 border-brand-light-blue pb-2">
                  <Play size={20} />
                  Kick-off Event
                </h3>
                <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{scenario.kickoff}</p>
              </div>
            </div>
        )}
      </div>
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default ScenarioGeneratorPage;
