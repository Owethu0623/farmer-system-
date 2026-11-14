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
    <div className="min-h-screen bg-[#F1F5F9] text-[#0F172A]">
      {/* Strict 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 bg-[#0B1F3A] text-white border-b border-[#163055]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="font-display text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            Field Shift
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#CBD5E1]">
            <a
              href="#journeys"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {t(languageCode, 'navPlatform')}
            </a>
            <a
              href="#mapping"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Land & GIS
            </a>
            <a
              href="#languages"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {t(languageCode, 'navLanguages')}
            </a>
            <a
              href="#accessibility"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {t(languageCode, 'navAccessibility')}
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateAuth('login')}
              className="px-4 py-2 rounded-lg bg-[#0B3D91] hover:bg-[#082E70] text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[40px]"
            >
              {t(languageCode, 'signIn')}
            </button>
          </div>
        </div>
      </header>

      {/* Utility Strip below header for language & accessibility */}
      <div className="border-b border-[#CBD5E1] bg-white">
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
              <p className="text-sm font-semibold text-[#0B3D91] tracking-wide">
                {t(languageCode, 'tagline')}
              </p>
              <h1
                className="font-display font-bold text-[#0B1F3A] tracking-tight leading-[1.08]"
                style={{ fontSize: 'clamp(2.25rem, 3.8vw, 3.45rem)', textWrap: 'balance' }}
              >
                {t(languageCode, 'heroTitle')}
              </h1>
              <p className="text-base sm:text-lg text-[#334155] leading-relaxed max-w-xl">
                {t(languageCode, 'heroSubtitle')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => onNavigateAuth('register')}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#0B3D91] hover:bg-[#082E70] text-white font-semibold text-base transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[44px]"
              >
                <span>{t(languageCode, 'getStarted')}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => onNavigateAuth('login')}
                className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-[#0B1F3A] font-semibold text-base transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[44px]"
              >
                <span>{t(languageCode, 'signIn')}</span>
              </button>
            </div>

            <div className="pt-4 border-t border-[#CBD5E1] flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-[#475569]">
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
            <div className="relative h-72 sm:h-96 lg:h-full min-h-[340px] rounded-2xl overflow-hidden border border-[#CBD5E1] bg-[#0B1F3A]">
              <img
                src="/src/assets/images/hero_sa_farmland_1794662157430.jpg"
                alt="Irrigated South African maize fields and citrus orchards at sunrise"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B1F3A]/85 via-[#0B1F3A]/20 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 text-white">
                <p className="text-xs font-mono uppercase tracking-wider text-[#93C5FD]">
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
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0B1F3A]">
              Two distinct farming journeys on one unified platform
            </h2>
            <p className="text-[#334155]">
              Whether you are preparing to acquire your first hectare or managing established commercial and smallholder farms, Field Shift adapts to your stage.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Prospective Farmer Card */}
            <div className="bg-white border border-[#CBD5E1] rounded-2xl overflow-hidden flex flex-col">
              <div className="aspect-[4/3] w-full bg-[#E2E8F0] overflow-hidden">
                <img
                  src="/src/assets/images/card_prospective_farmer_1794662158844.jpg"
                  alt="Aspiring South African farmer inspecting healthy vegetable seedlings"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-[#174C3C]">
                    <Sprout className="w-4 h-4" />
                    <span>Prospective Farmer Journey</span>
                  </div>
                  <h3 className="font-display text-xl font-bold text-[#0B1F3A]">
                    {t(languageCode, 'prospectiveTitle')}
                  </h3>
                  <p className="text-sm text-[#334155] leading-relaxed">
                    {t(languageCode, 'prospectiveDesc')}
                  </p>
                  <ul className="pt-2 space-y-1.5 text-sm text-[#334155]">
                    <li>· Provincial land suitability & rainfall exploration</li>
                    <li>· Farming opportunity discovery matched to budget & plot size</li>
                    <li>· Step-by-step beginner guides & business planning</li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateAuth('register', 'prospective_farmer')}
                  className="w-full py-3 px-4 rounded-xl bg-[#0B3D91] hover:bg-[#082E70] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer min-h-[44px]"
                >
                  <span>Start Prospective Farmer Setup</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Existing Farmer Card */}
            <div className="bg-white border border-[#CBD5E1] rounded-2xl overflow-hidden flex flex-col">
              <div className="aspect-[4/3] w-full bg-[#E2E8F0] overflow-hidden">
                <img
                  src="/src/assets/images/card_existing_farmer_1794662159717.jpg"
                  alt="Experienced South African farmer overlooking irrigated cattle pastureland"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-[#174C3C]">
                    <Tractor className="w-4 h-4" />
                    <span>Existing Farmer Journey</span>
                  </div>
                  <h3 className="font-display text-xl font-bold text-[#0B1F3A]">
                    {t(languageCode, 'existingTitle')}
                  </h3>
                  <p className="text-sm text-[#334155] leading-relaxed">
                    {t(languageCode, 'existingDesc')}
                  </p>
                  <ul className="pt-2 space-y-1.5 text-sm text-[#334155]">
                    <li>· Register and switch across multiple farms under one account</li>
                    <li>· Capture district, municipality, coordinates & field boundaries</li>
                    <li>· Track crops, livestock herds, soils, and irrigation water</li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateAuth('register', 'existing_farmer')}
                  className="w-full py-3 px-4 rounded-xl border border-[#0B3D91] bg-white hover:bg-[#EFF6FF] text-[#0B3D91] font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer min-h-[44px]"
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
          className="bg-white border border-[#CBD5E1] rounded-2xl p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
        >
          <div className="lg:col-span-5 aspect-[4/3] rounded-xl overflow-hidden bg-[#E2E8F0]">
            <img
              src="/src/assets/images/card_field_mapping_1794662159319.jpg"
              alt="Aerial view of demarcated green agricultural contour fields and farm dam"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="lg:col-span-7 space-y-5">
            <h2 className="font-display text-2xl font-bold text-[#0B1F3A]">
              Spatial precision across farms, experts, and cooperatives
            </h2>
            <p className="text-[#334155] leading-relaxed">
              Every farm record combines municipal geography, GPS coordinates, and PostGIS polygon boundaries so farmers, agricultural experts, and cooperative managers share an accurate picture of land under cultivation.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[#E2E8F0]">
              <div className="space-y-1 pt-2">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-[#0B1F3A]">
                  <MapPin className="w-4 h-4 text-[#0B3D91]" />
                  <span>Farm Boundaries</span>
                </div>
                <p className="text-xs text-[#475569]">
                  Polygon geometry, perimeter & hectare verification.
                </p>
              </div>
              <div className="space-y-1 pt-2">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-[#0B1F3A]">
                  <Layers className="w-4 h-4 text-[#174C3C]" />
                  <span>Field Blocks</span>
                </div>
                <p className="text-xs text-[#475569]">
                  Soil type, irrigation method & crop or livestock tracking.
                </p>
              </div>
              <div className="space-y-1 pt-2">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-[#0B1F3A]">
                  <Compass className="w-4 h-4 text-[#0B3D91]" />
                  <span>5 Platform Roles</span>
                </div>
                <p className="text-xs text-[#475569]">
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
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0B1F3A]">
                All 12 official South African languages
              </h2>
              <p className="text-[#334155]">
                Select any language below to switch the interface immediately and personalise your agricultural advisor responses.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#475569]">
              <Globe className="w-4 h-4 text-[#0B3D91]" />
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
                      ? 'bg-[#0B3D91] text-white border-[#0B3D91]'
                      : 'bg-white text-[#0F172A] border-[#CBD5E1] hover:border-[#0B3D91]'
                  }`}
                >
                  <p className="font-display font-semibold text-base">{lang.nativeName}</p>
                  <p className={`text-xs mt-0.5 ${active ? 'text-[#DBEAFE]' : 'text-[#475569]'}`}>
                    {lang.name}
                  </p>
                  <p className={`text-xs mt-2 ${active ? 'text-white' : 'text-[#174C3C]'}`}>
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
          className="bg-[#0B1F3A] text-white rounded-2xl p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center border border-[#163055]"
        >
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#93C5FD]">
              <Volume2 className="w-4 h-4" />
              <span>Designed for older & first-time technology users</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold">
              Simple taps, large readable text, audio guidance, and voice input.
            </h2>
            <p className="text-[#CBD5E1] leading-relaxed max-w-2xl">
              Field Shift minimises typing through step-by-step municipal selectors, oversized touch buttons, spoken instructions on every onboarding screen, and microphone dictation for questions and field notes.
            </p>
          </div>
          <div className="lg:col-span-5 flex flex-col sm:flex-row lg:flex-col gap-3">
            <button
              type="button"
              onClick={onToggleLargeMode}
              className="px-5 py-3.5 rounded-xl bg-white text-[#0B1F3A] font-semibold text-sm hover:bg-[#F8FAFC] transition-colors cursor-pointer min-h-[44px]"
            >
              {largeMode ? 'Standard Text Size' : 'Try Large Text & Buttons Mode'}
            </button>
            <button
              type="button"
              onClick={() => onNavigateAuth('register')}
              className="px-5 py-3.5 rounded-xl bg-[#0B3D91] text-white font-semibold text-sm hover:bg-[#082E70] transition-colors cursor-pointer min-h-[44px]"
            >
              Create Accessible Farmer Account
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#CBD5E1] bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 flex flex-wrap items-center justify-between gap-4 text-sm text-[#475569]">
          <p className="font-display font-semibold text-[#0B1F3A]">
            Field Shift · {t(languageCode, 'tagline')}
          </p>
          <p>South African Agricultural Intelligence Platform</p>
        </div>
      </footer>
    </div>
  );
};
