const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");
const { LEVELS, COMPETENCIAS_FUNDAMENTALES, BLOQUES_PLANIFICACION_MINERD } = require("../curriculum/levels");

const router = express.Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─────────────────────────────────────────────────────────────
// SISTEMA PROMPT — Asistente Pedagógico MINERD (República Dominicana)
// ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Eres un asistente pedagógico experto en el currículo dominicano vigente,
diseñado para apoyar a docentes del sistema educativo de la República
Dominicana en la planificación, análisis y evaluación de procesos de
enseñanza-aprendizaje, siguiendo los lineamientos del Ministerio de
Educación (MINERD).

## ROL Y CONOCIMIENTO BASE
- Conoces el enfoque por competencias del currículo dominicano (Nivel
  Inicial, Primario y Secundario) y sus áreas curriculares.
- Conoces las 7 Competencias Fundamentales del currículo dominicano:
  1. Comunicativa
  2. Pensamiento Lógico, Creativo y Crítico
  3. Resolución de Problemas
  4. Ética y Ciudadana
  5. Desarrollo Personal y Espiritual
  6. Científica y Tecnológica
  7. Ambiental y de la Salud
- Conoces la estructura de un Diseño/Planificación de Clase o Secuencia
  Didáctica según el modelo MINERD.
- Cuando el usuario no especifique nivel, grado o área, pregúntalo antes de
  planificar en detalle, o indica explícitamente el supuesto que asumiste.

## CAPACIDAD MULTIMODAL (análisis de imágenes)
Puedes recibir fotografías de:
- Pizarras con anotaciones, esquemas o ejercicios del docente.
- Páginas de libros de texto o guías didácticas.
- Fichas, guías de trabajo o evaluaciones aplicadas a estudiantes.

Cuando el usuario adjunte una imagen:
1. Describe brevemente lo que observas (contenido, nivel aparente, área
   curricular) antes de planificar, para confirmar que interpretaste bien
   la imagen.
2. Extrae el contenido curricular relevante (tema, subtemas, tipo de
   actividad, posibles errores conceptuales si es trabajo de un estudiante).
3. Usa ese contenido como insumo real para construir la planificación o el
   análisis solicitado — no generes algo genérico desconectado de la imagen.
4. Si la imagen es ilegible, ambigua o no corresponde a material educativo,
   dilo explícitamente y pide una nueva foto o más contexto en vez de
   inventar contenido.

## USO DE BÚSQUEDA (cuando esté disponible la herramienta de búsqueda)
Busca información actualizada cuando:
- Se te pida un dato, tema o normativa específica del MINERD que no puedas
  afirmar con certeza de memoria (nombre exacto de un documento curricular,
  cambios recientes al currículo, calendario escolar, etc.).
- Necesites verificar terminología oficial vigente antes de usarla.
No es necesario buscar para tareas de redacción o estructura general que ya
domines. Si buscas, sintetiza la información en tus propias palabras, sin
copiarla textualmente.

## DIÁLOGO Y PENSAMIENTO PREVIO (MUY IMPORTANTE)
Eres un asistente conversacional. No generes la planificación completa inmediatamente si te faltan datos clave (tema exacto, grado específico, etc.).
1. Si el usuario te da una instrucción vaga o una foto sin mucho contexto, PREGUNTA primero qué quiere hacer o de qué tema tratará la clase.
2. Si tienes toda la información, procede a generar la planificación.
3. Responde de forma amigable y conversacional cuando estés aclarando detalles.

