import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";
import { normalizarArea, gradosMultiples } from "../shared/catalogoCurricular.mjs";

const FRASE_PLANTILLA_COMP = "Desarrolla el pensamiento crítico, resolución de problemas";
const FRASE_PLANTILLA_CONT = "Contenidos conceptuales, procedimentales y actitudinales de";

test("017.1 - Consulta curricular: plantilla sintética NO llega a mensaje_chat", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, opts) => {
      const urlStr = String(url);
      if (urlStr.includes("/rpc/buscar_curriculo_secuencias")) {
        return new Response(JSON.stringify([
          {
            source_id: "SEC-PRI-5-EFI-001",
            tema: "Aptitud física",
            grado: 5,
            area: "Educación Física",
            coincide_tema: true,
            estado_validacion: "validado",
            competencias_especificas: `Competencias específicas de Educación Física (5.° Primaria):\n${FRASE_PLANTILLA_COMP} y comunicación fundamentada en torno a: Aptitud física.`,
            contenidos_texto_original: `${FRASE_PLANTILLA_CONT} Educación Física para quinto grado.`,
            indicadores_logro: ["Demuestra dominio en pruebas de aptitud física."],
            fuente_documento: "Diseño Curricular MINERD",
            pagina: "145"
          }
        ]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response("Not found", { status: 404 });
    };

    const req = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-key": "clave-institucional-test",
        "x-docente-id": "docente_test_017_filtro"
      },
      body: JSON.stringify({
        confirmado: true,
        messages: [
          { role: "user", text: "¿Cuáles son los contenidos de aptitud física para 5to de primaria en Educación Física?" }
        ]
      })
    });

    const env = {
      APP_ACCESS_KEY: "clave-institucional-test",
      SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_ANON_KEY: "anon-test-key",
      RATE_LIMIT_DISPOSITIVO_DIARIO: "100"
    };

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.modo, "consulta_curricular");
    assert.ok(data.mensaje_chat, "Debe contener mensaje_chat");

    assert.equal(data.mensaje_chat.includes(FRASE_PLANTILLA_COMP), false, "mensaje_chat no debe contener plantilla de competencias");
    assert.equal(data.mensaje_chat.includes(FRASE_PLANTILLA_CONT), false, "mensaje_chat no debe contener plantilla de contenidos");

    assert.ok(data.mensaje_chat.includes("Aptitud física"), "Debe incluir el tema");
    assert.ok(data.mensaje_chat.includes("Demuestra dominio en pruebas de aptitud física"), "Debe incluir el indicador real");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("017.2 - Streaming SSE: plantilla sintética NO se inyecta en el prompt para el modelo", async () => {
  const originalFetch = globalThis.fetch;
  let promptInyectado = "";
  let llamadaGeminiNum = 0;

  try {
    globalThis.fetch = async (url, opts) => {
      const urlStr = String(url);

      if (urlStr.includes("generateContent") && !urlStr.includes("streamGenerateContent")) {
        llamadaGeminiNum++;
        if (llamadaGeminiNum === 1) {
          return new Response(JSON.stringify({
            candidates: [{
              content: {
                parts: [{
                  functionCall: {
                    name: "consultar_base_datos",
                    args: { nivel: "Primario", grado: "5to", area: "Educación Física", tema_o_concepto: "aptitud física" }
                  }
                }]
              }
            }]
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        } else {
          return new Response(JSON.stringify({
            candidates: [{
              content: {
                parts: [{
                  text: "Información curricular recuperada, procediendo con la planificación."
                }]
              }
            }]
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
      }

      if (urlStr.includes("/rpc/buscar_curriculo_secuencias")) {
        return new Response(JSON.stringify([
          {
            source_id: "SEC-PRI-5-EFI-001",
            tema: "Aptitud física",
            grado: 5,
            area: "Educación Física",
            coincide_tema: true,
            estado_validacion: "validado",
            competencias_especificas: `Competencias específicas de Educación Física (5.° Primaria):\n${FRASE_PLANTILLA_COMP} y comunicación fundamentada en torno a: Aptitud física.`,
            contenidos_texto_original: `${FRASE_PLANTILLA_CONT} Educación Física.`,
            indicadores_logro: ["Ejecuta carreras y saltos con coordinación."],
            fuente_documento: "Diseño Curricular Primaria",
            pagina: "150"
          }
        ]), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (urlStr.includes("streamGenerateContent")) {
        const bodyParsed = JSON.parse(opts.body);
        if (bodyParsed.systemInstruction && bodyParsed.systemInstruction.parts) {
          promptInyectado = bodyParsed.systemInstruction.parts.map(p => p.text).join("\n");
        }

        const planMock = {
          mensaje_chat: "Plan generado",
          plan_completado: true,
          datos_planificacion: {
            tema: "Aptitud física",
            situacion_aprendizaje: "Desarrollar la condición física",
            momentos_clase: {
              inicio: "Calentamiento",
              desarrollo: "Circuitos motores",
              cierre: "Vuelta a la calma"
            }
          }
        };

        const sseData = 'data: ' + JSON.stringify({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify(planMock)
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
        "x-docente-id": "docente_test_017_stream"
      },
      body: JSON.stringify({
        confirmado: true,
        stream: true,
        messages: [{ role: "user", text: "Planificar clase de aptitud física para 5to grado de primaria" }]
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

    const reader = res.body.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    assert.ok(promptInyectado.length > 0, "Se debió capturar el prompt enviado a Gemini SSE");
    assert.equal(promptInyectado.includes(FRASE_PLANTILLA_COMP), false, "El prompt SSE no debe incluir plantilla de competencias");
    assert.equal(promptInyectado.includes(FRASE_PLANTILLA_CONT), false, "El prompt SSE no debe incluir plantilla de contenidos");
    assert.ok(promptInyectado.includes("Tema: Aptitud física"), "El prompt SSE debe incluir el tema");
    assert.ok(promptInyectado.includes("Ejecuta carreras y saltos con coordinación"), "El prompt SSE debe incluir el indicador real");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("017.3 - Truncado a 1500 caracteres por fragmento en prompt de streaming", async () => {
  const originalFetch = globalThis.fetch;
  let promptInyectado = "";
  let llamadaGeminiNum = 0;

  try {
    globalThis.fetch = async (url, opts) => {
      const urlStr = String(url);

      if (urlStr.includes("generateContent") && !urlStr.includes("streamGenerateContent")) {
        llamadaGeminiNum++;
        if (llamadaGeminiNum === 1) {
          return new Response(JSON.stringify({
            candidates: [{
              content: {
                parts: [{
                  functionCall: {
                    name: "consultar_base_datos",
                    args: { nivel: "Primario", grado: "6to", area: "Matemática", tema_o_concepto: "geometría" }
                  }
                }]
              }
            }]
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        } else {
          return new Response(JSON.stringify({
            candidates: [{
              content: {
                parts: [{
                  text: "Información curricular recuperada."
                }]
              }
            }]
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
      }

      if (urlStr.includes("/rpc/buscar_curriculo_secuencias")) {
        return new Response(JSON.stringify([
          {
            source_id: "SEC-PRI-6-MAT-999",
            tema: "Geometría avanzada",
            grado: 6,
            area: "Matemática",
            coincide_tema: true,
            estado_validacion: "validado",
            competencias_especificas: "A".repeat(2000),
            contenidos_texto_original: "B".repeat(2000),
            indicadores_logro: ["Indicador de prueba"],
            fuente_documento: "Currículo",
            pagina: "200"
          }
        ]), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (urlStr.includes("streamGenerateContent")) {
        const bodyParsed = JSON.parse(opts.body);
        if (bodyParsed.systemInstruction && bodyParsed.systemInstruction.parts) {
          promptInyectado = bodyParsed.systemInstruction.parts.map(p => p.text).join("\n");
        }

        const planMock = {
          mensaje_chat: "Plan generado",
          plan_completado: true,
          datos_planificacion: {
            tema: "Geometría avanzada",
            situacion_aprendizaje: "Aprender geometría",
            momentos_clase: { inicio: "I", desarrollo: "D", cierre: "C" }
          }
        };

        const sseData = 'data: ' + JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(planMock) }] } }]
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
        "x-docente-id": "docente_test_017_truncado"
      },
      body: JSON.stringify({
        confirmado: true,
        stream: true,
        messages: [{ role: "user", text: "Planificar geometría para 6to grado" }]
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
    const reader = res.body.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    const match = promptInyectado.match(/=== FRAGMENTOS CURRICULARES OFICIALES RECUPERADOS ===\s*<DATO>\s*([\s\S]*?)\s*<\/DATO>/);
    assert.ok(match, "Debe existir la sección de fragmentos");
    const fragmento = match[1].trim();
    assert.ok(fragmento.length <= 1500, "El fragmento debe medir <= 1500 caracteres, mide " + fragmento.length);
    assert.ok(fragmento.endsWith("..."), "Debe terminar en elipsis de truncado");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("017.4 - Normalización de las 8 áreas curriculares oficiales de Primaria", () => {
  assert.equal(normalizarArea("Educación Física"), "Educación Física");
  assert.equal(normalizarArea("educacion fisica"), "Educación Física");
  assert.equal(normalizarArea("Educación Artística"), "Educación Artística");
  assert.equal(normalizarArea("artes plasticas"), "Educación Artística");
  assert.equal(normalizarArea("Inglés"), "Lenguas Extranjeras - Inglés");
  assert.equal(normalizarArea("lengua extranjera ingles"), "Lenguas Extranjeras - Inglés");
  assert.equal(normalizarArea("Formación Integral Humana y Religiosa"), "Formación Integral Humana y Religiosa");
  assert.equal(normalizarArea("Ciencias Sociales"), "Ciencias Sociales");
  assert.equal(normalizarArea("Ciencias de la Naturaleza"), "Ciencias de la Naturaleza");
  assert.equal(normalizarArea("Matemática"), "Matemática");
  assert.equal(normalizarArea("Lengua Española"), "Lengua Española");
});

test("017.5 - Detección y delimitación de grados múltiples para aulas multigrado", () => {
  assert.deepEqual(gradosMultiples("planificar para 3ro y 4to grado"), [3, 4]);
  assert.deepEqual(gradosMultiples("aula multigrado 1ro y 2do"), [1, 2]);
  assert.deepEqual(gradosMultiples("aula multigrado 5to y 6to"), [5, 6]);
  assert.deepEqual(gradosMultiples("solo para 2do grado"), [2]);
  assert.deepEqual(gradosMultiples("sin grado especificado"), []);
});
