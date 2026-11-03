/**
 * shared/herramientasInvestigacion.mjs
 * Declaración de Herramientas del Agente Investigador Autónomo (Planifica Maestro)
 */

export const HERRAMIENTAS_INVESTIGACION = [
  {
    name: "consultar_fuente_curricular",
    description: "Busca información normativa oficial en los documentos curriculares del MINERD según la fuente requerida.",
    parameters: {
      type: "OBJECT",
      properties: {
        fuente: {
          type: "STRING",
          description: "Documento específico a consultar: 'adecuacion_2023', 'guia_con_base_lengua', 'guia_con_base_matematica' o 'diseno_curricular_base'.",
          enum: ["adecuacion_2023", "guia_con_base_lengua", "guia_con_base_matematica", "diseno_curricular_base"]
        },
        grado: { type: "NUMBER", description: "Grado escolar de 1 a 6." },
        area: { type: "STRING", description: "Área académica oficial del MINERD." },
        termino: { type: "STRING", description: "Término, tema, competencia o indicador a rastrear." }
      },
      required: ["fuente", "grado", "area", "termino"]
    }
  },
  {
    name: "buscar_contexto_web",
    description: "Realiza una búsqueda externa para verificar efemérides dominicanas, calendario escolar del MINERD, recursos abiertos o datos pedagógicos de actualidad.",
    parameters: {
      type: "OBJECT",
      properties: {
        consulta: { type: "STRING", description: "Término conciso de búsqueda web." }
      },
      required: ["consulta"]
    }
  }
];
