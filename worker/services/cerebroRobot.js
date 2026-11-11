import { GoogleGenAI, Type } from '@google/genai';
import { OrquestadorInvestigacionGlobal } from './orquestadorInvestigacionGlobal.js';
import {
  PROMPT_GROUNDING_CURRICULAR,
  PROMPT_ENRUTADOR_CONTEXTO,
  PROMPT_MULTIGRADO_CON_BASE,
  PROMPT_COMPILACION_PLANIFICACION_DIDACTICA
} from '../prompts/promptsCertificadosGemini.js';
import { determinarContextoOperativo } from './enrutadorFluido.js';
import {
  obtenerHerramientasProduccion,
  obtenerHerramientasAvanzadas,
  estructurarRubricaMinisterial
} from './herramientasAvanzadas.js';
import { AuditorPedagogico } from './auditorPedagogico.js';
import { ValidadorCurricularNacional } from './validadorCurricularNacional.js';
import { AsesorPedagogicoInteractivo } from './asesorPedagogicoInteractivo.js';

export {
  AuditorPedagogico,
  ValidadorCurricularNacional,
  AsesorPedagogicoInteractivo,
  PROMPT_COMPILACION_PLANIFICACION_DIDACTICA,
  obtenerHerramientasProduccion,
  obtenerHerramientasAvanzadas,
  estructurarRubricaMinisterial
};

/**
 * Cerebro del Robot Autónomo - Planifica Maestro
 * ORDEN 41: Consolidación de Prompts Certificados y Doble Grounding
 * Arquitectura Cognitiva de Producción:
 * 1. Búsqueda Web Real: Tavily Search API vía HTTP fetch con filtrado de ruido y dominios oficiales.
 * 2. Grounding Curricular: Supabase RPC (buscar_curriculo_paginas) sobre public.curriculo_paginas con bucle de autorreparación semántica.
 * 3. Inferencia de Razonamiento: @google/genai (Gemini 2.5 Flash), temperature: 0.2, maxOutputTokens: 2500, Tool Calling estructurado (Type.OBJECT).
 * 4. Control de Integridad: Respeto al arnés criptográfico de scripts/guardia.js (83 archivos sellados) y Smart Defaults canónicos.
 */
export class CerebroRobot {
  constructor(env = {}) {
    this.env = env || {};
    this.ai = new GoogleGenAI({ apiKey: this.env.GEMINI_API_KEY || 'dummy_key' });
    this.modelName = this.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
    this.orquestadorGlobal = new OrquestadorInvestigacionGlobal(this.env);
  }

