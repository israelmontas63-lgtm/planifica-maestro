/**
 * tests/test_tecnologias_avanzadas_hyde_crag.mjs
 * Pruebas unitarias para tecnologías cognitivas avanzadas:
 * 1. HyDE (Hypothetical Document Embeddings - Gao et al., CMU/Waterloo)
 * 2. Corrective RAG / CRAG (Yan et al., Meta AI / USTC)
 * 3. RRF Calibrado (k=60) con Balance por Área (Cormack et al., SIGIR)
 * 4. Structured Output Enforcement (Gemini JSON Schema Constrained Decoding)
 */

import test from "node:test";
import assert from "node:assert/strict";
import { generarDocumentoHipotetico } from "../worker/services/hydeService.js";
import { evaluarCalidadRecuperacion, esRecuperacionConfiable } from "../worker/services/evaluadorCRAG.js";
import { calibrarYFusionarRRF, obtenerPesosArea, CONSTANTE_K_RRF } from "../worker/services/rrfCalibrador.js";
import { ESQUEMA_PLANIFICACION_GEMINI, inyectarStructuredOutputConfig } from "../worker/schemas/planificacionSchema.js";

test("CRAG: a) evaluarCalidadRecuperacion clasifica correctamente fragmentos altos (CORRECT)", () => {
  const fragmentosAltos = [
    { id: 1, texto: "Adición de números naturales con reagrupación", score: 0.88 },
    { id: 2, texto: "Propiedades de la adición", score: 0.82 }
  ];

  const evalAlto = evaluarCalidadRecuperacion(fragmentosAltos, 0.75, 0.35);
  assert.equal(evalAlto.estado, "CORRECT", "Debe clasificar como CORRECT cuando el score supera el umbral alto");
  assert.equal(esRecuperacionConfiable(evalAlto), true);
  assert.equal(evalAlto.accionRecomendada, "grounding_oficial_garantizado");
  assert.equal(evalAlto.fragmentosDepurados.length, 2);
});

test("CRAG: a) evaluarCalidadRecuperacion clasifica correctamente fragmentos medios (AMBIGUOUS)", () => {
  const fragmentosMedios = [
    { id: 1, texto: "Conceptos generales de numeración", score: 0.55 },
    { id: 2, texto: "Conteo básico", score: 0.40 }
  ];

  const evalMedio = evaluarCalidadRecuperacion(fragmentosMedios, 0.75, 0.35);
  assert.equal(evalMedio.estado, "AMBIGUOUS", "Debe clasificar como AMBIGUOUS cuando el score está entre ambos umbrales");
  assert.equal(esRecuperacionConfiable(evalMedio), false);
  assert.equal(evalMedio.accionRecomendada, "advertencia_referencial");
  assert.equal(evalMedio.fragmentosDepurados.length, 2);
});

test("CRAG: a) evaluarCalidadRecuperacion clasifica correctamente fragmentos bajos o vacíos (INCORRECT)", () => {
  // Lista vacía
  const evalVacio = evaluarCalidadRecuperacion([], 0.75, 0.35);
  assert.equal(evalVacio.estado, "INCORRECT", "Debe clasificar como INCORRECT si la lista es vacía");
  assert.equal(evalVacio.accionRecomendada, "busqueda_contingencia");
  assert.equal(evalVacio.fragmentosDepurados.length, 0);

  // Fragmentos irrelevantes por debajo del umbral mínimo
  const fragmentosBajos = [
    { id: 1, texto: "Texto no relacionado de física avanzada", score: 0.20 },
    { id: 2, texto: "Vocabulario inconexo", score: 0.15 }
  ];
  const evalBajo = evaluarCalidadRecuperacion(fragmentosBajos, 0.75, 0.35);
  assert.equal(evalBajo.estado, "INCORRECT", "Debe clasificar como INCORRECT si los fragmentos no superan el umbral bajo");
  assert.equal(evalBajo.accionRecomendada, "busqueda_contingencia");
});

