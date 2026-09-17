const express = require("express");
const router = express.Router();
const { LEVELS } = require("../curriculum/levels");
const { GoogleGenAI } = require("@google/genai");
const {
  registrarPlan,
  registrarAjustesManuales,
  obtenerResumenPatrones
} = require("../curriculum/teacherHistory");
const {
  consultarEstadoCuota,
  verificarYConsumirCuota
} = require("../curriculum/quotaManager");
const {
  obtenerContextoConBase,
  COBERTURA_CON_BASE
} = require("../curriculum/contextoConBase");

const geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Modelos optimizados para máxima velocidad y tolerancia a fallos
const PRIMARY_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest"
];

async function generarConGeminiRapido({ contents, systemInstruction, responseMimeType = "application/json" }) {
  let ultimoError = null;
  for (const model of PRIMARY_MODELS) {
    // 1. Intento rápido con thinkingBudget: 0 (para modelos que lo soporten) y temperatura determinista 0.0
    try {
      const config = { responseMimeType, temperature: 0.0 };
      if (systemInstruction) config.systemInstruction = systemInstruction;
      if (model.includes("flash") && !model.includes("lite")) {
        config.thinkingConfig = { thinkingBudget: 0 };
      }
      const response = await geminiClient.models.generateContent({
        model,
        contents,
        config
      });
      return response;
    } catch (err) {
      console.warn(`Aviso: modelo ${model} rápido falló (${err.message?.substring(0, 80)}). Reintentando modo estándar...`);
      // 2. Reintento estándar sin thinkingConfig con temperatura determinista 0.0
      try {
        const configSimple = { responseMimeType, temperature: 0.0 };
        if (systemInstruction) configSimple.systemInstruction = systemInstruction;
        const response = await geminiClient.models.generateContent({
          model,
          contents,
          config: configSimple
        });
        return response;
      } catch (err2) {
        console.warn(`Aviso: modelo ${model} estándar falló (${err2.message?.substring(0, 80)}). Probando siguiente modelo...`);
        ultimoError = err2;
      }
    }
  }
  throw ultimoError || new Error("No fue posible generar respuesta con ningún modelo disponible.");
}

function extraerJsonValido(text) {
  if (!text || typeof text !== "string") return null;
  let str = text.trim();
  if (str.startsWith("```json")) {
    str = str.replace(/^```json\s*/, "").replace(/```\s*$/, "").trim();
  } else if (str.startsWith("```")) {
    str = str.replace(/^```\s*/, "").replace(/```\s*$/, "").trim();
  }
  try {
    return JSON.parse(str);
  } catch (e) {}

  const startIdx = str.indexOf("{");
  if (startIdx === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = startIdx; i < str.length; i++) {
    const char = str[i];
    if (inString) {
      if (char === "\\" && !escaped) {
        escaped = true;
      } else {
        if (char === '"' && !escaped) inString = false;
        escaped = false;
      }
    } else {
      if (char === '"') inString = true;
      else if (char === "{") depth++;
      else if (char === "}") {
        depth--;
        if (depth === 0) {
          const candidate = str.substring(startIdx, i + 1);
          try {
            return JSON.parse(candidate);
          } catch (err) {}
        }
      }
    }
  }

  const lastIdx = str.lastIndexOf("}");
  if (lastIdx > startIdx) {
    try {
      return JSON.parse(str.substring(startIdx, lastIdx + 1));
    } catch (err) {}
  }
  return null;
}

