// worker/services/validadorFinalPlan.js
// Etapa común de validación, corrección Self-RAG, evaluación RAGAS/CRAG y persistencia
// para todos los flujos activos de generación (Streaming SSE, usaHerramientasV2 y JSON estándar).

import { auditarFidelidadCurricular, construirPromptCorreccion } from "./criticoCurricular.js";
import { calcularFaithfulness, calcularRelevance, registrarMetricasRagas } from "./evaluadorRagas.js";
import { evaluarCalidadRecuperacion } from "./evaluadorCRAG.js";
import { generarClaveCache, guardarEnCache } from "./cacheSemanticaService.js";
import { guardarExperienciaEpisodica } from "./memoriaEpisodica.js";

export function clasificarEstadoValidacion({ esValidoEstructura, auditoriaFidelidad, fScore, totalFragmentos, crag }) {
  if (!esValidoEstructura) return "ERROR_DE_VALIDACION";
  if (!auditoriaFidelidad || !auditoriaFidelidad.esValido) return "NECESITA_CORRECCION";
  if (!totalFragmentos || totalFragmentos === 0) return "NO_VERIFICADO";
  if (fScore < 0.70 || crag?.estado === "AMBIGUOUS" || crag?.estado === "INCORRECT") {
    return "APROBADO_CON_OBSERVACIONES";
  }
  return "APROBADO";
}

export async function ejecutarValidacionYCorreccionFinal({
  objetoPlan,
  filasRecuperadas = [],
  bloqueCurriculoTexto = "",
  temaConsulta = "",
  grado = null,
  area = null,
  nivel = null,
  docenteId = "Israel Montás",
  sesionId = null,
  env,
  ctx,
  systemPrompt = "",
  modelArreglo = "gemini-3.1-flash-lite",
  fetchGeminiWithRetry,
  textoDeCandidato,
  extraerJson,
  validarCamposPlanificacion,
  construirMaxSalida,
  construirThinkingConfig,
  sanitizarPlanParaCache,
  signal,
}) {
  if (!objetoPlan || !objetoPlan.plan_completado || !objetoPlan.datos_planificacion) {
    return objetoPlan;
  }

  const filas = Array.isArray(filasRecuperadas) ? filasRecuperadas : [];
  const evaluacionCrag = evaluarCalidadRecuperacion(filas);
  let auditoriaFidelidad = auditarFidelidadCurricular(objetoPlan.datos_planificacion, filas);

  if (!auditoriaFidelidad.esValido && env?.GEMINI_API_KEY && typeof fetchGeminiWithRetry === "function") {
    try {
      const promptArreglo = construirPromptCorreccion(
        objetoPlan.datos_planificacion,
        auditoriaFidelidad.motivoFallo,
        filas.map((f) => f.texto || f.contenido || f.tema || "").filter(Boolean).join("\n")
      );
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelArreglo}:generateContent`;
      const retryRes = await fetchGeminiWithRetry(geminiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY,
        },
        timeoutMs: 45000,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: promptArreglo }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: {
            temperature: 0.0,
            responseMimeType: "application/json",
            maxOutputTokens: construirMaxSalida(env),
            ...construirThinkingConfig(env),
          },
        }),
        signal,
      });
      if (retryRes && retryRes.ok) {
        const dataArreglo = await retryRes.json();
        const candArreglo = dataArreglo.candidates?.[0];
        const rawArreglo = textoDeCandidato(candArreglo);
        const parsedArreglo = extraerJson(rawArreglo);
        if (parsedArreglo && validarCamposPlanificacion(parsedArreglo)) {
          objetoPlan.datos_planificacion = parsedArreglo.datos_planificacion || parsedArreglo;
          auditoriaFidelidad = auditarFidelidadCurricular(objetoPlan.datos_planificacion, filas);
        }
      }
    } catch (eArreglo) {
      console.warn("[Self-RAG] Fallo en reintento correctivo:", eArreglo?.message || eArreglo);
    }
  }

  const textoEvidencia = bloqueCurriculoTexto || (filas.length > 0 ? JSON.stringify(filas) : "");
  const fScore = calcularFaithfulness(objetoPlan.datos_planificacion, textoEvidencia);
  const rScore = calcularRelevance(objetoPlan.datos_planificacion, temaConsulta);
  const estadoValidacion = clasificarEstadoValidacion({
    esValidoEstructura: true,
    auditoriaFidelidad,
    fScore,
    totalFragmentos: filas.length,
    crag: evaluacionCrag,
  });

  objetoPlan.auditoria = {
    aprobado: Boolean(auditoriaFidelidad.esValido),
    estadoValidacion,
    scoreFidelidad: auditoriaFidelidad.scoreFidelidad,
    motivoFallo: auditoriaFidelidad.motivoFallo,
    faithfulness: fScore,
    relevance: rScore,
    crag: evaluacionCrag,
    notaMetrica: "Métricas heurísticas de apoyo; no sustituyen revisión docente.",
  };

  const despachar = (promesa) => {
    if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(promesa);
    else promesa.catch?.((e) => console.warn("[ValidadorFinal] Error en tarea asíncrona:", e?.message || e));
  };

  const tareaAuditoria = registrarMetricasRagas(env, {
    sesionId,
    grado,
    area,
    tema: temaConsulta,
    faithfulness: fScore,
    relevance: rScore,
    precision: filas.length > 0 ? 1.0 : 0.5,
  });
  despachar(tareaAuditoria);

  const claveCacheSem = generarClaveCache(grado, area, temaConsulta);
  if (claveCacheSem && fScore >= 0.70 && auditoriaFidelidad.esValido) {
    const tareaCacheSem = guardarEnCache(env, {
      claveHash: claveCacheSem,
      grado,
      area,
      tema: temaConsulta,
      planJson: typeof sanitizarPlanParaCache === "function" ? sanitizarPlanParaCache(objetoPlan.datos_planificacion) : objetoPlan.datos_planificacion,
      fuentes: objetoPlan.confianza_curricular || null,
    });
    despachar(tareaCacheSem);
  }

  if (auditoriaFidelidad.esValido && env?.SUPABASE_URL && env?.SUPABASE_SERVICE_ROLE_KEY) {
    const tareaMemoria = guardarExperienciaEpisodica(env, {
      docenteId: docenteId || "Israel Montás",
      gradoNivel: String(grado || nivel || "Primario"),
      areaCurricular: area || "General",
      temaConsulta,
      datosPlanificacion: objetoPlan.datos_planificacion || objetoPlan,
      esValido: auditoriaFidelidad.esValido,
    }).then((resMem) => {
      if (!resMem.ok) console.warn("[MemoriaRobot] Persistencia no completada:", resMem.motivo);
    });
    despachar(tareaMemoria);
  }

  return objetoPlan;
}