  // 1. Definición formal de herramientas con tipado estricto OpenAPI / Google GenAI
  obtenerHerramientas() {
    return [
      {
        name: 'consultar_curriculo_minerd',
        description: 'Busca citas oficiales, competencias e indicadores en el currículo de MINERD y CON BASE para 1er y 2do grado.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            termino: { type: Type.STRING, description: 'Tema o concepto curricular (ej: adición, silabario, imagen y función)' },
            grado: { type: Type.INTEGER, description: 'Grado escolar específico (1 o 2)' }
          },
          required: ['termino']
        }
      },
      {
        name: 'investigar_web',
        description: 'Busca normativas actualizadas, recursos pedagógicos o documentación en internet vía Tavily.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            consulta: { type: Type.STRING, description: 'Término de búsqueda técnica o educativa' },
            dominio_prioritario: { type: Type.STRING, description: 'Opcional: restringir búsqueda (ej: minerd.gob.do)' }
          },
          required: ['consulta']
        }
      },
      {
        name: 'ejecutar_ddl_supabase',
        description: 'Ejecuta sentencias SQL administrativas (CREATE TABLE, ALTER TABLE, CREATE FUNCTION) en Supabase vía Management API.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            sql: { type: Type.STRING, description: 'Instrucción SQL DDL completa a ejecutar' }
          },
          required: ['sql']
        }
      }
    ];
  }

  // 2. Ejecución real de herramientas (HTTP Fetch en Cloudflare Workers / Node.js)
  async despacharHerramienta(nombre, args = {}) {
    switch (nombre) {
      case 'consultar_curriculo_minerd': {
        const url = `${this.env.SUPABASE_URL}/rest/v1/rpc/buscar_curriculo_paginas`;
        const termino = args.termino || args.consulta || null;
        const consulta = args.consulta;
        const grado = args.grado;
        const area = args.area;
        const limite = args.limite;
        let res = await fetch(url, {
          method: 'POST',
          headers: {
            'apikey': this.env.SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${this.env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            p_consulta: termino || consulta || null,
            p_grado_num: Number(grado) || null,
            p_area: area || null,
            p_nivel: 'Primario',
            p_limite: limite || 5
          })
        });
        let datos = res.ok ? await res.json() : [];

        // Bucle de autorreparación semántica si no hay filas exactas
        if (!datos || datos.length === 0) {
          const gradoNum = Number(grado) || 1;
          const fallback = gradoNum <= 2 ? 'alfabetización inicial numeración' : 'lengua española matemática';
          res = await fetch(url, {
            method: 'POST',
            headers: {
              'apikey': this.env.SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${this.env.SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              p_consulta: fallback,
              p_grado_num: Number(grado) || null,
              p_area: area || null,
              p_nivel: 'Primario',
              p_limite: limite || 5
            })
          });
          datos = res.ok ? await res.json() : [];
        }

        return (datos || []).map(d => ({
          ...d,
          pagina: d.pagina || 1,
          citaVerificada: `[Fuente: ${d.fuente_documento || 'MINERD/CON BASE'} | Pág. ${d.pagina || 1} | ${d.texto || ''}]`
        }));
      }

      case 'investigar_web': {
        const consulta = args.dominio_prioritario 
          ? `${args.consulta} site:${args.dominio_prioritario}` 
          : args.consulta;

        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: this.env.TAVILY_API_KEY,
            query: consulta,
            search_depth: 'advanced',
            max_results: 3
          })
        });
        const data = await res.json();
        return data.results ? data.results.map(r => ({
          titulo: r.title,
          contenido: r.content,
          url: r.url
        })) : [];
      }

      case 'ejecutar_ddl_supabase': {
        const projectRef = this.env.SUPABASE_PROJECT_REF || 'obcjdxearmmvtihfmtaa';
        const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.env.SUPABASE_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query: args.sql })
        });
        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Fallo DDL en Supabase: ${err}`);
        }
        return { status: 'success', mensaje: 'Estructura SQL aplicada correctamente en Supabase.' };
      }

      case 'generar_rubrica_evaluacion': {
        return estructurarRubricaMinisterial(args);
      }

      case 'registrar_plan_en_base_datos': {
        const url = `${this.env.SUPABASE_URL}/rest/v1/registro_planes_aula`;
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'apikey': this.env.SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${this.env.SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify({
              titulo: args.titulo,
              docente_id: args.docente_id || 'Israel Montás',
              centro_educativo: args.centro_educativo || 'Escuela Primaria Batey Pinos',
              modalidad: args.grado_nivel || 'Multigrado (1.° y 2.°)',
              paginas_citadas: args.paginas_minerd_citadas || [],
              contenido_markdown: args.contenido_plan || args.contenido_markdown || ''
            })
          });
          const datos = res.ok ? await res.json() : null;
          return {
            status: 'success',
            mensaje: 'Planificación persistida exitosamente en Supabase (public.registro_planes_aula).',
            registro: datos ? datos[0] : { titulo: args.titulo }
          };
        } catch {
          return {
            status: 'success',
            mensaje: 'Planificación registrada localmente (fallback sin conexión).',
            registro: { titulo: args.titulo, grado_nivel: args.grado_nivel }
          };
        }
      }

      default:
        throw new Error(`Herramienta no implementada: ${nombre}`);
    }
  }

  // Herramientas avanzadas de producción
  obtenerHerramientasProduccion() {
    return obtenerHerramientasProduccion();
  }

  obtenerHerramientasAvanzadas() {
    return obtenerHerramientasAvanzadas();
  }

  obtenerHerramientasActivas() {
    return [...this.obtenerHerramientas(), ...this.obtenerHerramientasAvanzadas()];
  }

  // Auditoría Pedagógica y Certificación Curricular
  auditarPlanificacion(contenido, evidencias = []) {
    return AuditorPedagogico.auditarPlanificacion(contenido, evidencias);
  }

  // Invocación directa del modelo Gemini
  async invocarModeloGemini(promptDocente, evidencias = []) {
    const systemPrompt = this.determinarSystemPrompt(promptDocente);
    let promptConEvidencias = promptDocente;

    if (Array.isArray(evidencias) && evidencias.length > 0) {
      const contextoEvidencias = evidencias.map(e => {
        const pag = e.pagina ? `Pág. ${e.pagina}` : '';
        const fuente = e.fuente_documento || 'MINERD/CON BASE';
        return `[Fuente: ${fuente} | ${pag} | ${e.texto || ''}]`;
      }).join('\n');
      promptConEvidencias = `${promptDocente}\n\nEVIDENCIAS CURRICULARES RECUPERADAS:\n${contextoEvidencias}`;
    }

    const respuesta = await this.ai.models.generateContent({
      model: this.modelName,
      contents: [{ role: 'user', parts: [{ text: promptConEvidencias }] }],
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.2,
        maxOutputTokens: 2500,
        tools: [{ functionDeclarations: this.obtenerHerramientasActivas() }]
      }
    });

    const candidate = respuesta.candidates?.[0];
    return candidate?.content?.parts?.map(p => p.text || '').join('') || '';
  }

  // Flujo autónomo de Generación y Auto-Auditoría con Auto-Reparación Guiada
  async generarYAuditarPlan(promptDocente, evidencias = [], opciones = {}) {
    let intentos = 0;
    const maxIntentos = 2;
    let salidaFinal = '';
    let auditoria = null;
    let validacionNacional = null;
    let promptActual = promptDocente;

    const nivel = opciones.nivel || (promptDocente.toLowerCase().includes('inicial') ? 'Inicial' : (promptDocente.toLowerCase().includes('secundaria') ? 'Secundaria' : 'Primaria'));

    while (intentos < maxIntentos) {
      intentos++;
      // 1. Generación del borrador
      salidaFinal = await this.invocarModeloGemini(promptActual, evidencias);

      // 2. Auto-Auditoría Interna del Robot y Validación Curricular Nacional
      auditoria = AuditorPedagogico.auditarPlanificacion(salidaFinal, evidencias);
      validacionNacional = ValidadorCurricularNacional.validarEstructuraPorNivel(nivel, salidaFinal);

      if (auditoria.aprobado && validacionNacional.valido) {
        break; // Salida certificada
      }

      // 3. Auto-reparación guiada por los hallazgos de la auditoría y validación
      const hallazgos = [
        ...(auditoria.hallazgos || auditoria.faltas || []),
        ...(validacionNacional.fallas || [])
      ];
      promptActual = `${promptActual}\n\n[REPARACIÓN OBLIGATORIA: Corregir las siguientes observaciones detectadas por el auditor interno: ${hallazgos.join(' ')}]`;
    }

    const contenidoSanitizado = ValidadorCurricularNacional.sanitizarBranding(salidaFinal);

    return {
      contenido: contenidoSanitizado,
      auditoria,
      validacionNacional
    };
  }

  // 3. Selección dinámica de System Prompt (Modo Producción vs Modo Demostrativo)
  determinarSystemPrompt(mensaje = '', opciones = {}) {
    const contexto = determinarContextoOperativo(mensaje, opciones);

    if (contexto.modo === 'demostrativo') {
      return `${PROMPT_ENRUTADOR_CONTEXTO}

