/**
 * Auditor Pedagógico de Coherencia y Grounding Curricular
 * Ejecuta verificación determinista previa a la salida.
 */
export class AuditorPedagogico {
  /**
   * Audita el borrador generado contra las evidencias curriculares recuperadas de Supabase.
   * @param {string} contenidoGenerado - Texto o markdown de la planificación.
   * @param {Array} evidenciasCurriculares - Registros originales retornados por buscar_curriculo_paginas.
   * @returns {Object} { aprobado: boolean, dictamen: string, correcciones: Array }
   */
  static auditarPlanificacion(contenidoGenerado, evidenciasCurriculares = []) {
    if (!contenidoGenerado) {
      const hallazgoVacio = ['La planificación generada está vacía o es nula.'];
      return {
        aprobado: false,
        certificado: false,
        certificadoPor: 'AuditorPedagogico_PlanificaMaestro_v1',
        marcaTiempoAST: new Date().toISOString(),
        hallazgos: hallazgoVacio,
        faltas: hallazgoVacio,
        correcciones: hallazgoVacio,
        dictamen: 'RECHAZADO: Requiere auto-reparación antes de emitir.',
        motivoFallo: hallazgoVacio[0],
        metricas: {
          sinMarcadoresIncompletos: false,
          momentosCompletos: false,
          citasValidas: false
        }
      };
    }

    const hallazgos = [];
    const texto = typeof contenidoGenerado === 'string'
      ? contenidoGenerado
      : JSON.stringify(contenidoGenerado);

    // 1. Verificación de marcadores de texto incompletos o delegación al docente
    const marcadoresProhibidos = ['[completar', '[insertar', '[pendiente', '[asignar', '...'];
    for (const marcador of marcadoresProhibidos) {
      if (texto.toLowerCase().includes(marcador)) {
        hallazgos.push(`Contiene marcador de texto incompleto no permitido: "${marcador}".`);
      }
    }

    // Veto absoluto a menciones de IA
    const frasesIA = ['creado por ia', 'generado por inteligencia artificial', 'modelo de lenguaje', 'asistente virtual'];
    for (const f of frasesIA) {
      if (texto.toLowerCase().includes(f)) {
        hallazgos.push(`Contiene mención prohibida de IA: "${f}". Debe sustituirse por "Planifica Maestro".`);
      }
    }

    // 2. Verificación de estructura temporal obligatoria según nivel educativo
    const esNivelInicial = /nivel inicial|pre-primario|kínder|párvulo|sala cuna/i.test(texto);
    const tieneInicio = /(?:###?\s*)?inicio(?:\s*\(|:|\b)/i.test(texto);
    const tieneDesarrollo = /(?:###?\s*)?desarrollo(?:\s*\(|:|\b)/i.test(texto);
    const tieneCierre = /(?:###?\s*)?cierre(?:\s*\(|:|\b)/i.test(texto);
    const tieneMomentosPrimaria = Boolean(tieneInicio && tieneDesarrollo && tieneCierre);

    const tieneMomentosInicial = /(?:encuentro de grupo|grupo grande|grupo peque[ñn]o|juego[-\s]trabajo|zonas de inter[eé]s)/i.test(texto);

    const momentosCompletos = esNivelInicial
      ? (tieneMomentosInicial || tieneMomentosPrimaria)
      : tieneMomentosPrimaria;

    if (!momentosCompletos) {
      if (esNivelInicial) {
        hallazgos.push('La planificación de Nivel Inicial debe estructurarse formalmente en Momentos de la Rutina (Encuentro de Grupo, Grupo Grande/Pequeño, Juego-Trabajo y Evaluación).');
      } else {
        hallazgos.push('La secuencia no cumple formalmente los tres momentos obligatorios (Inicio, Desarrollo y Cierre).');
      }
    }

    // 3. Verificación de citas curriculares reales contra la base de datos
    let tieneCitaValida = false;
    if (evidenciasCurriculares && evidenciasCurriculares.length > 0) {
      for (const ev of evidenciasCurriculares) {
        if (ev.pagina && texto.includes(String(ev.pagina))) {
          tieneCitaValida = true;
          break;
        }
      }
      if (!tieneCitaValida) {
        hallazgos.push('No se detectó la referencia exacta al número de página de las evidencias oficiales recuperadas.');
      }
    } else {
      tieneCitaValida = true;
    }

    // 4. Verificación de progresión y diferenciación CON BASE (1.º y 2.º Grado)
    const esMultigrado = /multigrado|1\.[°º].*2\.[°º]|primer ciclo/i.test(texto);
    const tieneProgresionCONBASE = !esMultigrado || /(?:1\.[°º].*2\.[°º]|con base|fonol[oó]gic|grafema|letras m[oó]viles|sil[aá]bic)/i.test(texto);
    if (esMultigrado && !tieneProgresionCONBASE) {
      hallazgos.push('En modalidad multigrado, la diferenciación didáctica debe reflejar la progresión metodológica de CON BASE.');
    }

    const sinMarcadoresIncompletos = !marcadoresProhibidos.some(m => texto.toLowerCase().includes(m));
    const aprobado = hallazgos.length === 0;

    return {
      aprobado,
      certificado: aprobado,
      certificadoPor: 'AuditorPedagogico_PlanificaMaestro_v1',
      marcaTiempoAST: new Date().toISOString(),
      hallazgos,
      faltas: hallazgos,
      correcciones: hallazgos,
      dictamen: aprobado
        ? 'CERTIFICADO: Planificación validada contra fuentes oficiales MINERD/CON BASE.'
        : 'RECHAZADO: Requiere auto-reparación antes de emitir.',
      motivoFallo: aprobado ? null : hallazgos.join('; '),
      metricas: {
        sinMarcadoresIncompletos,
        momentosCompletos,
        citasValidas: tieneCitaValida,
        progresionCONBASE: tieneProgresionCONBASE,
        checklist: {
          indicadorEnBase: tieneCitaValida,
          paginaOficialMINERD: tieneCitaValida,
          diferenciacionCONBASE: tieneProgresionCONBASE,
          sinMarcadoresIncompletos
        }
      }
    };
  }

  /**
   * Método de conveniencia para invocación en instancia
   */
  auditar(contenidoGenerado, evidenciasCurriculares = []) {
    return AuditorPedagogico.auditarPlanificacion(contenidoGenerado, evidenciasCurriculares);
  }
}
