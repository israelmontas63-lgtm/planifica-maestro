import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CerebroMultimodal, manejarEndpointAsistente } from "../worker/services/cerebroMultimodal.js";

describe("CerebroMultimodal - Visión Interactiva y Tool Calling", () => {
  const envMock = {
    GEMINI_API_KEY: "test-gemini-key",
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-supabase-key",
    SUPABASE_ACCESS_TOKEN: "sbp_test_token",
    SUPABASE_PROJECT_REF: "obcjdxearmmvtihfmtaa",
    TAVILY_API_KEY: "tvly-test-key"
  };

  it("debe declarar formalmente las 3 herramientas requeridas y el system prompt especializado", () => {
    const cerebro = new CerebroMultimodal(envMock);
    const tools = cerebro.obtenerHerramientas();

    assert.equal(tools.length, 3);
    const nombres = tools.map((t) => t.name);
    assert.ok(nombres.includes("consultar_curriculo"));
    assert.ok(nombres.includes("investigar_normativa_minerd"));
    assert.ok(nombres.includes("verificar_esquema_ddl"));

    assert.ok(cerebro.systemPrompt.includes("tutor interactivo"));
    assert.ok(cerebro.systemPrompt.includes("Análisis visual"));
  });

  it("debe procesar correctamente un payload con imagen y texto simultáneos", async () => {
    let capturedBody = null;
    const mockFetch = async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: "En la captura se observa el botón azul de 'Generar Planificación'. Debes hacer clic en él."
                  }
                ]
              }
            }
          ]
        })
      };
    };

    const cerebro = new CerebroMultimodal(envMock, { fetchFn: mockFetch });
    const res = await cerebro.procesarMensaje({
      mensaje: "¿Dónde debo hacer clic en esta pantalla?",
      imagenBase64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      mimeType: "image/png"
    });

    assert.equal(res.ok, true);
    assert.ok(res.texto.includes("botón azul"));

    const userParts = capturedBody.contents[0].parts;
    assert.equal(userParts.length, 2);
    assert.equal(userParts[0].inlineData.mimeType, "image/png");
    assert.equal(userParts[0].inlineData.data, "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");
    assert.equal(userParts[1].text, "¿Dónde debo hacer clic en esta pantalla?");
  });

  it("debe despachar y recibir el resultado de la herramienta curricular con ciclo de Tool Calling", async () => {
    let llamadas = 0;
    let rpcArgsEnviados = null;

    const mockFetch = async (url, opts) => {
      llamadas++;
      // Turno 1: Gemini solicita consultar_curriculo
      if (llamadas === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      functionCall: {
                        name: "consultar_curriculo",
                        args: { query_text: "adición", p_grado: 1 }
                      }
                    }
                  ]
                }
              }
            ]
          })
        };
      }

      // Turno 2: Supabase RPC
      if (url.includes("/rest/v1/rpc/buscar_curriculo_paginas")) {
        rpcArgsEnviados = JSON.parse(opts.body);
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              pagina: 115,
              area: "Matemática",
              texto: "Adición de números naturales hasta el 99."
            }
          ]
        };
      }

      // Turno 3: Gemini sintetiza con la cita
      if (llamadas === 3) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: "En la página 115 de la Adecuación Curricular de Matemática para 1er grado se contempla la adición hasta el 99."
                    }
                  ]
                }
              }
            ]
          })
        };
      }

      return { ok: true, json: async () => ({}) };
    };

    const cerebro = new CerebroMultimodal(envMock, { fetchFn: mockFetch });
    const res = await cerebro.procesarMensaje({
      mensaje: "¿Cuál es el contenido de adición en primer grado?"
    });

    assert.equal(res.ok, true);
    assert.equal(res.herramientasEjecutadas.length, 1);
    assert.equal(res.herramientasEjecutadas[0].nombre, "consultar_curriculo");
    assert.equal(rpcArgsEnviados.query_text, "adición");
    assert.equal(rpcArgsEnviados.p_grado, 1);
    assert.ok(res.texto.includes("página 115"));
  });

  it("debe manejar con resiliencia fallos de red y respuestas nulas sin lanzar excepciones no controladas", async () => {
    // Caso 1: Error de red
    const mockFalloRed = async () => {
      throw new Error("Conexión abortada por timeout");
    };
    const cerebroRed = new CerebroMultimodal(envMock, { fetchFn: mockFalloRed });
    const resRed = await cerebroRed.procesarMensaje({ mensaje: "Prueba error red" });
    assert.equal(resRed.ok, false);
    assert.ok(resRed.error.includes("Conexión abortada"));
    assert.ok(resRed.texto.includes("problema de conexión"));

    // Caso 2: Respuesta HTTP 500 de Gemini
    const mockHttp500 = async () => ({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error"
    });
    const cerebro500 = new CerebroMultimodal(envMock, { fetchFn: mockHttp500 });
    const res500 = await cerebro500.procesarMensaje({ mensaje: "Prueba 500" });
    assert.equal(res500.ok, false);
    assert.ok(res500.error.includes("500"));

    // Caso 3: Candidatos vacíos (respuesta nula)
    const mockVacio = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [] })
    });
    const cerebroVacio = new CerebroMultimodal(envMock, { fetchFn: mockVacio });
    const resVacio = await cerebroVacio.procesarMensaje({ mensaje: "Prueba respuesta vacía" });
    assert.equal(resVacio.ok, false);
    assert.ok(resVacio.error.includes("sin candidatos"));
  });

  it("debe conectar correctamente en el adaptador de endpoint con JSON y streaming SSE", async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          { content: { parts: [{ text: "Explicación de la captura de pantalla" }] } }
        ]
      })
    });

    // Test JSON
    const resJson = await manejarEndpointAsistente(
      { mensaje: "Revisa esto", imagenBase64: "abc1234", stream: false },
      envMock,
      { fetchFn: mockFetch }
    );
    assert.equal(resJson.status, 200);
    const dataJson = await resJson.json();
    assert.equal(dataJson.ok, true);
    assert.equal(dataJson.modo, "multimodal_vision");
    assert.equal(dataJson.mensaje_chat, "Explicación de la captura de pantalla");

    // Test SSE
    const resStream = await manejarEndpointAsistente(
      { mensaje: "Revisa esto en stream", stream: true },
      envMock,
      { fetchFn: mockFetch }
    );
    assert.equal(resStream.status, 200);
    assert.ok(resStream.headers.get("Content-Type").includes("text/event-stream"));
    const textStream = await resStream.text();
    assert.ok(textStream.includes("analizando_multimodal"));
    assert.ok(textStream.includes("[DONE]"));
  });
});