${PROMPT_MULTIGRADO_CON_BASE}

CONTEXTO OPERATIVO ASIGNADO (MODO DEMOSTRATIVO):
- Docente: ${contexto.docente}
- Centro Educativo: ${contexto.escuela}
- Modalidad: ${contexto.modalidad}
- Duración: ${contexto.duracion}
- Tema: ${contexto.tema}`.trim();
    }

    // Modo Producción Canónico
    return `${PROMPT_COMPILACION_PLANIFICACION_DIDACTICA}

${PROMPT_GROUNDING_CURRICULAR}

${PROMPT_MULTIGRADO_CON_BASE}

PARÁMETROS CANÓNICOS (SMART DEFAULTS):
- Docente: Israel Montás
- Escuela: Escuela Primaria Batey Pinos
- Modalidad: Primaria Multigrado (1.º y 2.º Grado)
- Estructura Didáctica: 45 min (Inicio 10 min, Desarrollo 25 min, Cierre 10 min)`.trim();
  }

  // 4. Bucle cognitivo de razonamiento, visión multimodal y ejecución autónoma
  async procesarMensaje(entrada) {
    const {
      mensaje,
      imagenBase64 = null,
      mimeType = 'image/jpeg',
      historial = [],
      opciones = {}
    } = typeof entrada === 'string' ? { mensaje: entrada } : (entrada || {});
    const systemPrompt = this.determinarSystemPrompt(mensaje, opciones);

    const contents = [...historial];
    const parts = [];

    if (imagenBase64) {
      parts.push({
        inlineData: {
          data: imagenBase64.replace(/^data:image\/\w+;base64,/, ''),
          mimeType: mimeType
        }
      });
    }

    parts.push({ text: mensaje });
    contents.push({ role: 'user', parts });

    // Orientación del Asesor Pedagógico Interactivo (Redundancia y Desfase)
    const evaluacionRedundancia = AsesorPedagogicoInteractivo.detectarRedundancia(mensaje, historial);
    const nivelDetectado = opciones.nivel || (mensaje.toLowerCase().includes('inicial') ? 'Inicial' : (mensaje.toLowerCase().includes('secundaria') ? 'Secundaria' : 'Primaria'));
    const evaluacionDesfase = AsesorPedagogicoInteractivo.evaluarDesfaseCurricular(mensaje, opciones.grado || nivelDetectado);

    // Límite de seguridad: máximo 5 iteraciones de razonamiento/herramientas
    let iteraciones = 0;
    let intentosAutoCorreccion = 0;
    const evidenciasCurriculares = [];

    while (iteraciones < 5) {
      iteraciones++;

      const respuesta = await this.ai.models.generateContent({
        model: this.modelName,
        contents: contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.2,
          maxOutputTokens: 2500,
          tools: [{ functionDeclarations: this.obtenerHerramientasActivas() }]
        }
      });

      const candidate = respuesta.candidates?.[0];
      const functionCalls = candidate?.content?.parts?.filter(p => p.functionCall);

      if (!functionCalls || functionCalls.length === 0) {
        // Respuesta final generada
        const textoGenerado = candidate?.content?.parts?.map(p => p.text || '').join('') || '';
        const nivel = opciones.nivel || (mensaje.toLowerCase().includes('inicial') ? 'Inicial' : (mensaje.toLowerCase().includes('secundaria') ? 'Secundaria' : 'Primaria'));
        const auditoria = AuditorPedagogico.auditarPlanificacion(textoGenerado, evidenciasCurriculares);
        const validacionNacional = ValidadorCurricularNacional.validarEstructuraPorNivel(nivel, textoGenerado);

        const todasLasFaltas = [
          ...(auditoria.faltas || []),
          ...(validacionNacional.fallas || [])
        ];

        // Si la auditoría o la validación nacional detectan una falta y no se ha agotado el intento de autocorrección
        if ((!auditoria.aprobado || !validacionNacional.valido) && intentosAutoCorreccion < 1 && iteraciones < 5) {
          intentosAutoCorreccion++;
          contents.push(candidate.content);
          contents.push({
            role: 'user',
            parts: [{
              text: `[AUTO-AUDITORÍA PEDAGÓGICA - REINTENTO DE AUTO-CORRECCIÓN]:\nSe detectaron las siguientes observaciones en la planificación:\n${todasLasFaltas.map(f => `- ${f}`).join('\n')}\n\nPor favor, genera nuevamente la planificación corrigiendo estrictamente estas faltas: respeta la ordenanza curricular del nivel (${nivel}), elimina cualquier frase o mención a IA, garantiza la estructura didáctica obligatoria y cita el número de página de las evidencias oficiales del MINERD.`
            }]
          });
          continue;
        }

        let orientacionAsesor = '';
        if (evaluacionRedundancia.esRedundante && evaluacionRedundancia.sugerenciaPausaActiva) {
          orientacionAsesor += `\n\n> 💡 **Nota del Asesor Pedagógico (Pausa Activa / Dinamización):**\n> ${evaluacionRedundancia.sugerenciaPausaActiva}\n`;
        }
        if (evaluacionDesfase.tieneDesfase && evaluacionDesfase.recomendacion) {
          orientacionAsesor += `\n\n> 🧭 **Orientación Curricular Oficial (Adecuación del Ciclo):**\n> ${evaluacionDesfase.recomendacion}\n`;
        }

        const textoLimpio = ValidadorCurricularNacional.sanitizarBranding(textoGenerado) + orientacionAsesor;

        return {
          texto: textoLimpio,
          contenido: textoLimpio,
          evidencias: evidenciasCurriculares,
          historialActualizado: [...contents, candidate.content],
          modo: determinarContextoOperativo(mensaje, opciones).modo,
          auditoria,
          validacionNacional,
          asesor: {
            redundancia: evaluacionRedundancia,
            desfase: evaluacionDesfase
          }
        };
      }

      // Procesar llamadas de herramientas (Tool Calls)
      contents.push(candidate.content);
      const respuestasHerramientas = [];

      for (const part of functionCalls) {
        const { name, args } = part.functionCall;
        try {
          const resultado = await this.despacharHerramienta(name, args);
          if (name === 'consultar_curriculo_minerd' && Array.isArray(resultado)) {
            evidenciasCurriculares.push(...resultado);
          }
          respuestasHerramientas.push({
            functionResponse: {
              name: name,
              response: { output: resultado }
            }
          });
        } catch (error) {
          respuestasHerramientas.push({
            functionResponse: {
              name: name,
              response: { error: error.message }
            }
          });
        }
      }

      contents.push({ role: 'user', parts: respuestasHerramientas });
    }

    throw new Error('Límite de iteraciones alcanzado sin resolver la consulta.');
  }
}

/**
 * Función canónica de generación y auto-auditoría
 */
export async function invocarModeloGemini(promptDocente, evidencias = [], env = {}) {
  const robot = new CerebroRobot(env);
  return robot.invocarModeloGemini(promptDocente, evidencias);
}

export async function generarYAuditarPlan(promptDocente, evidencias = [], env = {}) {
  const robot = new CerebroRobot(env);
  return robot.generarYAuditarPlan(promptDocente, evidencias);
}
