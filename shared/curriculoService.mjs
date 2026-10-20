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

export const STOPWORDS_CURRICULARES = new Set([
  'a', 'al', 'algo', 'algunas', 'algunos', 'ante', 'antes', 'como', 'con', 'contra',
  'cual', 'cuales', 'cuando', 'de', 'del', 'desde', 'dice', 'donde', 'durante', 'e',
  'el', 'ella', 'ellas', 'ellos', 'en', 'entre', 'era', 'erais', 'eran', 'eras',
  'eres', 'es', 'esa', 'esas', 'ese', 'eso', 'esos', 'esta', 'estaba', 'estabais',
  'estaban', 'estabas', 'estad', 'estada', 'estadas', 'estado', 'estados', 'estais',
  'estamos', 'estan', 'estando', 'estar', 'estara', 'estaran', 'estaras', 'estare',
  'estareis', 'estaremos', 'estaria', 'estariais', 'estariamos', 'estarian', 'estarias',
  'estas', 'este', 'esteis', 'estemos', 'esten', 'estes', 'esto', 'estos', 'estoy',
  'estuve', 'estuviera', 'estuvierais', 'estuvieran', 'estuvieras', 'estuvieron',
  'estuviese', 'estuvieseis', 'estuviesen', 'estuvieses', 'estuvimos', 'estuviste',
  'estuvisteis', 'estuvo', 'fue', 'fuerais', 'fueran', 'fueras', 'fueron', 'fuese',
  'fueseis', 'fuesen', 'fueses', 'fui', 'fuimos', 'fuiste', 'fuisteis', 'ha',
  'habeis', 'habia', 'habiais', 'habiamo', 'habian', 'habias', 'habida', 'habidas',
  'habido', 'habidos', 'habiendo', 'habla', 'habran', 'habras', 'habre', 'habreis',
  'habremos', 'habria', 'habriais', 'habriamos', 'habrian', 'habrias', 'hace',
  'haceis', 'hacemos', 'hacen', 'hacer', 'hacerlo', 'haces', 'hacia', 'haciendo',
  'hago', 'han', 'has', 'hasta', 'hay', 'haya', 'hayais', 'hayamos', 'hayan', 'hayas',
  'he', 'hecho', 'hemos', 'hube', 'hubiera', 'hubierais', 'hubieran', 'hubieras',
  'hubieron', 'hubiese', 'hubieseis', 'hubiesen', 'hubieses', 'hubimos', 'hubiste',
  'hubisteis', 'hubo', 'la', 'las', 'le', 'les', 'lo', 'los', 'mas', 'me', 'mi',
  'mia', 'mias', 'mio', 'mios', 'mis', 'mucho', 'muchos', 'muy', 'nada', 'ni',
  'no', 'nos', 'nosotras', 'nosotros', 'nuestra', 'nuestras', 'nuestro', 'nuestros',
  'o', 'os', 'otra', 'otras', 'otro', 'otros', 'para', 'pero', 'poco', 'por',
  'porque', 'que', 'quien', 'quienes', 'se', 'sea', 'seais', 'seamos', 'sean',
  'seas', 'segun', 'ser', 'sera', 'seran', 'seras', 'sere', 'sereis', 'seremos',
  'seria', 'seriais', 'seriamos', 'serian', 'serias', 'si', 'sido', 'siendo',
  'sin', 'sobre', 'sois', 'somos', 'son', 'soy', 'su', 'sus', 'suya', 'suyas',
  'suyo', 'suyos', 'tambien', 'tanto', 'te', 'tendra', 'tendran', 'tendras',
  'tendre', 'tendreis', 'tendremos', 'tendria', 'tendriais', 'tendriamos', 'tendrian',
  'tendrias', 'tened', 'teneis', 'tenemos', 'tenga', 'tengais', 'tengamos', 'tengan',
  'tengas', 'tengo', 'tenia', 'teniais', 'teniamos', 'tenian', 'tenias',
  'tenida', 'tenidas', 'tenido', 'tenidos', 'teniendo', 'ti', 'tiene', 'tienen',
  'tienes', 'todo', 'todos', 'trata', 'tu', 'tus', 'tuve', 'tuviera', 'tuvierais',
  'tuvieran', 'tuvieras', 'tuvieron', 'tuviese', 'tuvieseis', 'tuviesen', 'tuvieses',
  'tuvimos', 'tuviste', 'tuvisteis', 'tuvo', 'tuya', 'tuyas', 'tuyo', 'tuyos',
  'un', 'una', 'unas', 'uno', 'unos', 'vosotras', 'vosotros', 'vuestra',
  'vuestras', 'vuestro', 'vuestros', 'y', 'ya', 'yo'
]);

