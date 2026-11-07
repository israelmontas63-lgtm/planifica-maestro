import { GoogleGenAI } from '@google/genai';

/**
 * Servicio de Memoria a Largo Plazo y Caché Semántica
 * Runtime: Cloudflare Workers Edge / Node.js
 */
export class MemoriaCognitivaService {
  constructor(env) {
    this.ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    this.supabaseUrl = env.SUPABASE_URL || `https://${env.SUPABASE_PROJECT_REF || 'obcjdxearmmvtihfmtaa'}.supabase.co`;
    this.serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  }

  // 1. Convertir la consulta en vector semántico
  async generarVector(texto) {
    try {
      const response = await this.ai.models.embedContent({
        model: 'text-embedding-004',
        contents: texto
      });
      return response.embedding.values;
    } catch {
      return null;
    }
  }

  // 2. Buscar si el robot ya aprendió esta respuesta en el pasado
  async recuperarMemoriaPrevia(textoConsulta) {
    const vector = await this.generarVector(textoConsulta);
    if (!vector) return null;

    try {
      const res = await fetch(`${this.supabaseUrl}/rest/v1/rpc/consultar_memoria_robot`, {
        method: 'POST',
        headers: {
          'apikey': this.serviceKey,
          'Authorization': `Bearer ${this.serviceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_embedding: vector,
          p_umbral_similitud: 0.94,
          p_limite: 1
        })
      });

      if (!res.ok) return null;
      const coincidencias = await res.json();
      return (coincidencias && coincidencias.length > 0) ? coincidencias[0] : null;
    } catch {
      return null;
    }
  }

  // 3. Consolidar aprendizaje: Guardar lo que estuvo bien
  async consolidarAprendizaje({ grado, area, tema, planTexto, paginasCitadas, esValido }) {
    if (!esValido) return false; // Si estuvo mal, no se memoriza

    const vector = await this.generarVector(tema);
    if (!vector) return false;

    try {
      const res = await fetch(`${this.supabaseUrl}/rest/v1/robot_memoria_experiencias`, {
        method: 'POST',
        headers: {
          'apikey': this.serviceKey,
          'Authorization': `Bearer ${this.serviceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          grado_nivel: grado,
          area_curricular: area,
          tema_consulta: tema,
          embedding: vector,
          planificacion_salida: planTexto,
          paginas_minerd_citadas: paginasCitadas,
          calificacion_calidad: 5,
          validado_por_auditor: true
        })
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
