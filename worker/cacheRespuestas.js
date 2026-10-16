/**
 * worker/cacheRespuestas.js
 * 
 * Caché segura en memoria (LRU + TTL) para Cloudflare Worker (ESM).
 * - Hash SHA-256 (Web Crypto API) por grado + área + tema + nivel + periodo.
 * - CERO datos personales almacenados (solo contenido pedagógico abstracto).
 * - Expiración por TTL (1 hora) y descarte por antigüedad (LRU, max 200 entradas).
 */

const MAX_ENTRADAS_CACHE = 300;
const TTL_DEFAULT_MS = 24 * 60 * 60 * 1000; // 24 horas

const cacheCurricular = new Map(); // hash -> { datos, expiraEn }

export function obtenerClaveStringRawWorker({ grado = "", area = "", tema = "", nivel = "", periodo = "" }) {
  if (!tema || typeof tema !== "string" || !tema.trim()) return null;

  // Clave curricular pura sin PII ni identificadores docentes
  return [
    (grado || "").trim().toLowerCase(),
    (area || "").trim().toLowerCase(),
    (tema || "").trim().toLowerCase(),
    (nivel || "").trim().toLowerCase(),
    (periodo || "").trim().toLowerCase()
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

export async function obtenerRespuestaDeKv(clave, env) {
  if (!clave || !env || (!env.CACHE_KV && !env.CURRICULO_KV)) return null;
  const kv = env.CACHE_KV || env.CURRICULO_KV;
  try {
    const val = await kv.get(`curriculo_${clave}`, "json");
    if (val && esRespuestaCacheable(val)) {
      guardarRespuestaEnCache(clave, val);
      return val;
    }
  } catch (e) {
    console.warn("[CacheCurricular] Lectura fallida de KV:", e?.message || e);
  }
  return null;
}

export function guardarRespuestaEnCache(clave, datos, ttlMs = TTL_DEFAULT_MS, env = null, ctx = null) {
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
    proveedor_utilizado: datos.proveedor_utilizado || "Caché de Currículo Oficial",
    origen: datos.origen || "cache_en_memoria"
  };

  cacheCurricular.set(clave, {
    datos: datosSeguros,
    expiraEn: Date.now() + ttlMs
  });

  // Guardar en Cloudflare KV en segundo plano si existe
  if (env && (env.CACHE_KV || env.CURRICULO_KV)) {
    const kv = env.CACHE_KV || env.CURRICULO_KV;
    const ttlSegundos = Math.max(60, Math.floor(ttlMs / 1000));
    try {
      const p = kv.put(`curriculo_${clave}`, JSON.stringify(datosSeguros), { expirationTtl: ttlSegundos });
      if (ctx && typeof ctx.waitUntil === "function") {
        ctx.waitUntil(p);
      }
    } catch (e) {
      console.warn("[CacheCurricular] Escritura fallida en KV:", e?.message || e);
    }
  }
}

export function limpiarCacheCurricular() {
  cacheCurricular.clear();
}

export function tamanoCacheCurricular() {
  return cacheCurricular.size;
}
