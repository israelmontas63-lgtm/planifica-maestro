/**
 * Asesor Pedagógico Interactivo y Detección de Redundancia
 * Estándar de Mentoría: Colega Pedagógico Experto (MINERD / Planifica Maestro)
 */

export class AsesorPedagogicoInteractivo {
  /**
   * Analiza si la petición es repetida o tiene inconsistencias de nivel.
   * Runtime: Cloudflare Workers Edge (JavaScript ES Modules)
   * 
   * @param {string} promptActual 
   * @param {Array} historialPeticiones - Array de temas previos en la sesión.
   */
  static evaluarPeticionDocente(promptActual, historialPeticiones = []) {
    const texto = (promptActual || '').toLowerCase();
    
    // 1. Verificación de Redundancia (Regla 2: Anti-Bucle)
    const peticionDuplicada = historialPeticiones.find(p => {
      const pLimpio = (typeof p === 'string' ? p : this._extraerTextoTurno(p)).toLowerCase().trim();
      return pLimpio && (texto.includes(pLimpio) || pLimpio.includes(texto));
    });

    if (peticionDuplicada) {
      const temaNombre = typeof peticionDuplicada === 'string' ? peticionDuplicada : this._extraerTextoTurno(peticionDuplicada);
      return {
        esRepetida: true,
        temaRepetido: temaNombre,
        mensajePausa: `Profe, ya trabajamos una planificación sobre "${temaNombre}". Para enriquecer tu jornada y no darte lo mismo, aquí tienes una variante con mayor profundidad en el cierre, o dime si prefieres pasar a los instrumentos de evaluación.`
      };
    }

    // 2. Asesoría Curricular ante Inconsistencias de Docente Novel
    const advertenciasCurriculares = [];
    
    // Inconsistencia: Contenido avanzado en primer ciclo
    if ((texto.includes('1er') || texto.includes('1°') || texto.includes('1.°') || texto.includes('2do') || texto.includes('2°') || texto.includes('2.°')) && 
        (texto.includes('fracciones complejas') || texto.includes('ecuaciones') || texto.includes('ensayo argumentativo'))) {
      advertenciasCurriculares.push({
        motivo: 'Contenido desfasado para Primer Ciclo',
        orientacion: 'Según la Adecuación Curricular y CON BASE, en este ciclo trabajamos nociones intuitivas y textos descriptivos/funcionales cortos. He adaptado la lección al nivel evolutivo correspondiente.'
      });
    }

    return {
      esRepetida: false,
      advertencias: advertenciasCurriculares
    };
  }

  /**
   * Detecta si una consulta actual es idéntica o redundante respecto al historial reciente.
   * Ofrece pausas activas, dinamizaciones lúdicas y variantes metodológicas.
   * 
   * @param {string} mensajeActual 
   * @param {Array} historial - Lista de mensajes previos [{ role, text | parts }]
   * @returns {Object} { esRedundante: boolean, sugerenciaPausaActiva: string|null }
   */
  static detectarRedundancia(mensajeActual = '', historial = []) {
    if (!mensajeActual || !Array.isArray(historial) || historial.length === 0) {
      return { esRedundante: false, sugerenciaPausaActiva: null };
    }

    const actualNorm = this._normalizarTexto(mensajeActual);
    if (!actualNorm) {
      return { esRedundante: false, sugerenciaPausaActiva: null };
    }

    let coincidencias = 0;

    for (const turno of historial) {
      const textoTurno = this._extraerTextoTurno(turno);
      const turnoNorm = this._normalizarTexto(textoTurno);

      if (turnoNorm && (turnoNorm === actualNorm || this._calcularSimilitudJaccard(actualNorm, turnoNorm) > 0.75)) {
        coincidencias++;
      }
    }

    if (coincidencias > 0) {
      return {
        esRedundante: true,
        coincidencias,
        sugerenciaPausaActiva: 'Profe, ya habíamos trabajado ese contenido. Te preparé una versión con actividades diferenciadas alternativas, o si deseas, elaboramos la lista de cotejo para evaluar esa misma lección.'
      };
    }

    return { esRedundante: false, sugerenciaPausaActiva: null };
  }