function normalizarTextoSinTildes(txt) {
  return (txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Limpia y extrae las palabras sustantivas de una consulta curricular para evitar
 * falsos positivos causados por el operador OR de la búsqueda de texto completo (FTS).
 * Elimina interrogativas, metadatos del currículo, nombres de áreas, grados y palabras vacías.
 *
 * @param {string} texto - Texto libre de consulta del docente
 * @param {Object} [contexto={}] - Contexto opcional { grado, area }
 * @returns {string} Consulta limpia con los términos clave sustantivos
 */
export function limpiarConsultaCurricular(texto, contexto = {}) {
  if (!texto || typeof texto !== 'string') return '';

  let norm = normalizarTextoSinTildes(texto);

  // 1. Quitar signos de puntuación e interrogación
  norm = norm.replace(/[¿?¡!.,:;()\[\]{}"'\\\/_\-]/g, ' ');

  // 2. Patrones curriculares y metadatos a remover (área, grado, sistema educativo)
  const patronesRemover = [
    // Metadatos curriculares y referencias al sistema
    /\b(curriculo oficial|curriculo|diseno curricular|adecuacion curricular|malla curricular|programa de estudio|guia didactica|con base|minerd)\b/g,
    // Áreas
    /\b(lengua espanola|lengua materna|lengua|espanol|espanola)\b/g,
    /\b(matematica|matematicas)\b/g,
    /\b(ciencias sociales|sociales)\b/g,
    /\b(ciencias de la naturaleza|ciencias naturales|naturaleza)\b/g,
    // Grados, niveles y ciclos
    /\b(primer ciclo|segundo ciclo|nivel primario|primaria|primario|secundaria|secundario|inicial|preescolar)\b/g,
    /\b(1ro|2do|3ro|4to|5to|6to|1ero|2ndo|3ero)\b/g,
    /\b(primer grado|segundo grado|tercer grado|cuarto grado|quinto grado|sexto grado)\b/g,
    /\b(primero|segundo|tercero|cuarto|quinto|sexto)\b/g,
    /\b(\d+\s*[\.°ºª]?\s*(grado)?)\b/g,
    /\bgrado\b/g,
    // Verbos de consulta / intencionales comunes
    /\b(dice|habla|trata|explica|indica|establece|menciona|muestra|contiene|presenta)\b/g,
    /\b(segun|acerca de|referente a|respecto a)\b/g
  ];

  for (const p of patronesRemover) {
    norm = norm.replace(p, ' ');
  }

  // 3. Filtrar palabras vacías (stopwords) y tokens de 1 o 2 caracteres
  const palabras = norm.split(/\s+/).filter(w => {
    if (!w || w.length <= 2) return false;
    if (STOPWORDS_CURRICULARES.has(w)) return false;
    return true;
  });

  return palabras.join(' ').trim();
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

  const temaLimpio = limpiarConsultaCurricular(temaRaw, { grado: gradoNum, area: areaCanonica }).slice(0, 150);

  // Si la consulta queda vacía tras retirar stopwords/metadatos, no se dispara la RPC para evitar falsos positivos
  if (!temaLimpio) {
    return [];
  }

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
