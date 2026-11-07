import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Hook de Dictado por Voz en Tiempo Real - Planifica Maestro
 * Utiliza Web Speech API con interimResults para transcripción interactiva continua.
 */
export function useDictadoVoz({ alCambiarTexto, alFinalizar } = {}) {
  const [escuchando, setEscuchando] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true; // Permite ver las palabras mientras se habla
    recognition.lang = 'es-DO'; // Español (República Dominicana) con fallback a es-419

    recognition.onresult = (event) => {
      let transcripcionFinal = '';
      let transcripcionInterina = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const texto = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          transcripcionFinal += texto + ' ';
        } else {
          transcripcionInterina += texto;
        }
      }

      // Se envía el texto acumulado más lo que se está pronunciando en este instante
      if (typeof alCambiarTexto === 'function') {
        alCambiarTexto((transcripcionFinal + transcripcionInterina).trim());
      }
    };

    recognition.onerror = () => {
      setEscuchando(false);
    };

    recognition.onend = () => {
      setEscuchando(false);
      if (typeof alFinalizar === 'function') alFinalizar();
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.abort();
      } catch {}
    };
  }, [alCambiarTexto, alFinalizar]);

  const iniciar = useCallback(() => {
    if (recognitionRef.current && !escuchando) {
      try {
        recognitionRef.current.start();
        setEscuchando(true);
      } catch (err) {
        console.warn('[useDictadoVoz] No se pudo iniciar el reconocimiento:', err);
      }
    }
  }, [escuchando]);

  const detener = useCallback(() => {
    if (recognitionRef.current && escuchando) {
      try {
        recognitionRef.current.stop();
        setEscuchando(false);
      } catch (err) {
        console.warn('[useDictadoVoz] No se pudo detener el reconocimiento:', err);
      }
    }
  }, [escuchando]);

  return { escuchando, iniciar, detener };
}
