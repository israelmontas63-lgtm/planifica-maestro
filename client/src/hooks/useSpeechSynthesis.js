import { useState, useCallback, useEffect, useRef } from "react";

export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const voicesRef = useRef([]);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;

    function updateVoices() {
      voicesRef.current = window.speechSynthesis.getVoices() || [];
    }

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;

    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  const speak = useCallback((text, onNotice) => {
    if (!("speechSynthesis" in window)) {
      onNotice?.("Tu navegador no soporta reproducción de voz local.");
      return;
    }

    // Detener cualquier reproducción previa
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = voicesRef.current.length > 0 ? voicesRef.current : window.speechSynthesis.getVoices();

    // Priorizar voz en español dominicano o latinoamericano
    const spanishVoice =
      voices.find((v) => v.lang === "es-DO") ||
      voices.find((v) => v.lang === "es-419") ||
      voices.find((v) => v.lang.startsWith("es-")) ||
      voices.find((v) => v.lang.startsWith("es")) ||
      null;

    if (spanishVoice) {
      utterance.voice = spanishVoice;
    }
    utterance.lang = spanishVoice?.lang || "es-DO";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setIsSpeaking(true);
      onNotice?.("🔊 Reproduciendo con voz del navegador (respaldo local).");
    };
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  return { speak, stopSpeaking, isSpeaking };
}
