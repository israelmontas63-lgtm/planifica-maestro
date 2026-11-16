import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";
import { IDENTIDAD_VERSION, FIRMA_AUTORIA_HEADER, SYSTEM_INSTRUCTION_IDENTIDAD } from "../src/identidad.js";

test("POST /api/chat integra identidad oficial (Israel Montás), header X-App-Author, curriculo_fragmentos y versionado en CACHE_KV", async () => {
  const originalFetch = globalThis.fetch;
  const kvStore = new Map();
  let llamadasGemini = 0;
  let llamadasSupabase = 0;
  let urlGeminiUsada = "";
  let bodyGeminiEnviado = null;

  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (u.includes("/rest/v1/curriculo_fragmentos")) {
      llamadasSupabase++;
      return new Response(JSON.stringify([
        {
          id: "frag-1",
          grado: "1.º Grado",
          area: "Lengua Española",
          tema: "La tarjeta de identidad",
          contenido: "Identificación del nombre propio y datos personales en la tarjeta de identidad (CON BASE).",
          pagina: 42
        }
      ]), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (u.includes("generativelanguage.googleapis.com")) {
      llamadasGemini++;
      urlGeminiUsada = u;
      bodyGeminiEnviado = JSON.parse(opts.body);
      return new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: "En 1.º grado con CON BASE trabajamos la tarjeta de identidad reconociendo las letras del nombre propio (pág. 42). ¿Quieres que preparemos una actividad de inicio para tu grupo?"
            }]
          }
        }]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return originalFetch(url, opts);
  };

  try {
    const env = {
      ACCESO_ABIERTO: "true",
      GEMINI_API_KEY: "test-gemini-key",
      SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_ANON_KEY: "test-anon-key",
      CACHE_KV: {
        get: async (k) => kvStore.get(k) || null,
        put: async (k, v) => { kvStore.set(k, v); }
      }
    };

    const diezMensajes = Array.from({ length: 10 }, (_, idx) => ({
      role: idx % 2 === 0 ? "user" : "assistant",
      text: `Mensaje ${idx + 1} sobre la tarjeta de identidad en primer grado`
    }));

    const req1 = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: diezMensajes })
    });

    const res1 = await worker.fetch(req1, env);
    assert.equal(res1.status, 200);
    assert.equal(res1.headers.get("X-App-Author"), FIRMA_AUTORIA_HEADER);
    const data1 = await res1.json();

    assert.equal(data1.ok, true);
    assert.equal(data1.desdeCache, false);
    assert.match(data1.modelo, /gemini-(?:3\.5|2\.5)-flash/);
    assert.equal(data1.identidad_version, IDENTIDAD_VERSION);
    assert.equal(data1.autor, FIRMA_AUTORIA_HEADER);
    assert.equal(data1.historial_usado, 8, "Debe mantener solo los últimos 8 mensajes");
    assert.match(urlGeminiUsada, /gemini-(?:3\.5|2\.5)-flash.*:generateContent/);
    assert.ok(bodyGeminiEnviado.systemInstruction.parts[0].text.startsWith(SYSTEM_INSTRUCTION_IDENTIDAD));
    assert.match(bodyGeminiEnviado.systemInstruction.parts[0].text, /Israel Montás/);
    assert.match(bodyGeminiEnviado.systemInstruction.parts[0].text, /cero estrés/i);
    assert.match(bodyGeminiEnviado.systemInstruction.parts[0].text, /curriculo_fragmentos/);
    assert.match(data1.respuesta, /\?\s*$/, "Debe cerrar con una pregunta breve de seguimiento");
    assert.equal(llamadasSupabase, 1);
    assert.equal(llamadasGemini, 1);

    // Verificar que la clave de caché en CACHE_KV incluye la versión de identidad
    const clavesKv = Array.from(kvStore.keys());
    assert.equal(clavesKv.length, 1);
    assert.ok(clavesKv[0].includes(IDENTIDAD_VERSION), "La clave de CACHE_KV debe incluir IDENTIDAD_VERSION");

    // Segunda consulta idéntica: debe responder desde CACHE_KV con el header X-App-Author
    const req2 = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: diezMensajes })
    });
    const res2 = await worker.fetch(req2, env);
    assert.equal(res2.headers.get("X-App-Author"), FIRMA_AUTORIA_HEADER);
    const data2 = await res2.json();
    assert.equal(data2.ok, true);
    assert.equal(data2.desdeCache, true);
    assert.equal(llamadasGemini, 1, "No debe volver a invocar Gemini cuando golpea CACHE_KV");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
