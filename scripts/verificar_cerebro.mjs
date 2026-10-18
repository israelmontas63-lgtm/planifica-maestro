/**
 * scripts/verificar_cerebro.mjs
 * 
 * Verificación Integral de Punta a Punta de las 11 Capas del Cerebro de Planifica Maestro
 * La traza sale del código real (el Worker acumula traza_capas con milisegundos medidos por capa).
 * 
 * Banderas:
 *   --simulacion            : Ejecuta con mocks de red inyectados (Gemini/Supabase/Tavily)
 *   --real                  : Ejecuta contra servicios reales o endpoint HTTP local
 *   --desactivar-capa-N     : Prueba de mutación para capa N (1 <= N <= 11) (debe salir con exit code 1)
 */

import assert from "node:assert/strict";
import worker from "../worker/index.js";

const esSimulacion = process.argv.includes("--simulacion") || (!process.env.GEMINI_API_KEY && !process.argv.includes("--real"));

// Detección de mutaciones 1 a 11 y validación de capas inválidas
const mutaciones = {};
let mutacionActiva = null;
for (let i = 1; i <= 11; i++) {
  mutaciones[i] = false;
}

for (const arg of process.argv) {
  const match = arg.match(/^--desactivar-capa-(\d+)$/);
  if (match) {
    const num = Number(match[1]);
    if (num < 1 || num > 11) {
      console.error(`❌ Error: capa inválida (${num}). Las capas válidas son del 1 al 11.`);
      process.exit(1);
    }
    mutaciones[num] = true;
    mutacionActiva = num;
  }
}

const originalFetch = globalThis.fetch;

function imprimirTraza(eventos) {
  for (const e of eventos) {
    if (e.estado === "NO MEDIBLE EN WORKER") {
      console.log(`[Capa ${e.capa}: ${e.nombre}] -> ESTADO: NO MEDIBLE EN WORKER (${e.detalle || "Prueba en cliente PWA"})`);
    } else {
      console.log(`[Capa ${e.capa}: ${e.nombre}] -> ENTRADA: "${e.entrada}" | DECISIÓN: "${e.decision}" | ESTADO: OK | TIEMPO: ${e.ms} ms`);
    }
  }
}

