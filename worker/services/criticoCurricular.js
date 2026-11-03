/**
 * worker/services/criticoCurricular.js
 * 
 * Agente de Auto-Corrección y Reflexión Interna (Self-RAG)
 * Basado en Asai et al. (ICLR 2024) y Shinn et al. (NeurIPS 2023).
 * Audita fidelidad fáctica con el currículo del MINERD y coherencia de los 3 momentos didácticos.
 */

/**
 * Inspecciona el JSON de planificación frente a los fragmentos oficiales del MINERD recuperados.
 * 
 * @param {Object} planData - Objeto JSON generado por el modelo (datos_planificacion)
 * @param {Array} fragmentosCurriculares - Lista de registros devueltos por curriculo_paginas
 * @returns {Object} { esValido: boolean, motivoFallo: string|null, scoreFidelidad: number }
 */
export function auditarFidelidadCurricular(planData, fragmentosCurriculares = []) {
  if (!planData || typeof planData !== 'object') {
    return { esValido: false, motivoFallo: 'Planificación vacía o no estructurada en JSON.', scoreFidelidad: 0.0 };
  }

  // 1. Verificación de momentos pedagógicos mínimos obligatorios
  const actividades = planData.actividades || planData['6. Actividades: Inicio - Desarrollo - Cierre'] || {};
  const tieneInicio = Boolean(actividades.inicio || actividades.Inicio || JSON.stringify(actividades).toLowerCase().includes('inicio'));
  const tieneDesarrollo = Boolean(actividades.desarrollo || actividades.Desarrollo || JSON.stringify(actividades).toLowerCase().includes('desarrollo'));
  const tieneCierre = Boolean(actividades.cierre || actividades.Cierre || JSON.stringify(actividades).toLowerCase().includes('cierre'));

  if (!tieneInicio || !tieneDesarrollo || !tieneCierre) {
    return {
      esValido: false,
      motivoFallo: 'Falta uno de los 3 momentos didácticos obligatorios de la clase dominicana (Inicio, Desarrollo o Cierre).',
      scoreFidelidad: 0.3
    };
  }

  // 2. Si no hubo fragmentos curriculares recuperados de Supabase, la planificación es puramente referencial
  if (!fragmentosCurriculares || fragmentosCurriculares.length === 0) {
    return { esValido: true, motivoFallo: null, scoreFidelidad: 0.5 };
  }

  // 3. Verificación de anclaje fáctico (Grounding Check)
  // Extrae términos del indicador de logro de la planificación y busca correspondencia textual en la evidencia
  const textoEvidencia = fragmentosCurriculares.map(f => (f.texto || '').toLowerCase()).join(' ');
  const indicadoresPlan = JSON.stringify(
    planData.indicadores_logro || 
    planData.evaluacion || 
    planData['8. Evaluación: indicadores de logro, técnicas e instrumentos'] || ''
  ).toLowerCase();

  const terminosIndicador = indicadoresPlan
    .replace(/[^\w\s]/gi, ' ')
    .split(/\s+/)
    .filter(w => w.length > 4);

  if (terminosIndicador.length === 0) {
    return { esValido: true, motivoFallo: null, scoreFidelidad: 0.7 };
  }

  let coincidencias = 0;
  for (const t of terminosIndicador) {
    if (textoEvidencia.includes(t)) {
      coincidencias++;
    }
  }

  const ratioGrounding = coincidencias / terminosIndicador.length;

  // Si menos del 25% de los conceptos del indicador aparecen en la evidencia oficial recuperada
  if (ratioGrounding < 0.25) {
    return {
      esValido: false,
      motivoFallo: 'Los indicadores de logro propuestos no corresponden al texto oficial de las páginas curriculares recuperadas.',
      scoreFidelidad: ratioGrounding
    };
  }

  return { esValido: true, motivoFallo: null, scoreFidelidad: Math.min(1.0, ratioGrounding + 0.3) };
}

/**
 * Construye el prompt de auto-corrección rápida si la auditoría detecta inconsistencias.
 */
export function construirPromptCorreccion(planInvalido, motivoFallo, fragmentosTexto) {
  return `INSTRUCCIÓN DE AUTO-CORRECCIÓN CRÍTICA (SELF-RAG):
Tu borrador previo presentó el siguiente fallo de alineación normativa:
"${motivoFallo}"

EVIDENCIA CURRICULAR OBLIGATORIA DEL MINERD:
${fragmentosTexto}

Corrige inmediatamente el objeto JSON de planificación asegurando:
1. Extraer textualmente los indicadores de logro y competencias desde la EVIDENCIA provista arriba.
2. Garantizar que existan actividades detalladas para Inicio, Desarrollo y Cierre.
Devuelve únicamente el JSON corregido y válido.`;
}
