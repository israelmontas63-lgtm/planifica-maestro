import test from "node:test";
import assert from "node:assert/strict";
import { clasificarPorReglas } from "../shared/clasificadorIntencion.js";
import * as promptMod from "../shared/promptSistemaV2.js";
const { construirPromptSistemaV2, BLOQUE_CRITERIO_EXPERTO } = promptMod;
import { SYSTEM_PROMPT_CONVERSACIONAL, generarRespuestaCharlaLocal } from "../shared/modoConversacional.js";
import worker from "../worker/index.js";

const envBase = {
  APP_ACCESS_KEY: "clave-institucional-test",
  RATE_LIMIT_DISPOSITIVO_DIARIO: "100",
  SUPABASE_URL: "https://test-supabase.supabase.co",
  SUPABASE_ANON_KEY: "anon-key-test"
};

// -----------------------------------------------------------------------------
// (i) TABLA DE LAS 20 FRASES + 6 CONTROLES CON SU CATEGORÍA ESPERADA
// -----------------------------------------------------------------------------
test("E1.1 - Clasificación de las 20 frases del cerebro pedagógico y 6 controles", () => {
  const casosEsperados = [
    { frase: "hola", categoria: "charla" },
    { frase: "buenos días profe", categoria: "charla" },
    { frase: "¿por qué falló?", categoria: "fallo_anterior" },
    { frase: "planifica fracciones para 3.° grado", categoria: "planificacion" },
    { frase: "dame una secuencia de lengua española para 2.°", categoria: "planificacion" },
    { frase: "qué dice el currículo sobre multiplicación", categoria: "consulta_curricular" },
    { frase: "busca en internet noticias del MINERD", categoria: "busqueda_web" },
    { frase: "dame actividades para desarrollar el pensamiento crítico", categoria: "conocimiento_general" },
    { frase: "qué destrezas mentales trabajo en una clase de resolución de problemas", categoria: "conocimiento_general" },
    { frase: "explícame la taxonomía de Bloom", categoria: "conocimiento_general" },
    { frase: "hazme una rúbrica para ensayo", categoria: "conocimiento_general" },
    { frase: "si todos los gatos son animales y Tom es gato, ¿qué sigue?", categoria: "conocimiento_general" },
    { frase: "cuánto es 3/4 + 1/2", categoria: "conocimiento_general" },
    { frase: "gracias", categoria: "charla" },
    { frase: "no me gustó el resultado", categoria: "charla" },
    { frase: "cambia la actividad 2", categoria: "ambigua" },
    { frase: "qué hora es", categoria: "conocimiento_general" },
    { frase: "ayúdame con mi planificación de mañana", categoria: "planificacion" },
    { frase: "compárame estas dos estrategias de lectura", categoria: "conocimiento_general" },
    { frase: "busca la fecha de la próxima evaluación diagnóstica", categoria: "busqueda_web" },
    // 6 Controles adicionales
    { frase: "qué sigue en la secuencia 2, 4, 6, 8", categoria: "conocimiento_general" },
    { frase: "resolución del ministerio sobre el calendario escolar", categoria: "consulta_curricular", cat6: "D_NORMATIVA_O_ACTUALIDAD" },
    { frase: "plan de clase de resolución de problemas para 3er grado", categoria: "planificacion" },
    { frase: "hola, planifica fracciones para 3.° grado", categoria: "planificacion", mixto: true },
    { frase: "cuántas competencias fundamentales hay", categoria: "consulta_curricular" },
    { frase: "gracias, ahora planifica la suma para 2do grado", categoria: "planificacion" }
  ];

  for (const c of casosEsperados) {
    const res = clasificarPorReglas(c.frase);
    assert.equal(
      res.categoria,
      c.categoria,
      `Frase "${c.frase}" esperaba categoría "${c.categoria}", obtuvo "${res.categoria}"`
    );
    if (c.cat6) {
      assert.equal(
        res.categoria_6,
        c.cat6,
        `Frase "${c.frase}" esperaba categoría_6 "${c.cat6}", obtuvo "${res.categoria_6}"`
      );
    }
    if (c.mixto !== undefined) {
      assert.equal(
        res.esMixtoConSaludo,
        c.mixto,
        `Frase "${c.frase}" esperaba esMixtoConSaludo=${c.mixto}, obtuvo ${res.esMixtoConSaludo}`
      );
    }
  }
});

