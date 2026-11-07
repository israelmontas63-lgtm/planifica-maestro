/**
 * Gestor de Memoria Episódica y Experiencias Curriculares
 * Runtime: Cloudflare Workers (V8 JavaScript) / Node.js
 * 
 * Gestiona la persistencia y recuperación semántica de experiencias docentes
 * exitosas utilizando pgvector en Supabase y embeddings de text-embedding-004.
 */

export class GestorMemoriaExperiencias {
  constructor(env = {}) {
    this.env = env;
    this.supabaseUrl = (env.SUPABASE_URL || '').replace(/\/+$/, '');
    this.supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || '';
  }

  /**
   * Consulta la memoria episódica utilizando la función RPC vectorial consultar_memoria_robot.
   * Retorna coincidencias con similitud de coseno superior al umbral establecido.
   */
  async consultarExperiencias({ embedding, umbralSimilitud = 0.92, limite = 1 }) {
    if (!this.supabaseUrl || !this.supabaseKey || !embedding) {
      return [];
    }

    const endpoint = `${this.supabaseUrl}/rest/v1/rpc/consultar_memoria_robot`;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_embedding: typeof embedding === 'string' ? embedding : `[${embedding.join(',')}]`,
          p_umbral_similitud: umbralSimilitud,
          p_limite: limite
        })
      });

      if (!res.ok) {
        console.warn(`[MemoriaExperiencias] RPC status: ${res.status}`);
        return [];
      }

      const datos = await res.json();
      return Array.isArray(datos) ? datos : [];
    } catch (err) {
      console.warn('[MemoriaExperiencias] Error al consultar:', err.message);
      return [];
    }
  }

  /**
   * Registra una experiencia de planificación validada en la tabla robot_memoria_experiencias.
   */
  async guardarExperiencia({
    docenteId = 'Israel Montás',
    gradoNivel,
    areaCurricular,
    temaConsulta,
    embedding = null,
    planificacionSalida,
    paginasMinerdCitadas = [],
    calificacionCalidad = 5,
    validadoPorAuditor = true
  }) {
    if (!this.supabaseUrl || !this.supabaseKey || !planificacionSalida) {
      return { exito: false, motivo: 'Configuración o datos incompletos' };
    }

    const endpoint = `${this.supabaseUrl}/rest/v1/robot_memoria_experiencias`;
    const payload = {
      docente_id: docenteId,
      grado_nivel: gradoNivel,
      area_curricular: areaCurricular,
      tema_consulta: temaConsulta,
      planificacion_salida: planificacionSalida,
      paginas_minerd_citadas: paginasMinerdCitadas,
      calificacion_calidad: calificacionCalidad,
      validado_por_auditor: validadoPorAuditor
    };

    if (embedding) {
      payload.embedding = typeof embedding === 'string' ? embedding : `[${embedding.join(',')}]`;
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorDetalle = await res.text();
        return { exito: false, status: res.status, error: errorDetalle };
      }

      const guardado = await res.json();
      return {
        exito: true,
        registro: Array.isArray(guardado) ? guardado[0] : guardado
      };
    } catch (err) {
      return { exito: false, error: err.message };
    }
  }
}
