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

const PATRONES_BUSQUEDA_WEB = [
  "busca en la web", "buscar en la web", "busca en internet", "buscar en internet",
  "busca en google", "buscar en google", "investiga en la web", "investigar en la web",
  "busca noticias", "buscar noticias", "noticias de educacion", "noticias recientes",
  "noticias de hoy", "ultimas noticias", "busca informacion sobre", "buscar informacion sobre",
  "busca en la red", "buscar en la red", "busca online", "buscar online", "investiga sobre",
  "investiga", "investigar"
];

const PATRONES_CONOCIMIENTO_GENERAL = [
  "que es un ", "que es una ", "que es la ", "que es el ", "que son los ", "que son las ",
  "que es ", "explicame la ", "explicame el ", "explicame como ", "explicame que ",
  "por que el cielo", "por que llueve", "por que ocurre", "como funciona",
  "quien fue", "quien era", "quien es", "quienes fueron", "quienes son", "cuando nacio", "cuando murio",
  "padres de la patria", "padre de la patria", "trinitaria", "la trinitaria", "salome urena",
  "definicion de", "concepto de", "ley de", "teoria de",
  "fotosintesis", "sistema digestivo", "sistema solar", "arbol", "energia cinetica",
  "adn", "celula", "atomo", "volcan", "gravedad",
  "dime que", "dime que es", "que planta", "que flor", "que animal", "que arbol",
  "que objeto", "que es esto", "que es esta", "que dice aqui", "leeme esto", "explica esta",
  "identifica", "como se llama", "cuentame sobre",
  "cuantos ", "cuantas ", "cuanto ", "cuanta ", "donde queda ", "donde esta ", "capital de "
];

const PATRONES_NO_EDUCATIVOS = [
  "receta de cocina", "receta de sancocho", "sancocho", "mangu", "cocinar",
  "chiste", "adivinanza graciosa", "reparar carro", "reparar", "alternador", "taller mecanico",
  "mecanica automotriz", "comprar", "precio de venta",
  "pelicula", "netflix", "cancion de moda", "horoscopo", "futbol en vivo",
  "juego de pelota", "partido de beisbol", "loteria", "chismes"
];

const CATEGORIAS_6 = {
  A_CURRICULAR_RD: "A_CURRICULAR_RD",
  B_PEDAGOGIA_GENERAL: "B_PEDAGOGIA_GENERAL",
  C_CONOCIMIENTO_GENERAL: "C_CONOCIMIENTO_GENERAL",
  D_NORMATIVA_O_ACTUALIDAD: "D_NORMATIVA_O_ACTUALIDAD",
  E_TERMINO_AJENO: "E_TERMINO_AJENO",
  F_FUERA_DE_ALCANCE: "F_FUERA_DE_ALCANCE"
};

