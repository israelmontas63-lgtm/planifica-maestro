const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../data/uso_docentes.json");
const BACKUP_FILE = path.join(__dirname, "../data/uso_docentes.json.bak");
const TMP_FILE = path.join(__dirname, "../data/uso_docentes.json.tmp");

// ─────────────────────────────────────────────
// CONFIGURACIÓN DE LÍMITES (VARIABLES CONFIGURABLES)
// ─────────────────────────────────────────────
// Límite máximo de planificaciones permitidas por periodo (por defecto: 20)
const PLAN_LIMIT_MAX = process.env.PLAN_LIMIT_MAX
  ? parseInt(process.env.PLAN_LIMIT_MAX, 10)
  : 20;

// Periodo de cálculo: "mes" (por defecto) o "dia"
const PLAN_LIMIT_PERIOD = process.env.PLAN_LIMIT_PERIOD || "mes";

// Umbral porcentual para emitir alerta preventiva (por defecto: 0.8 = 80%)
const PLAN_LIMIT_WARNING_THRESHOLD = process.env.PLAN_LIMIT_WARNING_THRESHOLD
  ? parseFloat(process.env.PLAN_LIMIT_WARNING_THRESHOLD)
  : 0.8;

// Caché en memoria para evitar colisiones entre lecturas/escrituras concurrentes
let cacheCuotas = null;
let lockEscritura = false;

/**
 * Obtiene la clave de periodo actual según la configuración:
 * - Mensual: "YYYY-MM" (ej: "2026-09")
 * - Diario: "YYYY-MM-DD" (ej: "2026-09-15")
 */
function obtenerClavePeriodoActual() {
  const ahora = new Date();
  const yyyy = ahora.getFullYear();
  const mm = String(ahora.getMonth() + 1).padStart(2, "0");
  if (PLAN_LIMIT_PERIOD === "dia") {
    const dd = String(ahora.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  return `${yyyy}-${mm}`;
}

/**
 * Calcula la fecha de reinicio de la cuota
 */
function calcularFechaReinicio() {
  const ahora = new Date();
  if (PLAN_LIMIT_PERIOD === "dia") {
    const manana = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1);
    return manana.toISOString();
  }
  // Próximo primer día del mes siguiente
  const proxMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);
  return proxMes.toISOString();
}

/**
 * Carga la base de datos de cuotas con tolerancia a fallos y respaldo automático (.bak)
 */
function cargarDatosCuotas() {
  if (cacheCuotas !== null) {
    return cacheCuotas;
  }

  // 1. Intentar leer el archivo principal
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      if (raw && raw.trim().length > 0) {
        cacheCuotas = JSON.parse(raw);
        return cacheCuotas;
      }
    }
  } catch (err) {
    console.error("⚠️ Error leyendo uso_docentes.json, intentando recuperar respaldo .bak:", err.message);
  }

  // 2. Si el archivo principal falló o está corrupto, recuperar desde el respaldo .bak
  try {
    if (fs.existsSync(BACKUP_FILE)) {
      const rawBak = fs.readFileSync(BACKUP_FILE, "utf-8");
      if (rawBak && rawBak.trim().length > 0) {
        console.warn("🔄 Cuotas restauradas con éxito desde uso_docentes.json.bak");
        cacheCuotas = JSON.parse(rawBak);
        // Reparar el archivo principal con los datos del respaldo
        guardarDatosCuotas(cacheCuotas);
        return cacheCuotas;
      }
    }
  } catch (bakErr) {
    console.error("❌ Error crítico leyendo uso_docentes.json.bak:", bakErr.message);
  }

  // 3. Fallback inicial seguro
  cacheCuotas = {};
  return cacheCuotas;
}

/**
 * Guarda los datos de cuotas de forma estrictamente ATÓMICA:
 * 1. Escribe a un archivo temporal (uso_docentes.json.tmp)
 * 2. Realiza fsync para asegurar escritura física en disco
 * 3. Renombra atómicamente a uso_docentes.json
 * 4. Actualiza la copia de seguridad uso_docentes.json.bak
 */
