import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("ETAPA 2: El Micrófono como Oído Inteligente", async (t) => {
  const appPath = path.resolve(__dirname, "../client/src/App.jsx");
  const appCode = fs.readFileSync(appPath, "utf-8");
  const hookPath = path.resolve(__dirname, "../client/src/hooks/useSpeechRecognition.js");
  const hookCode = fs.readFileSync(hookPath, "utf-8");

  await t.test("1. useSpeechRecognition implementa corte por silencio ajustable y confianza", () => {
    assert.ok(hookCode.includes("silenceTimeout"), "Debe aceptar silenceTimeout");
    assert.ok(hookCode.includes("silenceTimerRef"), "Debe gestionar timer de silencio");
    assert.ok(hookCode.includes("resetSilenceTimer"), "Debe reiniciar timer con cada nuevo resultado");
    assert.ok(hookCode.includes("isLowConfidence"), "Debe calcular y exponer isLowConfidence");
    assert.ok(hookCode.includes("confidence"), "Debe registrar nivel de confianza");
  });

  await t.test("2. Interbloqueo bidireccional micrófono-altavoz estricto", () => {
    // Al hacer clic en dictado: apaga altavoz si habla
    assert.ok(appCode.includes("if (isSpeaking)"), "Debe comprobar si el altavoz está activo al dictar");
    assert.ok(appCode.includes("stopSpeaking()"), "Debe detener altavoz al activar micrófono");

    // Al hablar el asistente: apaga el micrófono si está escuchando
    assert.ok(appCode.includes("if (listening)"), "Debe verificar si está escuchando antes de sintetizar voz");
    assert.ok(appCode.includes("stop();"), "Debe detener reconocimiento antes de hablar");
  });

  await t.test("3. Falla de micrófono o permiso denegado muestra mensaje amigable y ofrece escribir", () => {
    assert.ok(hookCode.includes("Permiso de micrófono bloqueado") || hookCode.includes("Permiso de micrófono denegado"), "Debe reportar permiso denegado amigable");
    assert.ok(appCode.includes("accionTexto: true"), "Debe activar opción de texto en error");
    assert.ok(appCode.includes("✍️ Escribir consulta"), "Debe ofrecer botón claro para escribir");
  });

  await t.test("4. Confirmación 'Entendí: …' con edición/deshacer para baja confianza y corrección posterior para alta", () => {
    assert.ok(appCode.includes("entendidoVoz"), "Debe gestionar estado de confirmación entendidoVoz");
    assert.ok(appCode.includes("bajaConfianza"), "Debe diferenciar baja confianza de alta");
    assert.ok(appCode.includes("🎙️ Entendí:"), "Debe mostrar 'Entendí: …' en interfaz");
    assert.ok(appCode.includes("✏️ Editar") || appCode.includes("✏️ Corregir"), "Debe permitir editar o corregir");
    assert.ok(appCode.includes("↩️ Deshacer"), "Debe permitir cancelar/deshacer");
  });

  await t.test("5. Texto dictado pasa por la MISMA tubería que el escrito (sin caminos paralelos)", () => {
    // Dictado llama a enviarMensaje(textToSend) exactamente igual que el texto escrito
    assert.ok(appCode.includes("enviarMensaje(textToSend)"), "Dictado debe enviar a enviarMensaje común");
    assert.ok(appCode.includes("fuePorVozRef.current = true"), "Debe marcar bandera solo para saber si sintetiza respuesta");
  });

  await t.test("6. Ejecución real: evaluarConfianzaVoz maneja 0, undefined, 0.5 y 0.9 correctamente", async () => {
    const { evaluarConfianzaVoz } = await import("../client/src/services/evaluadorVoz.js");

    // 0: Android no reporta confianza o devuelve 0 -> "desconocida", NO es baja confianza
    const c0 = evaluarConfianzaVoz(0);
    assert.equal(c0.valor, null);
    assert.equal(c0.estado, "desconocida");
    assert.equal(c0.isLowConfidence, false, "Confianza 0 no debe marcarse como baja para no forzar confirmación en Android");

    // undefined: navegador no expone la propiedad -> "desconocida", NO es baja confianza
    const cUndef = evaluarConfianzaVoz(undefined);
    assert.equal(cUndef.valor, null);
    assert.equal(cUndef.estado, "desconocida");
    assert.equal(cUndef.isLowConfidence, false, "Confianza ausente no debe marcarse como baja");

    // 0.5: menor a 0.65 -> baja confianza, sí pide confirmación previa
    const c05 = evaluarConfianzaVoz(0.5);
    assert.equal(c05.valor, 0.5);
    assert.equal(c05.estado, "baja");
    assert.equal(c05.isLowConfidence, true, "0.5 debe ser baja confianza");

    // 0.9: mayor o igual a 0.65 -> alta confianza, envía directo
    const c09 = evaluarConfianzaVoz(0.9);
    assert.equal(c09.valor, 0.9);
    assert.equal(c09.estado, "alta");
    assert.equal(c09.isLowConfidence, false, "0.9 debe ser alta confianza");
  });

  await t.test("7. Ejecución real: MockSpeechRecognition simula el ciclo de eventos, corte por silencio y confianza", async () => {
    const { ControladorVozInteligente, MockSpeechRecognition } = await import("../client/src/services/evaluadorVoz.js");

    let corteEjecutado = null;
    const controlador = new ControladorVozInteligente({
      silenceTimeout: 50, // 50ms para prueba rápida
      onSilenceStop: (res) => {
        corteEjecutado = res;
      }
    });

    // Iniciar escucha
    controlador.iniciar(MockSpeechRecognition);
    assert.equal(controlador.listening, true);

    // Caso A: Emite habla con confianza 0 (caso Android)
    controlador.recognition.emitResult({
      transcript: "planifica fracciones para 3ro",
      confidence: 0,
      isFinal: true
    });

    assert.equal(controlador.confirmedText, "planifica fracciones para 3ro");

    // Esperar a que el temporizador de silencio dispare el corte
    await new Promise((resolve) => setTimeout(resolve, 80));

    assert.ok(corteEjecutado !== null, "El temporizador de silencio debió disparar el corte");
    assert.equal(corteEjecutado.text, "planifica fracciones para 3ro");
    assert.equal(corteEjecutado.isLowConfidence, false, "Android con confianza 0 no debe activar isLowConfidence");
    assert.equal(controlador.listening, false, "Debe finalizar escucha al cortar");

    // Caso B: Emite habla con confianza baja (0.4)
    let corteBaja = null;
    const ctrlBaja = new ControladorVozInteligente({
      silenceTimeout: 40,
      onSilenceStop: (res) => { corteBaja = res; }
    });
    ctrlBaja.iniciar(MockSpeechRecognition);
    ctrlBaja.recognition.emitResult({
      transcript: "murmullo incomprensible",
      confidence: 0.4,
      isFinal: true
    });

    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.ok(corteBaja !== null);
    assert.equal(corteBaja.isLowConfidence, true, "Confianza 0.4 debe activar isLowConfidence");
  });

  await t.test("8. Ajuste de corte por silencio configurable en la app y persistente en localStorage", () => {
    const configModalPath = path.resolve(__dirname, "../client/src/components/ConfiguracionModal.jsx");
    const configCode = fs.readFileSync(configModalPath, "utf-8");

    // Selector en interfaz
    assert.ok(configCode.includes("silenceTimeoutMs"), "ConfiguracionModal debe recibir silenceTimeoutMs");
    assert.ok(configCode.includes("setSilenceTimeoutMs"), "ConfiguracionModal debe recibir setSilenceTimeoutMs");
    assert.ok(configCode.includes("Pausa de Silencio en Micrófono"), "Debe tener texto descriptivo en ajustes");

    // Persistencia en App.jsx
    assert.ok(appCode.includes("pm_silence_timeout_ms"), "App.jsx debe persistir el valor en localStorage");
    assert.ok(appCode.includes("silenceTimeout: silenceTimeoutMs"), "useSpeechRecognition debe recibir el timeout configurable");
  });
});
