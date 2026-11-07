import { GoogleGenAI, Type } from '@google/genai';
import * as asistenteService from './asistenteService.js';

export { asistenteService };

/**
 * Orquestador de Investigación Global y Grounding Antialucinación
 * Estándar de Ejecución: Planifica Maestro (Node.js / Cloudflare Workers)
 */
export class OrquestadorInvestigacionGlobal {
  constructor(env = {}, options = {}) {
    this.env = env || {};
    this.ai = new GoogleGenAI({ apiKey: (this.env && this.env.GEMINI_API_KEY) || '' });
    this.supabaseUrl = (this.env && this.env.SUPABASE_URL) || `https://${(this.env && this.env.SUPABASE_PROJECT_REF) || 'obcjdxearmmvtihfmtaa'}.supabase.co`;
    this.serviceKey = this.env && this.env.SUPABASE_SERVICE_ROLE_KEY;
    this.tavilyKey = this.env && this.env.TAVILY_API_KEY; // Motor de búsqueda web profesional
    this.fetchFn = options?.fetchFn || globalThis.fetch;
  }

  // 1. Declaración Formal de Herramientas OpenAPI / Google GenAI
  obtenerHerramientasSistema() {
    return [{
      functionDeclarations: [
        {
          name: 'consultar_curriculo_minerd',
          description: 'Busca competencias, contenidos e indicadores oficiales en las 500 páginas de Primaria en Supabase.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              termino: { type: Type.STRING, description: 'Concepto curricular específico o área troncal' },
              grado: { type: Type.INTEGER, description: 'Grado primario (1 a 3)' }
            },
            required: ['termino', 'grado']
          }
        },
        {
          name: 'investigar_web_global',
          description: 'Ejecuta búsqueda en tiempo real en la web abierta en cualquier idioma sin filtros corporativos de contenido.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              consulta: { type: Type.STRING, description: 'Término de búsqueda optimizado para la web' },
              dominio_prioritario: { type: Type.STRING, description: 'Opcional: restringir a un dominio específico (ej. educando.edu.do)' }
            },
            required: ['consulta']
          }
        }
      ]
    }];
  }

  // 2. Ejecutor de Búsqueda Web Global sin Restricciones
  async ejecutarBusquedaWeb(consulta, dominio = null) {
    if (!this.tavilyKey) {
      return [{ fuente: 'Web Fallback', fragmento: 'Búsqueda web no configurada; operando con RAG local.' }];
    }

    try {
      const q = dominio ? `${consulta} site:${dominio}` : consulta;
      const fetcher = this.fetchFn || globalThis.fetch;
      const res = await fetcher('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: this.tavilyKey,
          query: q,
          search_depth: 'advanced',
          include_raw_content: false,
          max_results: 4
        })
      });

      if (!res.ok) return [];
      const datos = await res.json();
      
      // Filtro de ruido: extrae únicamente URL y extractos de peso real
      return (datos.results || []).map(r => ({
        fuente: r.url,
        titulo: r.title,
        fragmento: r.content
      }));
    } catch {
      return [];
    }
  }

  // 3. Ejecutor Curricular Supabase con Bucle de Autorreparación
  async ejecutarConsultaCurricular(termino, grado) {
    const endpoint = `${this.supabaseUrl}/rest/v1/rpc/buscar_curriculo_paginas`;
    const fetcher = this.fetchFn || globalThis.fetch;
    try {
      let res = await fetcher(endpoint, {
        method: 'POST',
        headers: {
          'apikey': this.serviceKey,
          'Authorization': `Bearer ${this.serviceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query_text: termino, p_grado: grado, p_limite: 3 })
      });

      let datos = res.ok ? await res.json() : [];

      // Autorreparación semántica inmediata si no hay coincidencia exacta
      if (!datos || datos.length === 0) {
        const fallback = grado <= 2 ? 'alfabetización inicial numeración' : 'lengua española matemática';
        res = await fetcher(endpoint, {
          method: 'POST',
          headers: {
            'apikey': this.serviceKey,
            'Authorization': `Bearer ${this.serviceKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query_text: fallback, p_grado: grado, p_limite: 3 })
        });
        datos = res.ok ? await res.json() : [];
      }

      return datos || [];
    } catch {
      return [];
    }
  }

  // 4. Inferencia con Grounding Forzado (Arquitectura Real Gemini)
  async generarRespuestaVerificada(promptDocente) {
    // Inferencia de parámetros canónicos (Smart Defaults)
    const grado = promptDocente.includes('2') ? 2 : 1;
    const terminoBusqueda = promptDocente.includes('matemática') ? 'numeración y adición' : 'comprensión y producción escrita';

    // Recuperación paralela de evidencias reales
    const [curriculo, web] = await Promise.all([
      this.ejecutarConsultaCurricular(terminoBusqueda, grado),
      this.ejecutarBusquedaWeb(terminoBusqueda, 'gob.do')
    ]);

    const evidenciasCurriculo = curriculo.map(c => `[MINERD Pág. ${c.pagina} - ${c.fuente_documento}]: ${c.texto}`).join('\n\n');
    const evidenciasWeb = web.map(w => `[Web Oficial: ${w.fuente}]: ${w.fragmento}`).join('\n\n');

    const systemPrompt = `
Eres el Núcleo Cognitivo de Planifica Maestro, operando con la metodología analítica, rigor y postura de Gemini.

PROTOCOLO INVIOLABLE DE GROUNDING:
1. METADATOS DOCENTES ASUMIDOS:
   - Docente: Israel Montás
   - Centro Educativo: Escuela Primaria Batey Pinos
   - Modalidad: Primaria Multigrado (1.º y 2.º Grado)
   - Tiempo de bloque: 45 minutos
2. PROHIBICIÓN TOTAL DE ALUCINACIÓN:
   - Solo puedes emitir afirmaciones, competencias e indicadores que estén respaldados en las EVIDENCIAS DOCUMENTALES provistas a continuación.
   - Cita textualmente la fuente y el número de página oficial en cada sección.
3. EVIDENCIAS RECUPERADAS EN TIEMPO REAL:
${evidenciasCurriculo || 'Sin datos locales.'}

${evidenciasWeb || 'Sin datos web adicionales.'}

4. FORMATO DIDÁCTICO EN TRES TIEMPOS (45 MINUTOS):
   - INICIO (10 min): Exploración de conocimientos previos y activación motivacional ligada al contexto rural/escolar de Batey Pinos.
   - DESARROLLO (25 min): Actividades prácticas diferenciadas para 1.º y 2.º grado, modelado docente y ejercitación concreta.
   - CIERRE (10 min): Metacognición colectiva y evaluación formativa con evidencia verificable.
5. ESTILO DE EMISIÓN:
   - Entrega directamente la tabla o secuencia terminada en la primera línea. Prohibido saludar o incluir preámbulos vacíos.
`.trim();

    const respuesta = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: promptDocente,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.2, // Rigor matemático
        maxOutputTokens: 2500
      }
    });

    return respuesta.text;
  }

  // Alias compatible
  async procesarSolicitudCompleta(promptUsuario) {
    return this.generarRespuestaVerificada(promptUsuario);
  }
}

/**
 * Canal de resolución para consultas abiertas e investigaciones complejas (Bridged)
 */
export async function resolverInvestigacionGlobal(solicitud, env = {}) {
  const orquestador = new OrquestadorInvestigacionGlobal(env);
  return orquestador.procesarSolicitudCompleta(solicitud);
}