// -----------------------------------------------------------------------------
// (ii) BLOQUE_CRITERIO_EXPERTO PRESENTE EN V2 Y EN SYSTEM_PROMPT_CONVERSACIONAL
// -----------------------------------------------------------------------------
test("E1.2 - BLOQUE_CRITERIO_EXPERTO presente en construirPromptSistemaV2() y SYSTEM_PROMPT_CONVERSACIONAL", () => {
  assert.ok(BLOQUE_CRITERIO_EXPERTO, "BLOQUE_CRITERIO_EXPERTO debe estar exportado");

  const promptV2 = construirPromptSistemaV2();
  const promptConv = SYSTEM_PROMPT_CONVERSACIONAL;

  for (const [nombre, p] of [["PromptSistemaV2", promptV2], ["PromptConversacional", promptConv]]) {
    assert.match(p, /Competencias Fundamentales/i, `${nombre} debe mencionar competencias fundamentales`);
    assert.match(p, /Taxonomía de Bloom/i, `${nombre} debe mencionar taxonomía de Bloom`);
    assert.match(p, /NUNCA cites la taxonomía de Bloom como parte del currículo oficial/i, `${nombre} debe prohibir Bloom como currículo oficial`);
    assert.match(p, /paso a paso/i, `${nombre} debe requerir razonamiento paso a paso`);
    assert.match(p, /búsqueda web|verificación externa/i, `${nombre} debe advertir sobre verificación o búsqueda web`);
  }
});

