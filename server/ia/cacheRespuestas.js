const crypto = require("crypto");

/**
 * server/ia/cacheRespuestas.js
 * 
 * Caché segura en memoria (LRU + TTL) para respuestas curriculares idénticas.
 * - Hash SHA-256 por grado + área + tema + nivel + periodo.
 * - CERO datos personales almacenados (solo contenido pedagógico abstracto).
 * - Expiración por TTL (1 hora) y descarte por antigüedad (LRU, max 200 entradas).
 */

const MAX_ENTRADAS_CACHE = 200;
const TTL_DEFAULT_MS = 60 * 60 * 1000; // 1 hora

const cacheCurricular = new Map(); // hash -> { datos, expiraEn }

function obtenerClaveStringRaw({ grado = "", area = "", tema = "", nivel = "", periodo = "", perfilDocente = null, docenteId = "" }) {
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

function generarClaveCurricular(params) {
  const raw = obtenerClaveStringRaw(params);
  if (!raw) return null;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function esRespuestaCacheable(datos) {
  if (!datos || typeof datos !== "object") return false;
  if (datos.error || datos.requiereAclaracion || datos.requiereDesambiguacion) return false;
  return Boolean(datos.plan_completado && datos.datos_planificacion);
}

function obtenerRespuestaDeCache(clave) {
  if (!clave || !cacheCurricular.has(clave)) return null;

  const entrada = cacheCurricular.get(clave);
  const ahora = Date.now();

  if (ahora > entrada.expiraEn) {
    cacheCurricular.delete(clave);
    return null;
  }

  // Refrescar posición en LRU (eliminar y reinsertar)
  cacheCurricular.delete(clave);
  cacheCurricular.set(clave, entrada);

  // Retornar clon profundo seguro para evitar mutaciones externas
  return JSON.parse(JSON.stringify(entrada.datos));
}

function guardarRespuestaEnCache(clave, datos, ttlMs = TTL_DEFAULT_MS) {
  if (!clave || !esRespuestaCacheable(datos)) return;

  // Si se alcanza el límite de capacidad, descartar la entrada más antigua (primera en inserción)
  if (cacheCurricular.size >= MAX_ENTRADAS_CACHE) {
    const primeraClave = cacheCurricular.keys().next().value;
    cacheCurricular.delete(primeraClave);
  }

  // Filtrar estrictamente cualquier dato sensible o metadato de usuario
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

function limpiarCacheCurricular() {
  cacheCurricular.clear();
}

function tamanoCacheCurricular() {
  return cacheCurricular.size;
}

module.exports = {
  generarClaveCurricular,
  obtenerClaveStringRaw,
  esRespuestaCacheable,
  obtenerRespuestaDeCache,
  guardarRespuestaEnCache,
  limpiarCacheCurricular,
  tamanoCacheCurricular
};
