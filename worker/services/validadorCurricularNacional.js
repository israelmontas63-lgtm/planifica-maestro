/**
 * Validador Curricular Nacional de la República Dominicana
 * Certifica que las competencias, ordenanzas y estructuras respeten estrictamente al MINERD.
 * ORDEN 46: Blindaje Documental MINERD y Sanitización de Branding
 */
export class ValidadorCurricularNacional {
  static marcosNormativos() {
    return {
      inicial: 'Adecuación Curricular Nivel Inicial (Resolución 09-2023 / Ordenanza 01-2023)',
      primaria: 'Adecuación Curricular Nivel Primario (Ordenanza 04-2023) y Guías CON BASE',
      secundaria: 'Adecuación Curricular Nivel Secundario (Ordenanza 03-2023) - Modalidad Académica y Técnica'
    };
  }

  /**
   * Sanitiza e intercepta menciones a "IA" o modelos de lenguaje,
   * reemplazándolas por el branding oficial de "Planifica Maestro".
   * 
   * @param {string} planTexto - Texto o markdown a sanitizar
   * @returns {string} Texto con branding oficial
   */
  static sanitizarBranding(planTexto = '') {
    if (!planTexto) return '';
    let texto = String(planTexto);

    const reemplazos = [
      { regex: /cread[oa] por (?:una? )?ia\b/gi, valor: 'Planifica Maestro' },
      { regex: /generad[oa] por (?:una? )?ia\b/gi, valor: 'Planifica Maestro' },
      { regex: /generad[oa] por inteligencia artificial\b/gi, valor: 'Planifica Maestro' },
      { regex: /cread[oa] por inteligencia artificial\b/gi, valor: 'Planifica Maestro' },
      { regex: /modelo de lenguaje\b/gi, valor: 'Planifica Maestro' },
      { regex: /asistente virtual\b/gi, valor: 'Planifica Maestro' }
    ];

    for (const r of reemplazos) {
      texto = texto.replace(r.regex, r.valor);
    }

    return texto;
  }

  // Comprueba que los campos requeridos por la ordenanza del nivel estén completos
  static validarEstructuraPorNivel(nivel, planTexto = '') {
    if (!planTexto) {
      return {
        valido: false,
        fallas: ['El contenido de la planificación está vacío o es nulo.'],
        textoSaneado: ''
      };
    }

    const texto = typeof planTexto === 'string'
      ? planTexto
      : JSON.stringify(planTexto);

    const textoMin = texto.toLowerCase();
    const fallas = [];

    const nivelNormalizado = (nivel || '').trim().toLowerCase();

    if (nivelNormalizado === 'inicial' || nivelNormalizado === 'nivel inicial' || nivel === 'Inicial') {
      if (!textoMin.includes('encuentro de grupo') && !textoMin.includes('juego-trabajo')) {
        fallas.push('Nivel Inicial requiere momentos de la rutina (Encuentro de Grupo o Juego-Trabajo en Zonas).');
      }
    } else if (nivelNormalizado === 'secundaria' || nivelNormalizado === 'nivel secundario' || nivelNormalizado === 'secundario' || nivel === 'Secundaria') {
      if (!textoMin.includes('situación de aprendizaje') && !textoMin.includes('situacion de aprendizaje')) {
        fallas.push('Nivel Secundario requiere Situación de Aprendizaje formal como articulador.');
      }
    } else {
      // Primaria (Primer o Segundo Ciclo)
      const tieneInicio = textoMin.includes('inicio');
      const tieneDesarrollo = textoMin.includes('desarrollo');
      const tieneCierre = textoMin.includes('cierre');
      if (!tieneInicio || !tieneDesarrollo || !tieneCierre) {
        fallas.push('Nivel Primario requiere la secuencia didáctica estricta en 3 momentos (Inicio, Desarrollo y Cierre).');
      }
    }

    // Veto absoluto a frases de IA
    const frasesIA = ['creado por ia', 'generado por inteligencia artificial', 'modelo de lenguaje', 'asistente virtual', 'generado por ia'];
    for (const f of frasesIA) {
      if (textoMin.includes(f)) {
        fallas.push(`Contiene mención prohibida de IA: "${f}". Debe sustituirse por "Planifica Maestro".`);
      }
    }

    const textoSaneado = ValidadorCurricularNacional.sanitizarBranding(texto);

    return {
      valido: fallas.length === 0,
      fallas,
      textoSaneado
    };
  }
}
