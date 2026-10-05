import { useRef, useState, useCallback, useEffect } from "react";
import { evaluarConfianzaVoz } from "../services/evaluadorVoz.js";

export { evaluarConfianzaVoz };

/**
 * Hook de reconocimiento de voz para Web Speech API (Chrome, Edge, Safari, Chrome Android).
 * Resuelve problemas en móviles y Android:
 * - Solicita permiso explícito del micrófono (getUserMedia) al interactuar para evitar bloqueos silenciosos.
 * - Soporta idioma latinoamericano (es-419 / es-DO / es) con fallback si el dispositivo no tiene el paquete específico.
 * - Elimina la duplicación de palabras en Android reconstruyendo solo fragmentos válidos.
 * - Reporta errores amigables (permiso denegado, desconexión de red) en vez de fallar en silencio.
 * - Corte automático por silencio ajustable (default 2500 ms).
 * - Detección de nivel de confianza: trata confianza 0 o ausente como 'desconocida' (no baja)
 *   para evitar confirmaciones innecesarias en Android Chrome.
 */

export function useSpeechRecognition({ silenceTimeout = 2500, onSilenceStop = null } = {}) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [confidence, setConfidence] = useState(null);
  const [isLowConfidence, setIsLowConfidence] = useState(false);
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const confirmedTextRef = useRef("");
  const isExplicitStopRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const silenceTimeoutRef = useRef(silenceTimeout);
  const onSilenceStopRef = useRef(onSilenceStop);
  const confidenceSumRef = useRef(0);
  const confidenceCountRef = useRef(0);

  useEffect(() => {
    silenceTimeoutRef.current = silenceTimeout;
  }, [silenceTimeout]);

  useEffect(() => {
    onSilenceStopRef.current = onSilenceStop;
  }, [onSilenceStop]);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    isExplicitStopRef.current = true;
    clearSilenceTimer();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setListening(false);
    setInterimTranscript("");
    const finalText = confirmedTextRef.current.trim();
    setTranscript(finalText);

    let evalConf;
    if (confidenceCountRef.current > 0) {
      const avg = confidenceSumRef.current / confidenceCountRef.current;
      evalConf = evaluarConfianzaVoz(avg);
    } else {
      evalConf = evaluarConfianzaVoz(undefined);
    }

    setConfidence(evalConf.valor);
    setIsLowConfidence(evalConf.isLowConfidence);

    return {
      text: finalText,
      confidence: evalConf.valor,
      isLowConfidence: evalConf.isLowConfidence,
      estadoConfianza: evalConf.estado
    };
  }, [clearSilenceTimer]);

  const resetSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    if (silenceTimeoutRef.current && silenceTimeoutRef.current > 0) {
      silenceTimerRef.current = setTimeout(() => {
        if (recognitionRef.current) {
          const res = stop();
          if (onSilenceStopRef.current && res.text) {
            onSilenceStopRef.current(res);
          }
        }
      }, silenceTimeoutRef.current);
    }
  }, [clearSilenceTimer, stop]);

  const start = useCallback(async (onErrorCallback) => {
    setError(null);
    clearSilenceTimer();
    confidenceSumRef.current = 0;
    confidenceCountRef.current = 0;
    setConfidence(null);
    setIsLowConfidence(false);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      const msg = "Tu navegador no soporta dictado por voz. Usa Chrome o Edge, o escribe el tema directamente.";
      setError(msg);
      onErrorCallback?.(msg);
      return;
    }

    // Solicitar permiso de micrófono previamente para disparar el diálogo del sistema en Android
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      } catch (micErr) {
        let msg = "No se pudo acceder al micrófono o el permiso está bloqueado. Por favor actívalo en los ajustes o escribe tu consulta.";
        if (micErr.name === "NotAllowedError" || micErr.name === "PermissionDeniedError") {
          msg = "Permiso de micrófono bloqueado. Por favor actívalo en los ajustes del navegador o escribe tu consulta.";
        }
        console.warn("Permiso de micrófono denegado:", micErr);
        setError(msg);
        onErrorCallback?.(msg);
        return;
      }
    }

    // Detener instancia previa si estuviera abierta
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
    }

    isExplicitStopRef.current = false;
    confirmedTextRef.current = "";
    setTranscript("");
    setInterimTranscript("");
    setFinalTranscript("");

    const recognition = new SpeechRecognition();
    recognition.lang = "es-419";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let finalStr = "";
      let interimStr = "";

      for (let i = 0; i < event.results.length; i++) {
        const item = event.results[i];
        const piece = item[0]?.transcript || "";
        if (item.isFinal) {
          finalStr += piece;
          if (typeof item[0]?.confidence === "number" && item[0].confidence > 0) {
            confidenceSumRef.current += item[0].confidence;
            confidenceCountRef.current++;
          }
        } else {
          interimStr += piece;
        }
      }

      const finalClean = finalStr.trim();
      const interimClean = interimStr.trim();

      confirmedTextRef.current = finalClean;
      setFinalTranscript(finalClean);
      setInterimTranscript(interimClean);

      const fullPreview = [finalClean, interimClean].filter(Boolean).join(" ");
      setTranscript(fullPreview);

      // Reiniciar corte por silencio cada vez que el usuario pronuncia algo
      resetSilenceTimer();
    };

    recognition.onerror = (e) => {
      clearSilenceTimer();
      if (e.error === "no-speech" || e.error === "aborted") {
        setListening(false);
        setInterimTranscript("");
        return;
      }

      let errorMsg = "Error en el reconocimiento de voz. Puedes escribir tu consulta directamente.";
      if (e.error === "not-allowed") {
        errorMsg = "Permiso de micrófono denegado. Habilítalo en los ajustes del navegador o escribe tu consulta.";
      } else if (e.error === "network") {
        errorMsg = "Error de red o conexión con el servicio de voz. Puedes reintentar o escribir tu consulta.";
      } else if (e.error === "audio-capture") {
        errorMsg = "No se detectó entrada de audio en el micrófono. Verifica que no esté en uso por otra app.";
      } else if (e.error === "service-not-allowed") {
        errorMsg = "El servicio de reconocimiento no está habilitado en este navegador o modo PWA.";
      } else if (e.error === "language-not-supported") {
        errorMsg = "El idioma de voz no está soportado en este dispositivo.";
      }

      console.warn("SpeechRecognition error:", e.error);
      setError(errorMsg);
      onErrorCallback?.(errorMsg, e.error);
      setListening(false);
      setInterimTranscript("");
    };

    recognition.onend = () => {
      clearSilenceTimer();
      setListening(false);
      setInterimTranscript("");
      setTranscript(confirmedTextRef.current.trim());
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
      resetSilenceTimer();
    } catch (err) {
      console.warn("Error al iniciar SpeechRecognition:", err);
      setError("No se pudo iniciar el dictado por voz. Puedes escribir tu consulta.");
      setListening(false);
    }
  }, [clearSilenceTimer, resetSilenceTimer]);

  const resetTranscript = useCallback(() => {
    clearSilenceTimer();
    confirmedTextRef.current = "";
    confidenceSumRef.current = 0;
    confidenceCountRef.current = 0;
    setTranscript("");
    setInterimTranscript("");
    setFinalTranscript("");
    setConfidence(null);
    setIsLowConfidence(false);
    setError(null);
  }, [clearSilenceTimer]);

  useEffect(() => {
    return () => {
      clearSilenceTimer();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
    };
  }, [clearSilenceTimer]);

  return {
    listening,
    transcript,
    interimTranscript,
    finalTranscript,
    confidence,
    isLowConfidence,
    error,
    start,
    stop,
    resetTranscript,
    setTranscript,
  };
}
