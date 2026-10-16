/**
 * shared/curriculoService.mjs
 * 
 * Servicio Canónico de Consulta Curricular (Diseño A / Versión B de Base de Datos).
 * Invoca la función SQL public.buscar_curriculo mediante Supabase PostgREST RPC.
 * Provee tipado de errores (ErrorCurricular), cancelación con AbortController y normalización.
 */

import { gradoANumero, normalizarArea, NIVELES } from './catalogoCurricular.mjs';

export class ErrorCurricular extends Error {
  constructor(codigo, mensaje, detalles = null) {
    super(mensaje);
    this.name = 'ErrorCurricular';
    this.codigo = codigo; // 'CONFIG' | 'ENTRADA_INVALIDA' | 'RED' | 'TIMEOUT' | 'HTTP_<n>' | 'RESPUESTA_INVALIDA'
    this.detalles = detalles;
  }
}

/**
 * Consulta el currículo oficial en Supabase mediante la función RPC buscar_curriculo.
 * 
 * @param {Object} args - { nivel, grado, area, tema_o_concepto, limite }
 * @param {Object} [env={}] - { SUPABASE_URL, SUPABASE_ANON_KEY }
 * @param {Object} [opciones={}] - { signal, timeoutMs }
 * @returns {Promise<Array>} Lista de registros oficiales con coincidencia de tema
 */
export async function consultarCurriculoMINERD(args, env = {}, opciones = {}) {
  const { nivel: nivelRaw, grado: gradoRaw, area: areaRaw, tema_o_concepto: temaRaw, limite = 5 } = args || {};

  // 1. Obtención segura de credenciales
  const supabaseUrl = env?.SUPABASE_URL || (typeof process !== 'undefined' ? process.env?.SUPABASE_URL : null);
  const anonKey = env?.SUPABASE_ANON_KEY || (typeof process !== 'undefined' ? process.env?.SUPABASE_ANON_KEY : null);

  if (!supabaseUrl || !anonKey) {
    throw new ErrorCurricular('CONFIG', 'Credenciales de Supabase no configuradas en el entorno.');
  }

  // 2. Normalización y validación estricta de entradas
  if (!nivelRaw || typeof nivelRaw !== 'string') {
    throw new ErrorCurricular('ENTRADA_INVALIDA', 'El nivel curricular es obligatorio.');
  }

  const nivelNorm = nivelRaw.trim().toLowerCase();
  let nivelCanonica = null;
  if (nivelNorm === 'primario' || nivelNorm === 'primaria') nivelCanonica = 'Primario';
  else if (nivelNorm === 'inicial') nivelCanonica = 'Inicial';
  else if (nivelNorm === 'secundario' || nivelNorm === 'secundaria') nivelCanonica = 'Secundario';
  else {
    throw new ErrorCurricular('ENTRADA_INVALIDA', `Nivel '${nivelRaw}' no permitido. Debe ser Inicial, Primario o Secundario.`);
  }

  const gradoNum = gradoANumero(gradoRaw);
  if (gradoNum === null) {
    throw new ErrorCurricular('ENTRADA_INVALIDA', `Grado '${gradoRaw}' no reconocido como grado válido (1..6).`);
  }

  let areaCanonica;
  try {
    areaCanonica = normalizarArea(areaRaw);
  } catch (err) {
    throw new ErrorCurricular('ENTRADA_INVALIDA', err.message);
  }

  const temaLimpio = (temaRaw || '').toString().trim().slice(0, 150);

  // 3. Preparación de endpoint y señal de cancelación
  const baseUrl = supabaseUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/rest/v1/rpc/buscar_curriculo`;

  const timeoutMs = opciones.timeoutMs || 8000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);

  // Vincular con signal externo si se proporciona
  if (opciones.signal) {
    opciones.signal.addEventListener('abort', () => controller.abort(opciones.signal.reason));
  }

  try {
    let res = await fetch(`${baseUrl}/rest/v1/rpc/buscar_curriculo_secuencias`, {
      method: 'POST',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        p_nivel: nivelCanonica,
        p_grado: gradoNum,
        p_area: areaCanonica,
        p_consulta: temaLimpio,
        p_limite: Math.min(Math.max(limite, 1), 5)
      }),
      signal: controller.signal
    });

    // Fallback a nombre histórico / alternativo si buscar_curriculo_secuencias no existe
    if (!res.ok && res.status === 404) {
      res = await fetch(`${baseUrl}/rest/v1/rpc/buscar_curriculo`, {
        method: 'POST',
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          p_nivel: nivelCanonica,
          p_grado: gradoNum,
          p_area: areaCanonica,
          p_consulta: temaLimpio,
          p_limite: Math.min(Math.max(limite, 1), 5)
        }),
        signal: controller.signal
      });
    }

    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new ErrorCurricular(`HTTP_${res.status}`, `Error HTTP en consulta curricular (${res.status}): ${errText.slice(0, 100)}`);
    }

    const data = await res.json();
    if (!Array.isArray(data)) {
      throw new ErrorCurricular('RESPUESTA_INVALIDA', 'Supabase devolvió un formato de datos no esperado.');
    }

    return data;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError' || err.message === 'timeout') {
      throw new ErrorCurricular('TIMEOUT', 'La consulta a la base de datos excedió el límite de 8 segundos.');
    }
    if (err instanceof ErrorCurricular) {
      throw err;
    }
    throw new ErrorCurricular('RED', `Fallo de conexión de red con el repositorio curricular: ${err.message}`);
  }
}
