import test from "node:test";
import assert from "node:assert/strict";

function createMockKV() {
  const store = new Map();
  return {
    async get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.val;
    },
    async put(key, val, options = {}) {
      const ttl = options.expirationTtl;
      const expiresAt = ttl ? Date.now() + ttl * 1000 : null;
      store.set(key, { val: String(val), expiresAt });
    },
    _store: store,
  };
}

test("CLOUDFLARE KV RATE LIMITING DISTRIBUIDO", async (t) => {
  const workerModule = await import("../worker/index.js");
  const worker = workerModule.default;

  await t.test("1. Rate limit de dueño usa RATE_LIMIT_KV y bloquea tras 5 intentos fallidos", async () => {
    const mockKv = createMockKV();
    const env = {
      OWNER_MASTER_KEY: "super_secret_owner",
      RATE_LIMIT_KV: mockKv,
    };

    const clientIp = "200.10.20.30";

    // 5 intentos fallidos
    for (let i = 1; i <= 5; i++) {
      const req = new Request("http://localhost/api/auth/owner-verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "cf-connecting-ip": clientIp,
        },
        body: JSON.stringify({ key: "clave_incorrecta" }),
      });
      const res = await worker.fetch(req, env);
      assert.equal(res.status, 401, `Intento ${i} debe ser 401`);
    }

    // El 6to intento debe ser bloqueado con 429 por el KV
    const reqBloqueado = new Request("http://localhost/api/auth/owner-verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "cf-connecting-ip": clientIp,
      },
      body: JSON.stringify({ key: "clave_incorrecta" }),
    });
    const resBloqueado = await worker.fetch(reqBloqueado, env);
    assert.equal(resBloqueado.status, 429, "El intento 6 debe recibir 429 Too Many Requests");
    const dataBloqueado = await resBloqueado.json();
    assert.ok(dataBloqueado.error.includes("Demasiados intentos fallidos"));

    // Comprobar que en el KV está guardado el contador
    const kvVal = await mockKv.get(`rl_owner_${clientIp}`);
    assert.ok(parseInt(kvVal, 10) >= 5, "KV debe almacenar contador de intentos fallidos");
  });

  await t.test("2. Rate limit de dueño tolera fallo en KV cayendo a Map en memoria", async () => {
    const faultKv = {
      async get() { throw new Error("KV outage"); },
      async put() { throw new Error("KV outage"); },
    };
    const env = {
      OWNER_MASTER_KEY: "super_secret_owner",
      RATE_LIMIT_KV: faultKv,
    };

    const req = new Request("http://localhost/api/auth/owner-verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "cf-connecting-ip": "180.50.60.70",
      },
      body: JSON.stringify({ key: "clave_incorrecta" }),
    });
    const res = await worker.fetch(req, env);
    assert.equal(res.status, 401, "Debe continuar con Map sin tumbar el worker");
  });

  await t.test("3. Rate limit anónimo usa RATE_LIMIT_KV y respeta límite", async () => {
    const mockKv = createMockKV();
    const env = {
      APP_ACCESS_KEY: "app_key_123",
      GEMINI_API_KEY: "fake_gemini",
      RATE_LIMIT_KV: mockKv,
    };

    const clientIp = "186.120.30.40";

    // Simular que el KV ya tiene 30 consultas registradas para el hash del día
    // Llamar a /api/voice/generate hasta verificar que el KV incrementa
    const reqVoice = new Request("http://localhost/api/voice/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-key": "app_key_123",
        "cf-connecting-ip": clientIp,
      },
      body: JSON.stringify({}),
    });

    const resVoice = await worker.fetch(reqVoice, env);
    // Pasa auth y rate limit (400 por falta de text en body)
    assert.equal(resVoice.status, 400);

    // Verificar que mockKv tiene la clave de rate limit registrada
    const keys = [...mockKv._store.keys()];
    const anonKey = keys.find(k => k.startsWith("rl_anon_"));
    assert.ok(anonKey, "Debe existir clave rl_anon_ en RATE_LIMIT_KV");
    const countVal = await mockKv.get(anonKey);
    assert.equal(countVal, "1", "El contador en RATE_LIMIT_KV debe ser 1");
  });
});
