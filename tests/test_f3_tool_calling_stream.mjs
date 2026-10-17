import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";

test("F3 - Ciclo tool-calling se ejecuta ANTES de abrir el streaming SSE hacia el cliente", async () => {
  const originalFetch = globalThis.fetch;
  const ordenEventos = [];

  try {
    globalThis.fetch = async (url, opts) => {
      const urlStr = String(url);

      // 1. Fase Tool-Calling: Gemini devuelve functionCall para consultar_base_datos
      if (urlStr.includes("generateContent") && !urlStr.includes("streamGenerateContent")) {
        ordenEventos.push("1_TOOL_CALL_SOLICITADO");
        return new Response(JSON.stringify({
          candidates: [{
            content: {
              parts: [{
                functionCall: {
                  name: "consultar_base_datos",
                  args: { p_nivel: "Primario", p_grado: 2, p_area: "Lengua Española", p_consulta: "noticia" }
                }
              }]
            }
          }]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      // 2. Mock de Supabase si la herramienta consulta la base de datos
      if (urlStr.includes("/rpc/buscar_curriculo_secuencias")) {
        ordenEventos.push("2_HERRAMIENTA_EJECUTADA_EN_SUPABASE");
        return new Response(JSON.stringify([
          {
            source_id: "SEC-PRI-2-ESP-001",
            tema: "La Noticia",
            grado_num: 2,
            area: "Lengua Española",
            competencias_especificas: "Comprende noticias sencillas.",
            indicadores_logro: ["Identifica el hecho."],
            fuente_documento: "Adecuación Curricular",
            pagina: "75"
          }
        ]), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      // 3. Fase Streaming SSE: Gemini envía el flujo SSE tras haber recibido los datos de la herramienta
      if (urlStr.includes("streamGenerateContent")) {
        ordenEventos.push("3_STREAMING_SSE_INICIADO");
        const sseData = 'data: ' + JSON.stringify({
          candidates: [{
            content: {
              parts: [{
                text: '{"mensaje_chat":"Plan generado con datos oficiales","plan_completado":true,"datos_planificacion":{"tema":"La Noticia","situacion_aprendizaje":"Aprender a redactar noticias escolares","momentos_clase":{"inicio":"Inicio","desarrollo":"Desarrollo","cierre":"Cierre"}}}'
              }]
            }
          }]
        }) + '\n\n';

        return new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(sseData));
            controller.close();
          }
        }), { status: 200, headers: { "Content-Type": "text/event-stream" } });
      }

      return new Response("Not found", { status: 404 });
    };

    const req = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        "x-app-key": "clave-institucional-test",
        "x-docente-id": "docente_test_f3"
      },
      body: JSON.stringify({
        confirmado: true,
        stream: true,
        messages: [{ role: "user", text: "Planificar clase de la noticia para 2do grado de primaria en lengua española" }]
      })
    });

    const env = {
      APP_ACCESS_KEY: "clave-institucional-test",
      GEMINI_API_KEY: "gemini-test-key",
      SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_ANON_KEY: "anon-test-key",
      HERRAMIENTAS_V2: "true",
      RATE_LIMIT_DISPOSITIVO_DIARIO: "100"
    };

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 200);

    // Leer el stream SSE del worker
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let streamOutput = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      streamOutput += decoder.decode(value);
    }

    assert.ok(streamOutput.length > 0, "El cliente debe recibir chunks SSE");
    assert.ok(ordenEventos.includes("1_TOOL_CALL_SOLICITADO"), "Debe solicitar tool call primero");
    assert.ok(ordenEventos.includes("3_STREAMING_SSE_INICIADO"), "Debe iniciar streaming SSE después");

    const idxTool = ordenEventos.indexOf("1_TOOL_CALL_SOLICITADO");
    const idxStream = ordenEventos.indexOf("3_STREAMING_SSE_INICIADO");
    assert.ok(idxTool < idxStream, "El ciclo de herramienta debe ocurrir estrictamente antes de abrir el stream SSE");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
