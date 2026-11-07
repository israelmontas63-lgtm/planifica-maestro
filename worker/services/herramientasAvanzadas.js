import { Type } from '@google/genai';

/**
 * Declaraciones de Herramientas Avanzadas de Producción
 * Estándar de Ejecución: Planifica Maestro - MINERD / CON BASE
 */
export function obtenerHerramientasProduccion() {
  return [
    {
      name: 'generar_rubrica_evaluacion',
      description: 'Genera una rúbrica analítica oficial basada en los indicadores de logro del MINERD para 1.° y 2.° grado.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          area: { type: Type.STRING, description: 'Área curricular (ej. Lengua Española, Matemática)' },
          indicador_logro: { type: Type.STRING, description: 'Texto literal del indicador curricular' },
          grados: { 
            type: Type.ARRAY, 
            items: { type: Type.INTEGER },
            description: 'Grados involucrados [1], [2] o [1, 2]' 
          }
        },
        required: ['area', 'indicador_logro', 'grados']
      }
    },
    {
      name: 'registrar_plan_en_base_datos',
      description: 'Persiste la planificación generada en la base de datos de Supabase para registro y descarga.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          titulo: { type: Type.STRING },
          grado_nivel: { type: Type.STRING },
          paginas_minerd_citadas: { 
            type: Type.ARRAY, 
            items: { type: Type.INTEGER } 
          },
          contenido_plan: { type: Type.STRING }
        },
        required: ['titulo', 'grado_nivel', 'contenido_plan']
      }
    }
  ];
}

export const obtenerHerramientasAvanzadas = obtenerHerramientasProduccion;

/**
 * Generador de matriz de rúbrica analítica ministerial en 4 niveles de desempeño
 */
export function estructurarRubricaMinisterial({ area, indicador_logro, grados = [1, 2] }) {
  const gradosTxt = Array.isArray(grados) ? grados.map(g => `${g}.°`).join(' y ') : '1.° y 2.°';
  return {
    titulo: `Rúbrica Analítica de Evaluación Formativa (${area})`,
    grados: gradosTxt,
    indicador: indicador_logro,
    criterios: [
      {
        dimension: 'Comprensión y Reconocimiento',
        niveles: {
          receptivo: 'Identifica nociones iniciales con mediación docente constante y material concreto.',
          resolutivo: 'Reconoce y aplica conceptos básicos guiándose por modelos y apoyos visuales.',
          autonomo: 'Comprende y explica los elementos clave de forma independiente en tareas de aula.',
          estrategico: 'Transfiere el conocimiento a situaciones cotidianas proponiendo soluciones originales.'
        }
      },
      {
        dimension: 'Producción y Aplicación Práctica',
        niveles: {
          receptivo: 'Participa en actividades prácticas con asistencia directa en parejas o modelado.',
          resolutivo: 'Realiza los ejercicios prácticos completando la secuencia estructurada prevista.',
          autonomo: 'Elabora producciones coherentes evidenciando dominio procedimental del grado.',
          estrategico: 'Argumenta sus procedimientos y apoya a sus compañeros en la resolución colectiva.'
        }
      }
    ],
    sello_normativo: 'MINERD · Ordenanza 04-2023 · Adecuación Curricular y CON BASE'
  };
}
