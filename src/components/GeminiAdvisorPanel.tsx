import React, { useEffect, useState } from 'react';
import { BarChart3, MessageSquare, RefreshCw, Send, Sparkles } from 'lucide-react';
import { LANGUAGE_LIST } from '../i18n/translations';
import { apiRequest } from '../lib/api';
import {
  AiFarmAnalyticsReport,
  AiStructuredResponse,
  AuthUser,
  FarmItem,
  LanguageCode,
} from '../types';
import { SpeakButton, VoiceInputButton } from './AccessibilityControls';

interface GeminiAdvisorPanelProps {
  user: AuthUser;
  farms: FarmItem[];
  selectedFarmId: string | null;
  languageCode: LanguageCode;
  isSpeaking: boolean;
  isListening: boolean;
  speechSupported: boolean;
  recognitionSupported: boolean;
  onSpeak: (text: string) => void;
  onStopSpeaking: () => void;
  onStartVoiceInput: (cb: (txt: string) => void) => void;
}

interface ConversationTurn {
  id: string;
  question: string;
  response: AiStructuredResponse;
}

const SUGGESTED_QUESTIONS: string[] = [
  'Which crops may be suitable for my farm?',
  "Is tomorrow's weather suitable for planting?",
  'Why might my maize leaves be changing colour?',
  'How much water might my crops require?',
  'What should I monitor during hot weather?',
  'What livestock feeding practices should I consider?',
  'How many plants are currently registered?',
  'What damage did the last storm cause?',
  'What are my estimated farm expenses?',
  'What should I do next according to my farming activities?',
];

