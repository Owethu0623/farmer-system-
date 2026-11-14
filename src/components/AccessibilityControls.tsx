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
    <label className="inline-flex items-center gap-2 text-sm text-[#17201B]">
      <Globe className="w-4 h-4 text-[#1B4332] shrink-0" />
      <span className="sr-only">{t(value, 'languagePrompt')}</span>
      <select
        aria-label={t(value, 'languagePrompt')}
        value={value}
        onChange={(e) => onChange(e.target.value as LanguageCode)}
        className={`bg-white border border-[#D4DDD2] rounded-lg font-medium text-[#17201B] focus:outline-none focus:border-[#1B4332] cursor-pointer ${
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
      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#D4DDD2] bg-white hover:bg-[#EDF2EC] text-[#1B4332] text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
          ? 'bg-[#1B4332] text-white border-[#1B4332]'
          : supported
          ? 'bg-white text-[#1B4332] border-[#D4DDD2] hover:bg-[#EDF2EC] cursor-pointer'
          : 'bg-[#F1F3EF] text-[#7A867E] border-[#E2E6DF] cursor-not-allowed'
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
          ? 'bg-[#1B4332] text-white border-[#1B4332]'
          : 'bg-white text-[#17201B] border-[#D4DDD2] hover:bg-[#EDF2EC]'
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
    <div className="bg-[#EDF5EF] border border-[#BFD6C5] rounded-xl px-4 py-3 flex items-start gap-3 text-sm text-[#143326]">
      <Hand className="w-5 h-5 text-[#1B4332] shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold">South African Sign Language (SASL) Visual Mode</p>
        <p className="text-[#2D4B3B] mt-0.5">{t('sasl', 'saslVisualNote')}</p>
      </div>
    </div>
  );
};
