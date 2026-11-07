/**
 * Gestor de Memoria Híbrida (Corto y Largo Plazo)
 * Entorno: Cloudflare Workers Edge / Node.js
 */
export class GestorMemoriaHibrida {
  constructor(supabaseUrl, serviceRoleKey) {
    if (typeof supabaseUrl === 'object' && supabaseUrl !== null) {
      const env = supabaseUrl;
      this.url = (env.SUPABASE_URL || `https://${env.SUPABASE_PROJECT_REF || 'obcjdxearmmvtihfmtaa'}.supabase.co`).replace(/\/+$/, '');
      this.key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || '';
      this.fetchFn = serviceRoleKey?.fetchFn || ((...args) => globalThis.fetch(...args));
    } else {
      this.url = (supabaseUrl || '').replace(/\/+$/, '');
      this.key = serviceRoleKey || '';
      this.fetchFn = (...args) => globalThis.fetch(...args);
    }
  }

  // 1. Cargar Memoria a Largo Plazo (Perfil permanente)
  async obtenerMemoriaLargoPlazo(usuarioId = 'docente_principal') {
    const endpoint = `${this.url}/rest/v1/docente_memoria_largo_plazo?usuario_id=eq.${encodeURIComponent(usuarioId)}&select=categoria,clave,valor`;
    try {
      const res = await this.fetchFn(endpoint, {
        headers: {
          'apikey': this.key,
          'Authorization': `Bearer ${this.key}`
        }
      });
      if (!res.ok) return this._fallbackMemoriaLargoPlazo();

      const hechos = await res.json();
      if (!hechos || hechos.length === 0) return this._fallbackMemoriaLargoPlazo();

      let bloqueMemoria = '### MEMORIA PERMANENTE DEL DOCENTE:\n';
      for (const h of hechos) {
        bloqueMemoria += `- [${h.categoria}] ${h.clave}: ${h.valor}\n`;
      }
      return bloqueMemoria;
    } catch {
      return this._fallbackMemoriaLargoPlazo();
    }
  }

  _fallbackMemoriaLargoPlazo() {
    return `### MEMORIA PERMANENTE DEL DOCENTE:
- [perfil] nombre_docente: Israel Montás
- [aula] centro_educativo: Escuela Primaria Batey Pinos
- [aula] modalidad: Multigrado (1.º y 2.º de Primaria)
- [regla_planificacion] tiempo_bloque: 45 minutos por sesión
- [regla_planificacion] enfoque_oficial: Adecuación Curricular MINERD y CON BASE\n`;
  }

  // 2. Guardar o actualizar un hecho a largo plazo
  async aprenderHecho(categoria, clave, valor, usuarioId = 'docente_principal') {
    const endpoint = `${this.url}/rest/v1/docente_memoria_largo_plazo`;
    try {
      const res = await this.fetchFn(endpoint, {
        method: 'POST',
        headers: {
          'apikey': this.key,
          'Authorization': `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          usuario_id: usuarioId,
          categoria,
          clave,
          valor: String(valor),
          actualizado_en: new Date().toISOString()
        })
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // 3. Cargar Memoria a Corto Plazo (Últimos mensajes de la sesión)
  async obtenerMemoriaCortoPlazo(sesionId, limite = 6) {
    if (!sesionId) return [];
    const endpoint = `${this.url}/rest/v1/conversaciones_mensajes?sesion_id=eq.${encodeURIComponent(sesionId)}&order=creado_en.asc&limit=${limite}`;
    try {
      const res = await this.fetchFn(endpoint, {
        headers: {
          'apikey': this.key,
          'Authorization': `Bearer ${this.key}`
        }
      });
      if (!res.ok) return [];
      const filas = await res.json();
      return filas.map(f => ({
        role: f.rol === 'model' ? 'model' : 'user',
        parts: [{ text: f.contenido }]
      }));
    } catch {
      return [];
    }
  }

  // 4. Extracción de hechos en segundo plano (Consolidación de RAM a Disco)
  async extraerYConsolidarHechos(textoMensaje = '', usuarioId = 'docente_principal') {
    if (!textoMensaje || typeof textoMensaje !== 'string') return [];
    const texto = textoMensaje.trim();
    const hechosExtraidos = [];

    // Reglas semánticas deterministas de extracción continua:
    // A. Preferencias docentes
    if (/prefiero\s+(usar|trabajar|que)?\s*([^.,;\n]+)/i.test(texto)) {
      const m = texto.match(/prefiero\s+(?:usar|trabajar|que)?\s*([^.,;\n]+)/i);
      if (m && m[1]) {
        hechosExtraidos.push({
          categoria: 'preferencia',
          clave: 'preferencia_didactica',
          valor: m[1].trim()
        });
      }
    } else if (/no\s+me\s+gusta\s+([^.,;\n]+)/i.test(texto)) {
      const m = texto.match(/no\s+me\s+gusta\s+([^.,;\n]+)/i);
      if (m && m[1]) {
        hechosExtraidos.push({
          categoria: 'preferencia',
          clave: 'formato_evitado',
          valor: `Evitar ${m[1].trim()}`
        });
      }
    }

    // B. Condiciones del Aula / Entorno
    if (/(?:en\s+)?mi\s+aula\s+(no\s+tiene|cuenta\s+con|tiene)\s+([^.,;\n]+)/i.test(texto)) {
      const m = texto.match(/(?:en\s+)?mi\s+aula\s+(no\s+tiene|cuenta\s+con|tiene)\s+([^.,;\n]+)/i);
      if (m && m[2]) {
        const estado = m[1].toLowerCase().includes('no') ? 'Sin' : 'Con';
        hechosExtraidos.push({
          categoria: 'aula',
          clave: 'recursos_aula',
          valor: `${estado} ${m[2].trim()}`
        });
      }
    }

    // C. Reglas de Planificación
    if (/(?:clases?|sesi[oó]n|tiempo)\s+(?:debe\s+ser|duran?|siempre\s+de)\s+([^.,;\n]+)/i.test(texto)) {
      const m = texto.match(/(?:clases?|sesi[oó]n|tiempo)\s+(?:debe\s+ser|duran?|siempre\s+de)\s+([^.,;\n]+)/i);
      if (m && m[1]) {
        hechosExtraidos.push({
          categoria: 'regla_planificacion',
          clave: 'duracion_bloque',
          valor: m[1].trim()
        });
      }
    }

    // D. Proyectos de Aula / Centro
    if (/(?:estamos\s+trabajando|nuestro\s+proyecto\s+es|proyecto\s+de)\s+([^.,;\n]+)/i.test(texto)) {
      const m = texto.match(/(?:estamos\s+trabajando|nuestro\s+proyecto\s+es|proyecto\s+de)\s+([^.,;\n]+)/i);
      if (m && m[1]) {
        hechosExtraidos.push({
          categoria: 'proyecto',
          clave: 'proyecto_activo',
          valor: m[1].trim()
        });
      }
    }

    // Persistir todos los hechos extraídos en Supabase en segundo plano
    if (hechosExtraidos.length > 0) {
      await Promise.allSettled(
        hechosExtraidos.map(h => this.aprenderHecho(h.categoria, h.clave, h.valor, usuarioId))
      );
    }

    return hechosExtraidos;
  }
}
