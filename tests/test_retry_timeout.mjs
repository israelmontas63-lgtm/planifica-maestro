import test from "node:test";
import assert from "node:assert/strict";
import { fetchGeminiWithRetry } from "../worker/services/aiProvider.js";

test("1. fetch que nunca responde falla con TIMEOUT_INTENTO en ~ el límite y se llama 1 sola vez", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (url, opts) => {
    calls++;
    return new Promise((resolve, reject) => {
      if (opts?.signal) {
        if (opts.signal.aborted) reject(opts.signal.reason);
        else opts.signal.addEventListener("abort", () => reject(opts.signal.reason));
      }
    });
  };
  try {
    const t0 = Date.now();
    await assert.rejects(
      fetchGeminiWithRetry("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent", { timeoutMs: 200 }),
      (err) => {
        assert.equal(err.name, "TimeoutError");
        assert.match(err.message, /TIMEOUT_INTENTO:200ms:gemini-test/);
        return true;
      }
    );
    assert.ok(Date.now() - t0 < 1000, "debe fallar cerca del límite");
    assert.equal(calls, 1, "fetch se llamó UNA sola vez");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("2. 503 y luego 200 devuelve 200 (se conserva el reintento)", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) return { ok: false, status: 503 };
    return { ok: true, status: 200 };
  };
  try {
    const res = await fetchGeminiWithRetry("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent", {});
    assert.equal(res.status, 200);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("3. AbortError del cliente se relanza como AbortError, no como TimeoutError", async () => {
  const originalFetch = globalThis.fetch;
  const ctrl = new AbortController();
  ctrl.abort(new Error("CLIENTE"));
  globalThis.fetch = async (url, opts) => {
    if (opts?.signal?.aborted) {
      const err = new Error("This operation was aborted");
      err.name = "AbortError";
      throw err;
    }
    return { ok: true, status: 200 };
  };
  try {
    await assert.rejects(
      fetchGeminiWithRetry("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent", { signal: ctrl.signal }),
      (err) => {
        assert.equal(err.name, "AbortError");
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
