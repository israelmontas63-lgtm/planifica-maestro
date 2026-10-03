/**
 * worker/cacheRespuestas.js
 * 
 * Caché segura en memoria (LRU + TTL) para Cloudflare Worker (ESM).
 * - Hash SHA-256 (Web Crypto API) por grado + área + tema + nivel + periodo.
 * - CERO datos personales almacenados (solo contenido pedagógico abstracto).
 * - Expiración por TTL (1 hora) y descarte por antigüedad (LRU, max 200 entradas).
 */

const MAX_ENTRADAS_CACHE = 200;
const TTL_DEFAULT_MS = 60 * 60 * 1000; // 1 hora

const cacheCurricular = new Map(); // hash -> { datos, expiraEn }

export function obtenerClaveStringRawWorker({ grado = "", area = "", tema = "", nivel = "", periodo = "", perfilDocente = null, docenteId = "" }) {
  if (!tema || typeof tema !== "string" || !tema.trim()) return null;

  let perfilIdentificador = "";
  if (perfilDocente && typeof perfilDocente === "object") {
    const clavesOrdenadas = Object.keys(perfilDocente).sort();
    const partes = clavesOrdenadas.map(k => `${k}:${String(perfilDocente[k])}`);
    perfilIdentificador = partes.join(";");
  } else if (docenteId) {
    perfilIdentificador = String(docenteId);
  }

  return [
    (grado || "").trim().toLowerCase(),
    (area || "").trim().toLowerCase(),
    (tema || "").trim().toLowerCase(),
    (nivel || "").trim().toLowerCase(),
    (periodo || "").trim().toLowerCase(),
    perfilIdentificador.trim().toLowerCase()
  ].join("|");
}

export async function generarClaveCurricularSha256(params) {
  const raw = obtenerClaveStringRawWorker(params);
  if (!raw) return null;

  try {
    const msgUint8 = new TextEncoder().encode(raw);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (e) {
    return raw;
  }
}

export function esRespuestaCacheable(datos) {
  if (!datos || typeof datos !== "object") return false;
  if (datos.error || datos.requiereAclaracion || datos.requiereDesambiguacion) return false;
  return Boolean(datos.plan_completado && datos.datos_planificacion);
}

export function obtenerRespuestaDeCache(clave) {
  if (!clave || !cacheCurricular.has(clave)) return null;

  const entrada = cacheCurricular.get(clave);
  const ahora = Date.now();

  if (ahora > entrada.expiraEn) {
    cacheCurricular.delete(clave);
    return null;
  }

  cacheCurricular.delete(clave);
  cacheCurricular.set(clave, entrada);

  return JSON.parse(JSON.stringify(entrada.datos));
}

export function guardarRespuestaEnCache(clave, datos, ttlMs = TTL_DEFAULT_MS) {
  if (!clave || !esRespuestaCacheable(datos)) return;

  if (cacheCurricular.size >= MAX_ENTRADAS_CACHE) {
    const primeraClave = cacheCurricular.keys().next().value;
    cacheCurricular.delete(primeraClave);
  }

  const datosSeguros = {
    mensaje_chat: datos.mensaje_chat || "",
    plan_completado: true,
    datos_planificacion: datos.datos_planificacion,
    confianza_curricular: datos.confianza_curricular || null,
    proveedor_utilizado: datos.proveedor_utilizado || "Caché de Currícuo Oficial",
    origen: datos.origen || "cache_en_memoria"
  };

  cacheCurricular.set(clave, {
    datos: datosSeguros,
    expiraEn: Date.now() + ttlMs
  });
}

export function limpiarCacheCurricular() {
  cacheCurricular.clear();
}

export function tamanoCacheCurricular() {
  return cacheCurricular.size;
}
