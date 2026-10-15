/**
 * shared/herramientas.mjs
 * 
 * Despachador de herramientas y formatador oficial para Gemini Function Calling.
 */

import { consultarCurriculoMINERD, ErrorCurricular } from './curriculoService.mjs';

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
  const recortadas = (filas ?? []).slice(0, MAX_FILAS);
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
    return formatearRespuestaCurricular(filas);
  }
};

export async function ejecutarUna(call, env, opciones = {}) {
  const { name, args } = call.functionCall || call;
  const handler = HANDLERS[name];

  let response;
  if (!handler) {
    response = { error: `Herramienta no permitida: ${name}` };
  } else {
    const errorArgs = validarArgs(args);
    if (errorArgs) {
      response = { error: errorArgs };
    } else {
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
  }
  return { functionResponse: { name, response } };
}

export async function responderLlamadas(calls, env, opciones = {}) {
  // Manejo de compatibilidad si se pasó una función ejecutor directa en lugar del objeto opciones
  const opts = typeof opciones === 'function' ? { ejecutor: opciones } : opciones;
  const parts = await Promise.all(calls.map(c => ejecutarUna(c, env, opts)));
  return { role: 'user', parts };
}
