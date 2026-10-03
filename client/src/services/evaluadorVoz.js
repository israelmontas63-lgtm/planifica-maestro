/**
 * client/src/services/evaluadorVoz.js
 * 
 * Lógica pura para evaluación de confianza y emulación del ciclo de voz Web Speech API.
 */

export function evaluarConfianzaVoz(confianzaVal) {
  if (
    confianzaVal === undefined ||
    confianzaVal === null ||
    confianzaVal === 0 ||
    Number.isNaN(Number(confianzaVal))
  ) {
    return {
      valor: null,
      estado: "desconocida",
      isLowConfidence: false
    };
  }

  const valor = Number(confianzaVal);
  if (valor < 0.65) {
    return {
      valor,
      estado: "baja",
      isLowConfidence: true
    };
  }

  return {
    valor,
    estado: "alta",
    isLowConfidence: false
  };
}

/**
 * Emulador ligero de SpeechRecognition para pruebas unitarias y entornos sin DOM.
 */
export class MockSpeechRecognition {
  constructor({ lang = "es-419", continuous = true, interimResults = true } = {}) {
    this.lang = lang;
    this.continuous = continuous;
    this.interimResults = interimResults;
    this.maxAlternatives = 1;
    this.onresult = null;
    this.onerror = null;
    this.onend = null;
    this.started = false;
    this.aborted = false;
    this.stopped = false;
  }

  start() {
    this.started = true;
    this.aborted = false;
    this.stopped = false;
  }

  stop() {
    this.stopped = true;
    this.started = false;
    if (this.onend) this.onend();
  }

  abort() {
    this.aborted = true;
    this.started = false;
    if (this.onerror) this.onerror({ error: "aborted" });
    if (this.onend) this.onend();
  }

  emitResult({ transcript, confidence, isFinal = true }) {
    if (!this.onresult) return;
    const item = [{ transcript, confidence }];
    item.isFinal = isFinal;
    const event = {
      results: [item]
    };
    this.onresult(event);
  }

  emitError(errorName) {
    if (this.onerror) this.onerror({ error: errorName });
  }
}

/**
 * Máquina de estado lógica que refleja fielmente el ciclo de useSpeechRecognition
 * para verificación funcional desacoplada de React.
 */
export class ControladorVozInteligente {
  constructor({ silenceTimeout = 2500, onSilenceStop = null } = {}) {
    this.silenceTimeout = silenceTimeout;
    this.onSilenceStop = onSilenceStop;
    this.recognition = null;
    this.listening = false;
    this.confirmedText = "";
    this.confidenceSum = 0;
    this.confidenceCount = 0;
    this.silenceTimer = null;
  }

  iniciar(MockClass = MockSpeechRecognition) {
    this.recognition = new MockClass();
    this.listening = true;
    this.confirmedText = "";
    this.confidenceSum = 0;
    this.confidenceCount = 0;

    this.recognition.onresult = (event) => {
      let finalStr = "";
      for (let i = 0; i < event.results.length; i++) {
        const item = event.results[i];
        const piece = item[0]?.transcript || "";
        if (item.isFinal) {
          finalStr += piece;
          const c = item[0]?.confidence;
          if (typeof c === "number" && c > 0) {
            this.confidenceSum += c;
            this.confidenceCount++;
          }
        }
      }
      this.confirmedText = finalStr.trim();
      this.resetTimer();
    };

    this.resetTimer();
    this.recognition.start();
  }

  resetTimer() {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    if (this.silenceTimeout > 0) {
      this.silenceTimer = setTimeout(() => {
        const res = this.detener();
        if (this.onSilenceStop && res.text) {
          this.onSilenceStop(res);
        }
      }, this.silenceTimeout);
    }
  }

  detener() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.recognition) {
      this.recognition.stop();
    }
    this.listening = false;

    const finalText = this.confirmedText.trim();
    let evalConf;
    if (this.confidenceCount > 0) {
      const avg = this.confidenceSum / this.confidenceCount;
      evalConf = evaluarConfianzaVoz(avg);
    } else {
      evalConf = evaluarConfianzaVoz(undefined);
    }

    return {
      text: finalText,
      confidence: evalConf.valor,
      isLowConfidence: evalConf.isLowConfidence,
      estadoConfianza: evalConf.estado
    };
  }
}
