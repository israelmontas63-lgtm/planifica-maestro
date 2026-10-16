import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";

test("T4 - Modo conversacional limita turnos a TURNOS_CONVERSACION_MAX y no inyecta nota larga", async () => {
  const originalFetch = globalThis.fetch;
  let receivedContents = null;

  globalThis.fetch = async (url, opts) => {
    if (String(url).includes("generativelanguage.googleapis.com")) {
      const body = JSON.parse(opts.body);
      receivedContents = body.contents;
      return new Response(JSON.stringify({
        candidates: [{
          content: { parts: [{ text: "Respuesta pedagógica sobre el constructivismo en el aula." }] }
        }]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, opts);
  };

  try {
    const messages = [
      { role: "user", text: "Turno 1: hola" },
      { role: "assistant", text: "Turno 2: hola colega" },
      { role: "user", text: "Turno 3: hablemos de pedagogía" },
      { role: "assistant", text: "Turno 4: claro, dime qué tema" },
      { role: "user", text: "Turno 5: hablemos de evaluación formativa" },
      { role: "assistant", text: "Turno 6: la evaluación formativa retroalimenta" },
      { role: "user", text: "¿Qué aportes tiene el enfoque socioconstructivista?" }
    ];

    const req = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-key": "clave-institucional-test",
        "x-docente-id": "docente_test_t4"
      },
      body: JSON.stringify({
        confirmado: true,
        messages
      })
    });

    const env = {
      APP_ACCESS_KEY: "clave-institucional-test",
      GEMINI_API_KEY: "dummy-key-t4",
      TURNOS_CONVERSACION_MAX: "4",
      RATE_LIMIT_DISPOSITIVO_DIARIO: "100"
    };

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.modo, "conocimiento_general");
    assert.match(data.mensaje_chat, /constructivismo/i);
    // No debe contener la nota larga fija repetitiva
    assert.ok(!data.mensaje_chat.includes("Esta es una explicación pedagógica general, no una cita textual del currículo oficial MINERD"));

    // Verifica que Gemini recibió a lo sumo 4 turnos (TURNOS_CONVERSACION_MAX)
    assert.ok(receivedContents !== null);
    assert.ok(receivedContents.length <= 4, `Esperado <= 4 turnos recibidos por Gemini, recibido: ${receivedContents.length}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("T4 - Modo conversacional responde con SSE streaming cuando cliente lo solicita", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes("generativelanguage.googleapis.com")) {
      return new Response(JSON.stringify({
        candidates: [{
          content: { parts: [{ text: "Explicación breve de pedagogía activa." }] }
        }]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, opts);
  };

  try {
    const req = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        "x-app-key": "clave-institucional-test",
        "x-docente-id": "docente_test_t4_stream"
      },
      body: JSON.stringify({
        confirmado: true,
        stream: true,
        messages: [{ role: "user", text: "¿Qué es el aprendizaje significativo de Ausubel?" }]
      })
    });

    const env = {
      APP_ACCESS_KEY: "clave-institucional-test",
      GEMINI_API_KEY: "dummy-key-t4",
      RATE_LIMIT_DISPOSITIVO_DIARIO: "100"
    };

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") || "", /text\/event-stream/);

    const rawText = await res.text();
    assert.match(rawText, /data:\s*\{.*"delta"/);
    assert.match(rawText, /data:\s*\[DONE\]/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
