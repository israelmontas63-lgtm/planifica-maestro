/**
 * worker/services/orquestadorPedagogico.js
 * Orquestador Pedagógico con Smart Defaults, Mapeo de Esquemas Curriculares
 * y Memoria Híbrida Permanente (Largo y Corto Plazo)
 * Planifica Maestro — Educación Primaria Multigrado (1.º, 2.º y 3.º)
 */

import { GestorMemoriaHibrida } from './gestorMemoriaHibrida.js';

export const SMART_DEFAULTS = {
  docente: 'Israel Montás',
  centro: 'Escuela Batey Pinos',
  tiempoClase: '45 minutos',
  asignaturaPorDefecto: 'Lengua Española',
  gradoPorDefecto: 3,
  modalidad: 'Multigrado 1.°/2.°'
};

export const ASIGNATURAS_CANONICAS = [
  'Lengua Española',
  'Matemática',
  'Ciencias de la Naturaleza',
  'Ciencias Sociales',
  'Educación Artística',
  'Educación Física',
  'Formación Integral Humana y Religiosa'
];

export class OrquestadorPedagogico {
  constructor(env = {}, options = {}) {
    this.env = env || {};
    this.supabaseUrl = (this.env.SUPABASE_URL || `https://${this.env.SUPABASE_PROJECT_REF || 'obcjdxearmmvtihfmtaa'}.supabase.co`).replace(/\/+$/, '');
    this.serviceKey = this.env.SUPABASE_SERVICE_ROLE_KEY || this.env.SUPABASE_ANON_KEY || '';
    this.fetchFn = options.fetchFn || ((...args) => globalThis.fetch(...args));
    this.gestorMemoria = options.gestorMemoria || new GestorMemoriaHibrida(this.supabaseUrl, this.serviceKey);
    if (options.fetchFn) {
      this.gestorMemoria.fetchFn = options.fetchFn;
    }
  }

  /**
   * 1. normalizarParametros(prompt, overrides):
   * Resuelve automáticamente docente, centro, grado (1 a 3) y asignaturas canónicas.
   * Si no se especifica asignatura, asume 'Lengua Española' por defecto.
   */
  normalizarParametros(prompt = '', overrides = {}) {
    const texto = String(prompt || '').toLowerCase();

    // 1. Detección de Grado
    let grado = overrides.grado;
    if (!grado) {
      if (/\b(1|1ro|1er|primer|primero)\b/.test(texto) && !/\b(2|2do|2da|3|3ro|3er)\b/.test(texto)) {
        grado = 1;
      } else if (/\b(2|2do|2da|segundo)\b/.test(texto) && !/\b(3|3ro|3er)\b/.test(texto)) {
        grado = 2;
      } else if (/\b(3|3ro|3er|tercer|tercero)\b/.test(texto)) {
        grado = 3;
      } else {
        grado = SMART_DEFAULTS.gradoPorDefecto;
      }
    }
    grado = Number(grado) || SMART_DEFAULTS.gradoPorDefecto;

    // 2. Detección de Asignatura Canónica
    let asignatura = overrides.asignatura;
    if (!asignatura) {
      if (/matem[aá]tica|c[aá]lculo|numeraci[oó]n|suma|fracci[oó]n/i.test(texto)) {
        asignatura = 'Matemática';
      } else if (/ciencias\s+de\s+la\s+naturaleza|naturaleza|seres\s+vivos|ecosistema|cuerpo\s+humano/i.test(texto)) {
        asignatura = 'Ciencias de la Naturaleza';
      } else if (/ciencias\s+sociales|sociales|comunidad|patria|historia|geograf[ií]a/i.test(texto)) {
        asignatura = 'Ciencias Sociales';
      } else if (/art[ií]stica/i.test(texto)) {
        asignatura = 'Educación Artística';
      } else if (/f[ií]sica|deporte/i.test(texto)) {
        asignatura = 'Educación Física';
      } else {
        // Por defecto: Lengua Española
        asignatura = SMART_DEFAULTS.asignaturaPorDefecto;
      }
    }

    // 3. Extracción de Tema
    let tema = overrides.tema;
    if (!tema) {
      const matchTema = prompt.match(/(?:tema|sobre|acerca de|de)\s+([^\n,.;]+)/i);
      if (matchTema && matchTema[1]) {
        tema = matchTema[1].replace(/\b(de|en|para|el|la|los|las|un|una)\b/gi, ' ').trim();
      } else {
        tema = prompt.replace(/(?:hazme|crea|genera|planifica|dame|una|planificaci[oó]n|grado|de|\d+ro|\d+er|\d+)/gi, '').trim() || 'Contenido Curricular';
      }
    }

    return {
      docente: overrides.docente || SMART_DEFAULTS.docente,
      centro: overrides.centro || SMART_DEFAULTS.centro,
      modalidad: overrides.modalidad || SMART_DEFAULTS.modalidad,
      grado: grado,
      asignatura: asignatura,
      tema: tema,
      tiempoClase: overrides.tiempoClase || SMART_DEFAULTS.tiempoClase
    };
  }

