import { useRef, useState, useCallback, useEffect } from "react";

/**
 * Hook de reconocimiento de voz para Web Speech API (Chrome, Edge, Safari, Chrome Android).
 * Resuelve problemas en móviles y Android:
 * - Solicita permiso explícito del micrófono (getUserMedia) al interactuar para evitar bloqueos silenciosos.
 * - Soporta idioma latinoamericano (es-419 / es-DO / es) con fallback si el dispositivo no tiene el paquete específico.
 * - Elimina la duplicación de palabras en Android reconstruyendo solo fragmentos válidos.
 * - Reporta errores amigables (permiso denegado, desconexión de red) en vez de fallar en silencio.
 */
export function useSpeechRecognition() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const confirmedTextRef = useRef("");
  const isExplicitStopRef = useRef(false);

  const start = useCallback(async (onErrorCallback) => {
    setError(null);
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      const msg = "Tu navegador no soporta dictado por voz. Usa Chrome o Edge, o escribe el tema.";
      setError(msg);
      onErrorCallback?.(msg);
      return;
    }

    // Solicitar permiso de micrófono previamente para disparar el diálogo del sistema en Android
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Detener inmediatamente las pistas para dejar libre el micrófono para SpeechRecognition
        stream.getTracks().forEach((track) => track.stop());
      } catch (micErr) {
        let msg = "No se pudo acceder al micrófono.";
        if (micErr.name === "NotAllowedError" || micErr.name === "PermissionDeniedError") {
          msg = "Permiso de micrófono bloqueado. Por favor actívalo en los ajustes del navegador.";
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
    // Prioridad latinoamericana con máxima compatibilidad móvil
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
    };

    recognition.onerror = (e) => {
      // Ignorar errores 'no-speech' o 'aborted' sin alarmar
      if (e.error === "no-speech" || e.error === "aborted") {
        setListening(false);
        setInterimTranscript("");
        return;
      }

      let errorMsg = "Error en el reconocimiento de voz.";
      if (e.error === "not-allowed") {
        errorMsg = "Permiso de micrófono denegado. Habilítalo en el navegador.";
      } else if (e.error === "network") {
        errorMsg = "Error de red con el servicio de voz. Puedes usar el botón de texto.";
      }

      console.warn("SpeechRecognition error:", e.error);
      setError(errorMsg);
      onErrorCallback?.(errorMsg);
      setListening(false);
      setInterimTranscript("");
    };

    recognition.onend = () => {
      setListening(false);
      setInterimTranscript("");
      setTranscript(confirmedTextRef.current.trim());
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
    } catch (err) {
      console.warn("Error al iniciar SpeechRecognition:", err);
      setError("No se pudo iniciar el dictado por voz.");
      setListening(false);
    }
  }, []);

  const stop = useCallback(() => {
    isExplicitStopRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setListening(false);
    setInterimTranscript("");
    const finalText = confirmedTextRef.current.trim();
    setTranscript(finalText);
    return finalText;
  }, []);

  const resetTranscript = useCallback(() => {
    confirmedTextRef.current = "";
    setTranscript("");
    setInterimTranscript("");
    setFinalTranscript("");
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
    };
  }, []);

  return {
    listening,
    transcript,
    interimTranscript,
    finalTranscript,
    error,
    start,
    stop,
    resetTranscript,
    setTranscript,
  };
}