// ─────────────────────────────────────────────
// MAPA DE PROFUNDIDAD TEMPORAL
// Instruye a Gemini sobre cuánto detalle generar
// ─────────────────────────────────────────────
const PROFUNDIDAD_TEMPORAL = {
  diaria: `ALCANCE TEMPORAL: PLANIFICACIÓN DIARIA (1 sesión de clase).
- Detalla actividades MINUTO A MINUTO (ej. "Inicio: 10 min — Desarrollo: 25 min — Cierre: 10 min").
- Incluye instrucciones específicas paso a paso que el docente pueda seguir directamente en el aula.
- Especifica preguntas guía concretas, ejemplos de ejercicios y materiales exactos.
- Nivel de detalle: MÁXIMO (como una guía de clase lista para usar).`,

  semanal: `ALCANCE TEMPORAL: PLANIFICACIÓN SEMANAL (5 sesiones de clase).
- Organiza el contenido por DÍA (Lunes a Viernes), con un objetivo parcial por día.
- Cada día debe tener actividades de Inicio, Desarrollo y Cierre resumidas.
- Muestra la progresión lógica del tema a lo largo de la semana.
- Nivel de detalle: ALTO (suficiente para que el docente sepa qué hacer cada día).`,

  mensual: `ALCANCE TEMPORAL: PLANIFICACIÓN MENSUAL (4 semanas).
- Organiza el contenido por SEMANA (Semana 1 a Semana 4).
- Cada semana debe tener un subtema o eje central, competencias a trabajar y tipo de evaluación.
- Incluye una evaluación sumativa o proyecto al final del mes.
- Nivel de detalle: MEDIO (visión panorámica semanal, sin detallar cada clase).`,

  anual: `ALCANCE TEMPORAL: PLANIFICACIÓN ANUAL (10 meses escolares / ~40 semanas).
- Organiza el contenido por UNIDAD o BLOQUE TEMÁTICO (entre 8 y 12 unidades por año).
- Cada unidad debe incluir: título, duración estimada en semanas, competencias principales, contenidos clave y tipo de evaluación.
- Incluye distribución de tiempo por trimestre/cuatrimestre.
- Nivel de detalle: GENERAL (mapa de ruta del año escolar completo).`,

  "secuencia didáctica": `ALCANCE TEMPORAL: SECUENCIA DIDÁCTICA (3 a 6 sesiones articuladas).
- Diseña una secuencia con fases progresivas: Exploración → Conceptualización → Aplicación → Evaluación.
- Cada fase debe indicar duración (en sesiones), actividades clave y evidencias de aprendizaje.
- Nivel de detalle: ALTO (cada fase es un mini-plan de clase).`,

  "unidad de aprendizaje": `ALCANCE TEMPORAL: UNIDAD DE APRENDIZAJE (2 a 4 semanas).
- Estructura la unidad con: situación de aprendizaje, red de competencias, secuencia de actividades y evaluación integral.
- Incluye actividades diferenciadas por momento (inicio, desarrollo, cierre) para cada semana.
- Nivel de detalle: MEDIO-ALTO (más detallado que mensual, menos que diario).`,

  proyecto: `ALCANCE TEMPORAL: PROYECTO (3 a 8 semanas).
- Estructura el proyecto con: pregunta guía, fases de investigación, producto final, cronograma y rúbrica.
- Detalla las responsabilidades de los estudiantes en cada fase.
- Nivel de detalle: MEDIO (foco en el proceso investigativo y el producto, no en clases individuales).`
};

