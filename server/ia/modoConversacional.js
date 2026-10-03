/**
 * server/ia/modoConversacional.js
 * 
 * Motor del Modo Conversacional y Respuestas Locales de Alta Variedad ($0, < 50 ms).
 * Maneja saludos, cortesía y conocimiento general con personalidad de colega pedagógico.
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

function obtenerHoraSantoDomingo() {
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

function generarRespuestaCharlaLocal({ texto = "", nombreDocente = null }) {
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
    const primerNombre = nombreDocente.trim().split(" ")[0];
    respuesta = respuesta.replace(/Profe|colega/i, `Profe ${primerNombre}`);
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

const SYSTEM_PROMPT_CONVERSACIONAL = `
Eres Planifica Maestro en Modo Diálogo, un colega pedagógico de apoyo para docentes de República Dominicana.
Tu personalidad es:
- Cercana, profesional, cálida y concisa.
- Hablas en español dominicano neutral y formal-educativo.
- Si conoces el nombre del docente, dirígete con respeto y afecto profesional ("Profe").
- Si te hacen una pregunta de conocimiento general, responde con claridad pedagógica y agrega al final un aviso breve aclarando que es conocimiento general, no una prescripción del currículo oficial MINERD, y ofrece llevar el tema a una actividad de clase.
- No inventes competencias ni finjas emociones humanas. Admite con honestidad lo que no sepas.
`;

module.exports = {
  generarRespuestaCharlaLocal,
  SYSTEM_PROMPT_CONVERSACIONAL,
  obtenerHoraSantoDomingo
};
