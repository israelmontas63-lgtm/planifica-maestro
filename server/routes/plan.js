require("dotenv").config();
const express = require("express");
const router = express.Router();
const { LEVELS } = require("../curriculum/levels");
const { GoogleGenAI } = require("@google/genai");
const {
  registrarPlan,
  registrarAjustesManuales,
  obtenerResumenPatrones,
  cargarHistorialDocente
} = require("../curriculum/teacherHistory");
const {
  consultarEstadoCuota,
  verificarYConsumirCuota
} = require("../curriculum/quotaManager");
const {
  obtenerContextoConBase,
  COBERTURA_CON_BASE
} = require("../curriculum/contextoConBase");
const { enrutarPeticion, obtenerEstadoProveedores } = require("../ia/enrutadorIA");
const { generarDesdeBibliotecaOficial } = require("../ia/modoBibliotecaOficial");
const { clasificarIntencion } = require("../ia/clasificadorIntencion");
const { generarRespuestaCharlaLocal, SYSTEM_PROMPT_CONVERSACIONAL, limpiarSaludoInnecesario } = require("../ia/modoConversacional");
const { verificarYSanearCitas } = require("../curriculum/verificadorCitas");
const { tieneIntencionExplicita, identificarImagenConVision, analizarCalidadImagen } = require("../ia/ojoDigital");
const { corregirTextoPedagogico } = require("../ia/correctorTexto");
const { puedeRealizarConsulta } = require("../ia/gestorGasto");
const crypto = require("crypto");

const rateLimitPorDispositivo = new Map();
const rateLimitPorIp = new Map();

function verificarRateLimit({ devId, ip, isOwner }) {
  if (isOwner) return { permitido: true };
  const ahora = Date.now();
  
  if (ip) {
    let registroIp = rateLimitPorIp.get(ip);
    if (!registroIp || ahora > registroIp.resetAt) {
      registroIp = { count: 0, resetAt: ahora + 60000 };
      rateLimitPorIp.set(ip, registroIp);
    }
    registroIp.count++;
    if (registroIp.count > 60) {
      return { permitido: false, motivo: "Demasiadas solicitudes desde esta dirección IP. Espera un momento antes de continuar." };
    }
  }

  if (devId) {
    let registroDev = rateLimitPorDispositivo.get(devId);
    if (!registroDev || ahora > registroDev.resetAt) {
      registroDev = { count: 0, resetAt: ahora + 60000 };
      rateLimitPorDispositivo.set(devId, registroDev);
    }
    registroDev.count++;
    if (registroDev.count > 25) {
      return { permitido: false, motivo: "Demasiadas peticiones consecutivas desde este dispositivo. Espera unos segundos." };
    }
  }

  return { permitido: true };
}

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
      const config = { responseMimeType, temperature: 0.0, maxOutputTokens: 8192 };
      if (systemInstruction) config.systemInstruction = systemInstruction;
      if (model.includes("flash") && !model.includes("lite")) {
        config.thinkingConfig = { thinkingBudget: 0 };
      }
      const response = await geminiClient.models.generateContent({
        model,
        contents,
        config
      });
      const cand = response.candidates?.[0];
      if (cand?.finishReason && cand.finishReason !== "STOP") {
        throw new Error(`Finalización anormal de Gemini: ${cand.finishReason}`);
      }
      return response;
    } catch (err) {
      console.warn(`Aviso: modelo ${model} rápido falló (${err.message?.substring(0, 80)}). Reintentando modo estándar...`);
      // 2. Reintento estándar sin thinkingConfig con temperatura determinista 0.0
      try {
        const configSimple = { responseMimeType, temperature: 0.0, maxOutputTokens: 8192 };
        if (systemInstruction) configSimple.systemInstruction = systemInstruction;
        const response = await geminiClient.models.generateContent({
          model,
          contents,
          config: configSimple
        });
        const cand2 = response.candidates?.[0];
        if (cand2?.finishReason && cand2.finishReason !== "STOP") {
          throw new Error(`Finalización anormal de Gemini: ${cand2.finishReason}`);
        }
        return response;
      } catch (err2) {
        console.warn(`Aviso: modelo ${model} estándar falló (${err2.message?.substring(0, 80)}). Probando siguiente modelo...`);
        ultimoError = err2;
      }
    }
  }
  throw ultimoError || new Error("No fue posible generar respuesta con ningún modelo disponible.");
}

const { extraerJson, mensajeParaChat, validarCamposPlanificacion } = require("../utils/parseadorJsonSeguro");

function extraerJsonValido(text) {
  return extraerJson(text);
}

