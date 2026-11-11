/**
 * worker/services/rerankerCurricular.js
 * 
 * Capa de Re-ranking Semántico y Puntuación Cruzada (Cross-Scoring)
 * Basado en Reimers & Gurevych (EMNLP 2019).
 * Filtra y jerarquiza fragmentos del MINERD antes de construir el System Prompt.
 */

/**
 * Calcula una puntuación de afinidad cruzada entre la consulta docente y un fragmento recuperado.
 * Analiza congruencia de ciclo/grado, densidad de términos sustantivos y presencia de indicadores de logro.
 * 
 * @param {Object} params
 * @param {string} params.consulta - Tema o texto ingresado por el docente.
 * @param {number|null} params.grado - Grado escolar requerido (1 a 6).
 * @param {string|null} params.area - Área académica oficial.
 * @param {Object} params.fragmento - Registro de curriculo_paginas { texto, fuente_documento, pagina, grado_num, area }
 * @returns {number} Score normalizado entre 0.0 y 1.0
 */
export function calcularPuntajeRelevancia({ consulta, grado, area, fragmento }) {
  if (!fragmento) return 0.0;

  const texto = fragmento.texto || fragmento.contenido || [
    fragmento.tema,
    fragmento.bloque_guia,
    fragmento.competencias_especificas,
    fragmento.contenidos_texto_original,
    Array.isArray(fragmento.indicadores_logro) ? fragmento.indicadores_logro.join(" ") : fragmento.indicadores_logro
  ].filter(Boolean).join(" | ");

  if (!texto) return 0.0;

  let score = 0.0;
  const textoMin = texto.toLowerCase();
  const consultaMin = (consulta || '').toLowerCase();

  // 1. Penalización/Bonificación estricta por correspondencia de Grado (Peso: 0.35)
  if (grado !== null && grado !== undefined) {
    if (fragmento.grado_num === grado) {
      score += 0.35;
    } else if (fragmento.grado_num !== null && fragmento.grado_num !== grado) {
      // Si el fragmento pertenece explícitamente a otro grado, penalizar fuertemente
      score -= 0.40;
    }
  }

  // 2. Bonificación por Área Curricular exacta (Peso: 0.25)
  if (area && fragmento.area) {
    if (fragmento.area.toLowerCase() === area.toLowerCase()) {
      score += 0.25;
    } else {
      score -= 0.30;
    }
  }

  // 3. Densidad de coincidencia de términos clave del tema (Peso: 0.25)
  const terminos = consultaMin
    .replace(/[¿?¡!.,:;()\[\]]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);

  if (terminos.length > 0) {
    let coincidencias = 0;
    for (const t of terminos) {
      if (textoMin.includes(t)) coincidencias++;
    }
    const ratioTerminos = coincidencias / terminos.length;
    score += (ratioTerminos * 0.25);
  }

  // 4. Valor normativo pedagógico (Peso: 0.15)
  // Se priorizan fragmentos que contengan indicadores de logro o competencias explícitas
  if (textoMin.includes('indicadores de logro') || textoMin.includes('competencias específicas')) {
    score += 0.15;
  }

  // Normalización acotada [0, 1]
  return Math.max(0.0, Math.min(1.0, score));
}

/**
 * Reordena y poda la lista de fragmentos curriculares devueltos por Supabase
 * descartando resultados por debajo del umbral de calidad.
 * 
 * @param {Array} fragmentos - Lista cruda de registros devueltos por el RPC buscar_curriculo
 * @param {Object} contexto - { consulta, grado, area }
 * @param {Object} opciones - { umbralMinimo: 0.45, maxFragmentos: 3 }
 * @returns {Array} Fragmentos refinados y ordenados por score descendente
 */
export function reclasificarFragmentos(fragmentos = [], contexto = {}, opciones = {}) {
  const umbral = opciones.umbralMinimo ?? 0.45;
  const maximo = opciones.maxFragmentos ?? 3;

  if (!Array.isArray(fragmentos) || fragmentos.length === 0) {
    return [];
  }

  const evaluados = fragmentos.map(frag => {
    const puntaje = calcularPuntajeRelevancia({
      consulta: contexto.consulta,
      grado: contexto.grado,
      area: contexto.area,
      fragmento: frag
    });
    return { ...frag, score_rerank: puntaje };
  });

  // Filtrar los que no superan el umbral mínimo de afinidad y ordenar de mayor a menor
  return evaluados
    .filter(item => item.score_rerank >= umbral)
    .sort((a, b) => b.score_rerank - a.score_rerank)
    .slice(0, maximo);
}
