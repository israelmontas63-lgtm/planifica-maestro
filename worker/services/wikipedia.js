/**
 * worker/services/wikipedia.js
 * Servicio de Consulta a Wikipedia para Planifica Maestro
 * 
 * Uso Exclusivo: Complemento conceptual para explicaciones y definiciones de temas.
 * Prohibido: Competencias, indicadores de logro, ordenanzas, contenidos oficiales,
 *             efemérides o calendario escolar.
 * 
 * Reglas de Seguridad y Licencia:
 * - Solo HTTPS hacia es.wikipedia.org
 * - Atribución obligatoria CC BY-SA 4.0 con enlace y número de revisión
 * - Timeout estricto de 5 segundos con AbortController
 * - Presupuesto: máximo 3 resultados y 2 peticiones HTTP por consulta
 * - Caché de 7 días sin datos personales
 * - Límite de uso por docente en servidor
 */

const WIKIPEDIA_HOST = "es.wikipedia.org";
export const DEFAULT_CONTACT_EMAIL = "israelmontas65@gmail.com";
export const DEFAULT_BOT_URL = "https://planifica-maestro.israelmontas65.workers.dev";

export function getWikipediaUserAgent(env = {}) {
  const contacto = env?.BOT_CONTACT_EMAIL || DEFAULT_CONTACT_EMAIL;
  return `PlanificaMaestro-Bot/1.0 (+${DEFAULT_BOT_URL}; contacto: ${contacto})`;
}
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días en milisegundos
const TIMEOUT_MS = 5000; // 5 segundos

// Palabras y conceptos estrictamente prohibidos para Wikipedia
const PATRON_PROHIBIDO = /\b(indicador(?:es)?(?:\s+de\s+logro)?|competencia(?:s)?(?:\s+(?:espec[ií]fica|fundamental)(?:s)?)?|ordenanza(?:s)?|calendario\s+escolar|efem[eé]ride(?:s)?|normativa(?:s)?|dise[ñn]o\s+curricular|adecuaci[oó]n\s+curricular|con\s+base)\b/i;

// Caché en memoria (clave: consulta/título normalizado -> { data, expiraAt })
const cacheWikipedia = new Map();

// Rate limit por docente en memoria (docenteId -> { count, resetAt })
const rateLimitDocentes = new Map();
const RATE_LIMIT_MAX = 15; // máx 15 consultas por minuto por docente
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minuto

/**
 * Verifica si la URL pertenece estrictamente a es.wikipedia.org vía HTTPS
 */
export function verificarUrlSegura(urlStr) {
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === "https:" && parsed.hostname === WIKIPEDIA_HOST;
  } catch {
    return false;
  }
}

/**
 * Valida si la consulta es permitida según las reglas curriculares del proyecto
 */
export function validarConsultaPermitida(consulta) {
  if (!consulta || typeof consulta !== "string") {
    return { permitida: false, razon: "Consulta vacía o inválida." };
  }

  if (PATRON_PROHIBIDO.test(consulta)) {
    return {
      permitida: false,
      razon: "Wikipedia no es una fuente oficial del MINERD. Para competencias, indicadores, ordenanzas, contenidos o calendario escolar debe consultarse exclusivamente la base oficial curricular.",
    };
  }

  return { permitida: true };
}

/**
 * Comprueba y actualiza el límite de tasa por docente en el servidor
 */