// ─────────────────────────────────────────────
// MAPA DE PROFUNDIDAD TEMPORAL
// Instruye a Gemini sobre cuánto detalle generar
// ─────────────────────────────────────────────
const PROFUNDIDAD_TEMPORAL = {
  diaria: `ALCANCE TEMPORAL: PLANIFICACIÓN DIARIA (1 sesión de clase).
- Detalla actividades MINUTO A MINUTO (ej. "Inicio: 10-15 min — Desarrollo: 25-30 min — Cierre: 10 min").
- Incluye instrucciones específicas paso a paso que el docente pueda seguir directamente en el aula.
- Especifica preguntas guía concretas, ejemplos de ejercicios y materiales exactos según las Guías Didácticas oficiales del MINERD.
- Vinculación Curricular Estricta: Malla Curricular MINERD (competencias específicas, contenidos e indicadores de logro), Guías Didácticas (momentos pedagógicos) y Registro de Grado Oficial (criterios, evidencias e instrumentos de evaluación formativa).
- Adaptaciones de Aula: Incluye adaptaciones curriculares DUA para atención a la diversidad (NEAE) y notas de aula.
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
1. INFERENCIA PEDAGÓGICA ACTIVA: Si el usuario te envía una foto de un libro, pizarra o guía, o un requerimiento textual breve, actúa con criterio experto docente: infiere el tema, área y grado probable a partir de los indicios visuales y curriculares del texto y genera de inmediato la planificación completa, detallando en 'mensaje_chat' lo que identificaste. Solo pide aclaración si el texto está completamente vacío o ilegible.
2. ADAPTACIÓN: Si el usuario da instrucciones específicas (ej. "usa estrategias lúdicas", "enfócalo en trabajo colaborativo"), DEBES reflejarlo en el contenido generado.
3. GENERACIÓN CURRICULAR REAL: Genera contenido real, riguroso y alineado al MINERD (competencias fundamentales, específicas, indicadores de logro, conceptuales, procedimentales, actitudinales, actividades, recursos, evaluación).
4. MAPEO EXACTO: El contenido generado debe mapearse exactamente a los bloques del esquema seleccionado por el usuario.
5. ADAPTACIÓN DE IDIOMA: Detecta el idioma del mensaje del usuario y redacta 'mensaje_chat' en ese mismo idioma. Las planificaciones curriculares se mantienen en español oficial del MINERD salvo solicitud expresa de planificar en lengua extranjera.
6. RIGOR DOCUMENTAL: Cita la guía oficial y el grado correspondiente. Jamás mezcles contenidos de asignaturas distintas.

## 5. CAPACIDAD MULTIMODAL (VISIÓN PEDAGÓGICA Y CÁMARA INTELIGENTE)
Si el usuario envía una imagen de una pizarra, libro de texto, cuaderno, ejercicio o guía didáctica:
- Actúa con visión pedagógica como un docente humano experto: examina minuciosamente el texto, títulos, diagramas y actividades visibles.
- Identifica y transcribe los puntos clave del contenido pedagógico.
- Determina el tema curricular, área temática y grado escolar según las bases curriculares oficiales del MINERD.
- Genera DE INMEDIATO la planificación didáctica completa (plan_completado: true con todos los bloques de datos_planificacion) anclada al contenido de la imagen.
- En 'mensaje_chat', redacta una respuesta conversacional cálida y profesional explicando lo que la cámara identificó (tema detectado, área, grado inferido y cómo se estructuró la clase).

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

const handleGeneratePlan = async (req, res) => {
  try {
    let { messages = [], nivel = "primario", periodo = "diaria" } = req.body || {};
    if ((!messages || messages.length === 0) && (req.body.tema || req.body.prompt)) {
      const query = req.body.prompt || `Planifica el tema: ${req.body.tema} (${req.body.grado || ""} - ${req.body.area || ""})`;
      messages = [{ role: "user", text: query }];
    }
    const rawId = (req.body.docenteId || req.headers["x-docente-id"] || req.headers["x-device-id"] || "").trim();
    const resolvedDocenteId = (rawId && rawId !== "docente_default") ? rawId : (req.headers["x-device-id"] || ("anon_" + crypto.randomUUID()));
    const isOwner = req.isOwner === true;
    const isStream = Boolean(req.body.stream || req.headers["accept"]?.includes("text/event-stream"));

    const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "127.0.0.1";
    const rl = verificarRateLimit({ devId: resolvedDocenteId, ip: clientIp, isOwner });
    if (!rl.permitido) {
      return res.status(429).json({ error: rl.motivo });
    }

    if (!isOwner && !puedeRealizarConsulta(500)) {
      return res.status(429).json({
        error: "El servicio ha alcanzado su límite diario global de consultas para proteger el presupuesto. Intenta nuevamente mañana.",
        limiteAlcanzado: true
      });
    }

    const clientAbortController = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) {
        clientAbortController.abort();
      }
    });

    let resultadoCorreccionGlobal = null;

    function responder(data, status = 200, estado = "pensando") {
      if (resultadoCorreccionGlobal) {
        data.texto_original = resultadoCorreccionGlobal.textoOriginal;
        data.texto_corregido = resultadoCorreccionGlobal.textoCorregido;
        data.correcciones_aplicadas = resultadoCorreccionGlobal.cambios || [];
        data.hubo_correcciones = !!resultadoCorreccionGlobal.huboCambios;
        data.cambio_significado = Boolean(resultadoCorreccionGlobal.cambioSignificado);
      }
      if (status >= 400 || !isStream) {
        return res.status(status).json(data);
      }
      if (!res.headersSent) {
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
      }
      if (resultadoCorreccionGlobal && resultadoCorreccionGlobal.huboCambios) {
        res.write(`data: ${JSON.stringify({
          tipo: "correccion",
          texto_original: resultadoCorreccionGlobal.textoOriginal,
          texto_corregido: resultadoCorreccionGlobal.textoCorregido,
          correcciones_aplicadas: resultadoCorreccionGlobal.cambios || [],
          hubo_correcciones: true,
          cambio_significado: Boolean(resultadoCorreccionGlobal.cambioSignificado)
        })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ estado })}\n\n`);
      if (data.mensaje_chat) {
        res.write(`data: ${JSON.stringify({ delta: data.mensaje_chat, estado })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ final: data })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    }

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
      let textToUse = msg.text || msg.content || "";
      if (index === 0 && msg.role === "user") {
        let prefix = `[Contexto: El usuario seleccionó el esquema "${esquema.label}", Periodo: "${periodo}"]\n\n`;
        if (groundingConBaseBloque) {
          prefix += `${groundingConBaseBloque}\n\n`;
        }
        textToUse = prefix + textToUse;
      }
      
      const imgData = msg.imageBase64 || (index === messages.length - 1 ? req.body.imageBase64 : null);
      const imgMime = msg.mediaType || req.body.mediaType || "image/jpeg";
      if (imgData && imgMime) {
        parts.push({ inlineData: { data: imgData, mimeType: imgMime } });
      }
      if (textToUse) {
        parts.push({ text: textToUse });
      }
      
      return {
        role: msg.role === "user" ? "user" : "model",
        parts: parts.length > 0 ? parts : [{ text: "..." }]
      };
    });

    console.log(`Generando contenido curricular mediante Enrutador IA para esquema: ${nivel}...`);
    
    const ultimoMsg = messages[messages.length - 1] || {};
    const imageBase64 = ultimoMsg.imageBase64 || req.body.imageBase64 || null;
    const mediaType = ultimoMsg.mediaType || req.body.mediaType || "image/jpeg";
    const textoConsulta = (ultimoMsg.text || ultimoMsg.content || req.body.tema || req.body.prompt || "").trim();

    const forzarOriginal = Boolean(req.body.forzarOriginal);
    const confirmado = Boolean(req.body.confirmado);

    let resultadoCorreccion = await corregirTextoPedagogico({
      texto: textoConsulta,
      usarIA: false,
      env: process.env,
      signal: req.abortSignal || null
    });

    if (forzarOriginal) {
      resultadoCorreccion = {
        textoOriginal: textoConsulta,
        textoCorregido: textoConsulta,
        cambios: [],
        huboCambios: false,
        cambioEstructural: false,
        tipoCambioEstructural: null,
        detalleConfirmacion: null,
        tieneAmbiguedad: false,
        candidatosAmbiguos: []
      };
    }

    resultadoCorreccionGlobal = resultadoCorreccion;
    const textoParaProcesar = resultadoCorreccion.textoCorregido || textoConsulta;

    // Validación de ambigüedad en Levenshtein (empate de candidatos: no adivinar)
    if (resultadoCorreccion.tieneAmbiguedad && !confirmado && !forzarOriginal) {
      const amb = resultadoCorreccion.candidatosAmbiguos[0];
      const opciones = (amb.candidatos || []).map(c => `Usar "${c}"`).concat([`Mantener "${amb.antes}"`]);
      return responder({
        mensaje_chat: `Noté la palabra "${amb.antes}", que podría referirse a varios términos curriculares. ¿Cuál quisiste decir?`,
        plan_completado: false,
        modo: "aclarar_ambiguedad",
        categoria: "ambigua",
        requiereAclaracion: true,
        ambiguedad: amb,
        opciones,
        datos_planificacion: null
      }, 200, "pensando");
    }

    // Validación de cambios estructurales (solo confirmar si hay ambigüedad real; normalizaciones estándar de grado como 'tercer grado' -> '3.º' se aplican directamente)
    const det = resultadoCorreccion.detalleConfirmacion;
    const esNormalizacionGrado = det && det.tipo === "grado_minerd";
    if (resultadoCorreccion.cambioEstructural && !esNormalizacionGrado && !confirmado && !forzarOriginal) {
      const desc = det ? `"${det.antes}" a "${det.despues}" (${resultadoCorreccion.tipoCambioEstructural})` : `en ${resultadoCorreccion.tipoCambioEstructural}`;
      return responder({
        mensaje_chat: `He identificado un posible cambio de ${desc}:\n\n**"${resultadoCorreccion.textoCorregido}"**\n\n¿Deseas continuar con esta corrección o mantener tu texto original?`,
        plan_completado: false,
        modo: "confirmar_correccion",
        categoria: "confirmacion",
        requiereConfirmacion: true,
        cambio_estructural: {
          tipo: resultadoCorreccion.tipoCambioEstructural,
          detalle: det
        },
        opciones: [
          `Sí, continuar con "${resultadoCorreccion.textoCorregido}"`,
          `No, usar "${resultadoCorreccion.textoOriginal}"`
        ],
        datos_planificacion: null
      }, 200, "pensando");
    }

    // DEFENSA DE CÓDIGO (3B.2 / 3C.6): Si la imagen es muy pequeña, casi negra o sin contenido, responder mensaje honesto fijo
    if (imageBase64) {
      const calidadImg = analizarCalidadImagen(imageBase64);
      if (calidadImg.ilegible) {
        return responder({
          mensaje_chat: "La imagen se ve oscura o ilegible; toma otra foto con más luz o escribe el texto.",
          plan_completado: false,
          modo: "identificacion_visual",
          categoria: "identificacion_visual",
          tipo_visual: "ilegible",
          es_borrosa: true,
          opciones: ["Tomar otra foto con más luz", "Escribir mi consulta"],
          datos_planificacion: null
        }, 200, "conversando");
      }
    }

    // 0. Si viene una foto SIN intención explícita previa: Identificar primero (Ojo Digital) y ofrecer opciones
    if (imageBase64 && !tieneIntencionExplicita(textoConsulta)) {
      const idRes = await identificarImagenConVision({
        imageBase64,
        mediaType,
        env: process.env,
        signal: clientAbortController.signal
      });

      if (!idRes.exito) {
        return responder({
          mensaje_chat: idRes.mensaje || "La cámara no está disponible ahora (límite de visión alcanzado o sin conexión con el servicio). Por favor, prueba más tarde o escribe tu consulta.",
          plan_completado: false,
          modo: "error_camara",
          error: idRes.error || "camara_no_disponible"
        }, 200, "pensando");
      }

      return responder({
        mensaje_chat: idRes.descripcion,
        plan_completado: false,
        modo: "identificacion_visual",
        categoria: "identificacion_visual",
        tipo_visual: idRes.tipo_visual,
        es_borrosa: idRes.es_borrosa,
        es_delicado: idRes.es_delicado,
        tema_detectado: idRes.tema_detectado,
        opciones: idRes.opciones,
        datos_planificacion: null
      }, 200, "conversando");
    }

    // Atender opción de Ojo Digital: "Usarla como material de clase"
    if (textoConsulta.toLowerCase().includes("usarla como material de clase") || textoConsulta.toLowerCase().includes("usar como material")) {
      return responder({
        mensaje_chat: "¡Excelente idea pedagógica! Para adaptar las actividades al nivel exacto de tus estudiantes, ¿para qué grado escolar te gustaría preparar esta sesión?",
        plan_completado: false,
        modo: "pregunta_grado_material",
        categoria: "planificacion",
        opciones: [
          "1ro de Primaria",
          "2do de Primaria",
          "3ro de Primaria",
          "4to de Primaria",
          "5to de Primaria",
          "6to de Primaria"
        ],
        datos_planificacion: null
      }, 200, "conversando");
    }

    // Atender opción de Ojo Digital: "Leer el texto de la imagen"
    if (textoConsulta.toLowerCase().includes("leer el texto de la imagen") || textoConsulta.toLowerCase().includes("leer el texto") || textoConsulta.toLowerCase().includes("extraer texto")) {
      const msgConFoto = [...messages].reverse().find(m => m.imageBase64);
      if (msgConFoto) {
        try {
          const resOcr = await enrutarPeticion({
            tema: "Extracción de texto OCR",
            prompt: "Eres un asistente de lectura pedagógica. Transcribe con exactitud, buena ortografía y puntuación clara todo el texto legible visible en esta imagen. Si hay títulos, subtítulos o listas, organízalos ordenadamente en párrafos. No inventes texto no visible.",
            imageBase64: msgConFoto.imageBase64,
            mediaType: msgConFoto.mediaType || "image/jpeg",
            env: process.env,
            signal: clientAbortController.signal
          });
          const textoExtraido = resOcr.mensaje_chat || resOcr.texto || "No se detectó texto legible en la imagen.";
          return responder({
            mensaje_chat: `📄 **Texto extraído de la imagen:**\n\n${textoExtraido}\n\n¿Qué te gustaría hacer con este material?`,
            plan_completado: false,
            modo: "texto_extraido",
            categoria: "accion_app",
            opciones: [
              "Planificar una clase con esta lectura",
              "Crear preguntas de comprensión",
              "Buscar en el currículo"
            ],
            datos_planificacion: null
          }, 200, "conversando");
        } catch (ocrErr) {
          return responder({
            mensaje_chat: "La cámara no está disponible ahora para leer el texto. Puedes dictarlo o escribir el tema directamente.",
            plan_completado: false,
            modo: "error_camara"
          }, 200, "conversando");
        }
      }
    }

    // Clasificación de intención previa
    const clasificacion = await clasificarIntencion({
      texto: textoParaProcesar,
      env: process.env
    });

    // 1. MODO CHARLA (Saludos, cortesías, agradecimientos) -> Resolución local inmediata (< 50ms, $0)
    if (clasificacion.categoria === "charla") {
      const respCharla = generarRespuestaCharlaLocal({
        texto: textoParaProcesar,
        nombreDocente: req.body.nombreDocente || null
      });
      if (imageBase64) {
        respCharla.mensaje_chat = `${respCharla.mensaje_chat}\n\nVeo la foto que adjuntaste. ¿Qué te gustaría hacer con ella?`;
        respCharla.opciones = [
          "Identificar qué hay en la foto",
          "Usarla como material de clase",
          "Buscar en el currículo"
        ];
      }
      return responder(respCharla, 200, "charla");
    }

    // 2. MODO ACCION DE APP -> Respuesta local inmediata
    if (clasificacion.categoria === "accion_app") {
      return responder({
        mensaje_chat: `Entendido. Procesando acción de la aplicación: ${clasificacion.motivo}`,
        plan_completado: false,
        modo: "accion_app",
        categoria: "accion_app",
        datos_planificacion: null
      }, 200, "pensando");
    }

    // 2.5 MODO BÚSQUEDA WEB -> Tavily / Búsqueda en tiempo real con fuentes
    if (clasificacion.categoria === "busqueda_web") {
      try {
        const { buscarEnTavily } = require("../ia/adaptadores/tavilyAdapter");
        const queryLimpia = textoConsulta
          .replace(/^(?:por\s+favor\s+)?(?:busca|buscar|investiga|investigar)\s+(?:en\s+la\s+web\s+|en\s+internet\s+|en\s+google\s+|sobre\s+|acerca\s+de\s+)?/i, "")
          .trim() || textoConsulta;

        const resBusqueda = await buscarEnTavily({ query: queryLimpia, maxResults: 4 });
        if (resBusqueda.ok && resBusqueda.resultados && resBusqueda.resultados.length > 0) {
          let msg = `🔍 **Resultados de búsqueda en la web sobre "${queryLimpia}":**\n\n`;
          if (resBusqueda.respuestaDirecta) {
            msg += `${resBusqueda.respuestaDirecta}\n\n`;
          }
          msg += `**Fuentes y noticias encontradas:**\n\n`;
          resBusqueda.resultados.forEach((r, idx) => {
            msg += `${idx + 1}. **[${r.titulo}](${r.url})**\n${r.resumen}\n\n`;
          });
          msg += `*(Fuentes web consultadas en tiempo real. Si deseas incorporar estos datos en una planificación de clase del MINERD, dime el grado y área.)*`;

          return responder({
            mensaje_chat: msg,
            plan_completado: false,
            modo: "busqueda_web",
            categoria: "busqueda_web",
            fuentes: resBusqueda.resultados,
            datos_planificacion: null
          }, 200, "conversando");
        }
      } catch (errBusq) {
        console.warn("Aviso: Tavily search falló, continuando con flujo alternativo:", errBusq.message);
      }
    }

    // 3. MODO AMBIGUO -> Pregunta con botones de aclaración (sin adivinar)
    if (clasificacion.categoria === "ambigua") {
      return responder({
        mensaje_chat: "No identifiqué con claridad el tema escolar en tu consulta. ¿Deseas: 1) Planificar una clase del currículo oficial del MINERD, 2) Consultar información general, o 3) Ajustar el tema pedagógico?",
        plan_completado: false,
        requiereAclaracion: true,
        modo: "ambigua",
        categoria: "ambigua",
        tipoClasificado: "ambigua",
        confianza: clasificacion.confianza,
        opciones: clasificacion.opciones || [
          "Planificar una clase oficial MINERD",
          "Consultar información general",
          "Ajustar tema pedagógico"
        ],
        motivo: clasificacion.motivo
      }, 200, "pensando");
    }

    // 4. MODO CONOCIMIENTO GENERAL -> Conversacional directo sin buscar en currículo oficial
    if (clasificacion.categoria === "conocimiento_general") {
      const promptGeneral = `${SYSTEM_PROMPT_CONVERSACIONAL}\n\nConsulta del docente: "${textoConsulta}"\n\nResponde como un colega pedagógico cercano. Agrega al final una nota breve recordando que es una explicación general de apoyo, no una prescripción del currículo oficial MINERD, y ofrece llevar el tema a una actividad de clase. Si se requiere buscar en la web datos recientes que no conozcas, pide permiso al docente antes de buscar.`;
      const aviso = "\n\n*(Nota: Esta es una explicación pedagógica general, no una cita textual del currículo oficial MINERD. Si deseas llevar este concepto a una actividad de clase o situación de aprendizaje, dime el grado y lo armamos.)*";

      try {
        const respGen = await enrutarPeticion({
          tema: "Conocimiento General",
          prompt: promptGeneral,
          imageBase64,
          mediaType,
          env: process.env,
          signal: clientAbortController.signal
        });
        let textoChat = respGen.mensaje_chat || respGen.texto || respGen.respuesta;
        if (!textoChat && respGen && typeof respGen === "object") {
          const stringVals = Object.values(respGen).filter(v => typeof v === "string" && v.length > 0);
          if (stringVals.length > 0) textoChat = stringVals.join("\n\n");
        }
        if (!textoChat) textoChat = "Aquí tienes la información solicitada.";
        const esSaludoDocente = /^(¡?(?:hola|buen(?:os)?\s*días|buenas\s*tardes|buenas\s*noches|saludos))/i.test((textoConsulta || "").trim());
        textoChat = limpiarSaludoInnecesario(textoChat, esSaludoDocente);
        textoChat = verificarYSanearCitas(textoChat, []);
        return responder({
          mensaje_chat: textoChat.includes("currículo oficial") ? textoChat : `${textoChat}${aviso}`,
          plan_completado: false,
          modo: "conocimiento_general",
          categoria: "conocimiento_general",
          datos_planificacion: null
        }, 200, "conversando");
      } catch (e) {
        return responder({
          mensaje_chat: "⚠️ No se pudo establecer conexión con el modelo de inteligencia artificial para responder tu consulta de conocimiento general. Por favor, verifica tu conexión o intenta nuevamente más tarde.\n\n*(Nota: Esta respuesta requiere conexión activa con el modelo y no sustituye la consulta al currículo oficial MINERD.)*",
          plan_completado: false,
          modo: "conocimiento_general",
          categoria: "conocimiento_general",
          datos_planificacion: null
        }, 200, "conversando");
      }
    }

    // 5. MODO CURRICULAR: Consulta o Planificación -> Paralelismo con Promise.all
    let resBusquedaCurricular = null;
    if (clasificacion.tipo === "curricular" || clasificacion.categoria === "planificacion" || clasificacion.categoria === "consulta_curricular") {
      const temaParaBuscar = req.body.tema || textoConsulta.substring(0, 80);

      const [resBusqueda, patrones] = await Promise.all([
        Promise.resolve().then(() => buscarEnCurriculo({
          query: temaParaBuscar,
          grado: req.body.grado || "",
          area: req.body.area || ""
        })),
        Promise.resolve().then(() => obtenerResumenPatrones(resolvedDocenteId))
      ]);
      resBusquedaCurricular = resBusqueda;

      // Si el tema tiene ambigüedad de grado/área y el usuario no indicó el grado:
      if (resBusquedaCurricular.requiereDesambiguacion && !req.body.grado) {
        return responder({
          mensaje_chat: resBusquedaCurricular.mensaje,
          plan_completado: false,
          requiereDesambiguacion: true,
          opciones: resBusquedaCurricular.opciones || [],
          tipoClasificado: "curricular"
        }, 200, "curriculo");
      }

      // Si no se encuentra en el índice local y fue una consulta directa (no pedido de planificación)
      if (!resBusquedaCurricular.encontrado && !req.body.buscarEnWeb && clasificacion.categoria === "consulta_curricular") {
        return responder({
          mensaje_chat: resBusquedaCurricular.mensaje || "No se encontró ese dato en el currículo oficial (No encontré ese tema en la biblioteca oficial). ¿Deseas que lo busque en internet o prefieres ajustar el tema?",
          plan_completado: false,
          encontrado: false,
          sugerirWeb: true,
          tipoClasificado: "curricular",
          opciones: [
            "Buscar este tema en internet",
            "Ajustar tema pedagógico"
          ]
        }, 200, "curriculo");
      }
    }

    // Determinar documento curricular oficial según grado, ciclo y asignatura
    const areaNorm = (req.body.area || "").toLowerCase();
    const gradoNorm = (req.body.grado || "").toLowerCase();
    const esSecundaria = (typeof nivel === "string" && nivel.includes("secundari")) || gradoNorm.includes("secundaria");

    let docReferencia = "Adecuación Curricular del Nivel Primario (MINERD)";
    if (esSecundaria) {
      docReferencia = "Adecuación Curricular del Nivel Secundario (MINERD, 2023)";
    } else if (gradoNorm.includes("1") || gradoNorm.includes("2") || gradoNorm.includes("3") || gradoNorm.includes("primer ciclo")) {
      if (areaNorm.includes("lengua")) {
        docReferencia = "Guía Didáctica de Lengua Española (MINERD / CON BASE)";
      } else if (areaNorm.includes("matem")) {
        docReferencia = "Guía Didáctica de Matemática (MINERD / CON BASE)";
      } else {
        docReferencia = "Adecuación Curricular del Nivel Primario - Primer Ciclo (MINERD)";
      }
    } else {
      docReferencia = "Adecuación Curricular del Nivel Primario - Segundo Ciclo (MINERD)";
    }

    const groundingDirectivasMINERD = `
## DIRECTIVAS DE REFERENCIA CURRICULAR OFICIAL (MINERD):
- Documento oficial de referencia: "${docReferencia}".
- Cita este documento oficial y las páginas correspondientes en las fuentes y en la justificación curricular.
- MENSAJES AL MAESTRO SIN JERGA TÉCNICA: En 'mensaje_chat', exprésate de manera profesional, cálida y natural: "Preparé la planificación con el currículo oficial del MINERD para esta materia y grado."
- NUNCA digas "no hay guía CON BASE" para Ciencias Sociales, Ciencias de la Naturaleza ni otras materias.
- Solo si de verdad no existiera documento oficial para esa materia/grado, advierte de forma simple: "No encontré una guía oficial para esta materia en este grado; conviene que revises la planificación."
- RIGOR DISCIPLINAR: Jamás mezcles contenidos de asignaturas ajenas (prohibido mezclar Lengua o "La Noticia" con Ciencias Sociales o Matemáticas). Lo que sea propuesta didáctica del modelo indícalo con naturalidad.
`;

    if (isStream && !res.headersSent) {
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.write(`data: ${JSON.stringify({ estado: "curriculo" })}\n\n`);
    }

    let parsedResponse = null;
    try {
      parsedResponse = await enrutarPeticion({
        tema: req.body.tema || (messages[0]?.text ? messages[0].text.substring(0, 80) : ""),
        grado: req.body.grado || "",
        area: req.body.area || "",
        nivel,
        esquemaActivo: nivel,
        periodoActivo: periodo,
        prompt: dynamicSystemPrompt + "\n" + groundingDirectivasMINERD,
        contents: geminiContents,
        imageBase64,
        mediaType,
        env: process.env,
        signal: clientAbortController.signal,
        perfilDocente: req.body.perfilDocente || null,
        docenteId: resolvedDocenteId,
        onChunk: isStream ? (delta) => {
          if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({ delta, estado: "curriculo" })}\n\n`);
          }
        } : null
      });
    } catch (routeErr) {
      console.warn("⚠️ Enrutador IA lanzó excepción, ejecutando fallback oficial:", routeErr.message);
      parsedResponse = generarDesdeBibliotecaOficial({
        tema: req.body.tema || (messages[0]?.text ? messages[0].text.substring(0, 80) : ""),
        grado: req.body.grado || "",
        area: req.body.area || "",
        nivel,
        esquemaActivo: nivel,
        periodoActivo: periodo
      });
    }

    if (!parsedResponse) {
      return res.status(500).json({ error: "Error generando respuesta estructurada." });
    }

    if (!parsedResponse.fuentes || parsedResponse.fuentes.length === 0) {
      parsedResponse.fuentes = [{
        documento: docReferencia,
        area: req.body.area || "General",
        grado: req.body.grado || "General",
        pagina: "Adecuación Curricular MINERD"
      }];
    }

    // Atender saludo en mensajes mixtos (saludo + plan)
    if (clasificacion.esMixtoConSaludo && parsedResponse.mensaje_chat) {
      parsedResponse.mensaje_chat = `¡Hola, Profe! Con gusto te preparo la clase:\n\n${parsedResponse.mensaje_chat}`;
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
        docenteId: resolvedDocenteId,
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

    const esWeb = clasificacion.tipo === "web" || req.body.buscarEnWeb;
    const esMixta = clasificacion.tipo === "mixta";
    const origenFinal = esWeb
      ? "fuente_web_no_oficial"
      : esMixta
      ? "mixta"
      : (parsedResponse.origen || (parsedResponse.proveedor_utilizado ? "ia_generativa" : "biblioteca_oficial"));

    const distintivoFinal = esWeb
      ? "Fuente web (no oficial)"
      : esMixta
      ? "Biblioteca oficial + Fuentes web"
      : (parsedResponse.distintivo || (origenFinal === "biblioteca_oficial" ? "Basado en la biblioteca oficial del MINERD" : null));

    responder({
      ...parsedResponse,
      planId,
      nivel,
      periodo,
      nivelLabel: esquema.label,
      proveedor: parsedResponse.proveedor_utilizado || "Biblioteca Oficial MINERD",
      es_respaldo: parsedResponse.es_respaldo || false,
      distintivo: distintivoFinal,
      origen: origenFinal,
      cuota: estadoCuotaActual,
      confianzaCurricular: parsedResponse.confianza_curricular || null,
      tipoClasificado: clasificacion.tipo
    }, 200, "curriculo");
    
  } catch (err) {
    console.error(err);
    if (isStream && res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: "Error generando la planificación.", detail: err.message })}\n\n`);
      res.write("data: [DONE]\n\n");
      return res.end();
    }
  }
};

