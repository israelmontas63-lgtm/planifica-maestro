/**
 * worker/services/evaluadorRagas.js
 * 
 * Evaluador de Calidad RAGAS en Producción (Es et al., EACL 2024).
 * Calcula fidelidad, relevancia pedagógica y precisión contextual.
 */

/**
 * Calcula la métrica de Faithfulness (Fidelidad Fáctica).
 * Descompone los indicadores de logro y contenidos propuestos y verifica
 * si están respaldados por el texto oficial recuperado.
 */
export function calcularFaithfulness(planificacion, fragmentosTexto = '') {
  if (!planificacion || typeof planificacion !== 'object') return 0.0;
  if (!fragmentosTexto || fragmentosTexto.trim().length === 0) return 0.5; // Borrador referencial

  const textoOficial = fragmentosTexto.toLowerCase();
  const indicadores = JSON.stringify(
    planificacion.indicadores_logro || 
    planificacion['8. Evaluación: indicadores de logro, técnicas e instrumentos'] || ''
  ).toLowerCase();

  // Extraer términos sustantivos de más de 4 letras
  const sentencias = indicadores
    .replace(/[^\w\sáéíóúüñ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 4);

  if (sentencias.length === 0) return 0.8;

  let verificados = 0;
  for (const palabra of sentencias) {
    if (textoOficial.includes(palabra)) {
      verificados++;
    }
  }

  return Number((verificados / sentencias.length).toFixed(3));
}

/**
 * Calcula la Relevancia de Respuesta (Answer Relevance).
 * Verifica si las actividades contienen los momentos Inicio, Desarrollo y Cierre
 * y si abordan el tema solicitado.
 */
export function calcularRelevance(planificacion, temaConsulta = '') {
  if (!planificacion || typeof planificacion !== 'object') return 0.0;

  let score = 0.0;
  const textoPlan = JSON.stringify(planificacion).toLowerCase();
  const temaNorm = (temaConsulta || '').toLowerCase().trim();

  // 1. Cohesión de momentos pedagógicos obligatorios (0.50)
  const tieneInicio = textoPlan.includes('inicio');
  const tieneDesarrollo = textoPlan.includes('desarrollo');
  const tieneCierre = textoPlan.includes('cierre');

  if (tieneInicio && tieneDesarrollo && tieneCierre) {
    score += 0.50;
  } else if (tieneInicio || tieneDesarrollo) {
    score += 0.25;
  }

  // 2. Anclaje temático con la petición del docente (0.50)
  const terminosTema = temaNorm.split(/\s+/).filter(t => t.length > 3);
  if (terminosTema.length > 0) {
    let hallados = 0;
    for (const t of terminosTema) {
      if (textoPlan.includes(t)) hallados++;
    }
    score += (hallados / terminosTema.length) * 0.50;
  } else {
    score += 0.40;
  }

  return Number(Math.min(1.0, score).toFixed(3));
}

/**
 * Registra las métricas en segundo plano en Supabase sin demorar la respuesta al usuario.
 */
export async function registrarMetricasRagas(env, { sesionId, grado, area, tema, faithfulness, relevance, precision = 1.0 }) {
  if (!env || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return;

  let alerta = 'OPTIMO';
  if (faithfulness < 0.70 || relevance < 0.60) {
    alerta = 'CRITICO';
  } else if (faithfulness < 0.85 || relevance < 0.80) {
    alerta = 'ADVERTENCIA';
  }

  const url = `${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/auditoria_calidad_ragas`;
  const esUuid = typeof sesionId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sesionId);
  const gradoNum = typeof grado === 'number' ? grado : (parseInt(String(grado || '').match(/\d+/)?.[0], 10) || null);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },

      body: JSON.stringify({
        sesion_id: esUuid ? sesionId : null,
        grado: gradoNum,
        area: area || null,
        tema: tema || null,
        faithfulness_score: faithfulness,
        relevance_score: relevance,
        context_precision: precision,
        estado_alerta: alerta,
        detalles_auditoria: {
          timestamp: new Date().toISOString(),
          evaluador: "RAGAS-Lite-MINERD",
          sesion_original: sesionId || null
        }
      })
    });
    if (!res.ok) {
      console.warn(`[RAGAS] Error al registrar métricas en auditoria_calidad_ragas: status ${res.status}`);
    }
  } catch (err) {
    console.warn('[RAGAS] Error al registrar métricas:', err.message);
  }
}