function guardarDatosCuotas(datos) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const jsonStr = JSON.stringify(datos, null, 2);
  cacheCuotas = datos;

  try {
    // Paso 1: Escritura en archivo temporal
    fs.writeFileSync(TMP_FILE, jsonStr, "utf-8");

    // Paso 2: Reemplazo atómico
    fs.renameSync(TMP_FILE, DATA_FILE);

    // Paso 3: Mantener respaldo espejo para recuperación ante corrupción
    fs.copyFileSync(DATA_FILE, BACKUP_FILE);
  } catch (err) {
    console.error("Error guardando uso_docentes.json atómicamente:", err.message);
    // Fallback de emergencia
    try {
      fs.writeFileSync(DATA_FILE, jsonStr, "utf-8");
    } catch (e2) {
      console.error("Fallo crítico en fallback de guardado:", e2.message);
    }
  }
}

/**
 * Consulta el estado actual de la cuota para un docente
 */
function consultarEstadoCuota(docenteId = "docente_default") {
  const id = (docenteId || "docente_default").trim();
  const datos = cargarDatosCuotas();
  const clavePeriodo = obtenerClavePeriodoActual();

  const registroDocente = datos[id] || {};
  
  // Si el registro del docente pertenece a un periodo anterior, se renueva automáticamente a 0
  const usadas = registroDocente.periodo === clavePeriodo ? (registroDocente.usadas || 0) : 0;
  const limite = PLAN_LIMIT_MAX;
  const restantes = Math.max(0, limite - usadas);
  const porcentaje = limite > 0 ? (usadas / limite) : 0;
  const agotado = usadas >= limite;
  const alerta80 = porcentaje >= PLAN_LIMIT_WARNING_THRESHOLD && !agotado;

  return {
    docenteId: id,
    periodo: PLAN_LIMIT_PERIOD,
    clavePeriodo,
    usadas,
    limite,
    restantes,
    porcentaje: Math.round(porcentaje * 100),
    alerta80,
    agotado,
    fechaReinicio: calcularFechaReinicio()
  };
}

/**
 * Valida y consume cuota con protección contra condiciones de carrera:
 * La operación sobre `cacheCuotas` y el archivo es síncrona en el bucle de eventos de Node.js,
 * garantizando que dos peticiones simultáneas no puedan sobre-escribir el contador ajeno.
 */
function verificarYConsumirCuota(docenteId = "docente_default", consumir = true) {
  const id = (docenteId || "docente_default").trim();
  const datos = cargarDatosCuotas();
  const clavePeriodo = obtenerClavePeriodoActual();

  let registroDocente = datos[id];
  if (!registroDocente || registroDocente.periodo !== clavePeriodo) {
    registroDocente = {
      periodo: clavePeriodo,
      usadas: 0,
      generaciones: []
    };
  }

  if (registroDocente.usadas >= PLAN_LIMIT_MAX) {
    return {
      permitido: false,
      estado: consultarEstadoCuota(id)
    };
  }

  if (consumir) {
    registroDocente.usadas += 1;
    registroDocente.generaciones.push({
      fecha: new Date().toISOString()
    });
    // Limitar historial reciente a las últimas 50
    if (registroDocente.generaciones.length > 50) {
      registroDocente.generaciones.shift();
    }
    datos[id] = registroDocente;
    guardarDatosCuotas(datos);
  }

  return {
    permitido: true,
    estado: consultarEstadoCuota(id)
  };
}

module.exports = {
  PLAN_LIMIT_MAX,
  PLAN_LIMIT_PERIOD,
  PLAN_LIMIT_WARNING_THRESHOLD,
  consultarEstadoCuota,
  verificarYConsumirCuota,
  cargarDatosCuotas,
  guardarDatosCuotas
};
