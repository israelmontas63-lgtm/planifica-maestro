/**
 * server/ia/clasificadorIntencion.js
 * 
 * Portero de Intención Pedagógica Multicapa (Capa 1: Reglas $0 + Capa 2: Enrutador IA).
 * Clasifica cada mensaje en una de 6 categorías:
 * - "charla": Saludos, despedidas, fórmulas de cortesía, agradecimientos o conversación informal.
 * - "conocimiento_general": Explicaciones conceptuales, científicas o históricas no estructuradas como clase.
 * - "planificacion": Solicitud explícita de diseñar o estructurar una clase, momento didáctico o unidad.
 * - "consulta_curricular": Preguntas sobre normativas, indicadores, competencias o mallas del MINERD.
 * - "accion_app": Comandos de control sobre la aplicación (biblioteca, perfil, descarga docx, esquemas).
 * - "ambigua": Mensajes fragmentarios, vagos, domésticos o no educativos que requieren aclaración.
 */

function normalizarTexto(txt) {
  if (!txt || typeof txt !== "string") return "";
  return txt
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // sin acentos
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function contienePalabraOFrase(textoNorm, patron) {
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

const OPCIONES_ACLARACION = [
  "Planificar una clase oficial MINERD",
  "Consultar el currículo oficial",
  "Hacer una pregunta general"
];

/**
 * Capa 1: Clasificación determinista basada en reglas lingüísticas normalizadas ($0)
 */
function clasificarPorReglas(texto) {
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

  // 4. Caso Mixto: Saludo + Planificación (ej. "hola, planifícame fracciones para 3.º")
  if (tieneCharla && (tienePlanificacion || (tieneTemaCurricular && (norm.includes("3") || norm.includes("grado") || norm.includes("para"))))) {
    return {
      categoria: "planificacion",
      tipo: "curricular",
      confianza: 0.95,
      motivo: "Mensaje mixto con saludo y solicitud explícita de planificación pedagógica.",
      esMixtoConSaludo: true
    };
  }

  // Caso Mixto: Curricular + Datos Actuales / Web (compatibilidad con test existente)
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
 * Capa 2: Clasificación con IA a través de enrutadorIA.js
 * Cumple estrictamente con:
 * - Pasar por enrutadorIA (respaldo, circuit breaker, control de cuota en gestorGasto).
 * - Cero llamadas directas a raw fetch o claves directas.
 * - Si no hay cuota o circuit breaker abierto, fallback seguro a reglas locales.
 */
async function clasificarConIA({ texto, env = process.env, timeoutMs = 2500 }) {
  let enrutarPeticion = null;
  try {
    const routerMod = require("./enrutadorIA.js");
    enrutarPeticion = routerMod.enrutarPeticion;
  } catch (e) {
    return null;
  }

  if (!enrutarPeticion) return null;

  const promptClasificacion = `Analiza la siguiente consulta de un docente y clasifícala estrictamente en una de estas 6 categorías:
1. "charla": Saludos, despedidas, fórmulas de cortesía, agradecimientos o conversación informal.
2. "conocimiento_general": Conceptos, hechos históricos, definiciones o ciencia que no son una clase ni requieren el currículo oficial.
3. "planificacion": Si solicita estructurar, diseñar o elaborar una clase, actividad, momento didáctico o unidad escolar.
4. "consulta_curricular": Preguntas sobre normativas, indicadores de logro, competencias o contenidos del currículo oficial MINERD.
5. "accion_app": Comandos de control de la app (biblioteca, perfil, descargar word, cambiar esquema/periodo).
6. "ambigua": Si es algo no educativo, doméstico, confuso o fragmentario.

Consulta: "${texto}"

Responde ÚNICAMENTE un objeto JSON válido con esta interfaz:
{
  "categoria": "charla" | "conocimiento_general" | "planificacion" | "consulta_curricular" | "accion_app" | "ambigua",
  "confianza": 0.85,
  "motivo": "explicación breve de 1 frase",
  "esMixtoConSaludo": false
}`;

  try {
    const res = await enrutarPeticion({
      tema: "Clasificación de intención pedagógica",
      prompt: promptClasificacion,
      env,
      timeoutMs: timeoutMs || 2500
    });

    if (res && res.categoria && ["charla", "conocimiento_general", "planificacion", "consulta_curricular", "accion_app", "ambigua"].includes(res.categoria)) {
      const cat = res.categoria;
      const mapaTipo = {
        charla: "charla",
        conocimiento_general: "web",
        planificacion: "curricular",
        consulta_curricular: "curricular",
        accion_app: "accion_app",
        ambigua: "ambigua"
      };

      return {
        categoria: cat,
        tipo: mapaTipo[cat] || "ambigua",
        confianza: typeof res.confianza === "number" ? res.confianza : 0.85,
        motivo: res.motivo || "Clasificado por Enrutador IA.",
        esMixtoConSaludo: Boolean(res.esMixtoConSaludo),
        opciones: cat === "ambigua" ? OPCIONES_ACLARACION : undefined
      };
    }
  } catch (err) {
    // Si la cuota se agota o hay timeout, fallback transparente a reglas locales
  }

  return null;
}

/**
 * Clasificador principal de intención
 * 
 * @param {Object} options
 * @param {string} options.texto - Texto de la consulta o transcripción de voz
 * @param {string} [options.temaVision] - Tema previamente identificado por visión
 * @param {Object} [options.env] - Variables de entorno (Node o Worker)
 * @param {number} [options.timeoutMs] - Tiempo límite para Capa 2
 * @returns {Promise<{ categoria: string, tipo: string, confianza: number, motivo: string, esMixtoConSaludo?: boolean, opciones?: string[] }>}
 */
async function clasificarIntencion({ texto = "", temaVision = null, env = process.env, apiKey = null, timeoutMs = 2500 }) {
  const textoParaEvaluar = temaVision ? `${temaVision}. ${texto}` : texto;

  // 1. Capa 1: Reglas deterministas inmediatas (0 ms, $0.00)
  const resultadoReglas = clasificarPorReglas(textoParaEvaluar);

  // Si la confianza es alta (>= 0.75), retornar de inmediato sin consultar IA
  if (resultadoReglas.confianza >= 0.75) {
    return resultadoReglas;
  }

  // 2. Capa 2: Si la confianza es baja y no es charla evidente, pasar por enrutadorIA
  try {
    const envFinal = env || (apiKey ? { ...process.env, GEMINI_API_KEY: apiKey } : process.env);
    const resultadoIA = await clasificarConIA({ texto: textoParaEvaluar, env: envFinal, timeoutMs });
    if (resultadoIA) {
      return resultadoIA;
    }
  } catch (e) {
    // Fallback garantizado a las reglas
  }

  // 3. Fallback garantizado: siempre devolver el resultado determinista
  return resultadoReglas;
}

module.exports = {
  clasificarIntencion,
  clasificarPorReglas,
  normalizarTexto,
  OPCIONES_ACLARACION
};