test("HyDE: b) Fallback de HyDE devuelve la consulta intacta si la API no está disponible o falta clave", async () => {
  // Sin env
  const q1 = "clase de sumas con llevada";
  const r1 = await generarDocumentoHipotetico(null, q1, 2, "Matemática");
  assert.equal(r1, q1, "Debe retornar la consulta intacta cuando env es nulo");

  // Con env sin GEMINI_API_KEY
  const r2 = await generarDocumentoHipotetico({ GEMINI_API_KEY: "" }, q1, 2, "Matemática");
  assert.equal(r2, q1, "Debe retornar la consulta intacta cuando GEMINI_API_KEY no está configurada");

  // Consulta vacía
  const r3 = await generarDocumentoHipotetico({ GEMINI_API_KEY: "dummy" }, "   ");
  assert.equal(r3, "", "Debe manejar consultas vacías sin lanzar excepciones");
});

test("HyDE: Genera documento hipotético enriquecido cuando la API simulada responde", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return {
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                { text: "Contenidos conceptuales sobre la adición de números naturales hasta el 999 con reagrupación." }
              ]
            }
          }
        ]
      })
    };
  };

  try {
    const envMock = { GEMINI_API_KEY: "mock-key", GEMINI_MODEL: "gemini-test" };
    const res = await generarDocumentoHipotetico(envMock, "sumas con llevada", 2, "Matemática");
    assert.ok(res.includes("sumas con llevada"), "Debe preservar el tema original");
    assert.ok(res.includes("adición de números naturales"), "Debe incluir el pasaje hipotético formal expandido");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RRF Calibrado: Balanza adaptativa por área y constante k=60", () => {
  assert.equal(CONSTANTE_K_RRF, 60, "La constante k de RRF debe ser 60 (Cormack et al.)");

  const pesosMat = obtenerPesosArea("Matemática");
  assert.equal(pesosMat.wFts, 1.2, "Matemática debe priorizar precisión léxica (FTS 1.2)");
  assert.equal(pesosMat.wVector, 1.0);

  const pesosLengua = obtenerPesosArea("Lengua Española");
  assert.equal(pesosLengua.wFts, 0.9);
  assert.equal(pesosLengua.wVector, 1.3, "Lengua Española debe priorizar espacio semántico (Vector 1.3)");

  // Fusión real de dos listas
  const listaFTS = [
    { secuencia_id: "sec-1", tema: "Adición formal" },
    { secuencia_id: "sec-2", tema: "Cálculo mental" }
  ];
  const listaVector = [
    { secuencia_id: "sec-2", tema: "Cálculo mental" },
    { secuencia_id: "sec-3", tema: "Resolución de problemas" }
  ];

  const fusion = calibrarYFusionarRRF(listaFTS, listaVector, { k: 60, area: "Matemática", limite: 3 });
  assert.equal(fusion.length, 3);
  // sec-2 aparece en ambos rankings (rankFts: 2, rankVector: 1) -> debe tener el mayor score RRF combinado
  assert.equal(fusion[0].secuencia_id, "sec-2", "El documento presente en ambos índices debe liderar el ranking RRF");
  assert.ok(fusion[0].score > fusion[1].score);
});

test("Structured Output: Esquema oficial JSON Gemini y Constrained Decoding", () => {
  assert.equal(ESQUEMA_PLANIFICACION_GEMINI.type, "OBJECT");
  assert.ok(ESQUEMA_PLANIFICACION_GEMINI.required.includes("mensaje_chat"));
  assert.ok(ESQUEMA_PLANIFICACION_GEMINI.required.includes("plan_completado"));
  assert.ok(ESQUEMA_PLANIFICACION_GEMINI.properties.datos_planificacion);

  const configInyectada = inyectarStructuredOutputConfig({ temperature: 0.2 });
  assert.equal(configInyectada.responseMimeType, "application/json");
  assert.equal(configInyectada.responseSchema, ESQUEMA_PLANIFICACION_GEMINI);
  assert.equal(configInyectada.responseJsonSchema, ESQUEMA_PLANIFICACION_GEMINI);
});
