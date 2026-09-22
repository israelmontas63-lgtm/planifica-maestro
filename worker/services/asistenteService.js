/**
 * worker/services/asistenteService.js
 * Orquestador del Asistente Vivo de Planifica Maestro
 * Manejo de avisos SSE en tiempo real, integración multimodal y herramientas docentes
 */

import { getAiProvider } from "./aiProvider.js";
import { DOMINIOS_OFICIALES } from "./investigadorService.js";
import { consultarWikipediaConceptual } from "./wikipedia.js";

/**
 * Genera mensajes naturales de estado en vivo para el docente
 * Cada aviso refleja un paso REAL en ejecución, nunca simulado ni decorativo.
 */
export function generarMensajeEstado(paso, { docenteNombre = "profesor(a)", grado = "", area = "", tema = "" }) {
  const nombre = docenteNombre.split(" ")[0]; // Primer nombre

  switch (paso) {
    case "consultando_curriculo":
      return `Dame unos segundos, ${nombre}, estoy consultando el currículo oficial${grado ? ` de ${grado}` : ""}${area ? ` de ${area}` : ""}…`;
    case "consultando_con_base":
      return `Estoy revisando las guías oficiales del programa Con Base para ${grado || "el grado"}…`;
    case "consultando_wikipedia":
      return `Consultando un resumen conceptual en Wikipedia en español…`;
    case "investigando_web":
      return `Buscando información oficial verificada sobre "${tema || "este tema"}" en los portales del MINERD…`;
    case "contrastando_fuentes":
      return `Comparando las fuentes encontradas para asegurar la fidelidad curricular…`;
    case "armando_plan":
      return `Ya tengo lo que necesito, ${nombre}, estoy estructurando tu planificación…`;
    case "consultando_horario":
      return `Revisando tu horario de clases registrado…`;
    case "consultando_eventos":
      return `Consultando el calendario escolar y tus actividades programadas…`;
    case "finalizado":
      return `¡Listo! He completado tu solicitud.`;
    default:
      return `Trabajando en tu solicitud, un momento por favor…`;
  }
}

/**
 * Herramientas del Flujo Pedagógico y Curricular (Explicación de temas y Planificación)
 */
export const TOOL_CONSULTAR_CURRICULO = {
  name: "consultar_curriculo",
  description: "Consulta la base de datos oficial del currículo dominicano (MINERD y guías Con Base).",
  parameters: {
    type: "OBJECT",
    properties: {
      tema: { type: "STRING", description: "Tema o contenido curricular a buscar" },
      nivel: { type: "STRING", description: "Nivel educativo ('inicial', 'primario', 'secundario')" },
      grado: { type: "STRING", description: "Grado normalizado (ej. '1ro_prim', '3ro_sec')" },
      area: { type: "STRING", description: "Área curricular (ej. 'Lengua Española', 'Matemática')" },
    },
    required: ["tema"],
  },
};

export const TOOL_CONSULTAR_WIKIPEDIA = {
  name: "consultar_wikipedia",
  description: "Consulta un resumen conceptual breve de un tema educativo en Wikipedia en español exclusivamente como complemento explicativo (definiciones, antecedentes históricos, conceptos científicos). PROHIBIDO su uso para buscar competencias, indicadores de logro, contenidos oficiales, ordenanzas, efemérides o calendario escolar.",
  parameters: {
    type: "OBJECT",
    properties: {
      tema: {
        type: "STRING",
        description: "Tema conceptual a consultar (ej. 'Fotosíntesis', 'Revolución Francesa', 'Ecosistema'). No incluir términos curriculares normativos.",
      },
    },
    required: ["tema"],
  },
};

/**
 * Herramientas de Gestión Escolar (Horarios y Calendario)
 * Nota: Wikipedia está ESTRICTAMENTE EXCLUIDA de este conjunto.
 */
export const TOOL_CONSULTAR_HORARIO = {
  name: "consultar_horario",
  description: "Consulta el horario escolar y las clases del docente para un día específico o la semana completa.",
  parameters: {
    type: "OBJECT",
    properties: {
      dia: { type: "STRING", description: "Día de la semana ('lunes', 'martes', 'miercoles', 'jueves', 'viernes', o 'semana')" },
    },
    required: ["dia"],
  },
};

