/**
 * worker/services/motorCurricularRAG.js
 * Motor RAG Curricular Oficial y Generador de Secuencias Multigrado (1.º y 2.º)
 * Conexión nativa con Supabase RPC buscar_curriculo_paginas (500 páginas curriculo_paginas)
 */

export class MotorCurricularRAG {
  constructor(env = {}, options = {}) {
    this.env = env || {};
    this.supabaseUrl = (this.env.SUPABASE_URL || `https://${this.env.SUPABASE_PROJECT_REF || 'obcjdxearmmvtihfmtaa'}.supabase.co`).replace(/\/+$/, '');
    this.serviceKey = this.env.SUPABASE_SERVICE_ROLE_KEY || this.env.SUPABASE_ANON_KEY || '';
    this.fetchFn = options.fetchFn || ((...args) => globalThis.fetch(...args));
  }

  /**
   * Tarea 1: Conexión con Supabase RPC buscar_curriculo_paginas
   * Envía: query_text, p_grado (1 o 2), p_limite (mínimo 3 páginas relevantes)
   * Extrae: texto, número de página y fuente documental para inyectar en el contexto del LLM.
   */
  async consultarCurriculoPaginas({ termino, grado = 1, limite = 3 }) {
    if (!termino) {
      return { ok: false, error: 'Se requiere un término de búsqueda curricular.', fragmentos: [] };
    }

    const endpoint = `${this.supabaseUrl}/rest/v1/rpc/buscar_curriculo_paginas`;
    const payload = {
      query_text: termino,
      p_grado: Number(grado) || 1,
      p_limite: Math.max(3, Number(limite) || 3)
    };

    const res = await this.fetchFn(endpoint, {
      method: 'POST',
      headers: {
        'apikey': this.serviceKey,
        'Authorization': `Bearer ${this.serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.text();
      return { ok: false, error: `Fallo RPC en Supabase (${res.status}): ${err}`, fragmentos: [] };
    }

    const filas = await res.json();
    const fragmentos = (filas || []).map(f => ({
      pagina: f.pagina,
      texto: f.texto || f.contenido || '',
      documento: f.fuente_documento || f.documento_titulo || 'Adecuación Curricular MINERD',
      area: f.area || 'General',
      grado: f.grado || grado
    }));

    return {
      ok: true,
      total: fragmentos.length,
      fragmentos: fragmentos
    };
  }

  /**
   * Construye el bloque de fundamentación documental oficial para el LLM
   */
  formatearContextoRAG(fragmentos) {
    if (!fragmentos || fragmentos.length === 0) {
      return '=== CONTEXTO CURRICULAR OFICIAL MINERD ===\nNo se hallaron fragmentos específicos en la base de datos para este término.\n';
    }

    let bloque = '=== CONTEXTO CURRICULAR OFICIAL MINERD (500 PÁGINAS OFICIALES) ===\n';
    bloque += 'DIRECTRIZ OBLIGATORIA: Debes fundamentar las competencias e indicadores en estas citas y citar explícitamente "pág. X" del documento.\n\n';

    for (const f of fragmentos) {
      bloque += `[Documento: ${f.documento} | Grado: ${f.grado}° | Página Oficial: ${f.pagina}]\n`;
      bloque += `${f.texto}\n\n`;
    }

    return bloque;
  }

  /**
   * Tarea 2: Ensamblaje de Secuencias Multigrado (1.º y 2.º)
   * Fundamenta competencias específicas, contenidos, indicadores y actividades inicio/desarrollo/cierre (45 min)
   */
  async estructurarPlanificacionMultigrado({ tema, grado = 1, area = 'Lengua Española', aiInstance = null }) {
    // 1. Invocar automáticamente la búsqueda curricular
    const resultadoRAG = await this.consultarCurriculoPaginas({ termino: tema, grado, limite: 3 });
    const contextoCurricular = this.formatearContextoRAG(resultadoRAG.fragmentos);

    const paginaCitada = resultadoRAG.fragmentos[0]?.pagina || 1;
    const docCitado = resultadoRAG.fragmentos[0]?.documento || 'Adecuación Curricular MINERD';

    // 2. Si se proporciona instancia de IA (Gemini), generar la secuencia pedagógica fundamentada
    if (aiInstance && aiInstance.models && typeof aiInstance.models.generateContent === 'function') {
      const prompt = `Eres el Planificador Experto de Planifica Maestro para 1.° y 2.° grado de Primaria (Multigrado MINERD/CON BASE).
Genera una planificación didáctica estructurada para una clase de 45 minutos sobre el tema: "${tema}" en ${area} para ${grado}.° grado.

${contextoCurricular}

La estructura de salida DEBE incluir rigurosamente:
1. Competencias Específicas del Grado (fundamentadas en el currículo oficial).
2. Contenidos Curriculares (conceptuales, procedimentales y actitudinales).
3. Indicadores de Logro de la Adecuación Curricular.
4. Secuencia Didáctica para 45 minutos:
   - Inicio (10 min): Recuperación de saberes previos y motivación.
   - Desarrollo (25 min): Actividades prácticas diferenciadas para 1.° y 2.° grado con material concreto.
   - Cierre (10 min): Metacognición y síntesis formativa.
5. Cita de Fuente Oficial: Indicar expresamente "${docCitado}, pág. ${paginaCitada}".`;

      const res = await aiInstance.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { temperature: 0.2 }
      });

      const contenidoGenerado = res.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return {
        tema,
        grado,
        area,
        planificacion: contenidoGenerado,
        paginaCitada,
        docCitado,
        fragmentosRAG: resultadoRAG.fragmentos
      };
    }

    // 3. Generación determinista estructurada garantizada sin IA activa
    return {
      tema,
      grado,
      area,
      planificacion: {
        competencias_especificas: `Comprende y produce textos y conceptos sobre ${tema} atendiendo a la adecuación curricular (${docCitado}, pág. ${paginaCitada}).`,
        contenidos: {
          conceptuales: `Conceptos clave y nociones fundamentales sobre ${tema}.`,
          procedimentales: `Exploración guiada, resolución y práctica con material concreto sobre ${tema}.`,
          actitudinales: `Interés, curiosidad y valoración del aprendizaje colaborativo en el aula multigrado.`
        },
        indicadores_logro: `Identifica y aplica elementos esenciales de ${tema} en situaciones cotidianas de aprendizaje (${docCitado}, pág. ${paginaCitada}).`,
        secuencia_didactica_45min: {
          inicio_10min: `Saludo, recuperación de saberes previos y presentación de la meta de aprendizaje sobre ${tema}.`,
          desarrollo_25min: `Trabajo guiado con secuencias didácticas y ejercicios diferenciados para 1.º y 2.º grado.`,
          cierre_10min: `Puesta en común, metacognición y síntesis final de lo aprendido.`
        },
        fuente_oficial: `${docCitado}, pág. ${paginaCitada}`
      },
      paginaCitada,
      docCitado,
      fragmentosRAG: resultadoRAG.fragmentos
    };
  }
}
