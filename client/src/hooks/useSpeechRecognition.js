import { useRef, useState, useCallback, useEffect } from "react";

/**
 * Hook de reconocimiento de voz para Web Speech API (Chrome, Edge, Safari, Chrome Android).
 * Corrige la repetición de palabras en Android y entornos móviles:
 * - Usa event.resultIndex para procesar únicamente los nuevos resultados.
 * - Acumula exclusivamente los fragmentos con isFinal en confirmedText.
 * - Muestra el resultado interino solo como vista previa temporal sin concatenarlo de forma definitiva.
 * - Evita duplicaciones al reiniciar o detener el reconocimiento.
 * - Agrega espacios limpios entre fragmentos de voz.
 */
export function useSpeechRecognition() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");

  const recognitionRef = useRef(null);
  const confirmedTextRef = useRef("");
  const isExplicitStopRef = useRef(false);

  const start = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Tu navegador no soporta dictado por voz. Prueba con Chrome o Edge, o usa la opción de Texto.");
      return;
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
    recognition.lang = "es-DO"; // Preferencia español dominicano / latino
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let finalStr = "";
      let interimStr = "";

      // Reconstruir siempre a partir de la lista completa de resultados del evento (0 a length - 1)
      // para evitar que el índice no confiable de Android / Chrome Mobile re-procese y duplique palabras
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

      // Vista previa temporal en pantalla
      const fullPreview = [finalClean, interimClean].filter(Boolean).join(" ");
      setTranscript(fullPreview);
    };

    recognition.onerror = (e) => {
      // Ignorar errores 'no-speech' o 'aborted' sin alertar al usuario
      if (e.error !== "no-speech" && e.error !== "aborted") {
        console.warn("SpeechRecognition error:", e.error);
      }
      setListening(false);
      setInterimTranscript("");
    };

    recognition.onend = () => {
      setListening(false);
      setInterimTranscript("");
      // Asegurar que el transcript final refleje el texto confirmado
      setTranscript(confirmedTextRef.current.trim());
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
    } catch (err) {
      console.warn("Error al iniciar SpeechRecognition:", err);
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
  }, []);

  // Limpiar al desmontar
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
    start,
    stop,
    resetTranscript,
    setTranscript,
  };
}