export function verificarRateLimitDocente(docenteId) {
  if (!docenteId) return true; // Si no hay ID, se permite con prudencia
  const ahora = Date.now();
  const registro = rateLimitDocentes.get(docenteId);

  if (!registro || ahora > registro.resetAt) {
    rateLimitDocentes.set(docenteId, { count: 1, resetAt: ahora + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (registro.count >= RATE_LIMIT_MAX) {
    return false;
  }

  registro.count++;
  return true;
}

/**
 * Sanitiza un texto proveniente de Wikipedia para neutralizar inyecciones de prompt
 * Trata el texto estrictamente como DATO
 */
export function sanitizarTextoComoDato(texto) {
  if (!texto || typeof texto !== "string") return "";
  return texto
    .replace(/<[^>]*>/g, "") // Eliminar etiquetas HTML
    .replace(/(?:system\s*instruction|ignore\s*previous\s*instructions|instrucci[oó]n\s*del\s*sistema)/gi, "[texto neutralizado]")
    .trim();
}

/**
 * 1. Búsqueda de artículos en Wikipedia en español
 * Presupuesto: máximo 3 resultados, 1 petición HTTP, timeout 5s
 */
export async function buscarWikipedia(consulta, { signal, docenteId, env } = {}) {
  const validacion = validarConsultaPermitida(consulta);
  if (!validacion.permitida) {
    return { exito: false, error: validacion.razon, tipo: "consulta_prohibida" };
  }

  if (!verificarRateLimitDocente(docenteId)) {
    return { exito: false, error: "Límite de consultas a Wikipedia superado por este minuto.", tipo: "rate_limit" };
  }

  const queryLimpia = consulta.trim();
  const cacheKey = `search:${queryLimpia.toLowerCase()}`;
  const enCache = cacheWikipedia.get(cacheKey);
  if (enCache && Date.now() < enCache.expiraAt) {
    return { exito: true, desdeCache: true, resultados: enCache.data };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const combinedSignal = signal ? anySignal([signal, controller.signal]) : controller.signal;

  try {
    const url = `https://${WIKIPEDIA_HOST}/w/rest.php/v1/search/page?q=${encodeURIComponent(queryLimpia)}&limit=3`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": getWikipediaUserAgent(env),
        "Accept": "application/json",
      },
      signal: combinedSignal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return { exito: false, error: `Error de búsqueda en Wikipedia (${res.status})`, tipo: "http_error" };
    }

    // Verificar que la URL de respuesta no haya sido redirigida fuera de es.wikipedia.org
    if (!verificarUrlSegura(res.url)) {
      return { exito: false, error: "Redirección no autorizada fuera de es.wikipedia.org", tipo: "seguridad" };
    }

    const data = await res.json();
    const resultados = (data.pages || []).slice(0, 3).map((p) => ({
      id: p.id,
      titulo: p.title,
      clave: p.key,
      descripcion: p.description || "",
      extracto: sanitizarTextoComoDato(p.excerpt || ""),
    }));

    // Guardar en caché 7 días (sin datos personales)
    cacheWikipedia.set(cacheKey, { data: resultados, expiraAt: Date.now() + CACHE_TTL_MS });

    return { exito: true, desdeCache: false, resultados };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      return { exito: false, error: "Tiempo de espera agotado (5s) al consultar Wikipedia.", tipo: "timeout" };
    }
    return { exito: false, error: err.message, tipo: "error" };
  }
}

/**
 * 2. Obtención de resumen de página en Wikipedia
 * Presupuesto: 1 petición HTTP, timeout 5s
 */
export async function obtenerResumen(titulo, { signal, docenteId, env } = {}) {
  const validacion = validarConsultaPermitida(titulo);
  if (!validacion.permitida) {
    return { exito: false, error: validacion.razon, tipo: "consulta_prohibida" };
  }

  if (!verificarRateLimitDocente(docenteId)) {
    return { exito: false, error: "Límite de consultas a Wikipedia superado por este minuto.", tipo: "rate_limit" };
  }

  const tituloLimpio = titulo.trim();
  const cacheKey = `summary:${tituloLimpio.toLowerCase()}`;
  const enCache = cacheWikipedia.get(cacheKey);
  if (enCache && Date.now() < enCache.expiraAt) {
    return { exito: true, desdeCache: true, resumen: enCache.data };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const combinedSignal = signal ? anySignal([signal, controller.signal]) : controller.signal;

  try {
    const url = `https://${WIKIPEDIA_HOST}/api/rest_v1/page/summary/${encodeURIComponent(tituloLimpio)}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": getWikipediaUserAgent(env),
        "Accept": "application/json",
      },
      signal: combinedSignal,
    });

    clearTimeout(timeoutId);

    if (res.status === 404) {
      return { exito: false, error: `El artículo "${tituloLimpio}" no existe en Wikipedia en español.`, tipo: "no_encontrado" };
    }

    if (!res.ok) {
      return { exito: false, error: `Error en Wikipedia (${res.status})`, tipo: "http_error" };
    }

    if (!verificarUrlSegura(res.url)) {
      return { exito: false, error: "Redirección no autorizada fuera de es.wikipedia.org", tipo: "seguridad" };
    }

    const data = await res.json();

    // Manejo de desambiguación
    if (data.type === "disambiguation") {
      return {
        exito: true,
        tipo: "desambiguacion",
        titulo: data.title,
        descripcion: data.description || "Página de desambiguación",
        url: data.content_urls?.desktop?.page || `https://${WIKIPEDIA_HOST}/wiki/${encodeURIComponent(data.title)}`,
        mensaje: `El término "${data.title}" tiene múltiples acepciones en Wikipedia. Por favor especifica el tema pedagógico concreto.`,
      };
    }

    const extractoSanitizado = sanitizarTextoComoDato(data.extract || "");
    // Extracto corto (máximo 400 caracteres parafraseados pedagógicamente)
    const extractoCorte = extractoSanitizado.length > 400 
      ? extractoSanitizado.slice(0, 400).trim() + "…" 
      : extractoSanitizado;

    const resumen = {
      titulo: data.title,
      descripcion: data.description || "",
      extracto: extractoCorte,
      revision: data.revision ? String(data.revision) : "desconocida",
      url: data.content_urls?.desktop?.page || `https://${WIKIPEDIA_HOST}/wiki/${encodeURIComponent(data.title)}`,
      tipo: data.type || "standard",
    };

    cacheWikipedia.set(cacheKey, { data: resumen, expiraAt: Date.now() + CACHE_TTL_MS });

    return { exito: true, desdeCache: false, resumen };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      return { exito: false, error: "Tiempo de espera agotado (5s) al consultar Wikipedia.", tipo: "timeout" };
    }
    return { exito: false, error: err.message, tipo: "error" };
  }
}

