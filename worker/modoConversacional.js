/**
 * worker/modoConversacional.js
 * 
 * Modo conversacional para Cloudflare Worker (ESM).
 */

const SALUDOS_MANANA = [
  "¡Buen día, colega! ¿Qué tema o grado tenemos previsto organizar hoy?",
  "¡Muy buenos días! Espero que tu jornada escolar marche excelente. ¿Qué vamos a planificar?",
  "¡Saludos, Profe! Listo para apoyarte con tus clases. ¿Con qué grado empezamos hoy?"
];

const SALUDOS_TARDE = [
  "¡Buenas tardes, Profe! ¿Qué clase o actividad didáctica tenemos pendiente para hoy?",
  "¡Buenas tardes, colega! Con gusto te apoyo. ¿En qué área o tema vamos a trabajar?",
  "¡Saludos en esta tarde! Listo para estructurar tus actividades pedagógicas. ¿Qué necesitas?"
];

const SALUDOS_NOCHE = [
  "¡Buenas noches, colega! ¿Dejamos lista la planificación de mañana o revisamos algún tema?",
  "¡Buenas noches, Profe! Un buen momento para adelantar el trabajo del aula. ¿Qué grado preparamos?",
  "¡Saludos en esta noche! Aquí estoy para hacerte la labor más ligera. ¿En qué te colaboro?"
];

const AGRADECIMIENTOS = [
  "¡Siempre a la orden, colega! Es un gusto apoyarte. ¿En qué más te puedo colaborar?",
  "¡A tu completa disposición! Me alegra que te sirva. ¿Seguimos con otra clase o actividad?",
  "¡Para eso estamos, Profe! Tu tiempo vale mucho. Dime si avanzamos con otro tema."
];

const ESTADO_ANIMO = [
  "¡Todo marchando muy bien y listo para trabajar contigo! ¿Qué grado o tema escolar vamos a preparar?",
  "¡Excelente y con todas las pilas puestas para ayudarte en el aula! ¿En qué nos enfocamos hoy?",
  "¡Muy bien, gracias por preguntar! Dispuesto a darte una mano pedagógica. ¿Qué planificamos?"
];

const DESPEDIDAS = [
  "¡Hasta luego, colega! Que tengas un excelente día de clase con tus estudiantes.",
  "¡Nos vemos pronto, Profe! Aquí estaré cuando quieras preparar la próxima unidad.",
  "¡Hasta la próxima! Mucho éxito en tu jornada escolar."
];

let indiceRotacion = 0;

export function obtenerHoraSantoDomingo() {
  try {
    const parts = new Intl.DateTimeFormat("es-DO", {
      timeZone: "America/Santo_Domingo",
      hour: "numeric",
      hour12: false
    }).formatToParts(new Date());
    const h = parts.find(p => p.type === "hour")?.value;
    return parseInt(h, 10) || 12;
  } catch (e) {
    return new Date().getHours();
  }
}

export function generarRespuestaCharlaLocal({ texto = "", nombreDocente = null }) {
  const norm = texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const hora = obtenerHoraSantoDomingo();
  const idx = indiceRotacion++;

  let lista = SALUDOS_MANANA;
  if (norm.includes("gracias") || norm.includes("agradezc")) {
    lista = AGRADECIMIENTOS;
  } else if (norm.includes("como estas") || norm.includes("como esta") || norm.includes("que tal") || norm.includes("como te va")) {
    lista = ESTADO_ANIMO;
  } else if (norm.includes("adios") || norm.includes("chao") || norm.includes("hasta manana") || norm.includes("hasta luego")) {
    lista = DESPEDIDAS;
  } else {
    if (hora >= 5 && hora < 12) lista = SALUDOS_MANANA;
    else if (hora >= 12 && hora < 19) lista = SALUDOS_TARDE;
    else lista = SALUDOS_NOCHE;
  }

  let respuesta = lista[idx % lista.length];
  if (nombreDocente && typeof nombreDocente === "string" && nombreDocente.trim()) {
    const sinPrefijo = nombreDocente.trim().replace(/^(profe|prof\.|profesor|profesora|maestro|maestra|colega)\s+/i, "");
    const primerNombre = sinPrefijo.split(" ")[0] || "colega";
    if (/Profe|colega/i.test(respuesta)) {
      respuesta = respuesta.replace(/Profe|colega/i, `Profe ${primerNombre}`);
    } else {
      respuesta = `¡Hola, Profe ${primerNombre}! ` + respuesta.replace(/^¡/, "");
    }
  }

  return {
    mensaje_chat: respuesta,
    plan_completado: false,
    modo: "charla",
    categoria: "charla",
    datos_planificacion: null,
    opciones: [
      "Planificar fracciones para 3.º",
      "Ver mis planificaciones",
      "Consultar el currículo oficial"
    ]
  };
}

