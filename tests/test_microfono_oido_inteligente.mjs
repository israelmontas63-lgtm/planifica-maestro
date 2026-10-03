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
});
