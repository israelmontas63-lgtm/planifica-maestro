/**
 * server/ia/persistenciaEstado.js
 * 
 * Persistencia atómica y resiliente del estado del Circuit Breaker y contadores de gasto.
 * 
 * Garantías:
 * - Escritura segura mediante archivo temporal (.tmp) y copia de respaldo (.bak).
 * - Tolerancia a fallos: archivos inexistentes o JSON corruptos no rompen el arranque ni el servidor.
 * - Resiliencia en entornos serverless/read-only: si no hay disco persistente, funciona en memoria con advertencia.
 * - Cero datos de usuario: almacena únicamente metadatos operativos (IDs de proveedores, estados y contadores).
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const ARCHIVO_CIRCUITOS = path.join(DATA_DIR, "estado_circuitos.json");
const ARCHIVO_CIRCUITOS_BAK = path.join(DATA_DIR, "estado_circuitos.json.bak");
const ARCHIVO_CIRCUITOS_TMP = path.join(DATA_DIR, "estado_circuitos.json.tmp");

const ARCHIVO_GASTO = path.join(DATA_DIR, "gasto_diario.json");
const ARCHIVO_GASTO_BAK = path.join(DATA_DIR, "gasto_diario.json.bak");
const ARCHIVO_GASTO_TMP = path.join(DATA_DIR, "gasto_diario.json.tmp");

let avisoDiscoRegistrado = false;

function asegurarDirectorioData() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    return true;
  } catch (err) {
    if (!avisoDiscoRegistrado) {
      console.warn("⚠️ [Persistencia] No se pudo crear o acceder al directorio server/data/ (posible sistema de solo lectura). Operando en memoria:", err.message);
      avisoDiscoRegistrado = true;
    }
    return false;
  }
}

function escribirArchivoSeguro(archivoDestino, archivoTmp, archivoBak, datosObjeto) {
  if (!asegurarDirectorioData()) return false;

  try {
    const jsonStr = JSON.stringify(datosObjeto, null, 2);
    // 1. Escribir primero al archivo temporal
    fs.writeFileSync(archivoTmp, jsonStr, "utf-8");

    // 2. Mantener siempre copia de seguridad válida .bak
    try {
      fs.copyFileSync(archivoTmp, archivoBak);
    } catch (e) {
      console.warn(`⚠️ [Persistencia] No se pudo crear copia de respaldo ${path.basename(archivoBak)}:`, e.message);
    }

    // 3. Reemplazar atómicamente el temporal al destino con 2-3 reintentos cortos ante EPERM/EBUSY
    let renombrado = false;
    let ultimoErrorRename = null;
    for (let intento = 1; intento <= 3; intento++) {
      try {
        fs.renameSync(archivoTmp, archivoDestino);
        renombrado = true;
        break;
      } catch (renameErr) {
        ultimoErrorRename = renameErr;
        if (renameErr.code === "EPERM" || renameErr.code === "EBUSY") {
          // Breve pausa síncrona en Windows (50ms) para permitir liberación de handles
          const finEspera = Date.now() + 50;
          while (Date.now() < finEspera) {}
        } else {
          break;
        }
      }
    }

    // 4. Si fallaron los reintentos de renameSync, usar copia como último recurso
    if (!renombrado) {
      console.warn(`⚠️ [Persistencia] renameSync falló tras 3 intentos (${ultimoErrorRename?.message}). Usando copia como último recurso.`);
      if (fs.existsSync(archivoTmp)) {
        fs.copyFileSync(archivoTmp, archivoDestino);
        try {
          fs.unlinkSync(archivoTmp);
        } catch (unlinkErr) {
          console.warn(`⚠️ [Persistencia] No se pudo eliminar temporal tras copia (${path.basename(archivoTmp)}):`, unlinkErr.message);
        }
      }
    }
    return true;
  } catch (err) {
    if (!avisoDiscoRegistrado) {
      console.warn(`⚠️ [Persistencia] Error escribiendo en disco (${path.basename(archivoDestino)}). Continuando con estado en memoria:`, err.message);
      avisoDiscoRegistrado = true;
    }
    return false;
  }
}

function leerArchivoSeguro(archivoDestino, archivoBak, valorPorDefecto = {}) {
  try {
    if (fs.existsSync(archivoDestino)) {
      const contenido = fs.readFileSync(archivoDestino, "utf-8");
      if (contenido && contenido.trim()) {
        return JSON.parse(contenido);
      }
    } else if (archivoBak && fs.existsSync(archivoBak)) {
      // Usar copia .bak si el archivo principal falta
      console.warn(`⚠️ [Persistencia] Archivo principal no encontrado (${path.basename(archivoDestino)}). Intentando respaldo .bak...`);
      const contenidoBak = fs.readFileSync(archivoBak, "utf-8");
      if (contenidoBak && contenidoBak.trim()) {
        console.log(`✅ [Persistencia] Recuperado con éxito desde copia de seguridad ${path.basename(archivoBak)}`);
        return JSON.parse(contenidoBak);
      }
    }
  } catch (err) {
    console.warn(`⚠️ [Persistencia] Archivo corrupto o ilegible (${path.basename(archivoDestino)}). Intentando respaldo .bak...`);
    try {
      if (fs.existsSync(archivoBak)) {
        const contenidoBak = fs.readFileSync(archivoBak, "utf-8");
        if (contenidoBak && contenidoBak.trim()) {
          console.log(`✅ [Persistencia] Recuperado con éxito desde copia de seguridad ${path.basename(archivoBak)}`);
          return JSON.parse(contenidoBak);
        }
      }
    } catch (bakErr) {
      console.warn(`⚠️ [Persistencia] Respaldo .bak también inaccesible. Inicializando con estado limpio por defecto.`);
    }
  }
  return valorPorDefecto;
}

// ─────────────────────────────────────────────
// INTEGRACIÓN CON SUPABASE (Persistencia Cloud Protegida)
// ─────────────────────────────────────────────

function obtenerConfigSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    return { url: url.replace(/\/+$/, ""), key };
  }
  return null;
}

function tipoPersistencia() {
  if (obtenerConfigSupabase()) return "supabase";
  if (fs.existsSync(DATA_DIR)) {
    try {
      const testFile = path.join(DATA_DIR, ".write_test");
      fs.writeFileSync(testFile, "ok");
      fs.unlinkSync(testFile);
      return "disco";
    } catch (_) {}
  }
  return "en_memoria";
}

async function sincronizarHaciaSupabase(clave, valor) {
  const supa = obtenerConfigSupabase();
  if (!supa) return false;
  try {
    const res = await fetch(`${supa.url}/rest/v1/pm_estado_sistema`, {
      method: "POST",
      headers: {
        apikey: supa.key,
        Authorization: `Bearer ${supa.key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates"
      },
      body: JSON.stringify({
        clave,
        valor,
        updated_at: new Date().toISOString()
      })
    });
    return res.ok;
  } catch (err) {
    console.warn(`⚠️ [Persistencia Supabase] No se pudo sincronizar '${clave}':`, err.message);
    return false;
  }
}

async function leerDesdeSupabase(clave) {
  const supa = obtenerConfigSupabase();
  if (!supa) return null;
  try {
    const res = await fetch(`${supa.url}/rest/v1/pm_estado_sistema?clave=eq.${encodeURIComponent(clave)}&select=valor`, {
      method: "GET",
      headers: {
        apikey: supa.key,
        Authorization: `Bearer ${supa.key}`
      }
    });
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0 && rows[0].valor) {
        return rows[0].valor;
      }
    }
    return null;
  } catch (err) {
    console.warn(`⚠️ [Persistencia Supabase] No se pudo leer '${clave}':`, err.message);
    return null;
  }
}

// ─────────────────────────────────────────────
// ESTADO DE CIRCUIT BREAKERS
// ─────────────────────────────────────────────

function cargarEstadoCircuitos() {
  const guardado = leerArchivoSeguro(ARCHIVO_CIRCUITOS, ARCHIVO_CIRCUITOS_BAK, {});
  const mapa = new Map();
  if (guardado && typeof guardado === "object") {
    for (const [id, datos] of Object.entries(guardado)) {
      if (datos && typeof datos === "object") {
        mapa.set(id, {
          estado: datos.estado || "CERRADO",
          fallosConsecutivos: Number(datos.fallosConsecutivos) || 0,
          pausaHastaMs: Number(datos.pausaHastaMs) || 0,
          ultimoError: datos.ultimoError ? String(datos.ultimoError).substring(0, 200) : null,
          ultimaLlamada: Number(datos.ultimaLlamada) || 0,
          motivoPausa: datos.motivoPausa || null
        });
      }
    }
  }
  return mapa;
}

function guardarEstadoCircuitos(mapaCircuitos) {
  const serializable = {};
  if (mapaCircuitos instanceof Map) {
    for (const [id, val] of mapaCircuitos.entries()) {
      serializable[id] = {
        estado: val.estado,
        fallosConsecutivos: val.fallosConsecutivos,
        pausaHastaMs: val.pausaHastaMs,
        ultimoError: val.ultimoError ? String(val.ultimoError).substring(0, 200) : null,
        ultimaLlamada: val.ultimaLlamada || 0,
        motivoPausa: val.motivoPausa || null
      };
    }
  }
  const okDisco = escribirArchivoSeguro(ARCHIVO_CIRCUITOS, ARCHIVO_CIRCUITOS_TMP, ARCHIVO_CIRCUITOS_BAK, serializable);
  sincronizarHaciaSupabase("estado_circuitos", serializable).catch(err => {
    console.warn("⚠️ [Persistencia Supabase] Sincronización asíncrona de circuitos omitida:", err.message);
  });
  return okDisco;
}

// ─────────────────────────────────────────────
// CONTADORES DE GASTO DIARIO
// ─────────────────────────────────────────────

function cargarEstadoGasto() {
  const datos = leerArchivoSeguro(ARCHIVO_GASTO, ARCHIVO_GASTO_BAK, {
    fecha: new Date().toISOString().split("T")[0],
    consultasHoy: 0,
    consultasRealizadas: 0
  });
  // Normalización bidireccional entre consultasHoy (gestorGasto) y consultasRealizadas (persistenciaEstado)
  const cantidad = typeof datos.consultasHoy === "number" 
    ? datos.consultasHoy 
    : (typeof datos.consultasRealizadas === "number" ? datos.consultasRealizadas : 0);
  datos.consultasHoy = cantidad;
  datos.consultasRealizadas = cantidad;
  return datos;
}

function guardarEstadoGasto(datosGasto) {
  // Asegurar consistencia en el payload guardado
  const cantidad = typeof datosGasto.consultasHoy === "number" 
    ? datosGasto.consultasHoy 
    : (typeof datosGasto.consultasRealizadas === "number" ? datosGasto.consultasRealizadas : 0);
  const payloadGasto = {
    fecha: datosGasto.fecha || new Date().toISOString().split("T")[0],
    consultasHoy: cantidad,
    consultasRealizadas: cantidad
  };
  const okDisco = escribirArchivoSeguro(ARCHIVO_GASTO, ARCHIVO_GASTO_TMP, ARCHIVO_GASTO_BAK, payloadGasto);
  sincronizarHaciaSupabase("gasto_diario", payloadGasto).catch(err => {
    console.warn("⚠️ [Persistencia Supabase] Sincronización asíncrona de gasto omitida:", err.message);
  });
  return okDisco;
}

module.exports = {
  cargarEstadoCircuitos,
  guardarEstadoCircuitos,
  cargarEstadoGasto,
  guardarEstadoGasto,
  escribirArchivoSeguro,
  leerArchivoSeguro,
  obtenerConfigSupabase,
  tipoPersistencia,
  sincronizarHaciaSupabase,
  leerDesdeSupabase,
  DATA_DIR,
  ARCHIVO_CIRCUITOS,
  ARCHIVO_CIRCUITOS_BAK
};
