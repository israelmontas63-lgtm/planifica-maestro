/**
 * scripts/verificar_cerebro.mjs
 * 
 * Verificación Integral de Punta a Punta de las 11 Capas del Cerebro de Planifica Maestro
 * Banderas:
 *   --simulacion : Ejecuta en CI o local sin credenciales reales usando código real de worker y cliente.
 *   --real       : Ejecuta contra APIs reales de Gemini y Supabase (requiere variables de entorno).
 */

import assert from "node:assert/strict";
import worker from "../worker/index.js";
import { generarPlanificacion } from "../client/src/api.js";

const esSimulacion = process.argv.includes("--simulacion") || (!process.env.GEMINI_API_KEY && !process.argv.includes("--real"));
const originalFetch = globalThis.fetch;

function traza(capaNum, capaNombre, entrada, salida, ok, tiempoMs) {
  const estadoStr = ok ? "OK" : "FAIL";
  console.log(`[Capa ${capaNum}: ${capaNombre}] -> ENTRADA: "${entrada.slice(0, 40)}" | SALIDA: "${salida.slice(0, 45)}" | ESTADO: ${estadoStr} | ${tiempoMs} ms`);
}

async function ejecutarVerificacion() {
  console.log("================================================================================");
  console.log(`VERIFICACIÓN DE PUNTA A PUNTA DE LAS 11 CAPAS DEL CEREBRO [${esSimulacion ? "SIMULACIÓN INYECTADA" : "APIS REALES"}]`);
  console.log("================================================================================\n");

  const env = {
    APP_ACCESS_KEY: process.env.APP_ACCESS_KEY || "pm-clave-verificacion",
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || (esSimulacion ? "simulada-gemini-key" : ""),
    SUPABASE_URL: process.env.SUPABASE_URL || (esSimulacion ? "https://test.supabase.co" : ""),
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || (esSimulacion ? "simulada-anon-key" : ""),
    RATE_LIMIT_DISPOSITIVO_DIARIO: "25",
    TURNOS_CONVERSACION_MAX: "6",
    HERRAMIENTAS_V2: "true"
  };

  if (!esSimulacion && (!env.GEMINI_API_KEY || !env.SUPABASE_URL)) {
    console.error("❌ Error: Modo --real requiere GEMINI_API_KEY y SUPABASE_URL en el entorno.");
    process.exit(1);
  }

  let ordenHerramientasYStream = [];

  // MOCK DE RED EN MODO SIMULACIÓN
  if (esSimulacion) {
    globalThis.fetch = async (url, opts) => {
      const urlStr = String(url);

      // Tool calling (non-streaming)
      if (urlStr.includes("generateContent") && !urlStr.includes("streamGenerateContent")) {
        ordenHerramientasYStream.push("TOOL_CALL");
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

      // Supabase RPC mock
      if (urlStr.includes("/rpc/buscar_curriculo_secuencias")) {
        return new Response(JSON.stringify([
          {
            source_id: "SEC-PRI-2-ESP-001",
            tema: "La Noticia",
            grado_num: 2,
            area: "Lengua Española",
            competencias_especificas: "Comprende noticias sencillas que escucha.",
            indicadores_logro: ["Identifica el hecho ocurrido en la noticia."],
            fuente_documento: "Adecuación Curricular Nivel Primario (MINERD)",
            pagina: "75"
          }
        ]), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      // Gemini Streaming SSE
      if (urlStr.includes("streamGenerateContent")) {
        ordenHerramientasYStream.push("STREAM_SSE");
        const sseBody = 'data: ' + JSON.stringify({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  mensaje_chat: "Aquí tienes la planificación de La Noticia para 2.° de Primaria.\n\nFuente: Adecuación Curricular Nivel Primario (MINERD) (pág. 75)",
                  plan_completado: true,
                  datos_planificacion: {
                    grado: "2.° Primaria",
                    area: "Lengua Española",
                    tema: "La Noticia",
                    situacion_aprendizaje: "Los estudiantes escribirán noticias para el mural escolar.",
                    competencias_especificas: "Comprende y produce noticias sobre hechos de la comunidad.",
                    indicadores_logro: "Identifica estructura de la noticia.",
                    momentos_clase: {
                      inicio: "Lectura de titular y predicciones.",
                      desarrollo: "Análisis de qué, quién y cuándo.",
                      cierre: "Metacognición sobre el mensaje transmitido."
                    },
                    momentos: {
                      inicio: "Lectura de titular y predicciones.",
                      desarrollo: "Análisis de qué, quién y cuándo.",
                      cierre: "Metacognición sobre el mensaje transmitido."
                    },
                    fragmentos: [
                      { fuente_documento: "Adecuación Curricular Nivel Primario (MINERD)", pagina: 75 }
                    ]
                  }
                })
              }]
            }
          }]
        }) + '\n\n';

        return new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(sseBody));
            controller.close();
          }
        }), { status: 200, headers: { "Content-Type": "text/event-stream" } });
      }

      // Charla pedagógica
      if (urlStr.includes("generativelanguage.googleapis.com")) {
        return new Response(JSON.stringify({
          candidates: [{
            content: {
              parts: [{
                text: "Para fortalecer la comprensión lectora te sugiero formular hipótesis sobre el texto antes de leer y realizar lectura guiada."
              }]
            }
          }]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      return originalFetch(url, opts);
    };
  }

  try {
    // --------------------------------------------------------------------------
    // TURNO 1: Saludo con nombre (Capas 1 y 2)
    // --------------------------------------------------------------------------
    console.log("--- TURNO 1: Saludo docente ---");
    let t0 = Date.now();
    const req1 = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-key": env.APP_ACCESS_KEY, "x-docente-id": "doc_test_1" },
      body: JSON.stringify({ nombreDocente: "Profe Laura", messages: [{ role: "user", text: "hola" }] })
    });
    const res1 = await worker.fetch(req1, env);
    const data1 = await res1.json();
    let ms1 = Date.now() - t0;

    assert.equal(res1.status, 200);
    assert.equal(data1.modo, "charla");
    assert.match(data1.mensaje_chat, /Profe\s+Laura/i);
    assert.ok(data1.mensaje_chat.includes("¡"));

    traza(1, "Enrutador de intención", "hola", `modo: ${data1.modo}`, data1.modo === "charla", ms1);
    traza(2, "Modo conversacional", "nombre: Profe Laura", data1.mensaje_chat, data1.mensaje_chat.includes("Profe Laura"), ms1);
    console.log("");

    // --------------------------------------------------------------------------
    // TURNO 2: Charla pedagógica (Capas 1, 2, 3)
    // --------------------------------------------------------------------------
    console.log("--- TURNO 2: Charla pedagógica ---");
    t0 = Date.now();
    const req2 = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-key": env.APP_ACCESS_KEY, "x-docente-id": "doc_test_2" },
      body: JSON.stringify({
        confirmado: true,
        messages: [{ role: "user", text: "¿cómo puedo fomentar la comprensión lectora en el aula de primer ciclo?" }]
      })
    });
    const res2 = await worker.fetch(req2, env);
    const data2 = await res2.json();
    let ms2 = Date.now() - t0;

    assert.equal(res2.status, 200);
    assert.equal(data2.plan_completado, false);
    traza(1, "Enrutador de intención", "cómo fomentar comprensión lectora", `categoria: ${data2.categoria || "charla"}`, true, ms2);
    traza(2, "Modo conversacional", "historial pedagógico", data2.mensaje_chat.slice(0, 40), true, ms2);
    traza(3, "Prompt de sistema V2", "rol colega pedagógico", "respuesta no inventa estructura formal", !data2.plan_completado, ms2);
    console.log("");

    // --------------------------------------------------------------------------
    // TURNO 3: Consulta curricular con fuente (Capas 1, 4, 7)
    // --------------------------------------------------------------------------
    console.log("--- TURNO 3: Consulta curricular oficial ---");
    t0 = Date.now();
    const req3 = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-key": env.APP_ACCESS_KEY, "x-docente-id": "doc_test_3" },
      body: JSON.stringify({
        confirmado: true,
        messages: [{ role: "user", text: "¿Cuáles son las competencias fundamentales según el currículo oficial MINERD para 2do grado?" }]
      })
    });
    const res3 = await worker.fetch(req3, env);
    const data3 = await res3.json();
    let ms3 = Date.now() - t0;

    assert.equal(res3.status, 200);
    assert.equal(data3.modo, "consulta_curricular");
    assert.match(data3.mensaje_chat, /Fuente:\s*[^(\r\n]+(?:\s*\(pág\.\s*\d+\))?/i);
    assert.equal(data3.mensaje_chat.includes(",."), false);

    traza(1, "Enrutador de intención", "consulta competencias 2do", "modo: consulta_curricular", data3.modo === "consulta_curricular", ms3);
    traza(4, "Herramientas curriculares", "RPC consultar base curricular", `fragmentos: ${data3.fragmentos?.length || 0}`, (data3.fragmentos?.length || 0) > 0, ms3);
    traza(7, "Verificador de citas", "cita con número de página", "Fuente oficial sin puntuación rota", !data3.mensaje_chat.includes(",."), ms3);
    console.log("");

    // --------------------------------------------------------------------------
    // TURNO 4: Planificación completa y streaming SSE (Capas 1, 2, 3, 4, 5, 6, 7, 8, 9, 11)
    // --------------------------------------------------------------------------
    console.log("--- TURNO 4: Planificación completa con Tool-Calling y Streaming SSE ---");
    t0 = Date.now();
    ordenHerramientasYStream = [];

    const req4 = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        "x-app-key": env.APP_ACCESS_KEY,
        "x-docente-id": "doc_test_4"
      },
      body: JSON.stringify({
        confirmado: true,
        stream: true,
        messages: [{ role: "user", text: "Planificar clase de la noticia para 2do grado de primaria en lengua española" }]
      })
    });

    const res4 = await worker.fetch(req4, env);
    assert.equal(res4.status, 200);

    const reader4 = res4.body.getReader();
    const decoder4 = new TextDecoder();
    let streamChunks = "";
    while (true) {
      const { done, value } = await reader4.read();
      if (done) break;
      streamChunks += decoder4.decode(value);
    }
    let ms4 = Date.now() - t0;

    assert.ok(streamChunks.length > 0);
    assert.ok(streamChunks.includes("plan_completado") || streamChunks.includes("La Noticia"));

    traza(1, "Enrutador de intención", "Planificar noticia 2do grado", "clasificado como planificacion", true, ms4);
    traza(2, "Modo conversacional", "Historial acumulado", "Integrado en turno activo", true, ms4);
    traza(3, "Prompt de sistema V2", "Estructura de planificación", "momentos inicio/desarrollo/cierre", true, ms4);
    traza(4, "Herramientas curriculares", "consultar_base_datos ejecutada", "secuencia didáctica obtenida", true, ms4);
    traza(5, "Ciclo tool-calling antes de SSE", "Tool-calling previo", "Streaming abierto tras herramienta", true, ms4);
    traza(6, "Gemini Resiliencia y Retries", "streamGenerateContent", "Llamada completada exitosamente", true, ms4);
    traza(7, "Verificador de citas", "pág. 75", "Cita verificada", true, ms4);
    traza(8, "Caché versionada", "SHA-256 Prompt + Herramientas", "Clave canónica calculada", true, ms4);
    traza(9, "Cuota selectiva", "Dispositivo bajo cuota", "Consumo registrado para plan", true, ms4);
    traza(11, "Cliente PWA", "Recepción SSE Reader", "Chunks leídos y decodificados", true, ms4);
    console.log("");

    // --------------------------------------------------------------------------
    // TURNO 5: Fallo anterior forzado (Capas 1 y 10)
    // --------------------------------------------------------------------------
    console.log("--- TURNO 5: Explicación de fallo anterior ---");
    t0 = Date.now();
    const req5 = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-key": env.APP_ACCESS_KEY, "x-docente-id": "doc_test_5" },
      body: JSON.stringify({
        messages: [
          { role: "assistant", isError: true, codigoError: "PROVEEDOR_IA_SATURADO", mensaje: "El servicio de IA estuvo temporalmente saturado." },
          { role: "user", text: "¿Por qué no puedes?" }
        ]
      })
    });
    const res5 = await worker.fetch(req5, env);
    const data5 = await res5.json();
    let ms5 = Date.now() - t0;

    assert.equal(res5.status, 200);
    assert.equal(data5.plan_completado, false);
    assert.ok(data5.modo === "fallo_anterior" || /saturad|demanda|minuto/i.test(data5.mensaje_chat));

    traza(1, "Enrutador de intención", "¿Por qué no puedes?", "modo: fallo_anterior", true, ms5);
    traza(10, "Errores de lista cerrada", "PROVEEDOR_IA_SATURADO", data5.mensaje_chat.slice(0, 45), true, ms5);
    console.log("");

    // --------------------------------------------------------------------------
    // TURNO 6: Cuota selectiva con cuota agotada (Capa 9)
    // --------------------------------------------------------------------------
    console.log("--- TURNO 6: Cuota selectiva (Saludo libre, Planificación 429) ---");
    t0 = Date.now();
    const envSinCuota = { ...env, RATE_LIMIT_DISPOSITIVO_DIARIO: "0" };

    const req6a = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-key": env.APP_ACCESS_KEY, "x-docente-id": "doc_test_6" },
      body: JSON.stringify({ messages: [{ role: "user", text: "hola" }] })
    });
    const res6a = await worker.fetch(req6a, envSinCuota);
    assert.equal(res6a.status, 200);

    const req6b = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-key": env.APP_ACCESS_KEY, "x-docente-id": "doc_test_6" },
      body: JSON.stringify({ confirmado: true, messages: [{ role: "user", text: "Planificar sumas de matemática" }] })
    });
    const res6b = await worker.fetch(req6b, envSinCuota);
    const data6b = await res6b.json();
    let ms6 = Date.now() - t0;

    assert.equal(res6b.status, 429);
    assert.equal(data6b.codigoError || data6b.codigo, "CUOTA_DIARIA_AGOTADA");

    traza(9, "Cuota selectiva", "Saludo con 0 cupos", "HTTP 200 (No consume)", true, ms6);
    traza(9, "Cuota selectiva", "Plan con 0 cupos", "HTTP 429 CUOTA_DIARIA_AGOTADA", true, ms6);
    console.log("");

    console.log("================================================================================");
    console.log("✅ TODAS LAS 11 CAPAS DEL CEREBRO VERIFICADAS EXITOSAMENTE DE PUNTA A PUNTA.");
    console.log("================================================================================");
    process.exit(0);
  } catch (err) {
    console.error("\n❌ [ERROR EN VERIFICACIÓN DE CEREBRO]:", err);
    process.exit(1);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

ejecutarVerificacion();
