const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../data/uso_docentes.json");

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
 * Carga la base de datos de cuotas
 */
function cargarDatosCuotas() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("Error leyendo uso_docentes.json:", err.message);
  }
  return {};
}

/**
 * Guarda la base de datos de cuotas
 */
function guardarDatosCuotas(datos) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(datos, null, 2), "utf-8");
  } catch (err) {
    console.error("Error guardando uso_docentes.json:", err.message);
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
 * Valida si el docente puede generar una nueva planificación.
 * Si es permitido y `consumir` es true, incrementa el contador y persiste.
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
  verificarYConsumirCuota
};
