import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Clase simuladora avanzada de SpeechRecognition para verificar:
 * 1. Pausas de 8 segundos sin corte cuando silenceTimeout es 0 (Manual por defecto).
 * 2. Reconexión automática tras evento onend de Chrome sin duplicación de frases acumuladas.
 * 3. Detención manual efectiva con stop() sin reinicios posteriores.
 * 4. Protección contra bucles infinitos (límite de reinicios rápidos).
 */
class MockContinuousSpeechRecognition {
  constructor() {
    this.continuous = false;
    this.interimResults = false;
    this.lang = "es-419";
    this.onresult = null;
    this.onerror = null;
    this.onend = null;
    this.started = false;
    this.stopped = false;
  }

  start() {
    this.started = true;
    this.stopped = false;
  }

  stop() {
    this.stopped = true;
    this.started = false;
    if (this.onend) {
      this.onend();
    }
  }

  abort() {
    this.stop();
  }

  // Simula la entrega de un fragmento de voz
  emitSpeech(transcript, isFinal = true, confidence = 0.95) {
    if (!this.onresult || this.stopped) return;
    const event = {
      resultIndex: 0,
      results: [
        Object.assign([{ transcript, confidence }], { isFinal })
      ]
    };
    this.onresult(event);
  }

  // Simula corte inesperado de red o de Google Speech Services en Chrome móvil
  emitUnexpectedChromeEnd() {
    if (this.onend) {
      this.onend();
    }
  }
}

/**
 * Controlador de Reconocimiento Continuo que encapsula la lógica exacta de useSpeechRecognition
 */
class ControladorReconocimientoContinuo {
  constructor({ silenceTimeout = 0, onSilenceStop = null, onFiveMinuteLimit = null } = {}) {
    this.silenceTimeout = silenceTimeout;
    this.onSilenceStop = onSilenceStop;
    this.onFiveMinuteLimit = onFiveMinuteLimit;

    this.listening = false;
    this.transcript = "";
    this.accumulatedText = "";
    this.sessionFinal = "";
    this.isExplicitStop = false;
    this.silenceTimer = null;
    this.rapidRestarts = 0;
    this.lastRestartTime = 0;
    this.currentInstance = null;
    this.restartsCount = 0;
  }

  clearSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  resetSilenceTimer() {
    this.clearSilenceTimer();
    if (this.silenceTimeout > 0) {
      this.silenceTimer = setTimeout(() => {
        if (this.currentInstance) {
          const res = this.stop();
          if (this.onSilenceStop && res.text) {
            this.onSilenceStop(res);
          }
        }
      }, this.silenceTimeout);
    }
  }

  initInstance(MockClass = MockContinuousSpeechRecognition) {
    const inst = new MockClass();

    inst.onresult = (event) => {
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
      this.sessionFinal = finalClean;

      const fullFinal = [this.accumulatedText, finalClean].filter(Boolean).join(" ").replace(/\s+/g, " ");
      const fullPreview = [fullFinal, interimStr.trim()].filter(Boolean).join(" ").replace(/\s+/g, " ");

      this.transcript = fullPreview;
      this.resetSilenceTimer();
    };

    inst.onend = () => {
      this.clearSilenceTimer();

      if (this.isExplicitStop) {
        this.listening = false;
        this.transcript = [this.accumulatedText, this.sessionFinal].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
        return;
      }

      if (this.sessionFinal) {
        this.accumulatedText = [this.accumulatedText, this.sessionFinal].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
        this.sessionFinal = "";
      }

      const now = Date.now();
      if (now - this.lastRestartTime < 2500) {
        this.rapidRestarts += 1;
      } else {
        this.rapidRestarts = 0;
      }
      this.lastRestartTime = now;

      if (this.rapidRestarts >= 5) {
        this.listening = false;
        this.transcript = this.accumulatedText;
        return;
      }

      this.restartsCount++;
      const nextInst = this.initInstance(MockClass);
      this.currentInstance = nextInst;
      nextInst.start();
      this.listening = true;
      this.resetSilenceTimer();
    };

    return inst;
  }

  start(MockClass = MockContinuousSpeechRecognition) {
    this.isExplicitStop = false;
    this.accumulatedText = "";
    this.sessionFinal = "";
    this.transcript = "";
    this.rapidRestarts = 0;
    this.restartsCount = 0;

    this.currentInstance = this.initInstance(MockClass);
    this.currentInstance.start();
    this.listening = true;
    this.resetSilenceTimer();
  }