  /**
   * Evalúa si el tema solicitado corresponde al ciclo y nivel según el currículo dominicano,
   * u orienta fraternalmente al docente ante desfases de complejidad cognitiva.
   * 
   * @param {string} tema 
   * @param {string|number} gradoONivel 
   * @returns {Object} { tieneDesfase: boolean, recomendacion: string|null }
   */
  static evaluarDesfaseCurricular(tema = '', gradoONivel = '') {
    if (!tema) {
      return { tieneDesfase: false, recomendacion: null };
    }

    const temaMin = this._normalizarTexto(tema);
    const gradoStr = this._normalizarTexto(gradoONivel);

    // 1. Temas de secundaria o complejidad avanzada pedidos para 1.º o 2.º de primaria
    const temasAvanzados = [
      'algebra', 'ecuaciones cuadraticas', 'trigonometria', 'termodinamica',
      'filosofia', 'calculo diferencial', 'vectores en r3', 'genetica mendeliana compleja',
      'literatura renacentista'
    ];

    const esPrimerCicloPrimaria = gradoStr.includes('1') || gradoStr.includes('2') || gradoStr.includes('3') || gradoStr.includes('inicial') || gradoStr.includes('primero') || gradoStr.includes('segundo');

    for (const tAvanzado of temasAvanzados) {
      if (temaMin.includes(tAvanzado) && esPrimerCicloPrimaria) {
        return {
          tieneDesfase: true,
          complejidadDetectada: 'avanzada_para_ciclo',
          recomendacion: `Profe, para este grado el diseño curricular del MINERD contempla la noción concreta antes del algoritmo formal. Te estructuré la clase con material manipulativo y conteo vivencial, garantizando la articulación con la Adecuación Curricular (Ordenanza 04-2023).`
        };
      }
    }

    // 2. Metodología inicial básica requerida en niveles superiores
    const esSecundaria = gradoStr.includes('4') && (gradoStr.includes('secundaria') || gradoStr.includes('bachillerato')) || gradoStr.includes('5') && gradoStr.includes('secundaria') || gradoStr.includes('6') && gradoStr.includes('secundaria');
    if (temaMin.includes('conciencia fonologica basica') && esSecundaria) {
      return {
        tieneDesfase: true,
        complejidadDetectada: 'basica_para_secundaria',
        recomendacion: `Para Nivel Secundario (${gradoONivel}), se sugiere enfocar este contenido hacia la comprensión crítica, producción textual argumentativa y análisis discursivo, adecuando la nivelación lectoescritora sin infantilizar las dinámicas de aula.`
      };
    }

    return { tieneDesfase: false, recomendacion: null };
  }

  /**
   * Genera preguntas de acompañamiento y seguimiento al cierre de la planificación.
   */
  static generarPreguntasSeguimiento(grado = '1.° y 2.° Primaria') {
    return [
      '¿Deseas que prepare la rúbrica o lista de cotejo para evaluar esta clase?',
      '¿Quieres que te desglose el material manipulativo sugerido (tarjetas, letras móviles o papelógrafos)?'
    ];
  }

  // Métodos auxiliares
  static _normalizarTexto(txt = '') {
    return String(txt)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  static _extraerTextoTurno(turno) {
    if (!turno) return '';
    if (typeof turno === 'string') return turno;
    if (turno.text) return turno.text;
    if (Array.isArray(turno.parts)) {
      return turno.parts.map(p => (typeof p === 'string' ? p : (p.text || ''))).join(' ');
    }
    return '';
  }

  static _calcularSimilitudJaccard(a, b) {
    const setA = new Set(a.split(' ').filter(p => p.length > 2));
    const setB = new Set(b.split(' ').filter(p => p.length > 2));
    if (setA.size === 0 || setB.size === 0) return 0;

    let interseccion = 0;
    for (const elem of setA) {
      if (setB.has(elem)) interseccion++;
    }

    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : interseccion / union;
  }
}