## TONO Y ESTILO
- Profesional, claro y cercano al lenguaje docente dominicano.
- Usa terminología oficial del MINERD.
- Sé conciso en el diálogo y exhaustivo en la estructura de la planificación final.`;

/**
 * POST /api/plan/generate
 * body: {
 *   messages?: array of { role, text, imageBase64, mediaType }
 *   nivel: "inicial" | "primario" | "secundario" | "especial"
 *   periodo: string
 *   permitirBusquedaWeb: boolean
 * }
 */
router.post("/generate", async (req, res) => {
  try {
    const { messages = [], nivel, periodo = "diaria", permitirBusquedaWeb = true } = req.body;

    if (!messages.length) {
      return res.status(400).json({ error: "Faltan 'messages'." });
    }
    if (!nivel) {
      return res.status(400).json({ error: "Falta 'nivel'." });
    }

    const esquema = LEVELS[nivel];
    if (!esquema) {
      return res.status(400).json({
        error: `Nivel desconocido: "${nivel}". Niveles válidos: inicial, primario, secundario, especial.`,
      });
    }

    // Convertir el historial al formato de Anthropic
    const anthropicMessages = messages.map((msg, index) => {
      const content = [];
      
      // Si es el primer mensaje, le inyectamos el contexto UI
      let textToUse = msg.text || "";
      if (index === 0 && msg.role === "user") {
        textToUse = `[Contexto de la aplicación: El usuario seleccionó Nivel: ${esquema.label}, Tipo: ${periodo}]\n\n${textToUse}`;
      }

      if (msg.imageBase64 && msg.mediaType) {
        content.push({
          type: "image",
          source: { type: "base64", media_type: msg.mediaType, data: msg.imageBase64 }
        });
      }
      
      if (textToUse) {
        content.push({ type: "text", text: textToUse });
      }

      return {
        role: msg.role,
        content: content.length > 0 ? content : [{ type: "text", text: "..." }]
      };
    });

    const tools = permitirBusquedaWeb
      ? [{ type: "web_search_20250305", name: "web_search" }]
      : undefined;

    let planTexto = "";
    let proveedorUsado = "Anthropic (Claude)";

    const dynamicSystemPrompt = SYSTEM_PROMPT + `
## REGLA OBLIGATORIA DE SALIDA — ESQUEMA SELECCIONADO
Cuando YA TENGAS toda la información y decidas generar la planificación final, esta DEBE estructurarse SIEMPRE con los siguientes bloques, en este orden exacto, usando estos encabezados:

${esquema.bloques.join("\n")}

No omitas ningún bloque. Adapta el nivel de detalle, pero conserva siempre esta estructura.
`;

    try {
      console.log("Intentando generar con Anthropic (Claude)...");
      const response = await client.messages.create({
        model: "claude-sonnet-4-5", // Modelo con soporte de visión
        max_tokens: 4000,
        system: dynamicSystemPrompt,
        messages: anthropicMessages,
        ...(tools ? { tools } : {}),
      });
      planTexto = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n");
      console.log("Generación exitosa con Anthropic.");
    } catch (anthropicError) {
      console.warn("Fallo Anthropic (posible falta de saldo). Error:", anthropicError.message);
      console.log("Activando agente de respaldo: Google AI Studio (Gemini)...");
      
      proveedorUsado = "Google AI Studio (Gemini)";
      
      // Preparar payload de historial para Gemini
      const geminiContents = messages.map((msg, index) => {
        const parts = [];
        let textToUse = msg.text || "";
        if (index === 0 && msg.role === "user") {
          textToUse = `[Contexto de la aplicación: El usuario seleccionó Nivel: ${esquema.label}, Tipo: ${periodo}]\n\n${textToUse}`;
        }
        
        if (msg.imageBase64 && msg.mediaType) {
          parts.push({
            inlineData: { data: msg.imageBase64, mimeType: msg.mediaType }
          });
        }
        if (textToUse) {
          parts.push({ text: textToUse });
        }
        
        return {
          role: msg.role === "user" ? "user" : "model",
          parts: parts.length > 0 ? parts : [{ text: "..." }]
        };
      });

      try {
        const { GoogleGenAI } = require("@google/genai");
        const geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        const geminiResponse = await geminiClient.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: geminiContents,
          config: {
            systemInstruction: dynamicSystemPrompt,
          }
        });
        
        planTexto = geminiResponse.text;
        console.log("Generación exitosa con Gemini.");
      } catch (geminiError) {
        console.error("Fallo también Gemini. Error:", geminiError.message);
        throw new Error("Ambos agentes (Anthropic y Google) fallaron: " + geminiError.message);
      }
    }

    res.json({
      plan: planTexto,
      nivel,
      periodo,
      nivelLabel: esquema.label,
      proveedor: proveedorUsado,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error generando la planificación.", detail: err.message });
  }
});

module.exports = router;

