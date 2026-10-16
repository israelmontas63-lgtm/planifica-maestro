/**
 * tests/test_t11_health.mjs
 * Validación T11: /api/health protegido o en estado mínimo; detalle y chequeo de tablas solo con x-owner-key.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";

test("T11: /api/health público es mínimo y no consulta tablas de Supabase", async (t) => {
  let llamadasSupabase = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const urlStr = String(url);
    if (urlStr.includes("supabase.co") || urlStr.includes("/rest/v1/")) {
      llamadasSupabase++;
      return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return originalFetch(url, opts);
  };

  try {
    const envTest = {
      OWNER_MASTER_KEY: "owner-super-secreta-test",
      SUPABASE_URL: "https://ejemplo-minerd.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
      GEMINI_API_KEY: "dummy-gemini-key",
      APP_ACCESS_KEY: "clave-institucional-test"
    };

    // 1. Petición pública sin x-owner-key
    const reqPub = new Request("http://localhost/api/health", { method: "GET" });
    const resPub = await worker.fetch(reqPub, envTest, { waitUntil: () => {} });
    assert.strictEqual(resPub.status, 200);
    const dataPub = await resPub.json();

    assert.strictEqual(dataPub.status, "ok");
    assert.strictEqual(dataPub.worker, "cloudflare-workers");
    assert.deepStrictEqual(dataPub.tablas_disponibles, [], "tablas_disponibles debe ser [] en público");
    assert.strictEqual(dataPub.services.auth, undefined, "No debe filtrar estado de auth");
    assert.strictEqual(dataPub.services.owner, undefined, "No debe filtrar estado de owner");
    assert.strictEqual(llamadasSupabase, 0, "Llamada pública NO debe hacer fetch a Supabase");

    // 2. Petición del dueño con x-owner-key válida
    const reqOwner = new Request("http://localhost/api/health", {
      method: "GET",
      headers: { "x-owner-key": "owner-super-secreta-test" }
    });
    const resOwner = await worker.fetch(reqOwner, envTest, { waitUntil: () => {} });
    assert.strictEqual(resOwner.status, 200);
    const dataOwner = await resOwner.json();

    assert.strictEqual(dataOwner.services.auth, "activa");
    assert.strictEqual(dataOwner.services.owner, "configurada");
    assert.ok(llamadasSupabase >= 11, `Dueño debe auditar las tablas en Supabase (llamadas: ${llamadasSupabase})`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
