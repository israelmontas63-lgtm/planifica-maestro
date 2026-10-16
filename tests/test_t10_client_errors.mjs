import test from "node:test";
import assert from "node:assert/strict";
import { generarPlanificacion } from "../client/src/api.js";

test("T10 - generarPlanificacion en JSON preserva causa del worker sin sobreescribir con 'Tuve dificultades'", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return new Response(JSON.stringify({
      ok: false,
      isError: true,
      codigo: "PROVEEDOR_IA_SATURADO",
      codigoError: "PROVEEDOR_IA_SATURADO",
      mensaje: "El proveedor externo de Gemini reportó saturación temporal.",
      sugerencia: "Espera un minuto y reintenta.",
      mensaje_chat: "El proveedor externo de Gemini reportó saturación temporal.\n\n💡 Sugerencia: Espera un minuto y reintenta."
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  try {
    const res = await generarPlanificacion({
      messages: [{ role: "user", text: "planificar suma" }]
    });

    assert.equal(res.ok, false);
    assert.equal(res.isError, true);
    assert.equal(res.codigo, "PROVEEDOR_IA_SATURADO");
    assert.match(res.mensaje_chat, /Gemini reportó saturación temporal/);
    assert.ok(!res.mensaje_chat.includes("Tuve dificultades para organizar los componentes de esta planificación"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("T10 - generarPlanificacion en SSE preserva causa devuelta en final sin sobreescribir", async () => {
  const originalFetch = globalThis.fetch;
  const sseBody = [
    `data: ${JSON.stringify({ estado: "pensando" })}\n\n`,
    `data: ${JSON.stringify({ final: {
      ok: false,
      isError: true,
      codigo: "IA_NO_DISPONIBLE",
      mensaje: "Servicio de búsqueda web externa no disponible.",
      sugerencia: "Consulta el currículo directamente."
    } })}\n\n`,
    `data: [DONE]\n\n`
  ].join("");

  globalThis.fetch = async () => {
    return new Response(sseBody, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" }
    });
  };

  try {
    let chunks = [];
    const res = await generarPlanificacion({
      messages: [{ role: "user", text: "busca en la web" }],
      onChunk: (delta, acc) => { if (delta) chunks.push(delta); }
    });

    assert.equal(res.ok, false);
    assert.equal(res.isError, true);
    assert.equal(res.codigo, "IA_NO_DISPONIBLE");
    assert.match(res.mensaje_chat, /búsqueda web externa no disponible/);
    assert.ok(!res.mensaje_chat.includes("Tuve dificultades para organizar los componentes de esta planificación"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
