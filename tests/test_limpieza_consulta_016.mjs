import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";
import { limpiarConsultaCurricular } from "../shared/curriculoService.mjs";

test("016 - (a) Limpieza de consulta amplia sobre 'noticia' en 3.° Lengua Española", () => {
  const query = "¿Qué dice el currículo oficial de Lengua Española de 3.° sobre la noticia?";
  const limpio = limpiarConsultaCurricular(query, { grado: 3, area: "Lengua Española" });

  assert.ok(limpio.includes("noticia"), `Debe contener 'noticia', obtenido: "${limpio}"`);
  assert.equal(limpio.includes("lengua"), false, "No debe contener 'lengua'");
  assert.equal(limpio.includes("oficial"), false, "No debe contener 'oficial'");
  assert.equal(limpio.includes("3"), false, "No debe contener '3'");
  assert.equal(limpio.includes("espanola"), false, "No debe contener 'espanola'");
  assert.equal(limpio.includes("curriculo"), false, "No debe contener 'curriculo'");
  assert.equal(limpio, "noticia");
});

test("016 - (b) Limpieza de consulta amplia sobre 'comprensión lectora' en 3.° Lengua Española", () => {
  const query = "¿Qué dice el currículo oficial de Lengua Española de 3.° sobre la comprensión lectora?";
  const limpio = limpiarConsultaCurricular(query, { grado: 3, area: "Lengua Española" });

  assert.equal(limpio, "comprension lectora", `Debe ser exactamente 'comprension lectora', obtenido: "${limpio}"`);
  assert.equal(limpio.includes("lengua"), false);
  assert.equal(limpio.includes("oficial"), false);
  assert.equal(limpio.includes("3"), false);
});

test("016 - (c) Consulta solo con metadatos/área/grado -> limpia a '' y Worker pide tema sin llamar a RPC", async () => {
  const query = "¿Qué dice el currículo oficial de Lengua Española de 3.°?";
  const limpio = limpiarConsultaCurricular(query, { grado: 3, area: "Lengua Española" });
  assert.equal(limpio, "", "La consulta sin tema específico debe limpiarse a cadena vacía");

  let rpcLlamado = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (typeof url === "string" && url.includes("/rest/v1/rpc/buscar_curriculo")) {
      rpcLlamado = true;
      return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return originalFetch(url, options);
  };

  try {
    const env = {
      APP_ACCESS_KEY: "clave-institucional-test",
      RATE_LIMIT_DISPOSITIVO_DIARIO: "100",
      SUPABASE_URL: "https://test-supabase.supabase.co",
      SUPABASE_ANON_KEY: "anon-key-test"
    };

    const req = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-key": "clave-institucional-test",
        "x-docente-id": "docente_test_016_c"
      },
      body: JSON.stringify({
        confirmado: true,
        messages: [{ role: "user", text: query }]
      })
    });

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(rpcLlamado, false, "No debe invocar el RPC cuando la consulta limpia queda vacía");
    assert.equal(data.modo, "consulta_curricular");
    assert.equal(data.requiereAclaracion, true, "Debe requerir aclaración del tema");
    assert.match(data.mensaje_chat, /¿Qué tema o contenido específico deseas consultar para 3.° grado en Lengua Española?/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("016 - (d) Generación de plan sin inyección de fragmentos conserva aviso de borrador y nivel referencial", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const urlStr = String(url);
    if (urlStr.includes("generativelanguage.googleapis.com")) {
      return new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                mensaje_chat: "Aquí tienes la planificación para segundo grado de matemática.",
                plan_completado: true,
                datos_planificacion: {
                  "Datos Generales": { grado: "2.° Primaria", area: "Matemática", fecha: "2026-10-20" },
                  competencias_especificas: "Razona y argumenta",
                  indicadores_logro: "Identifica números",
                  momentos: { inicio: "I", desarrollo: "D", cierre: "C" }
                }
              })
            }]
          }
        }]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return originalFetch(url, options);
  };

  try {
    const env = {
      APP_ACCESS_KEY: "clave-institucional-test",
      GEMINI_API_KEY: "gemini-test-key",
      RATE_LIMIT_DISPOSITIVO_DIARIO: "100",
      SUPABASE_URL: "https://test-supabase.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key-test"
    };

    const req = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-key": "clave-institucional-test",
        "x-docente-id": "docente_test_016_d"
      },
      body: JSON.stringify({
        confirmado: true,
        messages: [{ role: "user", text: "Planificar clase de números para 2do grado de primaria en matemática" }]
      })
    });

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(data.plan_completado, true);
    assert.match(data.mensaje_chat, /Borrador: revísalo con el currículo antes de usarlo/i, "Debe incluir el aviso de borrador");
    assert.ok(data.confianza_curricular, "Debe contener el objeto confianza_curricular");
    assert.equal(data.confianza_curricular.nivel_certeza, "referencial, no verificado", "Debe marcar nivel de certeza como referencial, no verificado");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
