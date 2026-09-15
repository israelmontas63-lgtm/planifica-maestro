const express = require("express");
const router = express.Router();
const { LEVELS } = require("../curriculum/levels");
const { GoogleGenAI } = require("@google/genai");

const geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
Eres un Especialista en Diseño Curricular de la República Dominicana, con dominio experto y actualizado del currículo del MINERD en todos los niveles educativos (Inicial, Primario, Secundario) y sus diversas metodologías (ABP, Secuencias Didácticas, Ejes Temáticos, Con Base).

Tu objetivo es asistir al docente a generar una planificación curricular impecable.

## REGLAS DE FLUJO CONVERSACIONAL Y GENERACIÓN
1. DIAGNÓSTICO: Si el usuario te da un tema muy vago (ej. "los números") o te sube una foto sin contexto, debes usar 'mensaje_chat' para preguntarle a qué nivel y grado va dirigido. NO generes el plan si faltan datos clave (nivel, grado, tema).
2. ADAPTACIÓN: Si el usuario da instrucciones específicas (ej. "usa estrategias lúdicas", "enfócalo en trabajo colaborativo"), DEBES reflejarlo en el contenido generado.
3. GENERACIÓN CURRICULAR REAL: Cuando tengas la información, genera contenido real, riguroso y alineado al MINERD (competencias fundamentales, específicas, indicadores de logro, conceptuales, procedimentales, actitudinales, actividades, recursos, evaluación).
4. MAPEO EXACTO: El contenido generado debe mapearse exactamente a los bloques del esquema seleccionado por el usuario.

## CAPACIDAD MULTIMODAL (IMÁGENES)
Si el usuario envía una imagen de una pizarra, libro o ejercicio:
- Usa 'mensaje_chat' para confirmar qué interpretas de la imagen.
- Extrae el tema central y posibles errores/desafíos del estudiante.
- Ancla la planificación a lo observado en la foto.

## FORMATO DE SALIDA (OBLIGATORIO JSON)
Devuelve SIEMPRE tu respuesta en formato JSON estrictamente estructurado con esta interfaz:

{
  "mensaje_chat": "String. Tu respuesta conversacional al docente. Úsala para saludar, pedir contexto faltante, o explicar la planificación generada.",
  "plan_completado": "Booleano. true si lograste generar la planificación completa. false si estás preguntando por más contexto.",
  "datos_planificacion": {
    // Si plan_completado es true, este objeto debe tener como claves exactamente los bloques del esquema seleccionado, y como valores el contenido generado para ese bloque.
    // Ejemplo:
    // "1. Datos generales...": "valor generado",
    // "2. Competencias...": "valor generado"
  }
}
`;

router.post("/generate", async (req, res) => {
  try {
    const { messages = [], nivel, periodo = "diaria" } = req.body;

    if (!messages.length) return res.status(400).json({ error: "Faltan 'messages'." });
    if (!nivel) return res.status(400).json({ error: "Falta 'nivel'." });

    const esquema = LEVELS[nivel];
    if (!esquema) {
      return res.status(400).json({ error: `Nivel desconocido: ${nivel}` });
    }

    // Obtener instrucciones de profundidad temporal
    const instruccionesTemporal = PROFUNDIDAD_TEMPORAL[periodo] || PROFUNDIDAD_TEMPORAL["diaria"];

    const dynamicSystemPrompt = SYSTEM_PROMPT + `
## ESQUEMA ACTUAL SELECCIONADO POR EL USUARIO:
- ID: ${nivel}
- Nombre: ${esquema.label}
- Descripción: ${esquema.descripcion}
- Nivel/Ciclo: ${esquema.ciclos.join(", ")}
- Áreas: ${esquema.areas.join(", ")}

## ${instruccionesTemporal}

## BLOQUES OBLIGATORIOS PARA 'datos_planificacion'
Si plan_completado es true, el objeto 'datos_planificacion' DEBE tener exactamente estas claves (strings exactos):
${esquema.bloques.map(b => `"${b}"`).join("\n")}
`;

    // Preparar payload de historial para Gemini
    const geminiContents = messages.map((msg, index) => {
      const parts = [];
      let textToUse = msg.text || "";
      if (index === 0 && msg.role === "user") {
        textToUse = `[Contexto: El usuario seleccionó el esquema "${esquema.label}", Periodo: "${periodo}"]\n\n${textToUse}`;
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

    console.log(`Generando contenido curricular con Gemini (Modo JSON) para esquema: ${nivel}...`);
    
    const geminiResponse = await geminiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: geminiContents,
      config: {
        systemInstruction: dynamicSystemPrompt,
        responseMimeType: "application/json"
      }
    });
    
    const jsonText = geminiResponse.text;
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(jsonText);
    } catch(e) {
      console.error("Gemini no devolvió JSON válido:", jsonText);
      return res.status(500).json({ error: "Error de formato de IA." });
    }

    res.json({
      ...parsedResponse,
      nivel,
      periodo,
      nivelLabel: esquema.label,
      proveedor: "Google AI Studio (Gemini)"
    });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error generando la planificación.", detail: err.message });
  }
});

module.exports = router;
