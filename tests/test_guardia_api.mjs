import test from "node:test";
import assert from "node:assert/strict";

test("GUARDIA DE SEGURIDAD API - requerirAcceso (Fail-Closed, 401, Sanitización de Health)", async (t) => {
  const workerModule = await import("../worker/index.js");
  const worker = workerModule.default;

  const validAppKey = "CLAVE_INSTITUCIONAL_VALIDA";
  const validOwnerKey = "LLAVE_MAESTRA_DUENO_VALIDA";

  const defaultEnv = {
    APP_ACCESS_KEY: validAppKey,
    OWNER_MASTER_KEY: validOwnerKey,
    GEMINI_API_KEY: "fake_gemini",
  };

  const protectedRoutes = [
    { name: "/api/plan/generate", method: "POST", body: {} },
    { name: "/api/plan", method: "POST", body: {} },
    { name: "/api/plan/consultar-curriculo", method: "POST", body: {} },
    { name: "/api/voice/generate", method: "POST", body: {} },
    { name: "/api/voz", method: "POST", body: {} },
    { name: "/api/ocr/scan", method: "POST", body: {} },
    { name: "/api/transcribir", method: "POST", body: {} },
  ];

  await t.test("1. Falla cerrada: si falta APP_ACCESS_KEY en env -> HTTP 500", async () => {
    const envSinKey = { GEMINI_API_KEY: "fake_gemini" };
    for (const r of protectedRoutes) {
      const req = new Request(`http://localhost${r.name}`, {
        method: r.method,
        headers: { "Content-Type": "application/json", "x-app-key": validAppKey },
        body: JSON.stringify(r.body),
      });
      const res = await worker.fetch(req, envSinKey);
      assert.equal(res.status, 500, `${r.name} debe retornar 500 si falta APP_ACCESS_KEY en env`);
      const data = await res.json();
      assert.equal(data.ok, false);
      assert.ok(data.error.includes("Falta clave institucional"));
    }
  });

  await t.test("2. Sin x-app-key o con clave incorrecta -> HTTP 401 en todas las rutas protegidas", async () => {
    for (const r of protectedRoutes) {
      // 2a. Sin header x-app-key
      const reqSinKey = new Request(`http://localhost${r.name}`, {
        method: r.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(r.body),
      });
      const resSinKey = await worker.fetch(reqSinKey, defaultEnv);
      assert.equal(resSinKey.status, 401, `${r.name} debe retornar 401 sin x-app-key`);
      const dataSinKey = await resSinKey.json();
      assert.equal(dataSinKey.ok, false);
      assert.ok(dataSinKey.error.includes("Acceso no autorizado"));

      // 2b. Con x-app-key inválida
      const reqBadKey = new Request(`http://localhost${r.name}`, {
        method: r.method,
        headers: { "Content-Type": "application/json", "x-app-key": "clave_falsa" },
        body: JSON.stringify(r.body),
      });
      const resBadKey = await worker.fetch(reqBadKey, defaultEnv);
      assert.equal(resBadKey.status, 401, `${r.name} debe retornar 401 con clave inválida`);
    }
  });

  await t.test("3. Con x-app-key válida -> Acceso concedido (supera guardia de auth)", async () => {
    // voice/generate: pasa auth y falla en validación de cuerpo (400 "Falta el texto")
    const reqVoice = new Request("http://localhost/api/voice/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-key": validAppKey },
      body: JSON.stringify({}),
    });
    const resVoice = await worker.fetch(reqVoice, defaultEnv);
    assert.equal(resVoice.status, 400, "voice/generate con x-app-key debe superar auth y dar 400 por falta de body");
    const dataVoice = await resVoice.json();
    assert.equal(dataVoice.error, "Falta el texto para la voz.");

    // ocr/scan: pasa auth y da 400 por falta de imageBase64
    const reqOcr = new Request("http://localhost/api/ocr/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-key": validAppKey },
      body: JSON.stringify({}),
    });
    const resOcr = await worker.fetch(reqOcr, defaultEnv);
    assert.equal(resOcr.status, 400, "ocr/scan con x-app-key debe superar auth y dar 400 por falta de imageBase64");
    const dataOcr = await resOcr.json();
    assert.equal(dataOcr.error, "Falta imageBase64.");

    // consultar-curriculo: pasa auth y da 400 por falta de tema
    const reqCurr = new Request("http://localhost/api/plan/consultar-curriculo", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-key": validAppKey },
      body: JSON.stringify({}),
    });
    const resCurr = await worker.fetch(reqCurr, defaultEnv);
    assert.equal(resCurr.status, 400, "consultar-curriculo con x-app-key debe dar 400 por falta de tema");
  });

  await t.test("4. Con x-owner-key válida -> Acceso concedido como propietario", async () => {
    const reqVoiceOwner = new Request("http://localhost/api/voice/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-owner-key": validOwnerKey },
      body: JSON.stringify({}),
    });
    const resVoiceOwner = await worker.fetch(reqVoiceOwner, defaultEnv);
    assert.equal(resVoiceOwner.status, 400, "voice/generate con x-owner-key debe superar auth");
  });

  await t.test("5. GET /api/health sanitizado: no expone 'auth' ni 'owner' sin x-owner-key", async () => {
    // 5a. Petición pública normal
    const reqHealthPub = new Request("http://localhost/api/health", { method: "GET" });
    const resHealthPub = await worker.fetch(reqHealthPub, defaultEnv);
    assert.equal(resHealthPub.status, 200);
    const dataHealthPub = await resHealthPub.json();
    assert.equal(dataHealthPub.services.auth, undefined, "/api/health público NO debe contener services.auth");
    assert.equal(dataHealthPub.services.owner, undefined, "/api/health público NO debe contener services.owner");
    assert.ok(dataHealthPub.services.text_ai, "/api/health debe contener services.text_ai");

    // 5b. Petición de propietario con x-owner-key válida
    const reqHealthOwner = new Request("http://localhost/api/health", {
      method: "GET",
      headers: { "x-owner-key": validOwnerKey },
    });
    const resHealthOwner = await worker.fetch(reqHealthOwner, defaultEnv);
    assert.equal(resHealthOwner.status, 200);
    const dataHealthOwner = await resHealthOwner.json();
    assert.equal(dataHealthOwner.services.auth, "activa", "/api/health con x-owner-key debe exponer services.auth");
    assert.equal(dataHealthOwner.services.owner, "configurada", "/api/health con x-owner-key debe exponer services.owner");
  });

  await t.test("6. Rutas públicas permanecen accesibles sin x-app-key", async () => {
    // /api/health pública -> 200
    const resH = await worker.fetch(new Request("http://localhost/api/health"), defaultEnv);
    assert.equal(resH.status, 200);

    // /api/plan/esquemas -> 200
    const resE = await worker.fetch(new Request("http://localhost/api/plan/esquemas"), defaultEnv);
    assert.equal(resE.status, 200);

    // /api/auth/verify con clave incorrecta -> 401 ("Clave institucional incorrecta")
    const resV = await worker.fetch(new Request("http://localhost/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "mala" }),
    }), defaultEnv);
    assert.equal(resV.status, 401);
    const dataV = await resV.json();
    assert.equal(dataV.error, "Clave institucional incorrecta.");
  });
});
