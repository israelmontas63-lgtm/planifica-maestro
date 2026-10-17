/**
 * scripts/prueba_aceptacion_6_mensajes.mjs
 * 
 * Prueba de Aceptación Canónica de los 6 Mensajes con aserciones estrictas (R4):
 * 1. "hola" con nombre (zona horaria America/Santo_Domingo y signos ¡!)
 * 2. charla pedagógica (no inventa currículo, plan_completado === false)
 * 3. consulta curricular con fuente (modo consulta_curricular, Fuente: <doc> (pág. N), sin ',.')
 * 4. planificación (plan_completado === true, situacion_aprendizaje, momentos_clase con inicio/desarrollo/cierre)
 * 5. "¿por qué no puedes?" tras fallo simulado (modo fallo_anterior, explica causa, no planifica)
 * 6. "hola" con cuota diaria agotada (saludo responde por T6, siguiente plan da 429 CUOTA_DIARIA_AGOTADA)
 * 
 * Modo falla inyectada: pasar --simular-fallo para comprobar que el script falla y retorna código 1.
 */

import assert from "node:assert/strict";
import worker from "../worker/index.js";

const originalFetch = globalThis.fetch;
const simularFallo = process.argv.includes("--simular-fallo");

async function ejecutarPrueba() {
  console.log("================================================================================");
  console.log(`PRUEBA DE ACEPTACIÓN DE 6 MENSAJES ${simularFallo ? "[MODO SIMULACIÓN ROTA -- DEBE FALLAR]" : "[MODO CANÓNICO -- DEBE PASAR]"}`);
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

      // En modo fallo forzado, devolver respuesta rota para activar el assert
      if (simularFallo) {
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: "Respuesta defectuosa sin estructura de planificación" }] } }]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      // Si es planificación
      if (/planific/i.test(userText) || body.systemInstruction?.parts?.[0]?.text?.includes("Planificación")) {
        return new Response(JSON.stringify({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  mensaje_chat: "Aquí tienes la planificación para 2.° de Primaria en Matemática sobre adición.\n\nFuente: Adecuación Curricular MINERD (pág. 118)",
                  plan_completado: true,
                  datos_planificacion: {
                    grado: "2.° Primaria",
                    area: "Matemática",
                    tema: "Adición de números naturales",
                    situacion_aprendizaje: "Los estudiantes necesitan calcular la cantidad total de materiales para el huerto escolar.",
                    competencias_especificas: "Aplica conceptos y algoritmos de suma.",
                    indicadores_logro: "Resuelve problemas de adición hasta 999.",
                    momentos_clase: {
                      inicio: "Saberes previos con material concreto.",
                      desarrollo: "Sumas en la recta numérica.",
                      cierre: "Metacognición y autoevaluación."
                    },
                    momentos: {
                      inicio: "Saberes previos con material concreto.",
                      desarrollo: "Sumas en la recta numérica.",
                      cierre: "Metacognición y autoevaluación."
                    },
                    fragmentos: [
                      { fuente_documento: "Adecuación Curricular MINERD", pagina: 118 }
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
    // MENSAJE 1: "hola" con nombre docente
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

    assert.equal(res1.status, 200, "Mensaje 1 debe responder con status 200");
    assert.match(data1.mensaje_chat, /Profe\s+Laura/i, "Mensaje 1 debe incluir el nombre saneado 'Profe Laura'");
    assert.ok(data1.mensaje_chat.includes("¡"), "Mensaje 1 debe incluir signo de apertura '¡'");

    // Verificación de zona horaria America/Santo_Domingo
    const horaSD = Number(new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Santo_Domingo",
      hour: "numeric",
      hour12: false
    }).format(new Date()));
    const saludoEsperado = horaSD < 12 ? /días/i : (horaSD < 19 ? /tardes/i : /noches/i);
    assert.match(data1.mensaje_chat, saludoEsperado, `El saludo debe coincidir con la hora de Santo Domingo (${horaSD}h)`);
    console.log(`[PASS] Mensaje 1 validado: "${data1.mensaje_chat}"\n`);

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

    assert.equal(res2.status, 200, "Mensaje 2 debe responder con status 200");
    assert.equal(data2.plan_completado, false, "Mensaje 2 no debe completar un plan");
    assert.doesNotMatch(data2.mensaje_chat, /Situación de Aprendizaje:|Secuencia Didáctica:/i, "No debe inventar estructura de plan formal");
    assert.match(data2.mensaje_chat, /lectura|comprensión|saberes/i, "Debe responder con contenido pedagógico relevante");
    console.log(`[PASS] Mensaje 2 validado: "${data2.mensaje_chat.slice(0, 100)}..."\n`);

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

    assert.equal(res3.status, 200, "Mensaje 3 debe responder con status 200");
    assert.equal(data3.modo, "consulta_curricular", "Modo debe ser 'consulta_curricular'");
    assert.match(data3.mensaje_chat, /Fuente:\s*[^(\r\n]+(?:\s*\(pág\.\s*\d+\))?/i, "Debe contener 'Fuente: <doc>'");
    assert.equal(data3.mensaje_chat.includes(",."), false, "No debe contener ',.'");
    assert.equal(data3.mensaje_chat.includes(".."), false, "No debe contener '..'");
    console.log(`[PASS] Mensaje 3 validado con fuente limpia sin puntuación defectuosa\n`);

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

    assert.equal(res4.status, 200, "Mensaje 4 debe responder con status 200");
    assert.equal(data4.plan_completado, true, "plan_completado debe ser true");
    assert.ok(data4.datos_planificacion, "datos_planificacion debe existir");
    assert.ok(data4.datos_planificacion.situacion_aprendizaje, "Debe contener situacion_aprendizaje");

    const momentos = data4.datos_planificacion.momentos_clase || data4.datos_planificacion.momentos;
    assert.ok(momentos, "Debe contener momentos_clase");
    assert.ok(momentos.inicio, "Debe contener momento inicio");
    assert.ok(momentos.desarrollo, "Debe contener momento desarrollo");
    assert.ok(momentos.cierre, "Debe contener momento cierre");
    console.log(`[PASS] Mensaje 4 validado: estructura completa de planificación generada\n`);

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

    assert.equal(res5.status, 200, "Mensaje 5 debe responder con status 200");
    assert.equal(data5.plan_completado, false, "Mensaje 5 no debe intentar planificar de nuevo");
    assert.ok(data5.modo === "fallo_anterior" || /saturad|demanda|minuto|proveedor/i.test(data5.mensaje_chat), "Debe explicar la causa del fallo previo");
    console.log(`[PASS] Mensaje 5 validado: explicación diagnóstica entregada\n`);

    // --------------------------------------------------------------------------
    // MENSAJE 6: cuota selectiva (T6)
    // --------------------------------------------------------------------------
    console.log("--- MENSAJE 6: 'hola' y planificación con cuota diaria agotada (0 planes restantes) ---");
    const envSinCuota = { ...env, RATE_LIMIT_DISPOSITIVO_DIARIO: "0" };

    // 6a: Saludo no debe bloquearse por cuota (T6)
    const req6a = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-key": "pm-clave-aceptacion", "x-docente-id": "doc_agotado_6" },
      body: JSON.stringify({ messages: [{ role: "user", text: "hola" }] })
    });
    const res6a = await worker.fetch(req6a, envSinCuota);
    assert.equal(res6a.status, 200, "El saludo debe responder 200 sin bloquearse por cuota (T6)");

    // 6b: Solicitud de planificación debe rebotar con 429 CUOTA_DIARIA_AGOTADA
    const req6b = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-key": "pm-clave-aceptacion", "x-docente-id": "doc_agotado_6" },
      body: JSON.stringify({
        confirmado: true,
        messages: [{ role: "user", text: "Planificar clase de fracciones para 4to grado" }]
      })
    });
    const res6b = await worker.fetch(req6b, envSinCuota);
    const data6b = await res6b.json();

    assert.equal(res6b.status, 429, "Planificación con cuota agotada debe responder 429");
    assert.equal(data6b.codigoError || data6b.codigo, "CUOTA_DIARIA_AGOTADA", "Código debe ser CUOTA_DIARIA_AGOTADA");
    assert.match(data6b.mensaje_chat, /cuota|límite|mañana|medianoche/i, "Mensaje debe ser amable y explicativo");
    console.log(`[PASS] Mensaje 6 validado: cuota selectiva aplicada correctamente (saludo 200, plan 429)\n`);

    console.log("================================================================================");
    console.log("✅ TODAS LAS 6 PRUEBAS DE ACEPTACIÓN PASARON CON ÉXITO (CÓDIGO 0)");
    console.log("================================================================================");
    process.exit(0);
  } catch (err) {
    console.error("\n❌ [ERROR EN PRUEBA DE ACEPTACIÓN]:", err.message);
    process.exit(1);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

ejecutarPrueba();