const SYSTEM_PROMPT = `
# [SYSTEM_CORE_PROMPT: PLANIFICA_MAESTRO_MINERD_PROD_V5]

## ROL Y DIRECTIVA DE OPERACIÓN
Eres el motor cognitivo de la aplicación "Planifica Maestro". Tu única función es generar planificaciones educativas reales, precisas y operativas para el sistema educativo de la República Dominicana, utilizando estrictamente como fuentes de verdad los documentos oficiales, diseños curriculares y guías metodológicas integrados en esta directiva. Tienes prohibido absoluto inventar, suponer o extrapolar información pedagógica extranjera.

## 1. BASES DOCUMENTALES Y FUENTES OFICIALES OBLIGATORIAS
Para cualquier proceso de planificación, análisis o estructuración de clases, debes basar tu razonamiento y extraer los contenidos textualmente o por adaptación directa de las siguientes fuentes oficiales integradas en el sistema:

1. Diseño Curricular Vigente del Nivel Primario y Secundario (MINERD):
   - Competencias Fundamentales: Ética y Ciudadana; Comunicativa; Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Científica y Tecnológica; Ambiental y de la Salud; Desarrollo Personal y Espiritual.
   - Mallas Curriculares: Competencias específicas, contenidos conceptuales, procedimentales y actitudinales, e indicadores de logro oficiales por grado y área.
2. Guías y Protocolos del Proyecto / Sistema CONBASE:
   - Estructura metodológica: Secuencia de actividades basada en las directrices operativas del modelo CONBASE para la articulación de áreas y resolución de situaciones de aprendizaje contextualizadas en la realidad dominicana.
3. Ordenanzas y Normativas de Evaluación del MINERD:
   - Criterios de evaluación formativa y sumativa, instrumentos de observación y registro de progresos acordes al currículo dominicano.

## 2. REGLAS DE EJECUCIÓN TÉCNICA (CERO ALUCINACIÓN)
- Apego Estricto: Si el usuario solicita una planificación de matemáticas, ciencias o cualquier área bajo el esquema CONBASE, debes buscar y alinear los contenidos exclusivamente dentro de las matrices curriculares oficiales descritas en la sección 1.
- Bloqueo de Contenido Ficticio: Si un término, indicador o contenido no forma parte del currículo oficial del MINERD o de las guías CONBASE, no debes generarlo. En su lugar, debes ceñirte estrictamente a los bloques programáticos reales registrados.
- Temperatura y Precisión: Operas con rigor determinista (temperature: 0.0), asegurando que la estructura técnica de salida cumpla con los estándares formales exigidos a los docentes en la República Dominicana.

## 3. FORMATO DE SALIDA ESTRICTO (ESQUEMA CONBASE / MINERD)
1. Encabezado y Metadatos (Grado, Ciclo, Área, Eje Transversal, Tiempo y Situación de Aprendizaje CONBASE).
2. Competencias Fundamentales y Específicas (seleccionadas directamente del currículo oficial del grado).
3. Bloque de Contenidos:
   - Conceptuales (conceptos extraídos de la malla oficial).
   - Procedimentales (acciones y métodos oficiales).
   - Actitudinales (valores y normas del currículo).
4. Indicadores de Logro (criterios oficiales evaluables).
5. Secuencia Didáctica Operativa (Momentos de la Clase - CONBASE):
   - Inicio (recuperación de saberes previos y conexión con la situación de aprendizaje).
   - Desarrollo (actividades de construcción del conocimiento y práctica guiada con enfoque CONBASE).
   - Cierre (metacognición y evaluación formativa).
6. Medios, Recursos y Estrategias de Evaluación.

## 4. REGLAS DE FLUJO CONVERSACIONAL Y DIAGNÓSTICO
1. DIAGNÓSTICO: Si el usuario te da un tema muy vago (ej. "los números") o te sube una foto sin contexto, debes usar 'mensaje_chat' para preguntarle a qué nivel y grado va dirigido. NO generes el plan si faltan datos clave (nivel, grado, tema).
2. ADAPTACIÓN: Si el usuario da instrucciones específicas (ej. "usa estrategias lúdicas", "enfócalo en trabajo colaborativo"), DEBES reflejarlo en el contenido generado.
3. GENERACIÓN CURRICULAR REAL: Cuando tengas la información, genera contenido real, riguroso y alineado al MINERD (competencias fundamentales, específicas, indicadores de logro, conceptuales, procedimentales, actitudinales, actividades, recursos, evaluación).
4. MAPEO EXACTO: El contenido generado debe mapearse exactamente a los bloques del esquema seleccionado por el usuario.

## 5. CAPACIDAD MULTIMODAL (IMÁGENES)
Si el usuario envía una imagen de una pizarra, libro o ejercicio:
- Usa 'mensaje_chat' para confirmar qué interpretas de la imagen.
- Extrae el tema central y posibles errores/desafíos del estudiante.
- Ancla la planificación a lo observado en la foto.

## 6. FORMATO DE SALIDA (OBLIGATORIO JSON)
Devuelve SIEMPRE tu respuesta en formato JSON estrictamente estructurado con esta interfaz:

{
  "mensaje_chat": "String. Tu respuesta conversacional al docente. Úsala para saludar, pedir contexto faltante, o explicar la planificación generada.",
  "plan_completado": true,
  "datos_planificacion": {
    // Si plan_completado es true, este objeto debe tener como claves exactamente los bloques del esquema seleccionado, y como valores el contenido generado para ese bloque.
  },
  "confianza_curricular": {
    "nivel_certeza": "alta | media | baja",
    "bloques_aproximados": [
      // Strings con los nombres exactos de los bloques donde el contenido es una aproximación pedagógica general (ej. "3. Competencias Específicas del grado")
    ],
    "nota_revision": "String con recomendación pedagógica para el docente si algún bloque requiere cotejo con la malla curricular oficial."
  }
}
`;