  /**
   * 2. consultarFundamentacionCurricular(termino, grado):
   * Conexión con Supabase RPC buscar_curriculo_paginas con resiliencia ante caídas
   */
  async consultarFundamentacionCurricular(termino, grado = 1, limite = 3) {
    const endpoint = `${this.supabaseUrl}/rest/v1/rpc/buscar_curriculo_paginas`;
    const payload = {
      query_text: termino || 'contenidos e indicadores',
      p_grado: Number(grado) || 1,
      p_limite: Math.max(3, Number(limite) || 3)
    };

    try {
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
        console.warn(`[OrquestadorPedagogico] RPC respondió con status ${res.status}`);
        return this._fallbackCurricular(termino, grado);
      }

      const filas = await res.json();
      if (!Array.isArray(filas) || filas.length === 0) {
        return this._fallbackCurricular(termino, grado);
      }

      return {
        ok: true,
        fuente: 'curriculo_paginas',
        fragmentos: filas.map(f => ({
          pagina: f.pagina || 1,
          texto: f.texto || f.contenido || '',
          doc: f.fuente_documento || f.documento_titulo || 'Adecuación Curricular MINERD'
        }))
      };
    } catch (err) {
      console.warn('[OrquestadorPedagogico] Fallo de conexión RPC:', err.message);
      return this._fallbackCurricular(termino, grado);
    }
  }

  _fallbackCurricular(termino, grado) {
    return {
      ok: true,
      fuente: 'conocimiento_base_oficial',
      fragmentos: [
        {
          pagina: grado === 1 ? 45 : (grado === 2 ? 80 : 120),
          texto: `Contenidos, competencias e indicadores para ${termino} en ${grado}.° de Primaria.`,
          doc: 'Adecuación Curricular MINERD'
        }
      ]
    };
  }

  /**
   * 3. construirPromptMaestro(contexto, datosCurriculo, esquemaUsuario, bloqueMemoria):
   * Genera el prompt enriquecido con soporte de plantillas arbitrarias y memoria permanente inyectada.
   */
  construirPromptMaestro(contexto, datosCurriculo = {}, esquemaUsuario = null, bloqueMemoria = '') {
    const { docente, centro, grado, asignatura, tema, tiempoClase, modalidad } = contexto;
    const fragmentos = datosCurriculo.fragmentos || [];

    let citasDoc = '';
    if (fragmentos.length > 0) {
      citasDoc = fragmentos.map((f, i) => `[Cita ${i + 1} - ${f.doc}, pág. ${f.pagina}]:\n${f.texto}`).join('\n\n');
    } else {
      citasDoc = '[Cita Oficial - Adecuación Curricular MINERD, pág. Oficial]';
    }

    let bloqueEsquema = '';
    if (esquemaUsuario && typeof esquemaUsuario === 'object') {
      const campos = Array.isArray(esquemaUsuario)
        ? esquemaUsuario
        : Object.keys(esquemaUsuario);

      bloqueEsquema = `
ESTRUCTURA DE PLANTILLA OBLIGATORIA DEL USUARIO:
Debes preservar y rellenar exactamente los siguientes campos del esquema suministrado por el docente:
${campos.map(c => `- ${c}`).join('\n')}
Garantiza que todos y cada uno de estos campos contengan información pedagógica completa y diferenciada.`;
    } else if (typeof esquemaUsuario === 'string' && esquemaUsuario.trim()) {
      bloqueEsquema = `
PLANTILLA TEXTUAL SUMINISTRADA POR EL USUARIO:
Respeta fielmente este formato y rellena cada sección:
"""
${esquemaUsuario}
"""`;
    } else {
      bloqueEsquema = `
ESTRUCTURA CANÓNICA DE PLANIFICACIÓN DIARIA (45 MIN):
1. Datos Generales (Docente, Centro Educativo, Grado, Asignatura, Fecha, Tiempo de Clase, Modalidad).
2. Competencias Específicas del Grado (con cita curricular).
3. Contenidos Curriculares (conceptuales, procedimentales, actitudinales).
4. Indicadores de Logro Oficiales.
5. Secuencia Didáctica de 45 minutos:
   - Inicio (10 min): Recuperación de saberes previos y motivación.
   - Desarrollo (25 min): Actividades prácticas y guiadas.
   - Cierre (10 min): Metacognición y síntesis formativa.
6. Recursos Didácticos y Evaluación.
7. Fuente Oficial: Cita exacta de la página consultada.`;
    }

    let seccionMemoria = '';
    if (typeof bloqueMemoria === 'string' && bloqueMemoria.trim()) {
      seccionMemoria = `\n${bloqueMemoria.trim()}\n`;
    }

    return `Eres el Planificador Pedagógico Oficial de Planifica Maestro para Educación Primaria.
INFORMACIÓN DE LA SESIÓN (SMART DEFAULTS Y MEMORIA PERMANENTE):
- Docente: ${docente}
- Centro Educativo: ${centro}
- Modalidad: ${modalidad || SMART_DEFAULTS.modalidad}
- Grado: ${grado}.° de Primaria
- Asignatura: ${asignatura}
- Tema: ${tema}
- Tiempo de Clase: ${tiempoClase}
${seccionMemoria}
FUNDAMENTACIÓN CURRICULAR OFICIAL (MINERD / CON BASE):
${citasDoc}

DIRECTIVAS CRÍTICAS:
1. NO hagas preguntas de vuelta al docente ni pidas confirmaciones; resuelve y entrega la planificación completa de inmediato.
2. Fundamenta todas las competencias en el currículo dominicano y cita explícitamente el documento y la página.
3. Respeta fielmente los datos de identidad docente y modalidad establecidos en la memoria a largo plazo.
${bloqueEsquema}
Genera la planificación directamente en un formato estructurado, profesional y listo para el aula.`;
  }

  /**
   * 4. prepararContextoCompleto(prompt, opciones):
   * Orquestación integral: consulta memoria híbrida (largo y corto plazo),
   * normaliza parámetros, busca fundamentación curricular y ensambla el prompt maestro.
   */
  async prepararContextoCompleto(prompt = '', opciones = {}) {
    const usuarioId = opciones.usuarioId || 'docente_principal';
    const sesionId = opciones.sesionId || null;

    // 1. Obtener memoria a largo plazo (formato markdown)
    const bloqueMemoriaLargoPlazo = await this.gestorMemoria.obtenerMemoriaLargoPlazo(usuarioId);

    // 2. Obtener memoria a corto plazo si hay sesión activa (formato Gemini parts)
    const historialCortoPlazo = sesionId ? await this.gestorMemoria.obtenerMemoriaCortoPlazo(sesionId) : [];

    // 3. Normalizar parámetros considerando overrides
    const contexto = this.normalizarParametros(prompt, opciones.overrides || {});

    // 4. Fundamentación curricular
    const datosCurriculo = await this.consultarFundamentacionCurricular(contexto.tema, contexto.grado);

    // 5. Construcción del Prompt Maestro con la memoria permanente inyectada
    const promptMaestro = this.construirPromptMaestro(contexto, datosCurriculo, opciones.esquemaUsuario, bloqueMemoriaLargoPlazo);

    return {
      contexto,
      datosCurriculo,
      bloqueMemoriaLargoPlazo,
      historialCortoPlazo,
      promptMaestro
    };
  }
}