const MAPEO_TERMINOS_AJENOS = [
  {
    patrones: ["dba", "derechos basicos de aprendizaje"],
    termino: "DBA (Derechos Básicos de Aprendizaje)",
    pais_origen: "Colombia (MEN)",
    equivalente_minerd: "Indicadores de Logro y Contenidos Procedimentales",
    documento: "Adecuación Curricular del Nivel Primario (MINERD, 2023), pág. 26",
    explicacion: "En República Dominicana (MINERD) no se utilizan los DBA; el currículo oficial se organiza mediante Competencias Fundamentales, Específicas, Contenidos e Indicadores de Logro."
  },
  {
    patrones: ["aprendizajes clave", "campos formativos"],
    termino: "Aprendizajes Clave / Campos Formativos",
    pais_origen: "México (SEP)",
    equivalente_minerd: "Competencias Fundamentales y Específicas / Áreas Curriculares",
    documento: "Adecuación Curricular del Nivel Primario (MINERD, 2023), pág. 18",
    explicacion: "El sistema educativo dominicano no emplea Campos Formativos ni Aprendizajes Clave; se estructura en 7 Competencias Fundamentales y Competencias Específicas por grado y área."
  },
  {
    patrones: ["estandares basicos", "estandares basicos de competencias"],
    termino: "Estándares Básicos de Competencias",
    pais_origen: "Colombia",
    equivalente_minerd: "Competencias Fundamentales (7) y Específicas por ciclo y grado",
    documento: "Adecuación Curricular (MINERD, 2023), pág. 18",
    explicacion: "En República Dominicana, los referentes de calidad curricular son las 7 Competencias Fundamentales y los Indicadores de Logro definidos por el MINERD."
  },
  {
    patrones: ["nucleos de aprendizaje prioritarios", "nap"],
    termino: "Núcleos de Aprendizaje Prioritarios (NAP)",
    pais_origen: "Argentina",
    equivalente_minerd: "Contenidos e Indicadores de Logro de la Adecuación Curricular",
    documento: "Adecuación Curricular (MINERD, 2023), pág. 26",
    explicacion: "Los NAP corresponden a la normativa federal argentina. En República Dominicana se aplican los contenidos e indicadores de logro de la Adecuación Curricular 2023."
  },
  {
    patrones: ["objetivos de aprendizaje", "oa "],
    termino: "Objetivos de Aprendizaje (OA)",
    pais_origen: "Chile (MINEDUC)",
    equivalente_minerd: "Indicadores de Logro y Competencias Específicas",
    documento: "Adecuación Curricular (MINERD, 2023), pág. 26",
    explicacion: "En el sistema dominicano (MINERD), la concreción de los aprendizajes esperados se denomina Indicadores de Logro."
  },
  {
    patrones: ["malla curricular"],
    termino: "Malla Curricular",
    pais_origen: "Término no oficial (común en varios países)",
    equivalente_minerd: "Diseño Curricular / Adecuación Curricular / Matriz de Competencias y Contenidos",
    documento: "Adecuación Curricular (MINERD, 2023), pág. 12",
    explicacion: "El término oficial del MINERD en la Adecuación Curricular 2023 es Diseño Curricular o Matriz de Competencias, Contenidos e Indicadores de Logro."
  }
];

const PATRONES_NORMATIVA_ACTUALIDAD = [
  "ano escolar", "año escolar", "calendario escolar", "cuando inician las clases",
  "cuando terminan las clases", "inicio de clases", "fin de clases", "vacaciones escolares",
  "ordenanza", "resolucion", "circular minerd", "noticias de hoy", "noticias recientes",
  "ministro de educacion", "efemerides patrias", "efemerides", "concurso docente", "induccion docente",
  "concurso de oposicion", "concurso de oposicion docente", "oposicion docente", "ordenanza de evaluacion", "sistema de evaluacion"
];

