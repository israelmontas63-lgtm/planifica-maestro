import { useState, useCallback, useEffect, useRef } from "react";

/**
 * Hook de reproducción de voz local (Web Speech API).
 * Optimizado para Android y navegadores móviles:
 * - Divide textos largos en fragmentos/oraciones para evitar que Chrome Android se corte a los 15 segundos.
 * - Prioriza voces en español latino/dominicano y carga asíncrona de voces del sistema.
 * - Cancelación limpia e inmediata.
 */
export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const voicesRef = useRef([]);
  const activeChunksRef = useRef([]);
  const currentChunkIndexRef = useRef(0);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;

    function updateVoices() {
      try {
        voicesRef.current = window.speechSynthesis.getVoices() || [];
      } catch (e) {}
    }

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;

    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  function dividirEnOraciones(texto) {
    if (!texto) return [];
    // Dividir por puntos, saltos de línea, signos de exclamación o interrogación
    const partes = texto
      .replace(/\r\n/g, "\n")
      .split(/(?<=[.!?\n])\s+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    // Si hay párrafos muy largos sin puntuación, dividirlos en bloques de ~160 caracteres
    const trozosFinales = [];
    for (const parte of partes) {
      if (parte.length > 200) {
        const subpartes = parte.match(/.{1,180}(?:\s|$)/g) || [parte];
        trozosFinales.push(...subpartes.map((s) => s.trim()).filter(Boolean));
      } else {
        trozosFinales.push(parte);
      }
    }
    return trozosFinales;
  }

  const stopSpeaking = useCallback(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      activeChunksRef.current = [];
      currentChunkIndexRef.current = 0;
      setIsSpeaking(false);
    }
  }, []);

  const speak = useCallback((text, onNotice) => {
    if (!("speechSynthesis" in window)) {
      onNotice?.("Tu navegador no soporta reproducción de voz local.");
      return;
    }

    stopSpeaking();

    const trozos = dividirEnOraciones(text);
    if (trozos.length === 0) return;

    activeChunksRef.current = trozos;
    currentChunkIndexRef.current = 0;

    const voices = voicesRef.current.length > 0 ? voicesRef.current : window.speechSynthesis.getVoices();
    const spanishVoice =
      voices.find((v) => v.lang === "es-DO") ||
      voices.find((v) => v.lang === "es-419") ||
      voices.find((v) => v.lang.startsWith("es-")) ||
      voices.find((v) => v.lang.startsWith("es")) ||
      null;

    function reproducirSiguienteTroz() {
      if (currentChunkIndexRef.current >= activeChunksRef.current.length) {
        setIsSpeaking(false);
        return;
      }

      const oracion = activeChunksRef.current[currentChunkIndexRef.current];
      const utterance = new SpeechSynthesisUtterance(oracion);

      if (spanishVoice) {
        utterance.voice = spanishVoice;
      }
      utterance.lang = spanishVoice?.lang || "es-419";
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        if (currentChunkIndexRef.current === 0) {
          setIsSpeaking(true);
          onNotice?.("🔊 Reproduciendo con voz del navegador (respaldo local garantizado).");
        }
      };

      utterance.onend = () => {
        currentChunkIndexRef.current++;
        reproducirSiguienteTroz();
      };

      utterance.onerror = (err) => {
        console.warn("Aviso en reproducción de voz:", err);
        currentChunkIndexRef.current++;
        reproducirSiguienteTroz();
      };

      window.speechSynthesis.speak(utterance);
    }

    reproducirSiguienteTroz();
  }, [stopSpeaking]);

  return { speak, stopSpeaking, isSpeaking };
}
