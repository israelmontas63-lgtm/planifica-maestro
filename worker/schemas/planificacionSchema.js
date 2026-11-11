// worker/schemas/planificacionSchema.js
/**
 * Structured Output Enforcement (JSON Schema Constrained Decoding)
 * Especificación Oficial de Google Generative AI (Gemini API / REST v1beta)
 *
 * Fuerza la decodificación sintáctica y de campos en los logits del modelo para garantizar
 * que el JSON emitido sea siempre 100% válido y nunca rompa llaves ni omita campos obligatorios.
 */

export const ESQUEMA_PLANIFICACION_GEMINI = {
  type: "OBJECT",
  properties: {
    mensaje_chat: {
      type: "STRING",
      description: "Mensaje pedagógico explicativo dirigido al docente"
    },
    plan_completado: {
      type: "BOOLEAN",
      description: "Indica true si se entregó la planificación completa o false si es una aclaración/pregunta"
    },
    datos_planificacion: {
      type: "OBJECT",
      description: "Bloques curriculares oficiales requeridos por el diseño del MINERD",
      properties: {
        grado: { type: "STRING", description: "Grado escolar (ej: 1.° grado de Primaria)" },
        area: { type: "STRING", description: "Área curricular (ej: Matemática, Lengua Española)" },
        tema: { type: "STRING", description: "Tema o secuencia didáctica oficial" },
        duracion: { type: "STRING", description: "Duración de la clase (ej: 45 minutos)" },
        intencion_pedagogica: { type: "STRING", description: "Propósito de aprendizaje del día" },
        estrategias: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "Estrategias de enseñanza y aprendizaje"
        },
        momentos: {
          type: "OBJECT",
          description: "Momentos didácticos obligatorios de la clase",
          properties: {
            inicio: { type: "STRING", description: "Recuperación de saberes previos y motivación (10 min)" },
            desarrollo: { type: "STRING", description: "Construcción y aplicación de aprendizajes (25 min)" },
            cierre: { type: "STRING", description: "Metacognición y síntesis formativa (10 min)" }
          },
          required: ["inicio", "desarrollo", "cierre"]
        },
        recursos: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "Recursos didácticos y medios utilizados"
        },
        evaluacion: {
          type: "OBJECT",
          description: "Criterios e instrumentos de evaluación",
          properties: {
            indicadores: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            instrumento: { type: "STRING" }
          }
        }
      }
    }
  },
  required: ["mensaje_chat", "plan_completado"]
};

/**
 * Función que inyecta el esquema de Structured Output en la configuración de Gemini
 */
export function inyectarStructuredOutputConfig(generationConfig = {}, esquema = ESQUEMA_PLANIFICACION_GEMINI) {
  return {
    ...generationConfig,
    responseMimeType: "application/json",
    responseSchema: esquema,
    responseJsonSchema: esquema // Compatibilidad dual con SDK y endpoint REST beta
  };
}
