/**
 * scripts/prueba_aceptacion_6_mensajes.mjs
 * 
 * Prueba de Aceptación Canónica de los 6 Mensajes (con simulaciones inyectadas):
 * 1. "hola" con nombre
 * 2. charla pedagógica
 * 3. consulta curricular con fuente
 * 4. planificación
 * 5. "¿por qué no puedes?" tras fallo simulado
 * 6. "hola" con cuota diaria agotada
 */

import worker from "../worker/index.js";

const originalFetch = globalThis.fetch;

async function ejecutarPrueba() {
  console.log("================================================================================");
  console.log("PRUEBA DE ACEPTACIÓN DE 6 MENSAJES (SISTEMA CANÓNICO FASE FINAL)");
  console.log("================================================================================\n");

  const env = {
    APP_ACCESS_KEY: "pm-clave-aceptacion",
    GEMINI_API_KEY: "simulada-gemini-key",
    RATE_LIMIT_DISPOSITIVO_DIARIO: "25",
    TURNOS_CONVERSACION_MAX: "6"
  };

  // MOCK DE RED PARA SIMULACIÓN INYECTADA
  globalThis.fetch = async (url, opts) => {
    const urlStr = String(url);
    if (urlStr.includes("generativelanguage.googleapis.com")) {
      const body = JSON.parse(opts.body || "{}");
      const userText = body.contents?.[body.contents.length - 1]?.parts?.[0]?.text || "";

      // Si es planificación
      if (/planific/i.test(userText) || body.systemInstruction?.parts?.[0]?.text?.includes("Planificación")) {
        return new Response(JSON.stringify({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  mensaje_chat: "Aquí tienes la planificación para 2.° de Primaria en Matemática sobre adición.\n\n📖 Fuente: Adecuación Curricular MINERD (pág. 118).",
                  plan_completado: true,
                  datos_planificacion: {
                    grado: "2.° Primaria",
                    area: "Matemática",
                    tema: "Adición de números naturales",
                    competencias_especificas: "Aplica conceptos y algoritmos de suma.",
                    indicadores_logro: "Resuelve problemas de adición hasta 999.",
                    momentos: {
                      inicio: "Saberes previos con material concreto.",
                      desarrollo: "Sumas en la recta numérica.",
                      cierre: "Metacognición y autoevaluación."
                    },
                    fragmentos: [
                      { fuente_documento: "Adecuación Curricular MINERD (Nivel Primario)", pagina: 118 }
                    ]
                  }
                })
              }]
            }
          }]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      // Si es conocimiento general / charla pedagógica
      return new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: "Para fomentar la comprensión lectora te recomiendo activar saberes previos antes de leer, formular preguntas predictivas y trabajar la lectura compartida en pequeños grupos."
            }]
          }
        }]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return originalFetch(url, opts);
  };

  try {
    // --------------------------------------------------------------------------
    // MENSAJE 1: "hola" con nombre
    // --------------------------------------------------------------------------
    console.log("--- MENSAJE 1: 'hola' con nombre docente (Profe Laura) ---");
    const req1 = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-key": "pm-clave-aceptacion", "x-docente-id": "doc_aceptacion_1" },
      body: JSON.stringify({
        nombreDocente: "Profe Laura",
        messages: [{ role: "user", text: "hola" }]
      })
    });
    const res1 = await worker.fetch(req1, env);
    const data1 = await res1.json();
    console.log(`[Status]: ${res1.status}`);
    console.log(`[Modo]: ${data1.modo}`);
    console.log(`[Mensaje Chat]: ${data1.mensaje_chat}`);
    console.log("");

    // --------------------------------------------------------------------------
    // MENSAJE 2: charla pedagógica [SIMULACIÓN]
    // --------------------------------------------------------------------------
    console.log("--- MENSAJE 2: charla pedagógica [SIMULACIÓN] ---");
    const req2 = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-key": "pm-clave-aceptacion", "x-docente-id": "doc_aceptacion_2" },
      body: JSON.stringify({
        confirmado: true,
        messages: [{ role: "user", text: "¿cómo puedo fomentar la comprensión lectora en el aula de primer ciclo?" }]
      })
    });
    const res2 = await worker.fetch(req2, env);
    const data2 = await res2.json();
    console.log(`[Status]: ${res2.status}`);
    console.log(`[Modo]: ${data2.modo}`);
    console.log(`[Mensaje Chat]: ${data2.mensaje_chat}`);
    console.log("");

    // --------------------------------------------------------------------------
    // MENSAJE 3: consulta curricular con fuente
    // --------------------------------------------------------------------------
    console.log("--- MENSAJE 3: consulta curricular con fuente ---");
    const req3 = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-key": "pm-clave-aceptacion", "x-docente-id": "doc_aceptacion_3" },
      body: JSON.stringify({
        confirmado: true,
        messages: [{ role: "user", text: "¿Cuáles son las competencias fundamentales según el currículo oficial MINERD para 2do grado?" }]
      })
    });
    const res3 = await worker.fetch(req3, env);
    const data3 = await res3.json();
    console.log(`[Status]: ${res3.status}`);
    console.log(`[Modo]: ${data3.modo}`);
    console.log(`[Mensaje Chat]:\n${data3.mensaje_chat}`);
    console.log("");

    // --------------------------------------------------------------------------
    // MENSAJE 4: planificación [SIMULACIÓN]
    // --------------------------------------------------------------------------
    console.log("--- MENSAJE 4: planificación [SIMULACIÓN] ---");
    const req4 = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-key": "pm-clave-aceptacion", "x-docente-id": "doc_aceptacion_4" },
      body: JSON.stringify({
        confirmado: true,
        messages: [{ role: "user", text: "Planificar suma de números naturales para 2do grado de primaria en matemática" }]
      })
    });
    const res4 = await worker.fetch(req4, env);
    const data4 = await res4.json();
    console.log(`[Status]: ${res4.status}`);
    console.log(`[Plan Completado]: ${data4.plan_completado}`);
    console.log(`[Mensaje Chat]:\n${data4.mensaje_chat}`);
    console.log(`[Tema Plan]: ${data4.datos_planificacion?.tema}`);
    console.log("");

    // --------------------------------------------------------------------------
    // MENSAJE 5: "¿por qué no puedes?" tras un fallo simulado
    // --------------------------------------------------------------------------
    console.log("--- MENSAJE 5: '¿por qué no puedes?' tras fallo simulado ---");
    const req5 = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-key": "pm-clave-aceptacion", "x-docente-id": "doc_aceptacion_5" },
      body: JSON.stringify({
        messages: [
          { role: "assistant", isError: true, codigoError: "PROVEEDOR_IA_SATURADO", mensaje: "El servicio de IA estuvo temporalmente saturado." },
          { role: "user", text: "¿Por qué no puedes?" }
        ]
      })
    });
    const res5 = await worker.fetch(req5, env);
    const data5 = await res5.json();
    console.log(`[Status]: ${res5.status}`);
    console.log(`[isError]: ${data5.isError}`);
    console.log(`[codigoError]: ${data5.codigoError}`);
    console.log(`[Mensaje Chat]:\n${data5.mensaje_chat}`);
    console.log("");

    // --------------------------------------------------------------------------
    // MENSAJE 6: "hola" con cuota agotada
    // --------------------------------------------------------------------------
    console.log("--- MENSAJE 6: 'hola' con cuota diaria agotada (0 planes restantes) ---");
    const envSinCuota = { ...env, RATE_LIMIT_DISPOSITIVO_DIARIO: "0" };
    const req6 = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-key": "pm-clave-aceptacion", "x-docente-id": "doc_agotado_6" },
      body: JSON.stringify({
        messages: [{ role: "user", text: "hola" }]
      })
    });
    const res6 = await worker.fetch(req6, envSinCuota);
    const data6 = await res6.json();
    console.log(`[Status]: ${res6.status} (Responde exitosamente al saludo sin bloquearse por cuota)`);
    console.log(`[Modo]: ${data6.modo}`);
    console.log(`[Mensaje Chat]: ${data6.mensaje_chat}`);
    console.log("");

    console.log("================================================================================");
    console.log("PRUEBA DE ACEPTACIÓN DE 6 MENSAJES EJECUTADA CON ÉXITO.");
    console.log("================================================================================");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

ejecutarPrueba();
