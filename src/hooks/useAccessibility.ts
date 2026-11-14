import { useCallback, useEffect, useState } from 'react';
import { getSpeechLangCode } from '../i18n/translations';
import { LanguageCode } from '../types';

interface SpeechRecognitionResultEvent {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function useAccessibility(languageCode: LanguageCode, largeMode: boolean) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const recognitionSupported =
    typeof window !== 'undefined' &&
    Boolean(
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
        (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    );

  useEffect(() => {
    const root = document.documentElement;
    if (largeMode) {
      root.classList.add('fs-large-mode');
    } else {
      root.classList.remove('fs-large-mode');
    }
  }, [largeMode]);

  const stopSpeaking = useCallback(() => {
    if (speechSupported) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, [speechSupported]);

  const speak = useCallback(
    (text: string) => {
      if (!speechSupported || !text.trim()) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = getSpeechLangCode(languageCode);
      utterance.rate = 0.92; // slightly slower for clear comprehension by older farmers
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    },
    [languageCode, speechSupported]
  );

  const startVoiceInput = useCallback(
    (onTranscript: (text: string) => void) => {
      const win = window as unknown as Record<string, new () => SpeechRecognitionInstance>;
      const RecognitionCtor = win.SpeechRecognition || win.webkitSpeechRecognition;
      if (!RecognitionCtor) return false;

      try {
        const recognition = new RecognitionCtor();
        recognition.lang = getSpeechLangCode(languageCode);
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        setIsListening(true);

        recognition.onresult = (event) => {
          const transcript = event.results?.[0]?.[0]?.transcript;
          if (transcript) {
            onTranscript(transcript);
          }
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognition.start();
        return true;
      } catch {
        setIsListening(false);
        return false;
      }
    },
    [languageCode]
  );

  return {
    speak,
    stopSpeaking,
    isSpeaking,
    startVoiceInput,
    isListening,
    speechSupported,
    recognitionSupported,
  };
}
