/**
 * worker/clasificadorIntencion.js
 * 
 * Portero de Intención Pedagógica Multicapa para Cloudflare Worker (ESM).
 * Idéntico en reglas y comportamiento a server/ia/clasificadorIntencion.js.
 */

export function normalizarTexto(txt) {
  if (!txt || typeof txt !== "string") return "";
  return txt
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // sin acentos
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function contienePalabraOFrase(textoNorm, patron) {
  const patNorm = normalizarTexto(patron);
  if (!patNorm) return false;
  const escaped = patNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(?:^|\\s)${escaped}(?:$|\\s)`, "i");
  return regex.test(` ${textoNorm} `);
}

// ── PATRONES DETERMINISTAS PARA CAPA 1 (0 ms, $0.00) ──

const PATRONES_CHARLA_EXACTOS = new Set([
  "hola", "buenas", "buen dia", "buenos dias", "buenas tardes", "buenas noches",
  "saludos", "que tal", "como estas", "como esta", "como te va", "que lo que",
  "klk", "dimelo", "como tu ta", "como tu estas", "gracias", "muchas gracias",
  "mil gracias", "te lo agradezco", "adios", "chao", "hasta luego", "hasta manana",
  "hasta pronto", "nos vemos", "cuidate", "saludos cordiales", "muy amable"
]);

const PATRONES_CHARLA = [
  "hola", "buen dia", "buenos dias", "buenas tardes", "buenas noches", "saludos",
  "que tal", "como estas", "como esta", "como te va", "que lo que", "klk", "dimelo",
  "gracias", "muchas gracias", "mil gracias", "adios", "chao", "hasta luego",
  "hasta manana", "hasta pronto", "cuidate", "saludos cordiales", "muy amable"
];

const PATRONES_ACCION_APP = [
  "abre mi biblioteca", "abrir biblioteca", "abrir mi biblioteca", "ver biblioteca",
  "mis planificaciones", "ver planificaciones", "ver mis planes", "mostrar planes",
  "cambia el esquema", "cambiar esquema", "cambiar a conbase", "cambia a conbase",
  "cambiar a minerd", "cambia a minerd", "abre mi perfil", "abrir perfil",
  "editar perfil", "ver mi perfil", "descarga en word", "descargar en word",
  "exportar a docx", "exportar a word", "descargar docx", "limpiar chat",
  "borrar chat", "reiniciar chat", "cerrar sesion"
];

const PATRONES_CONSULTA_CURRICULAR = [
  "que indicadores", "cuales indicadores", "indicadores de logro", "indicador de logro",
  "que competencias", "cuales competencias", "competencias fundamentales", "competencias especificas",
  "que dice el curriculo", "segun el curriculo", "en el curriculo", "adecuacion curricular",
  "diseno curricular", "cuales son los contenidos", "que contenidos tiene",
  "contenidos conceptuales", "contenidos procedimentales", "contenidos actitudinales",
  "malla curricular", "matriz curricular", "registro de grado", "ordenanza de evaluacion",
  "criterios de evaluacion oficial"
];

const PATRONES_PLANIFICACION = [
  "planificacion", "planificar", "planifica", "plan de clase", "plan diario", "plan semanal",
  "plan mensual", "plan anual", "plan de manana", "secuencia didactica", "unidad de aprendizaje",
  "situacion de aprendizaje", "actividad de inicio", "actividad de desarrollo", "actividad de cierre",
  "momentos de la clase", "hazme un plan", "crea un plan", "disena un plan", "preparame una clase",
  "elabora una clase", "estructura una clase", "rubrica de evaluacion", "instrumento de evaluacion",
  "para 1er grado", "para 2do grado", "para 3er grado", "para 4to grado", "para 5to grado", "para 6to grado",
  "1er grado", "2do grado", "3er grado", "4to grado", "5to grado", "6to grado",
  "1ro", "2do", "3ro", "4to", "5to", "6to", "primer grado", "segundo grado", "tercer grado",
  "cuarto grado", "quinto grado", "sexto grado", "primaria", "secundaria"
];

const PATRONES_TEMAS_CURRICULARES = [
  "fracciones", "suma", "resta", "multiplicacion", "division", "geometria",
  "la tarjeta de identidad", "la receta", "la noticia", "el cuento", "el informe de lectura",
  "el articulo expositivo", "texto instructivo", "letrero", "conteo", "recta numerica",
  "ciencias de la naturaleza", "lengua espanola", "matematica", "ciencias sociales"
];

const PATRONES_CONOCIMIENTO_GENERAL = [
  "que es un ", "que es una ", "que es la ", "que es el ", "que son los ", "que son las ",
  "que es ", "explicame la ", "explicame el ", "explicame como ", "explicame que ",
  "por que el cielo", "por que llueve", "por que ocurre", "como funciona",
  "quien fue", "quien era", "quien es", "cuando nacio", "cuando murio",
  "definicion de", "concepto de", "ley de", "teoria de",
  "fotosintesis", "sistema digestivo", "sistema solar", "arbol", "energia cinetica",
  "adn", "celula", "atomo", "volcan", "gravedad"
];

const PATRONES_NO_EDUCATIVOS = [
  "receta de cocina", "receta de sancocho", "sancocho", "mangu", "cocinar",
  "chiste", "adivinanza graciosa", "reparar carro", "comprar", "precio de venta",
  "pelicula", "netflix", "cancion de moda", "horoscopo", "futbol en vivo",
  "juego de pelota", "loteria", "chismes"
];

export const OPCIONES_ACLARACION = [
  "Planificar una clase oficial MINERD",
  "Consultar el currículo oficial",
  "Hacer una pregunta general"
];

/**
 * Capa 1: Clasificación determinista basada en reglas lingüísticas normalizadas ($0)
 */
export function clasificarPorReglas(texto) {
  const norm = normalizarTexto(texto);
  if (!norm) {
    return {
      categoria: "ambigua",
      tipo: "ambigua",
      confianza: 0.9,
      motivo: "Texto vacío o sin caracteres válidos.",
      esMixtoConSaludo: false,
      opciones: OPCIONES_ACLARACION
    };
  }

  // 1. Detectar patrones no educativos o domésticos evidentes
  const esNoEducativo = PATRONES_NO_EDUCATIVOS.some(p => contienePalabraOFrase(norm, p));
  const pidePlanReceta = contienePalabraOFrase(norm, "plan") && (contienePalabraOFrase(norm, "grado") || contienePalabraOFrase(norm, "lengua") || contienePalabraOFrase(norm, "texto instructivo"));
  if (esNoEducativo && !pidePlanReceta) {
    return {
      categoria: "ambigua",
      tipo: "ambigua",
      confianza: 0.92,
      motivo: "Consulta identificada como tema doméstico/no educativo fuera del ámbito escolar.",
      esMixtoConSaludo: false,
      opciones: OPCIONES_ACLARACION
    };
  }

  // 2. Acciones de app
  const tieneAccionApp = PATRONES_ACCION_APP.some(p => contienePalabraOFrase(norm, p));
  if (tieneAccionApp) {
    return {
      categoria: "accion_app",
      tipo: "accion_app",
      confianza: 0.95,
      motivo: "Comando de acción sobre la aplicación o navegación.",
      esMixtoConSaludo: false
    };
  }

  // 3. Evaluar señales de cada categoría
  const tieneCharla = PATRONES_CHARLA.some(p => contienePalabraOFrase(norm, p)) || PATRONES_CHARLA_EXACTOS.has(norm);
  const tienePlanificacion = PATRONES_PLANIFICACION.some(p => contienePalabraOFrase(norm, p));
  const tieneConsultaCurricular = PATRONES_CONSULTA_CURRICULAR.some(p => contienePalabraOFrase(norm, p));
  const tieneTemaCurricular = PATRONES_TEMAS_CURRICULARES.some(p => contienePalabraOFrase(norm, p));
  const tieneConocimientoGeneral = PATRONES_CONOCIMIENTO_GENERAL.some(p => contienePalabraOFrase(norm, p));

  // 4. Caso Mixto: Saludo + Planificación
  if (tieneCharla && (tienePlanificacion || (tieneTemaCurricular && (norm.includes("3") || norm.includes("grado") || norm.includes("para"))))) {
    return {
      categoria: "planificacion",
      tipo: "curricular",
      confianza: 0.95,
      motivo: "Mensaje mixto con saludo y solicitud explícita de planificación pedagógica.",
      esMixtoConSaludo: true
    };
  }

  // Caso Mixto: Curricular + Datos Actuales / Web
  const pideDatosActuales = contienePalabraOFrase(norm, "datos actuales") || contienePalabraOFrase(norm, "noticias recientes");
  if ((tienePlanificacion || tieneTemaCurricular) && pideDatosActuales) {
    return {
      categoria: "planificacion",
      tipo: "mixta",
      confianza: 0.85,
      motivo: "Planificación pedagógica complementada con datos actuales.",
      esMixtoConSaludo: false
    };
  }

  // 5. Saludo / Charla pura
  if (tieneCharla && !tienePlanificacion && !tieneConsultaCurricular && !tieneTemaCurricular && !tieneConocimientoGeneral) {
    return {
      categoria: "charla",
      tipo: "charla",
      confianza: 0.95,
      motivo: "Mensaje de saludo, cortesía o conversación informal.",
      esMixtoConSaludo: false
    };
  }

  // 6. Consulta Curricular específica
  if (tieneConsultaCurricular) {
    return {
      categoria: "consulta_curricular",
      tipo: "curricular",
      confianza: 0.92,
      motivo: "Consulta directa sobre contenidos, normativas o indicadores de la malla curricular MINERD.",
      esMixtoConSaludo: false
    };
  }

  // 7. Planificación Curricular
  if (tienePlanificacion || (tieneTemaCurricular && norm.split(" ").length <= 5)) {
    return {
      categoria: "planificacion",
      tipo: "curricular",
      confianza: tienePlanificacion && tieneTemaCurricular ? 0.98 : 0.90,
      motivo: "Solicitud directa de diseño pedagógico, clase o unidad de aprendizaje.",
      esMixtoConSaludo: false
    };
  }

  // 8. Conocimiento General
  if (tieneConocimientoGeneral) {
    return {
      categoria: "conocimiento_general",
      tipo: "web",
      confianza: 0.90,
      motivo: "Consulta conceptual o informativa general.",
      esMixtoConSaludo: false
    };
  }

  // 9. Frases interrogativas generales
  if (norm.startsWith("que ") || norm.startsWith("quien ") || norm.startsWith("donde ") || norm.startsWith("por que ") || norm.startsWith("como ")) {
    return {
      categoria: "conocimiento_general",
      tipo: "web",
      confianza: 0.80,
      motivo: "Pregunta informativa general.",
      esMixtoConSaludo: false
    };
  }

  // 10. Fallback determinista: ambigua
  return {
    categoria: "ambigua",
    tipo: "ambigua",
    confianza: 0.45,
    motivo: "Texto ambiguo o fragmentario sin indicios pedagógicos claros.",
    esMixtoConSaludo: false,
    opciones: OPCIONES_ACLARACION
  };
}

/**
 * Clasificador principal para Cloudflare Worker
 */
export async function clasificarIntencion({ texto = "", temaVision = null, env = {}, timeoutMs = 2500 }) {
  const textoParaEvaluar = temaVision ? `${temaVision}. ${texto}` : texto;
  const resultadoReglas = clasificarPorReglas(textoParaEvaluar);

  if (resultadoReglas.confianza >= 0.75) {
    return resultadoReglas;
  }

  return resultadoReglas;
}
