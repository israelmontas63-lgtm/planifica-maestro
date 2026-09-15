const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../data/historial_docente.json");

function cargarHistorial() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("Error leyendo historial_docente.json:", err.message);
  }
  return [];
}

function guardarHistorial(historial) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(historial, null, 2), "utf-8");
  } catch (err) {
    console.error("Error guardando historial_docente.json:", err.message);
  }
}

/**
 * Registra una nueva planificación generada en el historial
 */
function registrarPlan({ nivel, periodo, esquemaLabel, area, grado, tema, datosPlanificacion }) {
  const historial = cargarHistorial();
  
  const nuevoRegistro = {
    id: "plan_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
    fecha: new Date().toISOString(),
    nivel: nivel || "primario",
    periodo: periodo || "diaria",
    esquemaLabel: esquemaLabel || "Tradicional",
    area: area || "",
    grado: grado || "",
    tema: tema || "",
    datosGenerados: datosPlanificacion || {},
    ajustesManuales: null, // se completa si el maestro edita
  };

  historial.push(nuevoRegistro);
  // Mantener últimos 100 registros
  if (historial.length > 100) {
    historial.shift();
  }
  guardarHistorial(historial);
  return nuevoRegistro;
}

/**
 * Actualiza una planificación con los ajustes manuales hechos por el docente
 */
function registrarAjustesManuales(id, datosAjustados) {
  const historial = cargarHistorial();
  const index = historial.findIndex((p) => p.id === id);
  if (index !== -1) {
    historial[index].ajustesManuales = datosAjustados;
    historial[index].fechaAjuste = new Date().toISOString();
    guardarHistorial(historial);
    return true;
  }
  return false;
}

/**
 * Analiza las últimas N planificaciones del docente y extrae un perfil de preferencias pedagógicas
 */
function obtenerResumenPatrones({ area = "", nivel = "" } = {}) {
  const historial = cargarHistorial();
  if (!historial.length) {
    return "No hay historial previo registrado para este docente. Aplica las mejores prácticas pedagógicas del MINERD.";
  }

  // Filtrar por área o nivel similar si es posible, o tomar las últimas 8 generales
  let relevantes = historial;
  if (area) {
    const porArea = historial.filter(
      (h) => h.area && h.area.toLowerCase().includes(area.toLowerCase())
    );
    if (porArea.length >= 2) relevantes = porArea;
  }
  if (nivel && relevantes.length < 3) {
    const porNivel = historial.filter((h) => h.nivel === nivel);
    if (porNivel.length >= 2) relevantes = porNivel;
  }

  const ultimas = relevantes.slice(-8);

  // Análisis de texto de las planificaciones para detectar patrones de estilo
  let textoUnificado = "";
  let huboAjustesManuales = 0;

  ultimas.forEach((plan) => {
    const fuentes = plan.ajustesManuales || plan.datosGenerados || {};
    Object.values(fuentes).forEach((v) => {
      if (typeof v === "string") textoUnificado += " " + v.toLowerCase();
    });
    if (plan.ajustesManuales) huboAjustesManuales++;
  });

  const patrones = [];

  // Detección de patrones metodológicos comunes
  if (textoUnificado.includes("lúdico") || textoUnificado.includes("juego") || textoUnificado.includes("dinámica")) {
    patrones.push("Muestra una fuerte preferencia por estrategias lúdicas, dinámicas participativas y juegos pedagógicos.");
  }
  if (textoUnificado.includes("equipo") || textoUnificado.includes("grupal") || textoUnificado.includes("pareja") || textoUnificado.includes("colaborativo")) {
    patrones.push("Prefiere actividades estructuradas en grupos colaborativos de 3 a 5 estudiantes o trabajo en pares.");
  }
  if (textoUnificado.includes("concreto") || textoUnificado.includes("manipulativo") || textoUnificado.includes("cartulina") || textoUnificado.includes("recort")) {
    patrones.push("Prioriza el uso de material concreto y recursos tangibles en el aula.");
  }
  if (textoUnificado.includes("rúbrica") || textoUnificado.includes("lista de cotejo") || textoUnificado.includes("observación")) {
    patrones.push("Prefiere instrumentos de evaluación formativa continua (rúbricas detalladas y listas de cotejo) por encima de exámenes tradicionales.");
  }
  if (textoUnificado.includes("indagación") || textoUnificado.includes("experimento") || textoUnificado.includes("pregunta")) {
    patrones.push("Enfoca el aprendizaje en la indagación dialógica y formulación de hipótesis por los propios estudiantes.");
  }

  if (huboAjustesManuales > 0) {
    patrones.push(`En ${huboAjustesManuales} de sus últimas planificaciones el docente ajustó manualmente los textos para hacer las actividades más detalladas, paso a paso y aterrizadas a la realidad de su aula.`);
  }

  if (!patrones.length) {
    return `El docente ha planificado previamente sobre temas como: ${ultimas.map((p) => p.tema || p.esquemaLabel).filter(Boolean).slice(-4).join(", ")}. Mantén un estilo claro, conciso y cercano al lenguaje docente dominicano.`;
  }

  return `Basado en las últimas ${ultimas.length} planificaciones de este docente:\n- ` + patrones.join("\n- ");
}

module.exports = {
  registrarPlan,
  registrarAjustesManuales,
  obtenerResumenPatrones,
  cargarHistorial
};
