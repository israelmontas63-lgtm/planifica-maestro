import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";

test("POST /api/chat canal imagen envía inlineData a gemini-2.5-flash y NO usa CACHE_KV", async () => {
  const originalFetch = globalThis.fetch;
  const kvStore = new Map();
  let bodyGemini = null;

  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (u.includes("/rest/v1/curriculo_fragmentos")) {
      return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (u.includes("generativelanguage.googleapis.com")) {
      bodyGemini = JSON.parse(opts.body);
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: "Veo una lámina de vocales para 1.º grado, vinculada a la competencia comunicativa. ¿La usamos en el inicio?" }] } }]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return originalFetch(url, opts);
  };

  try {
    const env = {
      ACCESO_ABIERTO: "true",
      GEMINI_API_KEY: "k",
      SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_ANON_KEY: "a",
      CACHE_KV: { get: async (k) => kvStore.get(k) || null, put: async (k, v) => { kvStore.set(k, v); } }
    };
    const res = await worker.fetch(new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensaje: "¿Qué ves aquí?", historial: [], canal: "imagen", imagenBase64: "data:image/jpeg;base64,AAAA", mimeType: "image/jpeg" })
    }), env);

    assert.equal(res.status, 200);
    assert.equal(res.headers.get("X-App-Author"), "Israel Montas - Planifica Maestro");
    const data = await res.json();
    assert.equal(data.canal, "imagen");
    const ultimo = bodyGemini.contents[bodyGemini.contents.length - 1];
    assert.ok(ultimo.parts.some((p) => p.inlineData && p.inlineData.data === "AAAA"));
    assert.match(bodyGemini.systemInstruction.parts[0].text, /Plani Maestra/);
    assert.match(bodyGemini.systemInstruction.parts[0].text, /CANAL ACTIVO: IMAGEN/);
    assert.equal(kvStore.size, 0, "Con imagen no debe escribirse en CACHE_KV");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("POST /api/chat canal voz aplica directiva de respuesta ágil", async () => {
  const originalFetch = globalThis.fetch;
  let bodyGemini = null;
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (u.includes("generativelanguage.googleapis.com")) {
      bodyGemini = JSON.parse(opts.body);
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "Claro, profe. ¿Empezamos?" }] } }] }), { status: 200 });
    }
    return new Response("[]", { status: 200 });
  };
  try {
    const res = await worker.fetch(new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensaje: "Dame una idea para la letra m", canal: "voz" })
    }), { ACCESO_ABIERTO: "true", GEMINI_API_KEY: "k" });
    const data = await res.json();
    assert.equal(data.canal, "voz");
    assert.match(bodyGemini.systemInstruction.parts[0].text, /CANAL ACTIVO: VOZ/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