export function limpiarSaludoInnecesario(texto, debePermitirSaludo = false) {
  if (debePermitirSaludo || !texto || typeof texto !== "string") return texto;
  let limpio = texto.trim();
  limpio = limpio.replace(/^(?:¡?(?:hola\b|buen(?:os)?\s*días\b|buenas\s*tardes\b|buenas\s*noches\b|saludos\b)(?:,\s*(?:profe|profesor[a]?|colega|maestro[a]?))?[!.]?\s*)+/i, "");
  limpio = limpio.replace(/^(?:(?:es\s+un\s+|qué\s+)?gusto\s+(?:en\s+)?saludar(?:te|le)?(?:,\s*(?:profe|profesor[a]?|colega|maestro[a]?))?[!.]?\s*|(?:es\s+un\s+|qué\s+)?placer\s+(?:en\s+)?saludar(?:te|le)?(?:,\s*(?:profe|profesor[a]?|colega|maestro[a]?))?[!.]?\s*|(?:un\s+placer|con\s+gusto\s+te\s+apoyo)[!.]?\s*)+/i, "");
  limpio = limpio.trim();
  return limpio || texto;
}

export const SYSTEM_PROMPT_CONVERSACIONAL = `
Eres Planifica Maestro en Modo Diálogo, colega pedagógico de apoyo para docentes de República Dominicana.
Tu personalidad es cercana, profesional, respetuosa ("Profe") y concisa.

REGLAS OBLIGATORIAS DE CONDUCTA Y RAZONAMIENTO:
1. Responde primero: En preguntas factuales o directas, la primera oración entrega de inmediato la respuesta central (quién, cuántos, qué es). Saluda únicamente al inicio de la conversación o cuando el docente salude.
2. Honestidad curricular y visual: Si un dato no existe en el currículo del grado solicitado (ej. física cuántica en 3.º de Primaria) o una imagen está oscura, borrosa o ilegible, admítelo de inmediato con total naturalidad sin inventar códigos, textos ni contenidos.
3. Precisión de fuentes: Cita documento y página cuando la respuesta provenga de la biblioteca curricular oficial. Incluye la nota de conocimiento general pedagógico únicamente en datos curriculares o normativos que no tengan respaldo en los documentos oficiales; no coloques notas fijas en consultas generales.
4. Hechos recientes: Ante eventos de última hora o noticias recientes, apóyate en fuentes verificadas. Si no dispones de datos confirmados, indica con franqueza que no fue posible verificarlo y sugiere consultar el portal del MINERD, sin afirmar que el hecho no ocurrió.
5. Clarificación de ambigüedad: Si la consulta del docente es polisémica o admite múltiples lecturas curriculares razonables (ej. "banco"), relaciónala con el contexto o perfil del docente; si la duda persiste, formula UNA sola pregunta aclaratoria ofreciendo opciones claras antes de generar un documento completo.
6. Servicios de hardware: No tienes acceso a impresoras locales. Ante peticiones de impresión, indícalo de inmediato y ofrece como salida descargar el contenido en Word o imprimirlo/guardarlo como PDF desde su dispositivo.
`;
