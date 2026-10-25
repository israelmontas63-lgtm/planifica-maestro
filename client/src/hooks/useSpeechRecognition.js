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

export function useSpeechRecognition({ silenceTimeout = 0, onSilenceStop = null, onFiveMinuteLimit = null } = {}) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [confidence, setConfidence] = useState(null);
  const [isLowConfidence, setIsLowConfidence] = useState(false);
  const [error, setError] = useState(null);
  const [duracionSegundos, setDuracionSegundos] = useState(0);

  const recognitionRef = useRef(null);
  const confirmedTextRef = useRef("");
  const accumulatedTextRef = useRef("");
  const sessionFinalRef = useRef("");
  const isExplicitStopRef = useRef(false);
  const isRecordingRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const silenceTimeoutRef = useRef(silenceTimeout);
  const onSilenceStopRef = useRef(onSilenceStop);
  const onFiveMinuteLimitRef = useRef(onFiveMinuteLimit);
  const confidenceSumRef = useRef(0);
  const IDIOMAS_FALLBACK = ["es-DO", "es-419", "es-ES", "es"];
  const idiomaIndexRef = useRef(0);
  const lastErrorRef = useRef(null);
  const confidenceCountRef = useRef(0);
  const rapidRestartsRef = useRef(0);
  const lastRestartTimeRef = useRef(0);
  const onErrorCallbackRef = useRef(null);
  const activeStreamRef = useRef(null);
  const networkRetryAttemptedRef = useRef(false);

  useEffect(() => {
    silenceTimeoutRef.current = silenceTimeout;
  }, [silenceTimeout]);

  useEffect(() => {
    onSilenceStopRef.current = onSilenceStop;
  }, [onSilenceStop]);

  useEffect(() => {
    onFiveMinuteLimitRef.current = onFiveMinuteLimit;
  }, [onFiveMinuteLimit]);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    isRecordingRef.current = false;
    isExplicitStopRef.current = true;
    clearSilenceTimer();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => track.stop());
      activeStreamRef.current = null;
    }
    setListening(false);
    setInterimTranscript("");

    const finalText = accumulatedTextRef.current
      .replace(/\s+/g, " ")
      .trim();

    confirmedTextRef.current = finalText;
    setTranscript(finalText);
    setFinalTranscript(finalText);

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
    // Solo arma el temporizador si silenceTimeout > 0 (opcional en configuración)
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

  // Manejador del temporizador de duración y tope de seguridad de 5 minutos
  useEffect(() => {
    let interval = null;
    if (listening) {
      interval = setInterval(() => {
        setDuracionSegundos((prev) => {
          const siguiente = prev + 1;
          // Tope de seguridad de 5 minutos (300 segundos)
          if (siguiente >= 300) {
            console.warn("Tope de seguridad de 5 minutos alcanzado en dictado por voz");
            const res = stop();
            onFiveMinuteLimitRef.current?.(res);
          }
          return siguiente;
        });
      }, 1000);
    } else {
      setDuracionSegundos(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [listening, stop]);

  const formatearDuracion = (segundos) => {
    const mins = Math.floor(segundos / 60);
    const secs = segundos % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  /**
   * Concatena fragmentos de voz previniendo duplicaciones en Chrome Android
   * (tanto cuando el motor reenvía cadenas acumulativas completas como cuando envía fragmentos incrementales).
   */
  const unirSinDuplicar = (textoActual, nuevoFragmento) => {
    const actual = (textoActual || "").trim();
    const nuevo = (nuevoFragmento || "").trim();
    if (!actual) return nuevo;
    if (!nuevo) return actual;

    // Si el nuevo fragmento ya contiene al actual desde el inicio (transcripción acumulativa del motor)
    if (nuevo.toLowerCase().startsWith(actual.toLowerCase())) {
      return nuevo;
    }

    // Si el texto actual ya termina exactamente con el nuevo fragmento (evento repetido)
    if (actual.toLowerCase().endsWith(nuevo.toLowerCase())) {
      return actual;
    }

    // Si hay solapamiento al final del actual y principio del nuevo (Android jitter)
    const palabrasActual = actual.split(/\s+/);
    const palabrasNuevo = nuevo.split(/\s+/);
    let solapamiento = 0;
    const maxCheck = Math.min(palabrasActual.length, palabrasNuevo.length, 6);
    for (let k = maxCheck; k >= 1; k--) {
      const finActual = palabrasActual.slice(-k).join(" ").toLowerCase();
      const iniNuevo = palabrasNuevo.slice(0, k).join(" ").toLowerCase();
      if (finActual === iniNuevo) {
        solapamiento = k;
        break;
      }
    }

    if (solapamiento > 0) {
      const restoNuevo = palabrasNuevo.slice(solapamiento).join(" ");
      return restoNuevo ? `${actual} ${restoNuevo}` : actual;
    }

    return `${actual} ${nuevo}`;
  };

  const initRecognitionInstance = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    const langElegido = IDIOMAS_FALLBACK[idiomaIndexRef.current] || "es-DO";
    recognition.lang = langElegido;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log(`🎙️ [SpeechRecognition] onstart (escuchando con idioma: ${langElegido})`);
    };

    recognition.onresult = (event) => {
      let interimStr = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        const piece = (item[0]?.transcript || "").trim();
        if (item.isFinal) {
          if (piece) {
            accumulatedTextRef.current = unirSinDuplicar(accumulatedTextRef.current, piece);
          }
          if (typeof item[0]?.confidence === "number" && item[0].confidence > 0) {
            confidenceSumRef.current += item[0].confidence;
            confidenceCountRef.current++;
          }
        } else {
          interimStr += (item[0]?.transcript || "");
        }
      }

      const fullFinal = accumulatedTextRef.current.replace(/\s+/g, " ").trim();
      const interimClean = interimStr.trim();
      const fullPreview = [fullFinal, interimClean].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

      confirmedTextRef.current = fullFinal;
      setFinalTranscript(fullFinal);
      setInterimTranscript(interimClean);
      setTranscript(fullPreview);
      console.log("🎙️ [SpeechRecognition] onresult:", fullPreview);

      // Reiniciar corte por silencio solo si está configurado (> 0)
      resetSilenceTimer();
    };

    function handleErrorTerminal(codigoError) {
      isRecordingRef.current = false;
      isExplicitStopRef.current = true;
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (err) {}
      }
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach((track) => track.stop());
        activeStreamRef.current = null;
      }
      setListening(false);
      setInterimTranscript("");

      let errorMsg = "Error en el reconocimiento de voz. Puedes escribir tu consulta directamente.";
      if (codigoError === "network") {
        errorMsg = "Falla de red en el servicio de voz del navegador. Verifica tu conexión a internet o escribe tu consulta.";
      } else if (codigoError === "not-allowed") {
        errorMsg = "Permiso de micrófono denegado. Por favor, habilita el acceso al micrófono en los ajustes del navegador o escribe tu consulta.";
      } else if (codigoError === "no-speech") {
        errorMsg = "No se detectó voz en el micrófono. Pulsa el micrófono para hablar o escribe tu consulta.";
      } else if (codigoError === "service-not-allowed") {
        errorMsg = "El servicio de reconocimiento de voz no está habilitado en este navegador o modo PWA. Puedes grabar y transcribir o escribir tu consulta.";
      } else if (codigoError === "audio-capture") {
        errorMsg = "No se detectó entrada de audio en el micrófono. Verifica que no esté en uso por otra app.";
      } else if (codigoError === "language-not-supported") {
        errorMsg = "El idioma de voz no está soportado en este dispositivo.";
      }

      console.warn("SpeechRecognition error terminal:", codigoError);
      setError(errorMsg);
      onErrorCallbackRef.current?.(errorMsg, codigoError);
    }

    recognition.onerror = (e) => {
      clearSilenceTimer();
      lastErrorRef.current = e.error;
      console.log("🎙️ [SpeechRecognition] onerror:", e.error);

      // Pausa natural en Android: Chrome emite 'no-speech' al pausar 1-2s. NO es fin de grabación.
      if (e.error === "no-speech") {
        console.log("🎙️ [SpeechRecognition] Pausa detectada ('no-speech'). Manteniendo grabación activa.");
        return;
      }

      if (e.error === "aborted") {
        if (!isRecordingRef.current) {
          setListening(false);
          setInterimTranscript("");
          return;
        }
        console.log("🎙️ [SpeechRecognition] Transición 'aborted' con grabación activa, permitiendo reinicio.");
        return;
      }

      // Para 'network': un solo reintento automático tras 1 segundo
      if (e.error === "network" && !networkRetryAttemptedRef.current) {
        networkRetryAttemptedRef.current = true;
        console.warn("🎙️ [SpeechRecognition] Error 'network'. Reintentando automáticamente en 1s...");
        setListening(false);
        setTimeout(() => {
          if (!isRecordingRef.current || isExplicitStopRef.current) return;
          try {
            if (recognitionRef.current) {
              try { recognitionRef.current.abort(); } catch (err) {}
            }
            const next = initRecognitionInstance();
            if (next) {
              recognitionRef.current = next;
              next.start();
              setListening(true);
              resetSilenceTimer();
            }
          } catch (retryErr) {
            handleErrorTerminal("network");
          }
        }, 1000);
        return;
      }

      handleErrorTerminal(e.error);
    };

    recognition.onend = () => {
      clearSilenceTimer();
      console.log("🎙️ [SpeechRecognition] onend (isRecording:", isRecordingRef.current, "isExplicitStop:", isExplicitStopRef.current, "último error:", lastErrorRef.current, ")");

      // Si el usuario tocó parar conscientemente o hubo error terminal, no reiniciar
      if (!isRecordingRef.current || isExplicitStopRef.current) {
        setListening(false);
        setInterimTranscript("");
        const fullFinal = accumulatedTextRef.current.replace(/\s+/g, " ").trim();
        setTranscript(fullFinal);
        return;
      }

      // El 'no-speech' es una pausa natural del docente en Android, NO cuenta como fallo rápido
      const eraNoSpeech = lastErrorRef.current === "no-speech";
      lastErrorRef.current = null;

      if (!eraNoSpeech) {
        const now = Date.now();
        if (now - lastRestartTimeRef.current < 2500) {
          rapidRestartsRef.current += 1;
        } else {
          rapidRestartsRef.current = 0;
        }
        lastRestartTimeRef.current = now;
      }

      if (rapidRestartsRef.current >= 5) {
        console.warn("Límite de reinicios automáticos consecutivos alcanzado (5). Deteniendo micrófono.");
        isRecordingRef.current = false;
        setListening(false);
        setInterimTranscript("");
        setTranscript(accumulatedTextRef.current.replace(/\s+/g, " ").trim());
        return;
      }

      // Reinicio automático inmediato para mantener el micrófono activo mientras el docente dicta
      try {
        const nextInstance = initRecognitionInstance();
        if (nextInstance) {
          recognitionRef.current = nextInstance;
          nextInstance.start();
          setListening(true);
          resetSilenceTimer();
        } else {
          isRecordingRef.current = false;
          setListening(false);
        }
      } catch (err) {
        console.warn("Error al reiniciar SpeechRecognition automáticamente:", err);
        setTimeout(() => {
          if (isRecordingRef.current && !isExplicitStopRef.current) {
            try {
              const retryInstance = initRecognitionInstance();
              if (retryInstance) {
                recognitionRef.current = retryInstance;
                retryInstance.start();
                setListening(true);
                resetSilenceTimer();
              }
            } catch (retryErr) {
              console.warn("Fallo reintento secundario de SpeechRecognition:", retryErr);
            }
          }
        }, 150);
      }
    };

    return recognition;
  }, [clearSilenceTimer, resetSilenceTimer]);

  const start = useCallback(async (onErrorCallback) => {
    setError(null);
    clearSilenceTimer();
    confidenceSumRef.current = 0;
    confidenceCountRef.current = 0;
    setConfidence(null);
    setIsLowConfidence(false);
    onErrorCallbackRef.current = onErrorCallback;
    rapidRestartsRef.current = 0;
    lastRestartTimeRef.current = 0;
    networkRetryAttemptedRef.current = false;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      const isIOS = typeof navigator !== "undefined" && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
      const isStandalone = typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone);
      let msg = "Tu navegador no soporta dictado por voz. Usa Chrome o Edge, o escribe el tema directamente.";
      if (isIOS && isStandalone) {
        msg = "Apple iOS restringe el dictado por voz en PWAs instaladas en la pantalla de inicio. Abre la app en Safari para usar el micrófono o escribe tu consulta directamente.";
      }
      setError(msg);
      onErrorCallback?.(msg, "service-not-allowed");
      return;
    }

    // Solicitar permiso de micrófono y mantener el stream activo durante el dictado
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        if (!activeStreamRef.current) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          activeStreamRef.current = stream;
        }
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

    isRecordingRef.current = true;
    isExplicitStopRef.current = false;
    accumulatedTextRef.current = "";
    sessionFinalRef.current = "";
    confirmedTextRef.current = "";
    setTranscript("");
    setInterimTranscript("");
    setFinalTranscript("");
    setDuracionSegundos(0);

    try {
      const recognition = initRecognitionInstance();
      if (!recognition) return;
      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
      resetSilenceTimer();
    } catch (err) {
      console.warn("Error al iniciar SpeechRecognition:", err);
      setError("No se pudo iniciar el dictado por voz. Puedes escribir tu consulta.");
      setListening(false);
    }
  }, [clearSilenceTimer, initRecognitionInstance, resetSilenceTimer]);

  const resetTranscript = useCallback(() => {
    clearSilenceTimer();
    accumulatedTextRef.current = "";
    sessionFinalRef.current = "";
    confirmedTextRef.current = "";
    confidenceSumRef.current = 0;
    confidenceCountRef.current = 0;
    setTranscript("");
    setInterimTranscript("");
    setFinalTranscript("");
    setConfidence(null);
    setIsLowConfidence(false);
    setError(null);
    setDuracionSegundos(0);
  }, [clearSilenceTimer]);

  useEffect(() => {
    return () => {
      clearSilenceTimer();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach((track) => track.stop());
        activeStreamRef.current = null;
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
    duracionSegundos,
    tiempoTranscurrido: formatearDuracion(duracionSegundos),
    start,
    stop,
    resetTranscript,
    setTranscript,
  };
}
