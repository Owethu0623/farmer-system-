import React from 'react';
import {
  ArrowRight,
  Compass,
  Globe,
  Layers,
  MapPin,
  Sprout,
  Tractor,
  Volume2,
} from 'lucide-react';
import { LANGUAGE_LIST, t } from '../i18n/translations';
import { LanguageCode } from '../types';
import {
  EasyReadToggle,
  LanguageSelector,
  SaslBanner,
  SpeakButton,
} from './AccessibilityControls';

interface LandingPageProps {
  languageCode: LanguageCode;
  onLanguageChange: (code: LanguageCode) => void;
  largeMode: boolean;
  onToggleLargeMode: () => void;
  isSpeaking: boolean;
  onSpeak: (text: string) => void;
  onStopSpeaking: () => void;
  speechSupported: boolean;
  onNavigateAuth: (mode: 'login' | 'register', preselectRole?: 'prospective_farmer' | 'existing_farmer') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  languageCode,
  onLanguageChange,
  largeMode,
  onToggleLargeMode,
  isSpeaking,
  onSpeak,
  onStopSpeaking,
  speechSupported,
  onNavigateAuth,
}) => {
  const heroNarration = `${t(languageCode, 'tagline')} ${t(languageCode, 'heroTitle')} ${t(
    languageCode,
    'heroSubtitle'
  )}`;

  return (
    <div className="min-h-screen bg-[#F6F7F4] text-[#17201B]">
      {/* Strict 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 bg-[#F6F7F4]/95 backdrop-blur border-b border-[#E2E6DF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="font-display text-xl font-bold tracking-tight text-[#143326] whitespace-nowrap shrink-0"
          >
            Field Shift
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#3B4A41]">
            <a
              href="#journeys"
              className="hover:text-[#143326] transition-colors whitespace-nowrap shrink-0"
            >
              {t(languageCode, 'navPlatform')}
            </a>
            <a
              href="#mapping"
              className="hover:text-[#143326] transition-colors whitespace-nowrap shrink-0"
            >
              Land & GIS
            </a>
            <a
              href="#languages"
              className="hover:text-[#143326] transition-colors whitespace-nowrap shrink-0"
            >
              {t(languageCode, 'navLanguages')}
            </a>
            <a
              href="#accessibility"
              className="hover:text-[#143326] transition-colors whitespace-nowrap shrink-0"
            >
              {t(languageCode, 'navAccessibility')}
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateAuth('login')}
              className="px-4 py-2 text-sm font-semibold text-[#143326] hover:text-[#2D6A4F] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {t(languageCode, 'signIn')}
            </button>
          </div>
        </div>
      </header>

      {/* Utility Strip below header for language & accessibility */}
      <div className="border-b border-[#E2E6DF] bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <LanguageSelector value={languageCode} onChange={onLanguageChange} compact />
            <EasyReadToggle
              largeMode={largeMode}
              onToggle={onToggleLargeMode}
              languageCode={languageCode}
            />
          </div>
          <SpeakButton
            text={heroNarration}
            languageCode={languageCode}
            isSpeaking={isSpeaking}
            onSpeak={onSpeak}
            onStop={onStopSpeaking}
            supported={speechSupported}
          />
        </div>
      </div>

      <main id="top" className="max-w-7xl mx-auto px-4 sm:px-8 py-10 sm:py-14 space-y-16">
        <SaslBanner languageCode={languageCode} />

        {/* Hero Section: Balanced 2-Column Split */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-between py-2 space-y-6">
            <div className="space-y-4">
              <p className="text-sm font-semibold text-[#2D6A4F] tracking-wide">
                {t(languageCode, 'tagline')}
              </p>
              <h1
                className="font-display font-bold text-[#143326] tracking-tight leading-[1.08]"
                style={{ fontSize: 'clamp(2.25rem, 3.8vw, 3.45rem)', textWrap: 'balance' }}
              >
                {t(languageCode, 'heroTitle')}
              </h1>
              <p className="text-base sm:text-lg text-[#415047] leading-relaxed max-w-xl">
                {t(languageCode, 'heroSubtitle')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => onNavigateAuth('register')}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#1B4332] hover:bg-[#143326] text-white font-semibold text-base transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>{t(languageCode, 'getStarted')}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => onNavigateAuth('login')}
                className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl border border-[#C9D4C8] bg-white hover:bg-[#EDF2EC] text-[#143326] font-semibold text-base transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>{t(languageCode, 'signIn')}</span>
              </button>
            </div>

            <div className="pt-4 border-t border-[#E2E6DF] flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-[#4A5A50]">
              <span>9 Provinces</span>
              <span aria-hidden="true">·</span>
              <span>12 Official Languages</span>
              <span aria-hidden="true">·</span>
              <span>Spatial Field Mapping</span>
              <span aria-hidden="true">·</span>
              <span>Voice & Audio Ready</span>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative h-72 sm:h-96 lg:h-full min-h-[340px] rounded-2xl overflow-hidden border border-[#D4DDD2] bg-[#143326]">
              <img
                src="/src/assets/images/hero_sa_farmland_1794662157430.jpg"
                alt="Irrigated South African maize fields and citrus orchards at sunrise"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0D2118]/75 via-[#0D2118]/15 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 text-white">
                <p className="text-xs font-mono uppercase tracking-wider text-[#D8E9DC]">
                  South African Agricultural Intelligence
                </p>
                <p className="text-base sm:text-lg font-display font-semibold mt-1">
                  From first plot discovery to multi-farm seasonal management.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Two Farmer Journeys */}
        <section id="journeys" className="space-y-6">
          <div className="max-w-2xl space-y-2">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#143326]">
              Two distinct farming journeys on one unified platform
            </h2>
            <p className="text-[#415047]">
              Whether you are preparing to acquire your first hectare or managing established commercial and smallholder farms, Field Shift adapts to your stage.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Prospective Farmer Card */}
            <div className="bg-white border border-[#E2E6DF] rounded-2xl overflow-hidden flex flex-col">
              <div className="aspect-[4/3] w-full bg-[#E8EEE7] overflow-hidden">
                <img
                  src="/src/assets/images/card_prospective_farmer_1794662158844.jpg"
                  alt="Aspiring South African farmer inspecting healthy vegetable seedlings"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-[#2D6A4F]">
                    <Sprout className="w-4 h-4" />
                    <span>Prospective Farmer Journey</span>
                  </div>
                  <h3 className="font-display text-xl font-bold text-[#143326]">
                    {t(languageCode, 'prospectiveTitle')}
                  </h3>
                  <p className="text-sm text-[#415047] leading-relaxed">
                    {t(languageCode, 'prospectiveDesc')}
                  </p>
                  <ul className="pt-2 space-y-1.5 text-sm text-[#35443B]">
                    <li>· Provincial land suitability & rainfall exploration</li>
                    <li>· Farming opportunity discovery matched to budget & plot size</li>
                    <li>· Step-by-step beginner guides & business planning</li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateAuth('register', 'prospective_farmer')}
                  className="w-full py-3 px-4 rounded-xl bg-[#1B4332] hover:bg-[#143326] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span>Start Prospective Farmer Setup</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Existing Farmer Card */}
            <div className="bg-white border border-[#E2E6DF] rounded-2xl overflow-hidden flex flex-col">
              <div className="aspect-[4/3] w-full bg-[#E8EEE7] overflow-hidden">
                <img
                  src="/src/assets/images/card_existing_farmer_1794662159717.jpg"
                  alt="Experienced South African farmer overlooking irrigated cattle pastureland"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-[#2D6A4F]">
                    <Tractor className="w-4 h-4" />
                    <span>Existing Farmer Journey</span>
                  </div>
                  <h3 className="font-display text-xl font-bold text-[#143326]">
                    {t(languageCode, 'existingTitle')}
                  </h3>
                  <p className="text-sm text-[#415047] leading-relaxed">
                    {t(languageCode, 'existingDesc')}
                  </p>
                  <ul className="pt-2 space-y-1.5 text-sm text-[#35443B]">
                    <li>· Register and switch across multiple farms under one account</li>
                    <li>· Capture district, municipality, coordinates & field boundaries</li>
                    <li>· Track crops, livestock herds, soils, and irrigation water</li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateAuth('register', 'existing_farmer')}
                  className="w-full py-3 px-4 rounded-xl border border-[#1B4332] bg-white hover:bg-[#EDF2EC] text-[#143326] font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span>Register Your Farm</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Spatial Intelligence & Role Ecosystem */}
        <section
          id="mapping"
          className="bg-white border border-[#E2E6DF] rounded-2xl p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
        >
          <div className="lg:col-span-5 aspect-[4/3] rounded-xl overflow-hidden bg-[#E8EEE7]">
            <img
              src="/src/assets/images/card_field_mapping_1794662159319.jpg"
              alt="Aerial view of demarcated green agricultural contour fields and farm dam"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="lg:col-span-7 space-y-5">
            <h2 className="font-display text-2xl font-bold text-[#143326]">
              Spatial precision across farms, experts, and cooperatives
            </h2>
            <p className="text-[#415047] leading-relaxed">
              Every farm record combines municipal geography, GPS coordinates, and PostGIS polygon boundaries so farmers, agricultural experts, and cooperative managers share an accurate picture of land under cultivation.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[#E2E6DF]">
              <div className="space-y-1 pt-2">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-[#143326]">
                  <MapPin className="w-4 h-4 text-[#2D6A4F]" />
                  <span>Farm Boundaries</span>
                </div>
                <p className="text-xs text-[#4A5A50]">
                  Polygon geometry, perimeter & hectare verification.
                </p>
              </div>
              <div className="space-y-1 pt-2">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-[#143326]">
                  <Layers className="w-4 h-4 text-[#2D6A4F]" />
                  <span>Field Blocks</span>
                </div>
                <p className="text-xs text-[#4A5A50]">
                  Soil type, irrigation method & crop or livestock tracking.
                </p>
              </div>
              <div className="space-y-1 pt-2">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-[#143326]">
                  <Compass className="w-4 h-4 text-[#2D6A4F]" />
                  <span>5 Platform Roles</span>
                </div>
                <p className="text-xs text-[#4A5A50]">
                  Farmers, Experts, Org Managers & System Admins.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 12 Official Languages Matrix */}
        <section id="languages" className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl space-y-2">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#143326]">
                All 12 official South African languages
              </h2>
              <p className="text-[#415047]">
                Select any language below to switch the interface immediately and personalise your agricultural advisor responses.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#4A5A50]">
              <Globe className="w-4 h-4 text-[#1B4332]" />
              <span>Instant language switching</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {LANGUAGE_LIST.map((lang) => {
              const active = lang.code === languageCode;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => onLanguageChange(lang.code)}
                  className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#1B4332] text-white border-[#1B4332]'
                      : 'bg-white text-[#17201B] border-[#E2E6DF] hover:border-[#2D6A4F]'
                  }`}
                >
                  <p className="font-display font-semibold text-base">{lang.nativeName}</p>
                  <p className={`text-xs mt-0.5 ${active ? 'text-[#D8E9DC]' : 'text-[#4A5A50]'}`}>
                    {lang.name}
                  </p>
                  <p className={`text-xs mt-2 ${active ? 'text-[#EFF5F0]' : 'text-[#2D6A4F]'}`}>
                    {lang.greeting}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Accessibility Section */}
        <section
          id="accessibility"
          className="bg-[#143326] text-white rounded-2xl p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
        >
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#B7DEC4]">
              <Volume2 className="w-4 h-4" />
              <span>Designed for older & first-time technology users</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold">
              Simple taps, large readable text, audio guidance, and voice input.
            </h2>
            <p className="text-[#DCE8DF] leading-relaxed max-w-2xl">
              Field Shift minimises typing through step-by-step municipal selectors, oversized touch buttons, spoken instructions on every onboarding screen, and microphone dictation for questions and field notes.
            </p>
          </div>
          <div className="lg:col-span-5 flex flex-col sm:flex-row lg:flex-col gap-3">
            <button
              type="button"
              onClick={onToggleLargeMode}
              className="px-5 py-3.5 rounded-xl bg-white text-[#143326] font-semibold text-sm hover:bg-[#EDF2EC] transition-colors cursor-pointer"
            >
              {largeMode ? 'Standard Text Size' : 'Try Large Text & Buttons Mode'}
            </button>
            <button
              type="button"
              onClick={() => onNavigateAuth('register')}
              className="px-5 py-3.5 rounded-xl bg-[#2D6A4F] text-white font-semibold text-sm hover:bg-[#40916C] transition-colors cursor-pointer"
            >
              Create Accessible Farmer Account
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#E2E6DF] bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 flex flex-wrap items-center justify-between gap-4 text-sm text-[#4A5A50]">
          <p className="font-display font-semibold text-[#143326]">
            Field Shift · {t(languageCode, 'tagline')}
          </p>
          <p>South African Agricultural Intelligence Platform</p>
        </div>
      </footer>
    </div>
  );
};