export const TOOL_CONSULTAR_CALENDARIO = {
  name: "consultar_calendario",
  description: "Consulta los eventos, efemérides y actividades pedagógicas del docente o del calendario escolar.",
  parameters: {
    type: "OBJECT",
    properties: {
      fecha_inicio: { type: "STRING", description: "Fecha de inicio en formato YYYY-MM-DD" },
      fecha_fin: { type: "STRING", description: "Fecha de fin en formato YYYY-MM-DD" },
    },
    required: ["fecha_inicio"],
  },
};

export const TOOL_PROPONER_CAMBIO_CLASE = {
  name: "proponer_cambio_clase",
  description: "Propone crear, modificar o eliminar una clase del horario. Requiere confirmación del docente.",
  parameters: {
    type: "OBJECT",
    properties: {
      accion: { type: "STRING", enum: ["crear", "modificar", "eliminar"] },
      dia: { type: "STRING" },
      hora_inicio: { type: "STRING" },
      hora_fin: { type: "STRING" },
      asignatura: { type: "STRING" },
      grado: { type: "STRING" },
      seccion: { type: "STRING" },
    },
    required: ["accion", "dia", "asignatura", "grado"],
  },
};

export const TOOL_PROPONER_EVENTO_CALENDARIO = {
  name: "proponer_evento_calendario",
  description: "Propone agregar un evento o recordatorio al calendario del docente. Requiere confirmación.",
  parameters: {
    type: "OBJECT",
    properties: {
      titulo: { type: "STRING" },
      fecha: { type: "STRING" },
      hora: { type: "STRING" },
      tipo: { type: "STRING", enum: ["pedagogico", "efemeride", "evaluacion", "reunion"] },
      descripcion: { type: "STRING" },
    },
    required: ["titulo", "fecha"],
  },
};

export const HERRAMIENTAS_PEDAGOGICAS = [
  TOOL_CONSULTAR_CURRICULO,
  TOOL_CONSULTAR_WIKIPEDIA,
];

export const HERRAMIENTAS_GESTION_ESCOLAR = [
  TOOL_CONSULTAR_HORARIO,
  TOOL_CONSULTAR_CALENDARIO,
  TOOL_PROPONER_CAMBIO_CLASE,
  TOOL_PROPONER_EVENTO_CALENDARIO,
];

/**
 * Segmentación estricta de herramientas por flujo de trabajo
 * Asegura que consultar_wikipedia SOLO esté disponible en el flujo pedagógico/curricular
 */
export function obtenerHerramientasPorFlujo(flujo) {
  switch (flujo) {
    case "pedagogico":
    case "planificacion":
    case "explicacion_tema":
      return HERRAMIENTAS_PEDAGOGICAS;
    case "horario":
    case "calendario":
    case "gestion_escolar":
      return HERRAMIENTAS_GESTION_ESCOLAR;
    case "imagenes":
    case "mapas":
    case "saludo":
    default:
      return []; // Ninguna herramienta para flujos no curriculares
  }
}

/**
 * Ejecutor de herramientas del asistente
 */
export async function ejecutarHerramientaAsistente(nombre, args, contexto = {}) {
  const { flujo = "pedagogico", docenteId, env } = contexto;

  if (nombre === "consultar_wikipedia") {
    // Validación de flujo exclusivo
    if (flujo !== "pedagogico" && flujo !== "planificacion" && flujo !== "explicacion_tema") {
      return {
        exito: false,
        error: "La herramienta consultar_wikipedia solo está disponible en el flujo pedagógico y curricular.",
      };
    }
    return consultarWikipediaConceptual(args.tema, { docenteId, env });
  }

  // Otras herramientas delegadas a sus respectivos servicios
  return { exito: false, error: `Herramienta ${nombre} no implementada en este ejecutor.` };
}

/**
 * Emite un evento Server-Sent Events (SSE) al cliente con aviso en tiempo real
 */
export function emitirEventoStatus(writer, encoder, paso, opciones = {}, hablarVoz = false) {
  const mensaje = generarMensajeEstado(paso, opciones);
  const payload = JSON.stringify({
    tipo: "status",
    paso,
    mensaje,
    hablar_voz: hablarVoz,
    timestamp: Date.now(),
  });
  return writer.write(encoder.encode(`event: status\ndata: ${payload}\n\n`));
}