const PATRONES_PEDAGOGIA_GENERAL = [
  "estrategias para motivar", "motivar a los estudiantes", "estrategias de motivacion",
  "disciplina en el aula", "manejo de disciplina", "control de grupo",
  "dinamicas de grupo", "romper el hielo", "tecnicas de comprension lectora",
  "evaluar con rubricas", "como elaborar una rubrica", "organizacion del aula",
  "inclusion educativa", "adaptaciones curriculares", "trabajo colaborativo",
  "gestion del tiempo escolar", "aprendizaje basado en proyectos",
  "estrategias de ensenanza", "tecnicas didacticas", "recursos didacticos",
  "estrategias ludicas", "lectura compartida", "estrategias de lectura", "estrategias pedagogicas",
  "atencion a la diversidad", "ritmos de aprendizaje", "estilos de aprendizaje", "diversidad en el aula",
  "retroalimentacion", "retroalimentacion formativa", "retroalimentacion constructiva", "evaluacion formativa",
  "cierre de la clase", "cierre de clase"
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
      categoria_6: CATEGORIAS_6.F_FUERA_DE_ALCANCE,
      codigo_categoria: "F",
      confianza: 0.9,
      motivo: "Texto vacío o sin caracteres válidos.",
      esMixtoConSaludo: false,
      opciones: OPCIONES_ACLARACION
    };
  }

  // 0. Detección de Término Ajeno (Categoría E)
  for (const m of MAPEO_TERMINOS_AJENOS) {
    if (m.patrones.some(p => contienePalabraOFrase(norm, p))) {
      return {
        categoria: "consulta_curricular",
        tipo: "curricular",
        categoria_6: CATEGORIAS_6.E_TERMINO_AJENO,
        codigo_categoria: "E",
        confianza: 0.96,
        motivo: `Consulta identificada con término ajeno al currículo MINERD: ${m.termino} (${m.pais_origen}).`,
        termino_ajeno: m,
        esMixtoConSaludo: false
      };
    }
  }

  // 1. Detectar patrones no educativos o domésticos evidentes (Categoría F)
  const esNoEducativo = PATRONES_NO_EDUCATIVOS.some(p => contienePalabraOFrase(norm, p));
  const pidePlanReceta = contienePalabraOFrase(norm, "plan") && (contienePalabraOFrase(norm, "grado") || contienePalabraOFrase(norm, "lengua") || contienePalabraOFrase(norm, "texto instructivo"));
  if (esNoEducativo && !pidePlanReceta) {
    return {
      categoria: "ambigua",
      tipo: "ambigua",
      categoria_6: CATEGORIAS_6.F_FUERA_DE_ALCANCE,
      codigo_categoria: "F",
      confianza: 0.92,
      motivo: "Consulta identificada como tema doméstico/no educativo fuera del ámbito escolar.",
      mensaje_rechazo: "Profe, como colega pedagógico de Planifica Maestro mi labor se enfoca exclusivamente en el apoyo educativo y curricular. ¿En qué planificación o contenido escolar te puedo colaborar hoy?",
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
      categoria_6: CATEGORIAS_6.B_PEDAGOGIA_GENERAL,
      codigo_categoria: "B",
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

  // 3.1 Categoría D: Normativa o Actualidad MINERD
  const tieneNormativaActualidad = PATRONES_NORMATIVA_ACTUALIDAD.some(p => contienePalabraOFrase(norm, p));
  if (tieneNormativaActualidad && !tienePlanificacion) {
    return {
      categoria: "consulta_curricular",
      tipo: "web",
      categoria_6: CATEGORIAS_6.D_NORMATIVA_O_ACTUALIDAD,
      codigo_categoria: "D",
      confianza: 0.94,
      motivo: "Consulta sobre normativa oficial, calendario escolar o actualidad educativa MINERD.",
      requiere_tavily: true,
      esMixtoConSaludo: false
    };
  }

  // 3.2 Categoría B: Pedagogía General Transversal (sin grado o área curricular específica)
  const tienePedagogiaGeneral = PATRONES_PEDAGOGIA_GENERAL.some(p => contienePalabraOFrase(norm, p));
  const tieneGradoEspecifico = norm.includes("grado") || norm.includes("ciclo") || norm.includes("primaria") || norm.includes("secundaria") || norm.includes("1ro") || norm.includes("2do") || norm.includes("3ro") || norm.includes("4to") || norm.includes("5to") || norm.includes("6to");
  if (tienePedagogiaGeneral && !tieneGradoEspecifico && !tienePlanificacion) {
    return {
      categoria: "consulta_curricular",
      tipo: "curricular",
      categoria_6: CATEGORIAS_6.B_PEDAGOGIA_GENERAL,
      codigo_categoria: "B",
      confianza: 0.92,
      motivo: "Consulta sobre estrategias didácticas y pedagogía general transversal sin grado escolar específico.",
      esMixtoConSaludo: false
    };
  }

  // 4. Caso Mixto: Saludo + Planificación (ej. "hola, planifícame fracciones para 3.º")
  if (tieneCharla && (tienePlanificacion || (tieneTemaCurricular && (norm.includes("3") || norm.includes("grado") || norm.includes("para"))))) {
    return {
      categoria: "planificacion",
      tipo: "curricular",
      categoria_6: CATEGORIAS_6.A_CURRICULAR_RD,
      codigo_categoria: "A",
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
      categoria_6: CATEGORIAS_6.A_CURRICULAR_RD,
      codigo_categoria: "A",
      confianza: 0.85,
      motivo: "Planificación pedagógica complementada con datos actuales.",
      esMixtoConSaludo: false
    };
  }

  // Detección de Búsqueda Web explícita
  const pideBusquedaWeb = PATRONES_BUSQUEDA_WEB.some(p => contienePalabraOFrase(norm, p)) ||
    ((norm.startsWith("busca ") || norm.startsWith("buscar ") || norm.startsWith("investiga ")) && !tienePlanificacion && !tieneTemaCurricular);

  if (pideBusquedaWeb && !tienePlanificacion) {
    const esActualidad = contienePalabraOFrase(norm, "noticias") || contienePalabraOFrase(norm, "hoy") || contienePalabraOFrase(norm, "recientes");
    return {
      categoria: "busqueda_web",
      tipo: "web",
      categoria_6: esActualidad ? CATEGORIAS_6.D_NORMATIVA_O_ACTUALIDAD : CATEGORIAS_6.C_CONOCIMIENTO_GENERAL,
      codigo_categoria: esActualidad ? "D" : "C",
      confianza: 0.96,
      motivo: "Solicitud explícita de búsqueda web o investigación externa.",
      esMixtoConSaludo: tieneCharla
    };
  }

  // 5. Saludo / Charla pura
  if (tieneCharla && !tienePlanificacion && !tieneConsultaCurricular && !tieneTemaCurricular && !tieneConocimientoGeneral) {
    return {
      categoria: "charla",
      tipo: "charla",
      categoria_6: CATEGORIAS_6.B_PEDAGOGIA_GENERAL,
      codigo_categoria: "B",
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
      categoria_6: CATEGORIAS_6.A_CURRICULAR_RD,
      codigo_categoria: "A",
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
      categoria_6: CATEGORIAS_6.A_CURRICULAR_RD,
      codigo_categoria: "A",
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
      categoria_6: CATEGORIAS_6.C_CONOCIMIENTO_GENERAL,
      codigo_categoria: "C",
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
      categoria_6: CATEGORIAS_6.C_CONOCIMIENTO_GENERAL,
      codigo_categoria: "C",
      confianza: 0.80,
      motivo: "Pregunta informativa general.",
      esMixtoConSaludo: false
    };
  }

  // 10. Fallback determinista: ambigua
  return {
    categoria: "ambigua",
    tipo: "ambigua",
    categoria_6: CATEGORIAS_6.F_FUERA_DE_ALCANCE,
    codigo_categoria: "F",
    confianza: 0.45,
    motivo: "Texto ambiguo o fragmentario sin indicios pedagógicos claros.",
    esMixtoConSaludo: false,
    opciones: OPCIONES_ACLARACION
  };
}

function clasificarCategoria6(texto, perfil = null) {
  const res = clasificarPorReglas(texto);
  return {
    codigo: res.codigo_categoria || "C",
    categoria: res.categoria_6 || CATEGORIAS_6.C_CONOCIMIENTO_GENERAL,
    motivo: res.motivo,
    termino_ajeno: res.termino_ajeno || null,
    resultado_base: res
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

  const promptClasificacion = `Analiza la siguiente consulta de un docente y clasifícala estrictamente en una de estas categorías:
1. "charla": Saludos, despedidas, fórmulas de cortesía, agradecimientos o conversación informal.
2. "busqueda_web": Si solicita explícitamente buscar en la web, en internet, noticias actuales o datos externos fuera del currículo.
3. "conocimiento_general": Conceptos, hechos históricos, definiciones o ciencia que no son una clase ni requieren el currículo oficial.
4. "planificacion": Si solicita estructurar, diseñar o elaborar una clase, actividad, momento didáctico o unidad escolar.
5. "consulta_curricular": Preguntas sobre normativas, indicadores de logro, competencias o contenidos del currículo oficial MINERD.
6. "accion_app": Comandos de control de la app (biblioteca, perfil, descargar word, cambiar esquema/periodo).
7. "ambigua": Si es algo no educativo, doméstico, confuso o fragmentario.

Consulta: "${texto}"

Responde ÚNICAMENTE un objeto JSON válido con esta interfaz:
{
  "categoria": "charla" | "busqueda_web" | "conocimiento_general" | "planificacion" | "consulta_curricular" | "accion_app" | "ambigua",
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

    if (res && res.categoria && ["charla", "busqueda_web", "conocimiento_general", "planificacion", "consulta_curricular", "accion_app", "ambigua"].includes(res.categoria)) {
      const cat = res.categoria;
      const mapaTipo = {
        charla: "charla",
        busqueda_web: "web",
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
  clasificarCategoria6,
  normalizarTexto,
  OPCIONES_ACLARACION,
  CATEGORIAS_6,
  MAPEO_TERMINOS_AJENOS,
  PATRONES_NORMATIVA_ACTUALIDAD,
  PATRONES_PEDAGOGIA_GENERAL
};