/**
 * 3. Función de alto nivel: consultarWikipediaConceptual
 * Ejecuta búsqueda y resumen con un presupuesto estricto de máximo 2 peticiones HTTP.
 * Formatea el texto con el etiquetado y la licencia obligatoria CC BY-SA 4.0.
 */
export async function consultarWikipediaConceptual(tema, { signal, docenteId, env } = {}) {
  // Validación de reglas pedagógicas
  const validacion = validarConsultaPermitida(tema);
  if (!validacion.permitida) {
    return {
      exito: false,
      rechazado: true,
      mensaje: validacion.razon,
    };
  }

  // Petición 1: Intento de resumen directo
  let resumenRes = await obtenerResumen(tema, { signal, docenteId, env });

  // Si no se encuentra directo o es desambiguación, usamos la búsqueda (Petición 2)
  if (!resumenRes.exito && resumenRes.tipo === "no_encontrado") {
    const busqueda = await buscarWikipedia(tema, { signal, docenteId, env });
    if (!busqueda.exito || !busqueda.resultados || busqueda.resultados.length === 0) {
      return {
        exito: false,
        noEncontrado: true,
        mensaje: `No se encontró ningún artículo conceptual sobre "${tema}" en Wikipedia en español.`,
      };
    }

    // Seleccionar el primer resultado relevante
    const mejorCandidato = busqueda.resultados[0];
    resumenRes = await obtenerResumen(mejorCandidato.titulo, { signal, docenteId, env });
  }

  if (!resumenRes.exito) {
    return {
      exito: false,
      error: resumenRes.error,
      tipo: resumenRes.tipo,
      mensaje: `No fue posible consultar Wikipedia (${resumenRes.error}). Se continúa sin este complemento conceptual.`,
    };
  }

  if (resumenRes.tipo === "desambiguacion") {
    return {
      exito: false,
      desambiguacion: true,
      mensaje: resumenRes.mensaje,
      url: resumenRes.url,
    };
  }

  const { titulo, extracto, url, revision } = resumenRes.resumen;

  // Formato estricto de etiquetado y licencia
  const textoEtiquetado = 
    `Complemento: Wikipedia (fuente colaborativa, no oficial)\n` +
    `Artículo: [${titulo}](${url})\n` +
    `Revisión: ${revision}\n` +
    `Licencia: CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/)\n` +
    `Resumen conceptual: ${extracto}`;

  return {
    exito: true,
    titulo,
    url,
    revision,
    extracto,
    licencia: "CC BY-SA 4.0",
    textoFormateado: textoEtiquetado,
  };
}

/**
 * Utilidad para combinar múltiples AbortSignals
 */
function anySignal(signals) {
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any(signals.filter(Boolean));
  }
  const controller = new AbortController();
  for (const s of signals) {
    if (!s) continue;
    if (s.aborted) {
      controller.abort(s.reason);
      break;
    }
    s.addEventListener("abort", () => controller.abort(s.reason), { once: true });
  }
  return controller.signal;
}
