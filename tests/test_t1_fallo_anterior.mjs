/**
 * tests/test_t1_fallo_anterior.mjs
 * Validación T1: Intención fallo_anterior en clasificadorIntencion y respuesta basada en último error.
 * Debe funcionar con "¿por qué no puedes?", "¿qué pasó?" y "¿por qué falló?".
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { clasificarIntencion } from "../shared/clasificadorIntencion.js";
import worker from "../worker/index.js";

test("T1: clasificarIntencion detecta intención 'fallo_anterior'", async () => {
  const frases = ["¿por qué no puedes?", "¿qué pasó?", "¿por qué falló?", "por que no pudiste", "dime por que fallo"];
  for (const f of frases) {
    const res = await clasificarIntencion({ texto: f, contexto: { ultimoError: "IA_NO_DISPONIBLE" } });
    assert.strictEqual(res.categoria, "fallo_anterior", `Frase "${f}" debe clasificarse como fallo_anterior`);
  }
});

test("T1: Worker responde al docente según el estado del último error sin exigir regex rígido", async () => {
  const envTest = {
    APP_ACCESS_KEY: "clave-institucional-test",
    HERRAMIENTAS_V2: "false"
  };

  const preguntas = ["¿por qué no puedes?", "¿qué pasó?", "¿por qué falló?"];

  for (const pregunta of preguntas) {
    const req = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-key": "clave-institucional-test"
      },
      body: JSON.stringify({
        messages: [
          { role: "user", text: "planificar fracciones para 4to grado" },
          { role: "assistant", text: "Error", isError: true, codigoError: "PROVEEDOR_IA_SATURADO" },
          { role: "user", text: pregunta }
        ]
      })
    });

    const res = await worker.fetch(req, envTest, { waitUntil: () => {} });
    assert.strictEqual(res.status, 200, `Respuesta a "${pregunta}" debe ser 200`);
    const data = await res.json();
    assert.strictEqual(data.codigo, "PROVEEDOR_IA_SATURADO");
    assert.ok(data.mensaje.includes("alta demanda") || data.mensaje.includes("saturado"), `Mensaje debe explicar el fallo: ${data.mensaje}`);
  }
});
