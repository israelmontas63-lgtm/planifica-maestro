/**
 * tests/test_t6_cuota_selectiva.mjs
 * Validación T6: Los topes y la cuota se aplican solo a acciones que usan IA o planificación.
 * Un dispositivo con cuota agotada recibe respuesta a "hola" y a "¿por qué no puedes?".
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";

test("T6: Dispositivo con cuota diaria agotada recibe respuesta a 'hola' y '¿por qué no puedes?' pero rechaza planificación con 429", async () => {
  const envTest = {
    APP_ACCESS_KEY: "clave-institucional-test",
    RATE_LIMIT_DISPOSITIVO_DIARIO: "0", // Cuota agotada desde el inicio
    RATE_LIMIT_ANONIMO_DIARIO: "0"
  };

  const headers = {
    "Content-Type": "application/json",
    "x-app-key": "clave-institucional-test",
    "x-device-id": "dispositivo_con_cuota_cero"
  };

  // 1. Enviar "hola" con cuota agotada -> Debe responder 200
  const reqHola = new Request("http://localhost/api/plan/generate", {
    method: "POST",
    headers,
    body: JSON.stringify({
      messages: [{ role: "user", text: "hola" }]
    })
  });
  const resHola = await worker.fetch(reqHola, envTest, { waitUntil: () => {} });
  assert.strictEqual(resHola.status, 200, "Hola debe responder 200 aun con cuota agotada");
  const dataHola = await resHola.json();
  assert.strictEqual(dataHola.modo, "charla", "Modo debe ser charla");
  assert.ok(dataHola.mensaje_chat.length > 0, "Debe tener mensaje_chat");

  // 2. Enviar "¿por qué no puedes?" con fallo previo con cuota agotada -> Debe responder 200
  const reqPorQue = new Request("http://localhost/api/plan/generate", {
    method: "POST",
    headers,
    body: JSON.stringify({
      messages: [
        { role: "user", text: "planificar" },
        { role: "assistant", text: "Error", isError: true, codigoError: "PROVEEDOR_IA_SATURADO" },
        { role: "user", text: "¿por qué no puedes?" }
      ]
    })
  });
  const resPorQue = await worker.fetch(reqPorQue, envTest, { waitUntil: () => {} });
  assert.strictEqual(resPorQue.status, 200, "¿por qué no puedes? debe responder 200 aun con cuota agotada");
  const dataPorQue = await resPorQue.json();
  assert.strictEqual(dataPorQue.codigo, "PROVEEDOR_IA_SATURADO");

  // 3. Enviar intento de planificación -> Debe ser bloqueado con 429
  const reqPlan = new Request("http://localhost/api/plan/generate", {
    method: "POST",
    headers,
    body: JSON.stringify({
      confirmado: true,
      messages: [{ role: "user", text: "planificar clase de matemática de 2do de primaria sobre adición" }]
    })
  });
  const resPlan = await worker.fetch(reqPlan, envTest, { waitUntil: () => {} });
  assert.strictEqual(resPlan.status, 429, "Planificación debe ser rechazada con 429 si la cuota está agotada");
  const dataPlan = await resPlan.json();
  assert.strictEqual(dataPlan.agotado, true);
});
