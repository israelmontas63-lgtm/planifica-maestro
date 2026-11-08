/**
 * shared/herramientas.mjs
 * 
 * Despachador de herramientas y formatador oficial para Gemini Function Calling.
 */

import { consultarCurriculoMINERD, buscarCurriculoOficial, ErrorCurricular } from './curriculoService.mjs';
import { ejecutarBusquedaWeb } from '../worker/services/investigadorService.js';
import { buscarCurriculoHibrido } from '../worker/services/busquedaSemantica.js';
import { gradoANumero, normalizarArea } from './catalogoCurricular.mjs';

export const UMBRAL_HIBRIDO = 0.017; // RRF k=60: exige coincidencia en texto y en vector

export const NIVELES = ['Inicial', 'Primario', 'Secundario'];
export const REQUERIDOS = ['nivel', 'grado', 'area', 'tema_o_concepto'];
export const MAX_FILAS = 5;
export const TIMEOUT_MS = 8000;

export function validarArgs(args) {
  for (const campo of REQUERIDOS) {
    if (typeof args?.[campo] !== 'string' || !args[campo].trim()) {
      return `Falta el argumento obligatorio: ${campo}`;
    }
  }
  const n = args.nivel.trim().toLowerCase();
  if (!['inicial', 'primario', 'secundario'].includes(n)) {
    return `nivel debe ser uno de: ${NIVELES.join(', ')}`;
  }
  return null;
}

export function formatearRespuestaCurricular(filas = []) {
  const filtradas = (filas ?? []).filter(f => f?.coincide_tema !== false && f?.coincide_tema !== "false");
  const recortadas = filtradas.slice(0, MAX_FILAS);
  if (recortadas.length === 0) {
    return {
      resultado: [],
      aviso: 'Sin coincidencias oficiales. No inventes contenido curricular; indica al docente que no se encontró.'
    };
  }

  const respuesta = { resultado: recortadas };
  const tienePendientes = recortadas.some(f => f.estado_validacion && f.estado_validacion !== 'validado');
  if (tienePendientes) {
    respuesta.aviso_validacion = 'Atención: parte de los contenidos recuperados están pendientes de validación oficial por experto.';
  }

  return respuesta;
}

export const HANDLERS = {
  consultar_base_datos: async (args, env, opciones = {}) => {
    const { ejecutor, signal } = opciones;

    if (typeof ejecutor === 'function') {
      const p = ejecutor(args, env);
      const filas = await Promise.race([
        p,
        new Promise((_, rej) => setTimeout(() => rej(new ErrorCurricular('TIMEOUT', 'Timeout en ejecutor')), TIMEOUT_MS))
      ]);
      return formatearRespuestaCurricular(filas);
    }

    const filas = await consultarCurriculoMINERD(args, env, { signal, timeoutMs: TIMEOUT_MS });
    const base = formatearRespuestaCurricular(filas);
    if (base.resultado.length > 0 || !(env && env.AI && env.SUPABASE_SERVICE_ROLE_KEY)) return base;
    const extra = await recuperarPorHibrida(args, env, signal);
    if (!extra.length) return base;
    const semantica = formatearRespuestaCurricular(extra);
    semantica.aviso_semantico = 'Coincidencias por similitud semántica, no por tema exacto. Dile al docente que son aproximadas y no las presentes como el tema pedido.';
    return semantica;
  },

  consultar_fuente_curricular: async (args, env) => {
    const { fuente, grado, area, termino } = args || {};
    const resultados = await buscarCurriculoOficial(env, {
      texto: termino,
      grado: grado,
      area: area,
      fuenteFiltro: fuente
    });
    return {
      total_encontrados: resultados.length,
      fragmentos: resultados.map(r => ({
        documento: r.fuente_documento,
        pagina: r.pagina,
        texto: r.texto
      }))
    };
  },

  buscar_contexto_web: async (args, env) => {
    return await ejecutarBusquedaWeb(args?.consulta, env);
  }
};

export async function ejecutarUna(call, env, opciones = {}) {
  const { name, args } = call.functionCall || call;
  const handler = HANDLERS[name];

  let response;
  if (!handler) {
    response = { error: `Herramienta no permitida: ${name}` };
  } else {
    if (name === 'consultar_base_datos') {
      const errorArgs = validarArgs(args);
      if (errorArgs) {
        return { functionResponse: { name, response: { error: errorArgs } } };
      }
    }
    try {
      response = await handler(args, env, opciones);
    } catch (e) {
      const codigo = e instanceof ErrorCurricular ? e.codigo : 'ERROR_INTERNO';
      response = { 
        error: `[${codigo}] No se pudo consultar la base de datos oficial. Informa al docente sin inventar.`,
        codigo 
      };
    }
  }
  return { functionResponse: { name, response } };
}

export async function responderLlamadas(calls, env, opciones = {}) {
  // Manejo de compatibilidad si se pasó una función ejecutor directa en lugar del objeto opciones
  const opts = typeof opciones === 'function' ? { ejecutor: opciones } : opciones;
  const parts = await Promise.all(calls.map(c => ejecutarUna(c, env, opts)));
  return { role: 'user', parts };
}

export async function recuperarPorHibrida(args, env, signal) {
  try {
    const gradoNum = gradoANumero(args.grado);
    const area = normalizarArea(args.area);
    const hits = await buscarCurriculoHibrido(env, { consulta: args.tema_o_concepto, grado: gradoNum, area, limite: 5, signal });
    if (!Array.isArray(hits) || !hits.length) return [];
    const buenos = hits.filter((h) => Number(h.score) >= UMBRAL_HIBRIDO);
    if (!buenos.length) return [];
    const ids = buenos.map((h) => encodeURIComponent(h.secuencia_id)).join(",");
    const res = await fetch(`${String(env.SUPABASE_URL).replace(/\/+$/, "")}/rest/v1/curriculo_secuencias?id=in.(${ids})&select=*`, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      signal
    });
    if (!res.ok) {
      console.warn("[Hibrida] HTTP", res.status);
      return [];
    }
    const filas = await res.json();
    return Array.isArray(filas) ? filas : [];
  } catch (e) {
    console.warn("[Hibrida] fallo:", String((e && e.message) || e).slice(0, 160));
    return [];
  }
}