// -----------------------------------------------------------------------------
// (iii) EN STREAMING, FILAS CON coincide_tema=false NO APARECEN EN <DATO>
// -----------------------------------------------------------------------------
test("E1.3 - En streaming, filas con coincide_tema=false son filtradas de <DATO> y se emite aviso si no hay coincidencias", async () => {
  const originalFetch = globalThis.fetch;
  let intentosNoSimulados = 0;
  let urlsNoSimuladas = [];
  let promptEnviadoAGemini = "";

  globalThis.fetch = async (url, options) => {
    const urlStr = String(url);

    // Mock Gemini inicial para disparar function call en cicloToolCalling
    if (urlStr.includes("generateContent") && !urlStr.includes("streamGenerateContent")) {
      return new Response(JSON.stringify({
        candidates: [{
          content: {
            role: "model",
            parts: [{
              functionCall: {
                name: "consultar_base_datos",
                args: { nivel: "Primario", grado: "2do", area: "Matemática", tema_o_concepto: "fracciones" }
              }
            }]
          }
        }]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // Mock Supabase RPC devolviendo una fila válida y una fila falsa de otro tema
    if (urlStr.includes("/rpc/buscar_curriculo_secuencias")) {
      return new Response(JSON.stringify([
        {
          source_id: "SEC-MAT-VERDADERO",
          tema: "Fracciones",
          grado_num: 2,
          area: "Matemática",
          competencia_especifica: "Comprende mitades y cuartos.",
          indicador_logro: "Identifica 1/2 y 1/4 en figuras.",
          fuente_documento: "Adecuación Curricular MINERD",
          pagina: 110,
          coincide_tema: true,
          estado_validacion: "validado"
        },
        {
          source_id: "SEC-MAT-FALSO",
          tema: "Geometría Espacial no solicitada",
          grado_num: 2,
          area: "Matemática",
          competencia_especifica: "Describe pirámides cuadrangulares.",
          indicador_logro: "Identifica vértices de pirámides.",
          fuente_documento: "Adecuación Curricular MINERD",
          pagina: 145,
          coincide_tema: false,
          estado_validacion: "validado"
        }
      ]), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // Interceptar llamada stream a Gemini
    if (urlStr.includes("streamGenerateContent")) {
      try {
        const bodyObj = JSON.parse(options.body);
        promptEnviadoAGemini = bodyObj?.systemInstruction?.parts?.[0]?.text || "";
      } catch (_) {}

      const sseBody = 'data: ' + JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                mensaje_chat: "Plan de fracciones generado.",
                plan_completado: true,
                datos_planificacion: {
                  tema: "Fracciones",
                  fragmentos: [{ fuente_documento: "MINERD", pagina: 110 }]
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

    intentosNoSimulados++;
    urlsNoSimuladas.push(urlStr);
    throw new Error(`RED_NO_SIMULADA: ${urlStr}`);
  };

  try {
    const envTest = {
      ...envBase,
      GEMINI_API_KEY: "mock-key",
      STREAMING_PROGRESIVO: "true",
      HERRAMIENTAS_V2: "true",
      PROMPT_SISTEMA_V2: "true"
    };

    const req = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        "x-app-key": "clave-institucional-test",
        "x-docente-id": "doc_stream_filtro"
      },
      body: JSON.stringify({
        confirmado: true,
        stream: true,
        messages: [{ role: "user", text: "Planifica una clase de fracciones para 2do grado de primaria en matemática" }]
      })
    });

    const res = await worker.fetch(req, envTest);
    assert.equal(res.status, 200, "Respuesta streaming debe ser 200");
    await res.text();

    assert.ok(promptEnviadoAGemini.includes("=== FRAGMENTOS CURRICULARES OFICIALES RECUPERADOS ==="), "Debe incluir sección de fragmentos");
    assert.ok(promptEnviadoAGemini.includes("Fracciones"), "Debe incluir el tema verdadero con coincide_tema: true");
    assert.equal(promptEnviadoAGemini.includes("Geometría Espacial no solicitada"), false, "Fila con coincide_tema: false NO debe figurar en <DATO>");
    assert.equal(promptEnviadoAGemini.includes("Describe pirámides cuadrangulares"), false, "Contenido de fila false NO debe figurar en <DATO>");
    assert.equal(intentosNoSimulados, 0, `No debe haber llamadas a red no simuladas: ${urlsNoSimuladas.join(", ")}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// -----------------------------------------------------------------------------
// (iv) CITAS: VERIFICARYSANEARCITAS NO CONSERVA CITA DE FILA CON coincide_tema=false
// -----------------------------------------------------------------------------
test("E1.4 - verificarYSanearCitas no conserva citas de filas con coincide_tema=false en streaming", async () => {
  const originalFetch = globalThis.fetch;
  let intentosNoSimulados = 0;
  let urlsNoSimuladas = [];

  globalThis.fetch = async (url, options) => {
    const urlStr = String(url);

    if (urlStr.includes("generateContent") && !urlStr.includes("streamGenerateContent")) {
      return new Response(JSON.stringify({
        candidates: [{
          content: {
            role: "model",
            parts: [{
              functionCall: {
                name: "consultar_base_datos",
                args: { nivel: "Primario", grado: "2do", area: "Matemática", tema_o_concepto: "fracciones" }
              }
            }]
          }
        }]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (urlStr.includes("/rpc/buscar_curriculo_secuencias")) {
      return new Response(JSON.stringify([
        {
          source_id: "SEC-MAT-001",
          tema: "Fracciones",
          grado_num: 2,
          area: "Matemática",
          pagina: 110,
          coincide_tema: true,
          estado_validacion: "validado"
        },
        {
          source_id: "SEC-MAT-FALSO",
          tema: "Geometría",
          grado_num: 2,
          area: "Matemática",
          pagina: 118,
          coincide_tema: false,
          estado_validacion: "validado"
        }
      ]), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (urlStr.includes("streamGenerateContent")) {
      // El modelo de IA intenta citar ambas páginas: la 110 (verdadera) y la 118 (falsa)
      const sseBody = 'data: ' + JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                mensaje_chat: "Actividad tomada de la pág. 110 y pág. 118 del documento oficial.",
                plan_completado: true,
                datos_planificacion: {
                  tema: "Fracciones",
                  fragmentos: []
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

    intentosNoSimulados++;
    urlsNoSimuladas.push(urlStr);
    throw new Error(`RED_NO_SIMULADA: ${urlStr}`);
  };

  try {
    const envTest = {
      ...envBase,
      GEMINI_API_KEY: "mock-key",
      STREAMING_PROGRESIVO: "true",
      HERRAMIENTAS_V2: "true",
      PROMPT_SISTEMA_V2: "true"
    };

    const req = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        "x-app-key": "clave-institucional-test",
        "x-docente-id": "doc_test_citas"
      },
      body: JSON.stringify({
        confirmado: true,
        stream: true,
        messages: [{ role: "user", text: "Planifica una clase de fracciones para 2do grado en matemática" }]
      })
    });

    const res = await worker.fetch(req, envTest);
    assert.equal(res.status, 200);
    const bodyText = await res.text();

    // Extraer parsedFinal enviado en el stream
    const lineas = bodyText.split("\n");
    let jsonFinal = null;
    for (const l of lineas) {
      if (l.startsWith("data: ")) {
        try {
          const parsed = JSON.parse(l.slice(6));
          const cand = parsed?.final || parsed;
          if (cand && cand.planId) jsonFinal = cand;
        } catch (_) {}
      }
    }

    assert.ok(jsonFinal, "Debe emitirse el JSON final estructurado");
    assert.ok(jsonFinal.mensaje_chat.includes("110"), "Debe conservar la cita válida de pág. 110");
    assert.equal(jsonFinal.mensaje_chat.includes("118"), false, "NO debe conservar la cita pág. 118 de una fila con coincide_tema: false");
    assert.equal(intentosNoSimulados, 0, `No debe haber llamadas a red no simuladas: ${urlsNoSimuladas.join(", ")}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// -----------------------------------------------------------------------------
// (v) TRAZA DE RUTA DIRECTA: CAPAS 5 Y 6 COMO "no aplica en esta ruta"
// -----------------------------------------------------------------------------
test("E1.5 - Traza de consulta curricular directa registra Capas 5 y 6 como 'no aplica en esta ruta'", async () => {
  const originalFetch = globalThis.fetch;
  let intentosNoSimulados = 0;
  let urlsNoSimuladas = [];

  globalThis.fetch = async (url, options) => {
    const urlStr = String(url);
    if (urlStr.includes("/rest/v1/rpc/buscar_curriculo_secuencias")) {
      return new Response(JSON.stringify([
        {
          source_id: "SEC-TEST-DIR-001",
          grado_num: 2,
          area: "Lengua Española",
          tema: "La Noticia Directa",
          competencia_especifica: "Comprende noticias",
          indicador_logro: "Identifica hechos",
          fuente_documento: "Adecuación Curricular MINERD",
          pagina: 75,
          coincide_tema: true,
          estado_validacion: "validado"
        }
      ]), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    intentosNoSimulados++;
    urlsNoSimuladas.push(urlStr);
    throw new Error(`RED_NO_SIMULADA: ${urlStr}`);
  };

  try {
    const envConTraza = {
      ...envBase,
      HABILITAR_TRAZA_CAPAS: "true"
    };

    const req = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-key": "clave-institucional-test",
        "x-docente-id": "doc_traza_directa"
      },
      body: JSON.stringify({
        confirmado: true,
        messages: [{ role: "user", text: "¿Cuáles son los contenidos de La Noticia Directa para 2do de primaria en Lengua Española?" }]
      })
    });

    const res = await worker.fetch(req, envConTraza);
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.ok(Array.isArray(data.traza_capas), "Debe incluir traza_capas");

    const eventoCapa5 = data.traza_capas.find((c) => c.capa === 5);
    assert.ok(eventoCapa5, "Debe existir registro para Capa 5");
    assert.equal(eventoCapa5.decision, "no aplica en esta ruta", "Capa 5 debe ser 'no aplica en esta ruta'");

    const eventoCapa6 = data.traza_capas.find((c) => c.capa === 6);
    assert.ok(eventoCapa6, "Debe existir registro para Capa 6");
    assert.equal(eventoCapa6.decision, "no aplica en esta ruta", "Capa 6 debe ser 'no aplica en esta ruta'");
    assert.notEqual(eventoCapa6.decision, "generación completada", "Capa 6 no debe ser generación completada");
    assert.notEqual(eventoCapa6.decision, "consulta_estructurada", "Capa 6 no debe ser consulta_estructurada");
    assert.equal(intentosNoSimulados, 0, "No debe haber llamadas a red no simuladas");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// -----------------------------------------------------------------------------
// (vi) SIN GRADO: 0 LLAMADAS A RPC, SIN CONSOLE.WARN DE GRADO, MENSAJE PIDE EL GRADO, Y TANDA EXTENDIDA DA GLOSARIO
// -----------------------------------------------------------------------------
test("E1.6 - Consulta sin grado no llama RPC, no emite warn de Grado, pide grado, y glosario sigue funcionando", async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  let llamadasRpc = 0;
  let warningsCapturados = [];

  console.warn = (...args) => {
    warningsCapturados.push(args.join(" "));
  };

  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes("/rpc/")) {
      llamadasRpc++;
      return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    throw new Error(`RED_NO_SIMULADA: ${urlStr}`);
  };

  try {
    // 1. Caso sin grado pedagógico
    const reqSinGrado = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-key": "clave-institucional-test",
        "x-docente-id": "doc_sin_grado"
      },
      body: JSON.stringify({
        confirmado: true,
        messages: [{ role: "user", text: "qué dice el currículo sobre multiplicación" }]
      })
    });

    const resSinGrado = await worker.fetch(reqSinGrado, envBase);
    assert.equal(resSinGrado.status, 200);
    const dataSinGrado = await resSinGrado.json();

    assert.equal(llamadasRpc, 0, "No debe hacer llamadas a RPC de Supabase si falta el grado");
    const warnConGrado = warningsCapturados.some((w) => /Grado.*undefined/i.test(w));
    assert.equal(warnConGrado, false, "No debe emitir console.warn de Grado undefined");
    assert.equal(dataSinGrado.requiereAclaracion, true, "Debe marcar requiereAclaracion: true");
    assert.equal(dataSinGrado.plan_completado, false, "plan_completado debe ser false");
    assert.deepEqual(dataSinGrado.fragmentos, [], "fragmentos debe ser array vacío");
    assert.match(dataSinGrado.mensaje_chat, /grado/i, "Mensaje debe preguntar por el grado");
    assert.match(dataSinGrado.mensaje_chat, /1\.[°º]\s*a\s*6\.[°º]/i, "Mensaje debe especificar de 1.° a 6.°");

    // 2. Caso glosario sin grado ("tanda extendida")
    const reqGlosario = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-key": "clave-institucional-test",
        "x-docente-id": "doc_glosario"
      },
      body: JSON.stringify({
        confirmado: true,
        messages: [{ role: "user", text: "¿qué es la jornada de tanda extendida según el currículo?" }]
      })
    });

    const resGlosario = await worker.fetch(reqGlosario, envBase);
    assert.equal(resGlosario.status, 200);
    const dataGlosario = await resGlosario.json();

    assert.match(dataGlosario.mensaje_chat, /Glosario de Planifica Maestro/i, "Tanda extendida debe devolver entrada de glosario local");
    assert.equal(llamadasRpc, 0, "Glosario local no debe llamar a RPC");
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
});

// -----------------------------------------------------------------------------
// (vii) QUEJA: "no me gustó el resultado" RESPONDE EN MODO CHARLA SIN SALUDO TEMPORAL
// -----------------------------------------------------------------------------
test("E1.7 - 'no me gustó el resultado' genera respuesta de queja en modo charla sin saludo horario", () => {
  const res = generarRespuestaCharlaLocal({
    texto: "no me gustó el resultado",
    nombreDocente: "María Rosario"
  });

  assert.equal(res.modo, "charla", "Modo debe ser 'charla'");
  assert.equal(res.categoria, "charla", "Categoría debe ser 'charla'");
  assert.equal(res.plan_completado, false, "plan_completado debe ser false");
  assert.equal(/buen(os|as)\s+(d[ií]as|tardes|noches)/i.test(res.mensaje_chat), false, "NO debe incluir saludo horario de buenos días/tardes/noches");
  assert.match(res.mensaje_chat, /convenci[oó]|cumplido|esperabas/i, "Debe preguntar qué aspecto no convenció");
  assert.match(res.mensaje_chat, /tema|nivel|grado|extensi[oó]n|actividades/i, "Debe mencionar opciones como tema, nivel, extensión o actividades");
});

// -----------------------------------------------------------------------------
// (viii) "cambia la actividad 2": EN RUTA AMBIGUA PIDE GRADO/ÁREA/TEMA DE LA PLANIFICACIÓN
// -----------------------------------------------------------------------------
test("E1.8 - 'cambia la actividad 2' en ruta ambigua pide planificación, grado, área y tema", async () => {
  const req = new Request("http://localhost/api/plan/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-app-key": "clave-institucional-test",
      "x-docente-id": "doc_cambia_actividad"
    },
    body: JSON.stringify({
      confirmado: true,
      messages: [{ role: "user", text: "cambia la actividad 2" }]
    })
  });

  const res = await worker.fetch(req, envBase);
  assert.equal(res.status, 200);
  const data = await res.json();

  assert.equal(data.categoria, "ambigua", "Categoría debe ser 'ambigua'");
  assert.equal(data.requiereAclaracion, true, "Debe requerir aclaración");
  assert.match(data.mensaje_chat, /planificaci[oó]n/i, "Debe mencionar 'planificación'");
  assert.match(data.mensaje_chat, /grado/i, "Debe solicitar el grado");
  assert.match(data.mensaje_chat, /[aá]rea/i, "Debe solicitar el área");
  assert.match(data.mensaje_chat, /tema/i, "Debe solicitar el tema");
});