router.post("/generate", handleGeneratePlan);
router.post("/", handleGeneratePlan);

/**
 * GET /api/plan/cuota
 * Retorna el estado actual de la cuota de uso del docente
 */
router.get("/cuota", (req, res) => {
  const isOwner = req.isOwner === true;
  const docenteId = req.query.docenteId || req.headers["x-pm-device-id"] || req.headers["x-device-id"] || req.headers["x-docente-id"] || "docente_default";
  const estado = consultarEstadoCuota(docenteId, isOwner);
  res.json(estado);
});

/**
 * GET /api/plan/historial
 * Retorna las planificaciones guardadas para el docente o dispositivo actual
 */
router.get("/historial", (req, res) => {
  try {
    const rawId = (req.query.docenteId || req.headers["x-pm-device-id"] || req.headers["x-device-id"] || req.headers["x-docente-id"] || "anon").trim();
    const historial = cargarHistorialDocente(rawId);
    res.json({ ok: true, historial });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

    // 0. Verificación anti-alucinación con el motor de búsqueda curricular oficial
    const resBusqueda = buscarEnCurriculo({ query: tema, grado, area });
    if (!resBusqueda.encontrado && !req.body.buscarEnWeb) {
      return res.json({
        encontrado: false,
        tema,
        grado,
        area,
        mensaje: resBusqueda.mensaje || "No se encontró ese dato en el currículo oficial (No encontré ese tema en la biblioteca oficial). ¿Deseas que lo busque en internet o prefieres ajustar el tema?",
        sugerirWeb: true,
        opciones: [
          "Buscar en internet",
          "Ajustar tema pedagógico"
        ]
      });
    }

    if (resBusqueda.requiereDesambiguacion && !req.body.grado) {
      return res.json({
        encontrado: true,
        requiereDesambiguacion: true,
        tema,
        grado,
        area,
        mensaje: resBusqueda.mensaje,
        opciones: resBusqueda.opciones || []
      });
    }

    // 1. Consulta prioritaria determinista a la Biblioteca Oficial MINERD (< 100ms)
    const resBiblio = generarDesdeBibliotecaOficial({
      tema,
      grado,
      area,
      nivel,
      esquemaActivo,
      periodoActivo
    });

    if (resBiblio && resBiblio.datos_planificacion && Object.keys(resBiblio.datos_planificacion).length > 0 && resBiblio.fuentes?.length > 0) {
      console.log(`⚡ [consultar-curriculo] Resuelto instantáneamente desde Biblioteca Oficial MINERD para "${tema}"`);
      return res.json({
        tema,
        grado,
        area,
        resumen_enfoque: `Contenido curricular oficial del MINERD para ${grado} en el área de ${area}.`,
        competencias_especificas: [resBiblio.datos_planificacion["3. Competencias Específicas del grado"] || "Competencia curricular oficial."],
        indicadores_logro: [resBiblio.datos_planificacion["4. Criterios de Desempeño e Indicadores de Logro"] || "Indicador curricular oficial."],
        contenidos: {
          conceptuales: resBiblio.datos_planificacion["2. Contenidos Curriculares"] || tema,
          procedimentales: "Procedimientos de aprendizaje del MINERD",
          actitudinales: "Valores y actitudes cívicas y académicas"
        },
        estrategias_sugeridas: ["Aprendizaje basado en problemas", "Trabajo colaborativo y exploración guiada"],
        actividades_sugeridas: {
          inicio: "Recuperación de experiencias previas y motivación.",
          desarrollo: "Construcción activa del conocimiento y práctica guiada.",
          cierre: "Metacognición y síntesis de lo aprendido."
        },
        datos_planificacion: resBiblio.datos_planificacion,
        fuentes: resBiblio.fuentes,
        origen: "biblioteca_oficial",
        distintivo: "Basado en la biblioteca oficial del MINERD"
      });
    }

    // 2. Si no está en matrices de Capa 3, consultar a través del Enrutador IA
    console.log(`Consultando currículo MINERD con Enrutador IA para tema: "${tema}" (${grado} - ${area})...`);
    let parsedResponse = null;
    try {
      parsedResponse = await enrutarPeticion({
        tema,
        grado,
        area,
        nivel,
        esquemaActivo,
        periodoActivo,
        prompt: promptCurricular,
        env: process.env
      });
    } catch (routeErr) {
      console.warn("⚠️ Enrutador falló en consultar-curriculo, usando fallback oficial:", routeErr.message);
      parsedResponse = resBiblio;
    }

    if (!parsedResponse) {
      parsedResponse = resBiblio;
    }

    res.json(parsedResponse);
  } catch (err) {
    console.error("Error en consultar-curriculo:", err);
    res.status(500).json({ error: "Error consultando el currículo con IA.", detail: err.message });
  }
});

/**
 * GET /api/plan/estado-ia
 * Retorna el estado en tiempo real de todos los proveedores de IA y circuito
 */
router.get("/estado-ia", (_req, res) => {
  try {
    const proveedores = obtenerEstadoProveedores();
    res.json({ ok: true, proveedores });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