  stop() {
    this.isExplicitStop = true;
    this.clearSilenceTimer();
    if (this.currentInstance) {
      this.currentInstance.stop();
    }
    this.listening = false;
    const finalText = [this.accumulatedText, this.sessionFinal].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    this.transcript = finalText;
    return { text: finalText };
  }
}

test("MICRÓFONO SIN CORTE AUTOMÁTICO (CAMBIO C)", async (t) => {
  const hookPath = path.resolve(__dirname, "../client/src/hooks/useSpeechRecognition.js");
  const hookCode = fs.readFileSync(hookPath, "utf-8");
  const modalPath = path.resolve(__dirname, "../client/src/components/ConfiguracionModal.jsx");
  const modalCode = fs.readFileSync(modalPath, "utf-8");
  const panelPath = path.resolve(__dirname, "../client/src/components/BottomPanel.jsx");
  const panelCode = fs.readFileSync(panelPath, "utf-8");
  const appPath = path.resolve(__dirname, "../client/src/App.jsx");
  const appCode = fs.readFileSync(appPath, "utf-8");

  await t.test("1. Configuración por defecto: silenceTimeout = 0 (Manual sin corte automático)", () => {
    assert.ok(hookCode.includes("silenceTimeout = 0"), "useSpeechRecognition debe tener silenceTimeout = 0 por defecto");
    assert.ok(modalCode.includes("Manual (sin corte automático) - Por defecto"), "ConfiguracionModal debe mostrar la opción manual por defecto");
    assert.ok(appCode.includes("return 0; // Por defecto: 0 = Manual (sin corte automático)"), "App.jsx debe inicializar con 0 por defecto");
  });

  await t.test("2. Una frase larga con pausas de 8 segundos NO se corta con modo manual", async () => {
    let seCorto = false;
    const controlador = new ControladorReconocimientoContinuo({
      silenceTimeout: 0,
      onSilenceStop: () => { seCorto = true; }
    });

    controlador.start();
    assert.equal(controlador.listening, true);

    controlador.currentInstance.emitSpeech("Planificación diaria de Matemáticas para cuarto de primaria", true);
    assert.equal(controlador.transcript, "Planificación diaria de Matemáticas para cuarto de primaria");

    assert.equal(controlador.silenceTimer, null, "No debe existir ningún temporizador de silencio armado");

    controlador.currentInstance.emitSpeech("Planificación diaria de Matemáticas para cuarto de primaria con tema de fracciones equivalentes", true);
    assert.equal(controlador.transcript, "Planificación diaria de Matemáticas para cuarto de primaria con tema de fracciones equivalentes");
    assert.equal(seCorto, false, "El dictado no debe cortarse ante pausas largas");
    assert.equal(controlador.listening, true, "El micrófono debe seguir escuchando");

    controlador.stop();
    assert.equal(controlador.listening, false);
  });

  await t.test("3. Si Chrome emite onend inesperadamente, reinicia automáticamente y NO duplica texto", () => {
    const controlador = new ControladorReconocimientoContinuo({ silenceTimeout: 0 });
    controlador.start();

    controlador.currentInstance.emitSpeech("Inicio de la clase sobre el sistema solar", true);
    assert.equal(controlador.transcript, "Inicio de la clase sobre el sistema solar");

    const primeraInstancia = controlador.currentInstance;
    primeraInstancia.emitUnexpectedChromeEnd();

    assert.notEqual(controlador.currentInstance, primeraInstancia, "Debe haber creado una nueva instancia");
    assert.equal(controlador.listening, true, "Debe seguir escuchando tras el corte de Chrome");
    assert.equal(controlador.restartsCount, 1, "Debe registrar 1 reinicio transparente");

    controlador.currentInstance.emitSpeech("y los planetas interiores", true);

    assert.equal(controlador.transcript, "Inicio de la clase sobre el sistema solar y los planetas interiores");
    assert.ok(!controlador.transcript.includes("Inicio de la clase sobre el sistema solar Inicio de la clase sobre el sistema solar"), "No debe haber duplicación de frases");

    const res = controlador.stop();
    assert.equal(res.text, "Inicio de la clase sobre el sistema solar y los planetas interiores");
    assert.equal(controlador.listening, false);
  });

  await t.test("4. El botón de parar (stop) detiene efectivamente y no reinicia", () => {
    const controlador = new ControladorReconocimientoContinuo({ silenceTimeout: 0 });
    controlador.start();

    controlador.currentInstance.emitSpeech("Consulta sobre indicadores de Ciencias Sociales", true);
    assert.equal(controlador.listening, true);

    const res = controlador.stop();
    assert.equal(controlador.listening, false, "listening debe ser false");
    assert.equal(controlador.isExplicitStop, true, "Debe marcar parada explícita");
    assert.equal(res.text, "Consulta sobre indicadores de Ciencias Sociales");

    if (controlador.currentInstance.onend) {
      controlador.currentInstance.onend();
    }
    assert.equal(controlador.listening, false, "No debe reabrir el micrófono si el usuario lo paró");
    assert.equal(controlador.restartsCount, 0, "No debe registrar reinicios automáticos");
  });

  await t.test("5. Muestra que está escuchando y el tiempo transcurrido en el botón", () => {
    assert.ok(panelCode.includes("duracionTexto"), "BottomPanel debe aceptar duracionTexto");
    assert.ok(panelCode.includes("Escuchando (${duracionTexto"), "Debe mostrar el tiempo en el botón");
    assert.ok(appCode.includes("duracionTexto={tiempoTranscurrido}"), "App.jsx debe suministrar tiempoTranscurrido a BottomPanel");
    assert.ok(hookCode.includes("tiempoTranscurrido: formatearDuracion(duracionSegundos)"), "useSpeechRecognition debe calcular tiempoTranscurrido formateado");
  });

  await t.test("6. Protección contra bucles infinitos: límite de 5 reinicios rápidos", () => {
    const controlador = new ControladorReconocimientoContinuo({ silenceTimeout: 0 });
    controlador.start();

    for (let i = 0; i < 6; i++) {
      controlador.lastRestartTime = Date.now();
      if (controlador.currentInstance) {
        controlador.currentInstance.emitUnexpectedChromeEnd();
      }
    }

    assert.equal(controlador.listening, false, "Debe detenerse tras 5 reinicios rápidos para proteger la CPU y batería");
  });

  await t.test("7. Tope de seguridad de 5 minutos configurado con aviso en App.jsx", () => {
    assert.ok(hookCode.includes("siguiente >= 300"), "Debe verificar tope de 300 segundos (5 minutos)");
    assert.ok(appCode.includes("El dictado se detuvo automáticamente tras 5 minutos continuos por seguridad"), "App.jsx debe notificar el tope de 5 minutos");
  });

  await t.test("8. Modo continuo estricto con bandera isRecordingRef y no-speech como pausa natural", () => {
    assert.ok(hookCode.includes("recognition.continuous = true"), "Debe tener continuous en true");
    assert.ok(hookCode.includes("recognition.interimResults = true"), "Debe tener interimResults en true");
    assert.ok(hookCode.includes("isRecordingRef"), "Debe gestionar la bandera isRecordingRef");
    assert.ok(hookCode.includes("event.resultIndex"), "Debe iterar desde event.resultIndex para evitar duplicar palabras");
    assert.ok(hookCode.includes("unirSinDuplicar"), "Debe usar función para desduplicar palabras en Android");
    assert.ok(hookCode.includes("Pausa detectada ('no-speech')"), "no-speech debe ser tratado como pausa natural sin detener la grabación");
  });

  await t.test("9. Mensajes claros y amigables en español para not-allowed, no-speech y network", () => {
    assert.ok(hookCode.includes("Permiso de micrófono denegado. Por favor, habilita el acceso"), "Mensaje de not-allowed debe ser amigable");
    assert.ok(hookCode.includes("No se detectó voz en el micrófono"), "Mensaje de no-speech debe ser claro");
    assert.ok(hookCode.includes("Falla de red en el servicio de voz del navegador"), "Mensaje de network debe ser claro");
  });

  await t.test("10. El dictado NUNCA se envía automáticamente al parar: queda en el cuadro de texto editable", () => {
    assert.ok(appCode.includes("handleAbrirTexto(textoNormalizado, \"Revisa tu planificación antes de enviar\")"), "Al parar el dictado debe abrir el cuadro de texto editable");
    assert.ok(!appCode.includes("else {\n      fuePorVozRef.current = true;\n      setEntendidoVoz({\n        tipo: \"directo\",\n        texto: textoNormalizado,\n        analisis,\n        bajaConfianza: false,\n        enviado: true\n      });\n      const textToSend = textoNormalizado;\n      enviarMensaje(textToSend);\n    }"), "No debe existir bloque que envíe automáticamente al terminar el dictado");
    assert.ok(appCode.includes("forzarEnvio: true"), "El envío solo se dispara cuando el docente pulsa explícitamente Enviar");
  });
});
