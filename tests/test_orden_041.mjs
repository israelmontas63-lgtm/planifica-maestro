import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";

const mockEnv = {
  APP_ACCESS_KEY: "test_key",
  ACCESO_ABIERTO: "true",
  GEMINI_API_KEY: "test_gemini_key",
  GEMINI_MODEL: "gemini-3.1-flash-lite",
  OWNER_MASTER_KEY: "owner_test_key"
};

test("1. Un POST a /api/plan/generate con cuerpo mayor a 1 MB devuelve 413", async () => {
  const bigBody = JSON.stringify({ prompt: "x".repeat(1000005) });
  const req = new Request("http://localhost/api/plan/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-app-key": "test_key"
    },
    body: bigBody
  });

  const res = await worker.fetch(req, mockEnv, {});
  assert.equal(res.status, 413);
  const data = await res.json();
  assert.equal(data.ok, false);
});

test("2. El catch de visión no incluye el texto interno del error en la respuesta", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      throw new Error("SECRETO_INTERNO_NO_DEBE_FILTRARSE");
    };

    const req = new Request("http://localhost/api/ocr/scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-key": "test_key"
      },
      body: JSON.stringify({
        imageBase64: "data:image/jpeg;base64," + "A".repeat(400)
      })
    });

    const res = await worker.fetch(req, mockEnv, {});
    assert.equal(res.status, 500);
    const text = await res.text();
    assert.ok(!text.includes("SECRETO_INTERNO"), "La respuesta no debe contener SECRETO_INTERNO");
    const json = JSON.parse(text);
    assert.equal(json.detalle, "Servicio de visión no disponible. Intenta de nuevo.");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("3. /api/voice/generate ante fallo no devuelve e.message", async () => {
  const req = new Request("http://localhost/api/voice/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-app-key": "test_key"
    },
    body: JSON.stringify({ text: ["tipo_invalido_provoca_fallo"] })
  });

  const res = await worker.fetch(req, mockEnv, {});
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.ok(!text.includes("is not a function"), "No debe exponer e.message interno");
  const json = JSON.parse(text);
  assert.equal(json.fallbackLocal, true);
  assert.equal(json.error, "VOZ_NO_DISPONIBLE");
});
