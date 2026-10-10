import { test } from "node:test";
import assert from "node:assert";
import worker from "../worker/index.js";

test("Debe retornar IA_NO_DISPONIBLE si IA_APAGADA es true", async () => {
  const req = new Request("http://localhost/api/plan/generate", {
    method: "POST",
    body: JSON.stringify({ confirmado: true, messages: [{ role: "user", text: "planificar fracciones para 3ro de primaria matematica" }] }),
    headers: { "Content-Type": "application/json" }
  });

  const res = await worker.fetch(req, { IA_APAGADA: "1" }, {});
  const json = await res.json();
  assert.strictEqual(json.ok, false);
  assert.strictEqual(json.codigo, "IA_NO_DISPONIBLE");
  assert.strictEqual(json.reintentable, false);
});

test("Debe retornar ERROR_INTERNO si falta GEMINI_API_KEY", async () => {
  const req = new Request("http://localhost/api/plan/generate", {
    method: "POST",
    body: JSON.stringify({ confirmado: true, messages: [{ role: "user", text: "planificar fracciones para 3ro de primaria matematica" }] }),
    headers: { "Content-Type": "application/json" }
  });

  const res = await worker.fetch(req, {}, {});
  const json = await res.json();
  assert.strictEqual(json.ok, false);
  assert.strictEqual(json.codigo, "ERROR_INTERNO");
});

test("Debe procesar seguimiento por que si el previo fue un error", async () => {
  const req = new Request("http://localhost/api/plan/generate", {
    method: "POST",
    body: JSON.stringify({ 
      messages: [
        { role: "user", text: "armar" },
        { role: "assistant", text: "Falta grado", isError: true, codigoError: "DATOS_INCOMPLETOS" },
        { role: "user", text: "¿por qué?" }
      ] 
    }),
    headers: { "Content-Type": "application/json" }
  });

  const res = await worker.fetch(req, { GEMINI_API_KEY: "dummy" }, {});
  const json = await res.json();
  assert.strictEqual(json.ok, false);
  assert.strictEqual(json.codigo, "DATOS_INCOMPLETOS");
  assert.ok(json.mensaje.includes("faltaron datos clave"));
});
