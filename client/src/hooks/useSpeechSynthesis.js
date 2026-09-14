import { useState, useCallback, useEffect } from "react";

export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speak = useCallback((text) => {
    if (!('speechSynthesis' in window)) return;
    
    // Stop any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    // Intentar buscar voz dominicana o latina
    const voices = window.speechSynthesis.getVoices();
    const spanishVoice = voices.find(v => v.lang === 'es-DO' || v.lang.includes('es-')) || voices[0];
    if (spanishVoice) {
      utterance.voice = spanishVoice;
    }
    
    utterance.lang = "es-DO"; // Fallback a es-ES si no lo soporta pero el tag es este
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  return { speak, stopSpeaking, isSpeaking };
}
