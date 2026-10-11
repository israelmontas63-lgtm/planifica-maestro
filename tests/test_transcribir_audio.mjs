import test from "node:test";
import assert from "node:assert/strict";

test("PRUEBAS DE SERVICIO Y ENDPOINT /api/transcribir", async (t) => {
  const workerModule = await import("../worker/index.js");
  const worker = workerModule.default;

  const mockEnv = {
    APP_ACCESS_KEY: "RD-Maestro-8492",
    OWNER_MASTER_KEY: "llave_maestra_test_123",
    GEMINI_API_KEY: "test_gemini_key",
    GEMINI_MODEL: "gemini-3.1-flash-lite",
  };

  await t.test("1. Sin x-app-key -> Rechazo 401 Unauthorized", async () => {
    const req = new Request("http://localhost/api/transcribir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audioBase64: "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=" }),
    });

    const res = await worker.fetch(req, mockEnv, {});
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.ok, false);
    assert.match(data.error, /x-app-key/i);
  });

  await t.test("2. Con x-app-key inválida -> Rechazo 401 Unauthorized", async () => {
    const req = new Request("http://localhost/api/transcribir", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-key": "clave_falsa_999",
      },
      body: JSON.stringify({ audioBase64: "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=" }),
    });

    const res = await worker.fetch(req, mockEnv, {});
    assert.strictEqual(res.status, 401);
  });

  await t.test("3. Con x-app-key válida pero sin audioBase64 -> Rechazo 400 Bad Request", async () => {
    const req = new Request("http://localhost/api/transcribir", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-key": "RD-Maestro-8492",
      },
      body: JSON.stringify({}),
    });

    const res = await worker.fetch(req, mockEnv, {});
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.ok, false);
    assert.match(data.error, /Falta audioBase64/i);
  });

  await t.test("4. Payload mayor a 2.8 MB base64 -> Rechazo 413 Payload Too Large", async () => {
    const oversizedBase64 = "A".repeat(3 * 1024 * 1024);
    const req = new Request("http://localhost/api/transcribir", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-key": "RD-Maestro-8492",
      },
      body: JSON.stringify({ audioBase64: oversizedBase64 }),
    });

    const res = await worker.fetch(req, mockEnv, {});
    assert.strictEqual(res.status, 413);
    const data = await res.json();
    assert.strictEqual(data.ok, false);
    assert.match(data.error, /supera el tamaño máximo/i);
  });
});