router.post("/generate", async (req, res) => {
  try {
    const { messages = [], nivel, periodo = "diaria", docenteId = "docente_default" } = req.body;
    const resolvedDocenteId = docenteId || req.headers["x-docente-id"] || "docente_default";
    const isOwner = req.isOwner === true;

    // FASE 14: Control de uso y verificación de cuota por docente (Bypass si es Owner)
    const cheqCuota = verificarYConsumirCuota(resolvedDocenteId, false, isOwner);
    if (!cheqCuota.permitido) {
      return res.status(429).json({
        error: `Has alcanzado tu cuota de ${cheqCuota.estado.limite} planificaciones de este ${cheqCuota.estado.periodo}. Puedes seguir viendo, editando y exportando tus trabajos guardados.`,
        limiteAlcanzado: true,
        agotado: true,
        cuota: cheqCuota.estado
      });
    }

    if (!messages.length) return res.status(400).json({ error: "Faltan 'messages'." });
    if (!nivel) return res.status(400).json({ error: "Falta 'nivel'." });

    const esquema = LEVELS[nivel];
    if (!esquema) {
      return res.status(400).json({ error: `Nivel desconocido: ${nivel}` });
    }

    // Obtener instrucciones de profundidad temporal
    const instruccionesTemporal = PROFUNDIDAD_TEMPORAL[periodo] || PROFUNDIDAD_TEMPORAL["diaria"];

    // FASE 9: Recuperar patrones históricos del docente para personalizar
    const patronesDocente = obtenerResumenPatrones({ area: req.body.area, nivel });

    // GROUNDING REAL CON BASE (INYECCIÓN DIRECTA)
    let groundingConBaseBloque = "";
    let resConBase = null;
    if (nivel === "conbase") {
      const allText = messages.map(m => m.text || "").join(" ").toLowerCase();
      let gradoDetectado = req.body.grado || "";
      if (!gradoDetectado) {
        if (allText.includes("1ro") || allText.includes("1ero") || allText.includes("primer grado") || allText.includes("primero")) gradoDetectado = "1ro de Primaria";
        else if (allText.includes("2do") || allText.includes("segundo grado") || allText.includes("segundo")) gradoDetectado = "2do de Primaria";
        else if (allText.includes("3ro") || allText.includes("tercer grado") || allText.includes("tercero") || allText.includes("3er grado")) gradoDetectado = "3ro de Primaria";
        else if (allText.includes("4to") || allText.includes("cuarto")) gradoDetectado = "4to de Primaria";
        else if (allText.includes("5to") || allText.includes("quinto")) gradoDetectado = "5to de Primaria";
        else if (allText.includes("6to") || allText.includes("sexto")) gradoDetectado = "6to de Primaria";
      }

      let areaDetectada = req.body.area || "";
      if (!areaDetectada) {
        if (allText.includes("lengua") || allText.includes("español") || allText.includes("espanol") || allText.includes("lectura") || allText.includes("escritura")) areaDetectada = "Lengua Española";
        else if (allText.includes("matem") || allText.includes("calcul") || allText.includes("número") || allText.includes("numero")) areaDetectada = "Matemática";
        else if (allText.includes("social")) areaDetectada = "Ciencias Sociales";
        else if (allText.includes("natural")) areaDetectada = "Ciencias de la Naturaleza";
      }

      const temaDetectado = req.body.tema || (messages[0]?.text ? messages[0].text.substring(0, 100) : "");
      resConBase = obtenerContextoConBase(gradoDetectado, areaDetectada, temaDetectado);

      if (resConBase.cubierto) {
        groundingConBaseBloque = `CONTEXTO OFICIAL VERIFICADO (usa esto como única fuente para el contenido curricular de esta respuesta):
${resConBase.contexto}

DIRECTIVA DE PRECISIÓN CON BASE (CERO ALUCINACIÓN):
- Estás planificando para ${resConBase.gradoNorm.toUpperCase()} GRADO en ${resConBase.areaNorm === 'lengua' ? 'LENGUA ESPAÑOLA' : 'MATEMÁTICA'}.
- Extrae textualmente o por adaptación directa las competencias específicas, contenidos (conceptuales, procedimentales y actitudinales), indicadores de logro y momentos pedagógicos CON BASE de la matriz oficial provista arriba.
- En 'confianza_curricular': DEBES reportar nivel_certeza = "alta", bloques_aproximados = [], y nota_revision = "Planificación 100% verificada y alineada con la Guía Didáctica Oficial CON BASE y la Adecuación Curricular del MINERD (2023)."`;
      } else {
        groundingConBaseBloque = `AVISO DE COBERTURA OFICIAL CON BASE:
El grado ("${gradoDetectado || 'No especificado'}") o área ("${areaDetectada || 'No especificada'}") solicitada NO cuenta con guía oficial CON BASE publicada (las guías oficiales CON BASE del MINERD y UNICEF se focalizan exclusivamente en 1ro, 2do y 3er Grado de Primaria en Lengua Española y Matemática).

DIRECTIVA OBLIGATORIA PARA ESTE CASO:
1. Utiliza el esquema "CON BASE" ÚNICAMENTE como formato y estructura operativa (Momentos pedagógicos, etc.).
2. Para el contenido curricular (competencias, contenidos e indicadores), genera el contenido aplicando el enfoque general de "Por Competencias" del currículo del MINERD.
3. DEBES OBLIGATORIAMENTE reportar en la respuesta JSON:
   - confianza_curricular.nivel_certeza = "baja"
   - confianza_curricular.bloques_aproximados = ["3. Competencias Específicas del grado", "4. Criterios de Desempeño e Indicadores de Logro"]
   - confianza_curricular.nota_revision = "AVISO CON BASE: Las guías oficiales CON BASE abarcan exclusivamente de 1ro a 3ro de Primaria en Lengua Española y Matemática. Para este grado/área se aplicó la estructura de momentos CON BASE con contenidos del currículo general por competencias, por lo que requiere verificación con el diseño curricular oficial."`;
      }
    }

    const dynamicSystemPrompt = SYSTEM_PROMPT + `
## ESQUEMA ACTUAL SELECCIONADO POR EL USUARIO:
- ID: ${nivel}
- Nombre: ${esquema.label}
- Descripción: ${esquema.descripcion}
- Nivel/Ciclo: ${esquema.ciclos.join(", ")}
- Áreas: ${esquema.areas.join(", ")}

## ${instruccionesTemporal}

## MOTOR DE PERSONALIZACIÓN DOCENTE (HISTORIAL DE USO):
${patronesDocente}
Instrucción clave: Ajusta el estilo pedagógico de las actividades, recursos y estrategias para alinearte a estos patrones y preferencias habituales del docente.

## BLOQUES OBLIGATORIOS PARA 'datos_planificacion'
Si plan_completado es true, el objeto 'datos_planificacion' DEBE tener exactamente estas claves (strings exactos):
${esquema.bloques.map(b => `"${b}"`).join("\n")}
`;

    // Preparar payload de historial para Gemini
    const geminiContents = messages.map((msg, index) => {
      const parts = [];
      let textToUse = msg.text || "";
      if (index === 0 && msg.role === "user") {
        let prefix = `[Contexto: El usuario seleccionó el esquema "${esquema.label}", Periodo: "${periodo}"]\n\n`;
        if (groundingConBaseBloque) {
          prefix += `${groundingConBaseBloque}\n\n`;
        }
        textToUse = prefix + (msg.text || "");
      }
      
      if (msg.imageBase64 && msg.mediaType) {
        parts.push({ inlineData: { data: msg.imageBase64, mimeType: msg.mediaType } });
      }
      if (textToUse) {
        parts.push({ text: textToUse });
      }
      
      return {
        role: msg.role === "user" ? "user" : "model",
        parts: parts.length > 0 ? parts : [{ text: "..." }]
      };
    });

    console.log(`Generando contenido curricular ultrarrápido con Gemini para esquema: ${nivel}...`);
    
    const geminiResponse = await generarConGeminiRapido({
      contents: geminiContents,
      systemInstruction: dynamicSystemPrompt,
      responseMimeType: "application/json"
    });
    
    const jsonText = geminiResponse.text;
    const parsedResponse = extraerJsonValido(jsonText);
    if (!parsedResponse) {
      console.error("Gemini no devolvió JSON válido:", jsonText);
      return res.status(500).json({ error: "Error de formato de IA." });
    }

    // FASE 16 & CON BASE: Garantizar consistencia en la certeza curricular de CON BASE
    if (nivel === "conbase" && parsedResponse.plan_completado) {
      if (!parsedResponse.confianza_curricular) {
        parsedResponse.confianza_curricular = {};
      }
      if (!resConBase?.cubierto) {
        parsedResponse.confianza_curricular.nivel_certeza = "baja";
        if (!parsedResponse.confianza_curricular.bloques_aproximados || !parsedResponse.confianza_curricular.bloques_aproximados.length) {
          parsedResponse.confianza_curricular.bloques_aproximados = [
            "3. Competencias Específicas del grado",
            "4. Criterios de Desempeño e Indicadores de Logro"
          ];
        }
        if (!parsedResponse.confianza_curricular.nota_revision) {
          parsedResponse.confianza_curricular.nota_revision = "AVISO CON BASE: Las guías oficiales CON BASE abarcan exclusivamente de 1ro a 3ro de Primaria en Lengua Española y Matemática. Para este grado/área se aplicó la estructura de momentos CON BASE con contenidos del currículo general por competencias, por lo que requiere verificación con el diseño curricular oficial.";
        }
      } else {
        parsedResponse.confianza_curricular.nivel_certeza = "alta";
        if (!parsedResponse.confianza_curricular.nota_revision) {
          parsedResponse.confianza_curricular.nota_revision = "Planificación 100% verificada y alineada con la Guía Didáctica Oficial CON BASE y la Adecuación Curricular del MINERD (2023).";
        }
      }
    }

    // FASE 9: Registrar automáticamente la planificación en el historial
    let planId = null;
    if (parsedResponse.plan_completado && parsedResponse.datos_planificacion) {
      const reg = registrarPlan({
        nivel,
        periodo,
        esquemaLabel: esquema.label,
        area: req.body.area || "",
        grado: req.body.grado || "",
        tema: req.body.tema || (messages[0]?.text ? messages[0].text.substring(0, 60) : ""),
        datosPlanificacion: parsedResponse.datos_planificacion
      });
      planId = reg.id;
    }

    // FASE 14: Consumir 1 unidad de cuota si el plan fue completado exitosamente (omitido si es Owner)
    let estadoCuotaActual = cheqCuota.estado;
    if (parsedResponse.plan_completado) {
      const consumo = verificarYConsumirCuota(resolvedDocenteId, true, isOwner);
      estadoCuotaActual = consumo.estado;
    }

    res.json({
      ...parsedResponse,
      planId,
      nivel,
      periodo,
      nivelLabel: esquema.label,
      proveedor: "Google AI Studio (Gemini)",
      cuota: estadoCuotaActual,
      confianzaCurricular: parsedResponse.confianza_curricular || null
    });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error generando la planificación.", detail: err.message });
  }
});