export const GeminiAdvisorPanel: React.FC<GeminiAdvisorPanelProps> = ({
  user,
  farms,
  selectedFarmId,
  languageCode,
  isSpeaking,
  isListening,
  speechSupported,
  recognitionSupported,
  onSpeak,
  onStopSpeaking,
  onStartVoiceInput,
}) => {
  const [subTab, setSubTab] = useState<'chat' | 'analytics'>('chat');
  const [farmId, setFarmId] = useState<string>(selectedFarmId || farms[0]?.id || '');
  const [responseLang, setResponseLang] = useState<LanguageCode>(languageCode);

  useEffect(() => {
    setResponseLang(languageCode);
  }, [languageCode]);

  useEffect(() => {
    if (selectedFarmId && farms.some((f) => f.id === selectedFarmId)) {
      setFarmId(selectedFarmId);
    }
  }, [selectedFarmId, farms]);

  // Conversational state
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // Analytics state
  const [analyticsReport, setAnalyticsReport] = useState<AiFarmAnalyticsReport | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const handleAsk = async (promptText?: string) => {
    const q = (promptText ?? question).trim();
    if (!q) return;
    setChatError(null);
    setLoadingChat(true);
    try {
      const historyPayload = turns.flatMap((turn) => [
        { role: 'user' as const, text: turn.question },
        { role: 'assistant' as const, text: turn.response.answer },
      ]);

      const data = await apiRequest<AiStructuredResponse>('/api/ai/advise', {
        method: 'POST',
        body: JSON.stringify({
          question: q,
          farmId: farmId || undefined,
          languageCode: responseLang,
          conversationHistory: historyPayload,
        }),
      });

      setTurns((prev) => [
        {
          id: `turn-${Date.now()}`,
          question: q,
          response: data,
        },
        ...prev,
      ]);
      if (!promptText) {
        setQuestion('');
      }
    } catch (err: unknown) {
      setChatError(err instanceof Error ? err.message : 'Unable to reach AI advisor.');
    } finally {
      setLoadingChat(false);
    }
  };

  const handleGenerateAnalytics = async () => {
    setAnalyticsError(null);
    setLoadingAnalytics(true);
    try {
      const report = await apiRequest<AiFarmAnalyticsReport>('/api/ai/analytics', {
        method: 'POST',
        body: JSON.stringify({
          farmId: farmId || undefined,
          languageCode: responseLang,
        }),
      });
      setAnalyticsReport(report);
    } catch (err: unknown) {
      setAnalyticsError(
        err instanceof Error ? err.message : 'Unable to generate AI farm analytics.'
      );
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const activeFarm = farms.find((f) => f.id === farmId) || null;

  return (
    <div className="space-y-6">
      {/* Header & Workspace Switcher */}
      <div className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EDF5EF] text-[#1B4332] flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-[#143326]">
                Agricultural Decision-Support Assistant
              </h1>
              <p className="text-xs text-[#4A5A50]">
                Grounded strictly in your farm location, soil reports, live weather, crops, livestock, incidents, and expenses.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={responseLang}
              onChange={(e) => setResponseLang(e.target.value as LanguageCode)}
              className="px-3 py-2 rounded-xl border border-[#D4DDD2] bg-white text-xs font-semibold min-h-[40px]"
            >
              {LANGUAGE_LIST.map((l) => (
                <option key={l.code} value={l.code}>
                  Language: {l.nativeName}
                </option>
              ))}
            </select>

            {farms.length > 0 && (
              <select
                value={farmId}
                onChange={(e) => {
                  setFarmId(e.target.value);
                  setAnalyticsReport(null);
                }}
                className="px-3 py-2 rounded-xl border border-[#D4DDD2] bg-white text-xs font-semibold min-h-[40px]"
              >
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    Farm: {f.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Sub-Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E2E6DF]">
          <div className="flex items-center gap-1 p-1 bg-[#F6F7F4] rounded-xl">
            <button
              type="button"
              onClick={() => setSubTab('chat')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                subTab === 'chat'
                  ? 'bg-white text-[#143326] border border-[#D4DDD2]'
                  : 'text-[#4A5A50] hover:text-[#143326]'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Ask Farm Question</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSubTab('analytics');
                if (!analyticsReport && !loadingAnalytics) {
                  handleGenerateAnalytics();
                }
              }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                subTab === 'analytics'
                  ? 'bg-white text-[#143326] border border-[#D4DDD2]'
                  : 'text-[#4A5A50] hover:text-[#143326]'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>AI Farm Analytics</span>
            </button>
          </div>

          <p className="text-xs text-[#4A5A50]">
            Context: <strong className="text-[#143326]">{activeFarm?.name || user.profile?.province || 'South Africa'}</strong>
          </p>
        </div>
      </div>

      {/* CONVERSATIONAL ASSISTANT TAB */}
      {subTab === 'chat' && (
        <div className="space-y-6">
          {/* Input & Suggested Questions */}
          <section className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#4A5A50]">
                Suggested questions using your selected farm records:
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_QUESTIONS.map((qp) => (
                  <button
                    key={qp}
                    type="button"
                    disabled={loadingChat}
                    onClick={() => handleAsk(qp)}
                    className="text-left px-3.5 py-2 rounded-xl border border-[#D4DDD2] bg-[#F6F7F4] hover:bg-[#EDF5EF] hover:border-[#2D6A4F] text-xs font-medium text-[#17201B] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {qp}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-[#E2E6DF]">
              <textarea
                rows={3}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask about your crops, soil pH, weather window, livestock feed, storm damage, or expenses..."
                className="w-full px-4 py-3 rounded-xl border border-[#D4DDD2] bg-white text-sm focus:outline-none focus:border-[#1B4332]"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <VoiceInputButton
                  languageCode={responseLang}
                  isListening={isListening}
                  supported={recognitionSupported}
                  onStart={() =>
                    onStartVoiceInput((txt) =>
                      setQuestion((prev) => (prev ? `${prev} ${txt}` : txt))
                    )
                  }
                />
                <button
                  type="button"
                  disabled={loadingChat || !question.trim()}
                  onClick={() => handleAsk()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1B4332] hover:bg-[#143326] disabled:opacity-50 text-white font-semibold text-sm min-h-[42px] cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{loadingChat ? 'Analysing farm records...' : 'Ask Decision Assistant'}</span>
                </button>
              </div>
            </div>

            {chatError && (
              <div className="bg-[#FDF2F2] border border-[#E8B4B4] text-[#8E2424] rounded-xl px-4 py-3 text-sm">
                {chatError}
              </div>
            )}
          </section>

          {/* Conversational Response Cards */}
          {turns.length === 0 ? (
            <div className="bg-[#FAFBF9] border border-[#E2E6DF] rounded-2xl p-6 text-sm text-[#4A5A50]">
              Tap any suggested question above or ask your own question. Every answer cites your farm’s actual records, lists assumptions and missing data, and never guarantees yields or profits.
            </div>
          ) : (
            <div className="space-y-5">
              {turns.map((turn) => (
                <article
                  key={turn.id}
                  className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[#E2E6DF]">
                    <div>
                      <p className="text-xs text-[#4A5A50]">
                        {turn.response.farmName || 'General Advisory'} ·{' '}
                        {turn.response.poweredBy === 'gemini'
                          ? 'Gemini AI Grounded'
                          : 'Farm Record Summary Engine'}{' '}
                        · {new Date(turn.response.generatedAt).toLocaleTimeString()}
                      </p>
                      <h3 className="font-display text-base font-bold text-[#143326] mt-0.5">
                        “{turn.question}”
                      </h3>
                    </div>
                    <SpeakButton
                      text={turn.response.answer}
                      languageCode={responseLang}
                      isSpeaking={isSpeaking}
                      onSpeak={onSpeak}
                      onStop={onStopSpeaking}
                      supported={speechSupported}
                      label="Read Aloud"
                    />
                  </div>

                  <div className="text-sm text-[#17201B] whitespace-pre-line leading-relaxed">
                    {turn.response.answer}
                  </div>

                  {turn.response.suggestedActions.length > 0 && (
                    <div className="bg-[#EDF5EF] border border-[#BFD6C5] rounded-xl p-4 space-y-1.5">
                      <p className="text-xs font-bold text-[#143326]">Suggested Next Actions</p>
                      <ul className="text-xs text-[#17201B] space-y-1">
                        {turn.response.suggestedActions.map((a) => (
                          <li key={a}>· {a}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-[#E2E6DF] text-xs">
                    <div>
                      <p className="font-semibold text-[#143326]">Supporting Information Used</p>
                      <ul className="mt-1 space-y-1 text-[#35443B]">
                        {turn.response.supportingInformation.map((s) => (
                          <li key={s}>· {s}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <p className="font-semibold text-[#9A5B13]">Missing Information</p>
                      <ul className="mt-1 space-y-1 text-[#35443B]">
                        {turn.response.missingInformation.map((m) => (
                          <li key={m}>· {m}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <p className="font-semibold text-[#143326]">Assumptions</p>
                        <ul className="mt-1 space-y-1 text-[#35443B]">
                          {turn.response.assumptions.length > 0 ? (
                            turn.response.assumptions.map((a) => <li key={a}>· {a}</li>)
                          ) : (
                            <li>· Grounded directly on stored farm records.</li>
                          )}
                        </ul>
                      </div>
                      <p className="text-[#4A5A50] italic">{turn.response.uncertaintyNote}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI FARM ANALYTICS TAB */}
      {subTab === 'analytics' && (
        <div className="space-y-5">
          <div className="bg-white border border-[#E2E6DF] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-[#143326]">
                AI Farm Performance & Decision Analytics
              </h2>
              <p className="text-xs text-[#4A5A50]">
                Synthesises farm crops, livestock, weather warnings, soil status, production, and expenses.
              </p>
            </div>
            <button
              type="button"
              disabled={loadingAnalytics}
              onClick={handleGenerateAnalytics}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1B4332] hover:bg-[#143326] text-white text-sm font-semibold min-h-[42px] cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loadingAnalytics ? 'animate-spin' : ''}`} />
              <span>{loadingAnalytics ? 'Generating Report...' : 'Refresh AI Analytics'}</span>
            </button>
          </div>

          {analyticsError && (
            <div className="bg-[#FDF2F2] border border-[#E8B4B4] text-[#8E2424] rounded-xl px-4 py-3 text-sm">
              {analyticsError}
            </div>
          )}

          {loadingAnalytics && !analyticsReport && (
            <div className="bg-white border border-[#E2E6DF] rounded-2xl p-8 text-sm text-[#4A5A50]">
              Compiling farm performance, crop, livestock, weather, and expense insights...
            </div>
          )}

          {analyticsReport && (
            <div className="space-y-5">
              <div className="bg-[#143326] text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1 max-w-3xl">
                  <p className="text-xs text-[#B7DEC4] font-mono">
                    {analyticsReport.farmName} ·{' '}
                    {analyticsReport.poweredBy === 'gemini'
                      ? 'Gemini AI Analytics'
                      : 'Grounded Records Analytics'}{' '}
                    · {new Date(analyticsReport.generatedAt).toLocaleString()}
                  </p>
                  <p className="text-base font-medium leading-relaxed">
                    {analyticsReport.farmPerformanceSummary}
                  </p>
                </div>
                <SpeakButton
                  text={`${analyticsReport.farmPerformanceSummary} ${analyticsReport.cropPerformanceInsights} ${analyticsReport.livestockPerformanceInsights} ${analyticsReport.weatherImpactSummary}`}
                  languageCode={responseLang}
                  isSpeaking={isSpeaking}
                  onSpeak={onSpeak}
                  onStop={onStopSpeaking}
                  supported={speechSupported}
                  label="Read Analytics"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <div className="bg-white border border-[#E2E6DF] rounded-2xl p-5 space-y-1.5">
                  <p className="text-xs font-semibold text-[#1B4332]">Crop Performance Insights</p>
                  <p className="text-sm text-[#17201B] leading-relaxed">
                    {analyticsReport.cropPerformanceInsights}
                  </p>
                </div>

                <div className="bg-white border border-[#E2E6DF] rounded-2xl p-5 space-y-1.5">
                  <p className="text-xs font-semibold text-[#1B4332]">
                    Livestock Performance Insights
                  </p>
                  <p className="text-sm text-[#17201B] leading-relaxed">
                    {analyticsReport.livestockPerformanceInsights}
                  </p>
                </div>

                <div className="bg-white border border-[#E2E6DF] rounded-2xl p-5 space-y-1.5">
                  <p className="text-xs font-semibold text-[#1B4332]">Weather Impact Summary</p>
                  <p className="text-sm text-[#17201B] leading-relaxed">
                    {analyticsReport.weatherImpactSummary}
                  </p>
                </div>

                <div className="bg-white border border-[#E2E6DF] rounded-2xl p-5 space-y-1.5">
                  <p className="text-xs font-semibold text-[#1B4332]">Stock & Inventory Summary</p>
                  <p className="text-sm text-[#17201B] leading-relaxed font-mono tabular-nums">
                    {analyticsReport.stockSummary}
                  </p>
                </div>

                <div className="bg-white border border-[#E2E6DF] rounded-2xl p-5 space-y-1.5">
                  <p className="text-xs font-semibold text-[#1B4332]">
                    Production Estimates (Non-Guaranteed)
                  </p>
                  <p className="text-sm text-[#17201B] leading-relaxed">
                    {analyticsReport.productionEstimates}
                  </p>
                </div>

                <div className="bg-white border border-[#E2E6DF] rounded-2xl p-5 space-y-1.5">
                  <p className="text-xs font-semibold text-[#1B4332]">Expense Summary</p>
                  <p className="text-sm text-[#17201B] leading-relaxed font-mono tabular-nums">
                    {analyticsReport.expenseSummary}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <section className="bg-white border border-[#E2E6DF] rounded-2xl p-5 space-y-3">
                  <h3 className="font-display font-bold text-base text-[#143326]">
                    Agricultural Opportunities & Next Actions
                  </h3>
                  <div className="space-y-3 text-xs text-[#17201B]">
                    <div>
                      <p className="font-semibold text-[#2D6A4F]">Opportunities Identified</p>
                      <ul className="mt-1 space-y-1">
                        {analyticsReport.agriculturalOpportunities.map((o) => (
                          <li key={o}>· {o}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-[#143326]">Recommended Next Actions</p>
                      <ul className="mt-1 space-y-1">
                        {analyticsReport.suggestedNextActions.map((a) => (
                          <li key={a}>· {a}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </section>

                <section className="bg-white border border-[#E2E6DF] rounded-2xl p-5 space-y-3">
                  <h3 className="font-display font-bold text-base text-[#143326]">
                    Evidence, Assumptions & Missing Records
                  </h3>
                  <div className="space-y-3 text-xs text-[#35443B]">
                    <div>
                      <p className="font-semibold text-[#143326]">Supporting Records Used</p>
                      <ul className="mt-1 space-y-1">
                        {analyticsReport.supportingInformation.map((s) => (
                          <li key={s}>· {s}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-[#9A5B13]">
                        Assumptions & Missing Information
                      </p>
                      <ul className="mt-1 space-y-1">
                        {analyticsReport.assumptionsAndMissingInfo.map((m) => (
                          <li key={m}>· {m}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
