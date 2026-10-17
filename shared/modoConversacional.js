/**
 * shared/modoConversacional.js
 * 
 * Modo conversacional canónico para Planifica Maestro.
 * Compartido entre Cloudflare Worker y Node.js.
 */

const SALUDOS_MANANA = [
  "¡Buenos días, colega! ¿Qué tema o grado tenemos previsto organizar hoy?",
  "¡Muy buenos días! Espero que tu jornada escolar marche excelente. ¿Qué vamos a planificar?",
  "¡Buenos días, Profe! Listo para apoyarte con tus clases. ¿Con qué grado empezamos hoy?"
];

const SALUDOS_TARDE = [
  "¡Buenas tardes, Profe! ¿Qué clase o actividad didáctica tenemos pendiente para hoy?",
  "¡Buenas tardes, colega! Con gusto te apoyo. ¿En qué área o tema vamos a trabajar?",
  "¡Muy buenas tardes! Listo para estructurar tus actividades pedagógicas. ¿Qué necesitas?"
];

const SALUDOS_NOCHE = [
  "¡Buenas noches, colega! ¿Dejamos lista la planificación de mañana o revisamos algún tema?",
  "¡Buenas noches, Profe! Un buen momento para adelantar el trabajo del aula. ¿Qué grado preparamos?",
  "¡Muy buenas noches! Aquí estoy para hacerte la labor más ligera. ¿En qué te colaboro?"
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

export function obtenerHoraSantoDomingo(fecha = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Santo_Domingo",
      hour: "numeric",
      hourCycle: "h23"
    });
    const parts = formatter.formatToParts(fecha);
    const h = parseInt(parts.find(p => p.type === "hour")?.value, 10);
    return isNaN(h) ? 12 : h;
  } catch (e) {
    const utcHours = fecha.getUTCHours();
    const localHour = (utcHours - 4 + 24) % 24;
    return localHour;
  }
}

export function obtenerFranjaSaludo(fecha = new Date()) {
  const hora = obtenerHoraSantoDomingo(fecha);
  if (hora >= 5 && hora < 12) return "manana";
  if (hora >= 12 && hora < 19) return "tarde";
  return "noche";
}

export function sanearNombreDocente(nombre) {
  if (!nombre || typeof nombre !== "string") return null;
  // 1. Longitud <= 50 caracteres
  let limpio = nombre.slice(0, 50);
  // 2. Sin saltos de línea ni caracteres de control
  limpio = limpio.replace(/[\x00-\x1F\x7F-\x9F\r\n\t]/g, "").trim();
  // 3. Sanitizar caracteres extraños o scripts (solo letras, espacios, puntos, guiones)
  limpio = limpio.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s.-]/g, "").trim();
  // 4. Si no hay nombre real o es marcador genérico, retornar null
  if (!limpio || /^(docente_?default|anonimo|anónimo|default|usuario|null|undefined)$/i.test(limpio)) {
    return null;
  }
  return limpio;
}

export function generarRespuestaCharlaLocal({ texto = "", nombreDocente = null, reloj = null, fecha = null }) {
  const norm = texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const fechaActual = fecha || (typeof reloj === "function" ? reloj() : new Date());
  const franja = obtenerFranjaSaludo(fechaActual);
  const idx = indiceRotacion++;

  let lista = SALUDOS_MANANA;
  if (norm.includes("gracias") || norm.includes("agradezc")) {
    lista = AGRADECIMIENTOS;
  } else if (norm.includes("como estas") || norm.includes("como esta") || norm.includes("que tal") || norm.includes("como te va")) {
    lista = ESTADO_ANIMO;
  } else if (norm.includes("adios") || norm.includes("chao") || norm.includes("hasta manana") || norm.includes("hasta luego")) {
    lista = DESPEDIDAS;
  } else {
    if (franja === "manana") lista = SALUDOS_MANANA;
    else if (franja === "tarde") lista = SALUDOS_TARDE;
    else lista = SALUDOS_NOCHE;
  }

  let respuesta = lista[idx % lista.length];
  const nombreSaneado = sanearNombreDocente(nombreDocente);

  if (nombreSaneado) {
    const sinPrefijo = nombreSaneado.replace(/^(profe|prof\.|profesor|profesora|maestro|maestra|colega)\s+/i, "");
    const primerNombre = sinPrefijo.split(/\s+/)[0];
    if (/Profe|colega/i.test(respuesta)) {
      respuesta = respuesta.replace(/Profe|colega/i, primerNombre ? `Profe ${primerNombre}` : "Profe");
    } else {
      respuesta = `¡Hola, Profe ${primerNombre}! ` + respuesta.replace(/^¡/, "");
    }
  } else {
    // Si no hay nombre: no inventar ninguno ni usar marcadores genéricos visibles (remover 'colega', 'Profe', etc.)
    respuesta = respuesta
      .replace(/,\s*(?:colega|Profe)\b/gi, "")
      .replace(/\b(?:colega|Profe)\s*,?\s*/gi, "")
      .replace(/¡\s*,?\s*/g, "¡")
      .trim();
  }

  // Asegurar signos ¡! y ¿? correctos en español
  if (!respuesta.startsWith("¡")) {
    respuesta = "¡" + respuesta;
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
7. Términos de otros países: Si el docente pregunta por conceptos curriculares ajenos al MINERD (DBA, Aprendizajes Clave, Estándares Básicos, NAP, Objetivos de Aprendizaje OA), aclara en la primera frase que el término proviene de otro sistema educativo y ofrece de inmediato el término oficial equivalente del MINERD según la Adecuación Curricular 2023 (Competencias Fundamentales, Específicas, Contenidos e Indicadores de Logro).
8. Salud y primeros auxilios: Ante síntomas, accidentes o medicamentos en la escuela, prioriza la vida del estudiante. Nunca prescribas ni autorices administrar medicamentos; remite de inmediato al protocolo de salud escolar, enfermería, dirección del centro y aviso urgente a los padres. Ante plantas o sustancias dudosas, advierte taxativamente el riesgo de toxicidad.
9. Consultas no educativas (fuera de alcance): Ante solicitudes domésticas o ajenas a la escuela (cocina casera, reparar vehículos, juegos de azar), declina amablemente en la primera frase ("Profe, como colega pedagógico mi labor se enfoca en apoyar tus clases...") y redirige al trabajo docente.
`;