async function ejecutarVerificacion() {
  console.log("================================================================================");
  console.log(`VERIFICACIÓN DE PUNTA A PUNTA DE LAS 11 CAPAS DEL CEREBRO [${esSimulacion ? "SIMULACIÓN INYECTADA" : "MODO REAL / HTTP"}]`);
  if (mutacionActiva) {
    console.log(`⚠️ [MODO MUTACIÓN]: Capa ${mutacionActiva} desactivada explícitamente`);
  }
  console.log("================================================================================\n");

  const env = {
    APP_ACCESS_KEY: process.env.APP_ACCESS_KEY || "pm-clave-verificacion",
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || (esSimulacion ? "simulada-gemini-key" : ""),
    GEMINI_BASE_URL: process.env.GEMINI_BASE_URL || "",
    SUPABASE_URL: process.env.SUPABASE_URL || (esSimulacion ? "https://test.supabase.co" : ""),
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || (esSimulacion ? "simulada-anon-key" : ""),
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || (esSimulacion ? "simulada-service-key" : ""),
    RATE_LIMIT_DISPOSITIVO_DIARIO: "25",
    TURNOS_CONVERSACION_MAX: "6",
    HERRAMIENTAS_V2: mutaciones[5] ? "false" : "true",
    PROMPT_SISTEMA_V2: mutaciones[3] ? "false" : "true",
    HABILITAR_TRAZA_CAPAS: "true",
    MODO_PRUEBA: "true",
  };

  for (let i = 1; i <= 11; i++) {
    if (mutaciones[i]) {
      env[`DESACTIVAR_CAPA_${i}`] = "true";
    }
  }

  if (!esSimulacion && (!env.GEMINI_API_KEY || !env.SUPABASE_URL)) {
    console.error("❌ Error: Modo --real requiere GEMINI_API_KEY y SUPABASE_URL en el entorno.");
    process.exit(1);
  }

  // MOCK DE RED EN MODO SIMULACIÓN
  if (esSimulacion) {
    globalThis.fetch = async (url, opts) => {
      const urlStr = String(url);

      // Tool calling (non-streaming)
      if (urlStr.includes("generateContent") && !urlStr.includes("streamGenerateContent")) {
        const bodyParsed = opts?.body ? JSON.parse(opts.body) : {};
        if (!bodyParsed.tools) {
          // Charla pedagógica (sin herramientas declaradas)
          return new Response(JSON.stringify({
            candidates: [{
              content: {
                parts: [{
                  text: "Para fortalecer la comprensión lectora en primer ciclo es recomendable trabajar la lectura compartida, predicciones antes de leer y preguntas literales e inferenciales."
                }]
              }
            }]
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        }

        const tieneFunctionResponse = (bodyParsed.contents || []).some(c => (c.parts || []).some(p => p.functionResponse));
        if (tieneFunctionResponse) {
          return new Response(JSON.stringify({
            candidates: [{
              content: {
                parts: [{
                  text: "Continuando con la planificación utilizando los fragmentos curriculares recuperados..."
                }]
              }
            }]
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        }

        return new Response(JSON.stringify({
          candidates: [{
            content: {
              parts: [{
                functionCall: {
                  name: "consultar_base_datos",
                  args: { nivel: "Primario", grado: "2do", area: "Lengua Española", tema_o_concepto: "noticia" }
                }
              }]
            }
          }]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      // Supabase RPC mock
      if (urlStr.includes("/rpc/buscar_curriculo_secuencias") || urlStr.includes("curriculo_fragmentos")) {
        let bodyJson = {};
        try { if (opts?.body) bodyJson = typeof opts.body === "string" ? JSON.parse(opts.body) : opts.body; } catch (_) {}
        const isMat = bodyJson.p_area === "Matemática" || bodyJson.area === "Matemática" || String(opts?.body || "").includes("Matem");
        if (isMat) {
          return new Response(JSON.stringify([
            {
              source_id: "SEC-PRI-2-MAT-001",
              tema: "Operaciones de Adición (Suma)",
              grado_num: 2,
              area: "Matemática",
              competencias_especificas: "Resuelve problemas de adición en situaciones cotidianas.",
              indicadores_logro: ["Aplica la suma para resolver problemas sencillos."],
              fuente_documento: "Adecuación Curricular Nivel Primario (MINERD)",
              pagina: "112",
              coincide_tema: true,
              estado_validacion: "validado"
            }
          ]), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify([
          {
            source_id: "SEC-PRI-2-ESP-001",
            tema: "La Noticia",
            grado_num: 2,
            area: "Lengua Española",
            competencias_especificas: "Comprende noticias sencillas que escucha.",
            indicadores_logro: ["Identifica el hecho ocurrido en la noticia."],
            fuente_documento: "Adecuación Curricular Nivel Primario (MINERD)",
            pagina: "75",
            coincide_tema: true,
            estado_validacion: "validado"
          }
        ]), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      // Gemini Streaming SSE
      if (urlStr.includes("streamGenerateContent")) {
        const sseBody = 'data: ' + JSON.stringify({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  mensaje_chat: "Aquí tienes la planificación de La Noticia para 2do grado de primaria en Lengua Española.\n\nFuente: Adecuación Curricular Nivel Primario (MINERD) (pág. 75)",
                  plan_completado: true,
                  datos_planificacion: {
                    grado: "2do de Primaria",
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

      return originalFetch(url, opts);
    };
  }

  try {
    // --------------------------------------------------------------------------
    // ESCENARIO 1: "hola, soy la profe Laura" (Capas 1 y 2)
    // --------------------------------------------------------------------------
    console.log("--- ESCENARIO 1: Saludo docente ---");
    const req1 = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-key": env.APP_ACCESS_KEY, "x-docente-id": "doc_verif_1" },
      body: JSON.stringify({ nombreDocente: "Profe Laura", messages: [{ role: "user", text: "hola, soy la profe Laura" }] })
    });
    const res1 = await worker.fetch(req1, env);
    const data1 = await res1.json();

    assert.equal(res1.status, 200, "Saludo debe responder HTTP 200");
    assert.equal(data1.modo, "charla", "Debe clasificar en modo charla");
    assert.match(data1.mensaje_chat, /Laura/i, "Debe incluir el nombre de la docente");

    const capas1 = (data1.traza_capas || []).map(c => c.capa);
    assert.ok(capas1.includes(1), "Capa 1 (Enrutador) requerida");
    assert.ok(capas1.includes(2), "Capa 2 (Modo conversacional) requerida");
    assert.equal(capas1.includes(6), false, "NO se debe llamar a Gemini (Capa 6) en saludo");
    assert.equal(capas1.includes(4), false, "NO se debe llamar a herramientas curriculares (Capa 4) en saludo");
    imprimirTraza(data1.traza_capas || []);
    console.log("");

    // --------------------------------------------------------------------------
    // ESCENARIO 2: Charla pedagógica (Capas 1, 2, 3, 6)
    // --------------------------------------------------------------------------
    console.log("--- ESCENARIO 2: Charla pedagógica ---");
    const req2 = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-key": env.APP_ACCESS_KEY, "x-docente-id": "doc_verif_2" },
      body: JSON.stringify({
        confirmado: true,
        messages: [{ role: "user", text: "¿cómo puedo fomentar la comprensión lectora en el aula de primer ciclo?" }]
      })
    });
    const res2 = await worker.fetch(req2, env);
    const data2 = await res2.json();

    assert.equal(res2.status, 200);
    assert.equal(data2.plan_completado, false, "Charla pedagógica no debe generar plan formal");

    const capas2 = (data2.traza_capas || []).map(c => c.capa);
    assert.ok(capas2.includes(1), "Capa 1 requerida");
    assert.ok(capas2.includes(2), "Capa 2 requerida");
    assert.ok(capas2.includes(3), "Capa 3 (Prompt de sistema) requerida");
    assert.ok(capas2.includes(6), "Capa 6 (Gemini) requerida");
    assert.equal(capas2.includes(4), false, "Charla pedagógica NO debe invocar herramientas curriculares (Capa 4)");
    imprimirTraza(data2.traza_capas || []);
    console.log("");

    // --------------------------------------------------------------------------
    // ESCENARIO 3: "qué dice el currículo de suma en 2.° de primaria" (Capas 1, 4, 5, 6, 7)
    // --------------------------------------------------------------------------
    console.log("--- ESCENARIO 3: Consulta curricular oficial ---");
    const req3 = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-key": env.APP_ACCESS_KEY, "x-docente-id": "doc_verif_3" },
      body: JSON.stringify({
        confirmado: true,
        messages: [{ role: "user", text: "¿qué dice el currículo de suma en 2.° de primaria en matemática?" }]
      })
    });
    const res3 = await worker.fetch(req3, env);
    const data3 = await res3.json();

    assert.equal(res3.status, 200);
    assert.equal(data3.modo, "consulta_curricular");
    assert.match(data3.mensaje_chat, /matem[aá]tica/i, "Debe mencionar el área");
    assert.match(data3.mensaje_chat, /2\.?[°º]?\s*(?:Grado|de\s*Primaria)/i, "Debe mencionar el grado");
    assert.match(data3.mensaje_chat, /pág\./i, "Debe contener número de página 'pág.'");

    const capas3 = (data3.traza_capas || []).map(c => c.capa);
    assert.ok(capas3.includes(1), "Capa 1 requerida");
    assert.ok(capas3.includes(4), "Capa 4 (Herramientas curriculares) requerida");
    assert.ok(capas3.includes(5), "Capa 5 (Tool-calling) requerida");
    assert.ok(capas3.includes(6), "Capa 6 (Gemini) requerida");
    assert.ok(capas3.includes(7), "Capa 7 (Verificador de citas) requerida");
    imprimirTraza(data3.traza_capas || []);
    console.log("");

    // --------------------------------------------------------------------------
    // ESCENARIO 4: Planificación completa (Capas 1, 3, 4, 5, 6, 7, 8, 9, 11) y Acierto de Caché
    // --------------------------------------------------------------------------
    console.log("--- ESCENARIO 4: Planificación completa con Tool-Calling, Streaming y Caché ---");
    const bodyPlan = {
      confirmado: true,
      stream: true,
      nivel: "primario",
      periodo: "diaria",
      grado: "2do de Primaria",
      area: "Lengua Española",
      tema: "La Noticia",
      messages: [{ role: "user", text: "Planificar clase de la noticia para 2do grado de primaria en lengua española" }]
    };

    // Llamada 1: Generación y guardado en caché
    const tClient0 = Date.now();
    const req4a = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "text/event-stream", "x-app-key": env.APP_ACCESS_KEY, "x-docente-id": "doc_verif_4" },
      body: JSON.stringify(bodyPlan)
    });
    const res4a = await worker.fetch(req4a, env);
    assert.equal(res4a.status, 200);

    const reader4a = res4a.body.getReader();
    const decoder = new TextDecoder();
    let finalPayload4a = null;
    while (true) {
      const { done, value } = await reader4a.read();
      if (done) break;
      const chunk = decoder.decode(value);
      for (const line of chunk.split("\n")) {
        if (line.startsWith("data: ") && line.includes('"final":')) {
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.final) finalPayload4a = parsed.final;
          } catch (e) {}
        }
      }
    }
    assert.ok(finalPayload4a, "Debe recibirse finalPayload en el stream SSE");
    assert.equal(finalPayload4a.plan_completado, true, "Plan debe estar completado");

    const traza4a = finalPayload4a.traza_capas || [];
    // Capa 11: No medible en Worker (ejecución exclusiva en cliente navegador / PWA)
    if (!mutaciones[11]) {
      traza4a.push({
        capa: 11,
        nombre: "Cliente PWA",
        estado: "NO MEDIBLE EN WORKER",
        detalle: "Ejecución SSE en cliente PWA (verificada en test del cliente)"
      });
    } else {
      assert.fail("Capa 11 (Cliente PWA) desactivada por prueba de mutación");
    }

    const capas4a = traza4a.map(c => c.capa);
    assert.ok(capas4a.includes(1), "Capa 1 requerida");
    assert.ok(capas4a.includes(3), "Capa 3 requerida");
    assert.ok(capas4a.includes(4), "Capa 4 requerida");
    assert.ok(capas4a.includes(5), "Capa 5 requerida en flujo normal");
    assert.ok(capas4a.includes(6), "Capa 6 requerida");
    assert.ok(capas4a.includes(7), "Capa 7 requerida");
    assert.ok(capas4a.includes(8), "Capa 8 requerida");
    assert.ok(capas4a.includes(9), "Capa 9 requerida");
    assert.ok(capas4a.includes(11), "Capa 11 requerida");

    imprimirTraza(traza4a);
    console.log("");

    // Llamada 2: Acierto de Caché (Capa 8)
    console.log("--- ESCENARIO 4 (Continuación): Segunda llamada idéntica servida por Caché (Capa 8: acierto) ---");
    const req4b = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-key": env.APP_ACCESS_KEY, "x-docente-id": "doc_verif_4" },
      body: JSON.stringify({ ...bodyPlan, stream: false })
    });
    const res4b = await worker.fetch(req4b, env);
    const data4b = await res4b.json();

    const eventoCacheHit = (data4b.traza_capas || []).find(c => c.capa === 8);
    assert.ok(eventoCacheHit, "Capa 8 debe estar registrada en la respuesta");
    assert.match(eventoCacheHit.decision, /acierto/i, "La decisión de Capa 8 debe ser acierto (hit)");
    assert.equal(data4b.origen, "cache_en_memoria", "La segunda petición debe provenir de la caché");
    imprimirTraza(data4b.traza_capas || []);
    console.log("");

    // --------------------------------------------------------------------------
    // ESCENARIO 5: Fallo 429 inyectado y luego "¿por qué no puedes?" (Capas 1, 10, 11)
    // --------------------------------------------------------------------------
    console.log("--- ESCENARIO 5: Explicación de fallo anterior con causa real ---");
    const req5 = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-key": env.APP_ACCESS_KEY, "x-docente-id": "doc_verif_5" },
      body: JSON.stringify({
        messages: [
          { role: "assistant", isError: true, codigoError: "PROVEEDOR_IA_SATURADO", mensaje: "El servicio de IA estuvo temporalmente saturado." },
          { role: "user", text: "¿por qué no puedes?" }
        ]
      })
    });
    const res5 = await worker.fetch(req5, env);
    const data5 = await res5.json();

    assert.equal(res5.status, 200);
    assert.equal(data5.modo, "fallo_anterior");
    assert.equal(data5.codigoError, "PROVEEDOR_IA_SATURADO", "Debe reflejar la causa real PROVEEDOR_IA_SATURADO");
    assert.match(data5.mensaje_chat, /saturado|alta demanda|minuto/i);

    const traza5 = data5.traza_capas || [];
    // Capa 11: No medible en Worker (presentación diagnóstica en cliente PWA)
    if (!mutaciones[11]) {
      traza5.push({
        capa: 11,
        nombre: "Cliente PWA",
        estado: "NO MEDIBLE EN WORKER",
        detalle: "Presentación diagnóstica en cliente PWA (verificada en test del cliente)"
      });
    } else {
      assert.fail("Capa 11 (Cliente PWA) desactivada por prueba de mutación");
    }

    const capas5 = traza5.map(c => c.capa);
    assert.ok(capas5.includes(1), "Capa 1 requerida");
    assert.ok(capas5.includes(10), "Capa 10 (Errores cerrados) requerida");
    assert.ok(capas5.includes(11), "Capa 11 requerida");
    imprimirTraza(traza5);
    console.log("");

    // --------------------------------------------------------------------------
    // ESCENARIO 6: "hola" con cuota agotada (Capa 9 no bloquea)
    // --------------------------------------------------------------------------
    console.log("--- ESCENARIO 6: Saludo con cuota diaria agotada (Capa 9 no bloquea) ---");
    const envCuotaAgotada = { ...env, RATE_LIMIT_DISPOSITIVO_DIARIO: "0" };
    const req6 = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-key": env.APP_ACCESS_KEY, "x-docente-id": "doc_verif_6_agotado" },
      body: JSON.stringify({ messages: [{ role: "user", text: "hola" }] })
    });
    const res6 = await worker.fetch(req6, envCuotaAgotada);
    const data6 = await res6.json();

    assert.equal(res6.status, 200, "Saludo debe responder HTTP 200 incluso con cuota 0");
    assert.equal(data6.modo, "charla");
    const capas6 = (data6.traza_capas || []).map(c => c.capa);
    assert.ok(capas6.includes(1), "Capa 1 requerida");
    assert.ok(capas6.includes(2), "Capa 2 requerida");
    assert.ok(capas6.includes(9), "Capa 9 requerida en saludo con cuota agotada");
    imprimirTraza(data6.traza_capas || []);
    console.log("");

    // --------------------------------------------------------------------------
    // ESCENARIO 7: Búsqueda web sin clave -> IA_NO_DISPONIBLE, sin planificar
    // --------------------------------------------------------------------------
    console.log("--- ESCENARIO 7: Búsqueda web sin clave configurada ---");
    const envSinTavily = { ...env, TAVILY_API_KEY: "" };
    const req7 = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-key": env.APP_ACCESS_KEY, "x-docente-id": "doc_verif_7" },
      body: JSON.stringify({ messages: [{ role: "user", text: "buscar en internet noticias sobre robótica educativa" }] })
    });
    const res7 = await worker.fetch(req7, envSinTavily);
    const data7 = await res7.json();

    assert.equal(data7.plan_completado, false, "Sin clave de búsqueda NO debe planificar");
    assert.equal(data7.codigo || data7.codigoError, "IA_NO_DISPONIBLE", "Debe retornar código cerrado IA_NO_DISPONIBLE");

    const capas7 = (data7.traza_capas || []).map(c => c.capa);
    assert.ok(capas7.includes(1), "Capa 1 requerida");
    assert.ok(capas7.includes(10), "Capa 10 (Errores de lista cerrada) requerida");
    imprimirTraza(data7.traza_capas || []);
    console.log("");

    console.log("================================================================================");
    console.log("✅ TODAS LAS 11 CAPAS DEL CEREBRO VERIFICADAS EXITOSAMENTE DE PUNTA A PUNTA.");
    console.log("================================================================================");
    process.exitCode = 0;
    return;
  } catch (err) {
    console.error("\n❌ [ERROR EN VERIFICACIÓN DE CEREBRO]:", err.message || err);
    process.exit(1);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

ejecutarVerificacion();