/**
 * GET /api/plan/cuota
 * Retorna el estado actual de la cuota de uso del docente
 */
router.get("/cuota", (req, res) => {
  const isOwner = req.isOwner === true;
  const docenteId = req.query.docenteId || req.headers["x-docente-id"] || "docente_default";
  const estado = consultarEstadoCuota(docenteId, isOwner);
  res.json(estado);
});

/**
 * GET /api/plan/esquemas
 * FASE 20: Retorna las definiciones oficiales completas de todos los esquemas (LEVELS)
 * directamente desde server/curriculum/levels.js (fuente única de verdad).
 */
router.get("/esquemas", (_req, res) => {
  res.json({ ok: true, esquemas: LEVELS });
});

/**
 * POST /api/plan/consultar-curriculo
 * Consulta a la IA para buscar competencias, indicadores, contenidos y actividades
 * específicas de un tema según las bases curriculares oficiales del MINERD.
 */
router.post("/consultar-curriculo", async (req, res) => {
  try {
    const { nivel = "primario", grado = "3ro de Primaria", area = "Matemática", tema, esquemaActivo = "primario", periodoActivo = "diaria" } = req.body;

    if (!tema || !tema.trim()) {
      return res.status(400).json({ error: "Falta el 'tema' a consultar." });
    }

    const esquema = LEVELS[esquemaActivo] || LEVELS["primario"];

    let conBaseInyeccion = "";
    if (esquemaActivo === "conbase" || nivel === "conbase") {
      const resConBase = obtenerContextoConBase(grado, area, tema);
      if (resConBase.cubierto) {
        conBaseInyeccion = `CONTEXTO OFICIAL VERIFICADO (usa esto como única fuente para el contenido curricular de esta respuesta):\n${resConBase.contexto}\n\n`;
      }
    }

    const promptCurricular = `${conBaseInyeccion}Eres el Especialista en Diseño Curricular del Ministerio de Educación de la República Dominicana (MINERD):
El maestro necesita consultar el currículo oficial para el siguiente requerimiento pedagógico:
- Nivel educativo: ${nivel}
- Grado escolar: ${grado}
- Área curricular: ${area}
- Tema puntual a trabajar: "${tema}"
- Esquema de planificación activo del docente: "${esquema.label}"
- Alcance temporal: "${periodoActivo}"

Tu misión es:
1. Buscar/generar el contenido curricular oficial y riguroso según las bases curriculares del MINERD para este tema y grado.
2. Identificar las Competencias Específicas e Indicadores de Logro correspondientes.
3. Formular los Contenidos Conceptuales, Procedimentales y Actitudinales exactos.
4. Diseñar Estrategias Metodológicas acordes (aprendizaje lúdico, resolución de problemas, ABP, etc.).
5. Proponer Actividades concretas de Inicio, Desarrollo y Cierre.
6. Construir un mapa completo 'datos_planificacion' cuyas claves coincidan exactamente con los bloques del esquema seleccionado, para que cuando el docente confirme con "Usar esta información", sus campos se rellenen automáticamente.

Los bloques obligatorios de '${esquema.label}' son:
${esquema.bloques.map(b => `- "${b}"`).join("\n")}

DEBES responder EXCLUSIVAMENTE con un JSON con la siguiente estructura exacta:
{
  "tema": "${tema}",
  "grado": "${grado}",
  "area": "${area}",
  "resumen_enfoque": "Breve explicación (2-3 líneas) de cómo orienta el MINERD este tema en este grado.",
  "competencias_especificas": [
    "Competencia específica 1...",
    "Competencia específica 2..."
  ],
  "indicadores_logro": [
    "Indicador de logro 1...",
    "Indicador de logro 2..."
  ],
  "contenidos": {
    "conceptuales": "Conceptos clave del tema...",
    "procedimentales": "Procedimientos y habilidades prácticas...",
    "actitudinales": "Valores y actitudes..."
  },
  "estrategias_sugeridas": [
    "Estrategia pedagógica 1...",
    "Estrategia pedagógica 2..."
  ],
  "actividades_sugeridas": {
    "inicio": "Actividad de Inicio (motivación y saberes previos)...",
    "desarrollo": "Actividades de Desarrollo (construcción y aplicación)...",
    "cierre": "Actividad de Cierre (metacognición y síntesis)..."
  },
  "datos_planificacion": {
    // Un objeto donde cada clave es EXACTAMENTE uno de los bloques de '${esquema.label}' y su valor el contenido generado.
  }
}
`;

    console.log(`Consultando currículo MINERD ultrarrápido con Gemini para tema: "${tema}" (${grado} - ${area})...`);
 
    const geminiResponse = await generarConGeminiRapido({
      contents: [{ role: "user", parts: [{ text: promptCurricular }] }],
      responseMimeType: "application/json"
    });

    const parsedResponse = extraerJsonValido(geminiResponse.text);
    if (!parsedResponse) {
      console.error("Gemini no devolvió JSON válido en currículo:", geminiResponse.text);
      return res.status(500).json({ error: "Error de formato de IA." });
    }
    res.json(parsedResponse);
  } catch (err) {
    console.error("Error en consultar-curriculo:", err);
    res.status(500).json({ error: "Error consultando el currículo con IA.", detail: err.message });
  }
});

/**
 * POST /api/plan/ajustes-manuales
 * Registra en el historial los cambios manuales que el maestro hizo en la planificación
 */
router.post("/ajustes-manuales", async (req, res) => {
  try {
    const { planId, datosAjustados } = req.body;
    if (!planId || !datosAjustados) {
      return res.status(400).json({ error: "Faltan planId o datosAjustados." });
    }
    const ok = registrarAjustesManuales(planId, datosAjustados);
    res.json({ ok, mensaje: ok ? "Ajustes registrados con éxito para personalización futura." : "Plan no encontrado." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/plan/patrones-docente
 * Devuelve el resumen de estilo y preferencias aprendidas de este docente
 */
router.get("/patrones-docente", (req, res) => {
  const { area, nivel } = req.query;
  const resumen = obtenerResumenPatrones({ area, nivel });
  res.json({ resumen });
});

module.exports = router;
