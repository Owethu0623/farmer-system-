import React from 'react';
import { Globe, Hand, Mic, Square, Volume2, ZoomIn } from 'lucide-react';
import { LANGUAGE_LIST, t } from '../i18n/translations';
import { LanguageCode } from '../types';

interface LanguageSelectorProps {
  value: LanguageCode;
  onChange: (code: LanguageCode) => void;
  compact?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  value,
  onChange,
  compact = false,
}) => {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-[#0F172A]">
      <Globe className="w-4 h-4 text-[#0B3D91] shrink-0" />
      <span className="sr-only">{t(value, 'languagePrompt')}</span>
      <select
        aria-label={t(value, 'languagePrompt')}
        value={value}
        onChange={(e) => onChange(e.target.value as LanguageCode)}
        className={`bg-white border border-[#CBD5E1] rounded-lg font-medium text-[#0F172A] focus:outline-none focus:border-[#0B3D91] cursor-pointer ${
          compact ? 'px-2.5 py-2 text-xs' : 'px-3 py-2.5 text-sm'
        }`}
      >
        {LANGUAGE_LIST.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.nativeName} {lang.name !== lang.nativeName ? `(${lang.name})` : ''}
          </option>
        ))}
      </select>
    </label>
  );
};

interface SpeakButtonProps {
  text: string;
  languageCode: LanguageCode;
  isSpeaking: boolean;
  onSpeak: (text: string) => void;
  onStop: () => void;
  supported: boolean;
  label?: string;
}

export const SpeakButton: React.FC<SpeakButtonProps> = ({
  text,
  languageCode,
  isSpeaking,
  onSpeak,
  onStop,
  supported,
  label,
}) => {
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={() => (isSpeaking ? onStop() : onSpeak(text))}
      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] text-[#0B3D91] text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
    >
      {isSpeaking ? (
        <>
          <Square className="w-4 h-4" />
          <span>{t(languageCode, 'stopListening')}</span>
        </>
      ) : (
        <>
          <Volume2 className="w-4 h-4" />
          <span>{label || t(languageCode, 'listenInstruction')}</span>
        </>
      )}
    </button>
  );
};

interface VoiceInputButtonProps {
  languageCode: LanguageCode;
  isListening: boolean;
  supported: boolean;
  onStart: () => void;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  languageCode,
  isListening,
  supported,
  onStart,
}) => {
  return (
    <button
      type="button"
      onClick={onStart}
      disabled={!supported}
      title={
        supported
          ? t(languageCode, 'speakInput')
          : 'Voice dictation requires a browser with Speech Recognition support'
      }
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
        isListening
          ? 'bg-[#0B3D91] text-white border-[#0B3D91]'
          : supported
          ? 'bg-white text-[#0B3D91] border-[#CBD5E1] hover:bg-[#F1F5F9] cursor-pointer'
          : 'bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0] cursor-not-allowed'
      }`}
    >
      <Mic className="w-4 h-4" />
      <span>{isListening ? 'Listening...' : t(languageCode, 'speakInput')}</span>
    </button>
  );
};

interface EasyReadToggleProps {
  largeMode: boolean;
  onToggle: () => void;
  languageCode: LanguageCode;
}

export const EasyReadToggle: React.FC<EasyReadToggleProps> = ({
  largeMode,
  onToggle,
  languageCode,
}) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={largeMode}
      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
        largeMode
          ? 'bg-[#0B3D91] text-white border-[#0B3D91]'
          : 'bg-white text-[#0F172A] border-[#CBD5E1] hover:bg-[#F1F5F9]'
      }`}
    >
      <ZoomIn className="w-4 h-4" />
      <span>{t(languageCode, 'largeTextLabel')}</span>
    </button>
  );
};

export const SaslBanner: React.FC<{ languageCode: LanguageCode }> = ({ languageCode }) => {
  if (languageCode !== 'sasl') return null;
  return (
    <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl px-4 py-3 flex items-start gap-3 text-sm text-[#0B1F3A]">
      <Hand className="w-5 h-5 text-[#0B3D91] shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold">South African Sign Language (SASL) Visual Mode</p>
        <p className="text-[#334155] mt-0.5">{t('sasl', 'saslVisualNote')}</p>
      </div>
    </div>
  );
};
