/**
 * Cerebro curricular y metodológico - Planifica Maestro (Cloudflare Worker)
 * Definición oficial de esquemas de planificación pedagógica MINERD.
 */

export const COMPETENCIAS_FUNDAMENTALES = [
  "Comunicativa",
  "Pensamiento Lógico, Creativo y Crítico",
  "Resolución de Problemas",
  "Ética y Ciudadana",
  "Desarrollo Personal y Espiritual",
  "Científica y Tecnológica",
  "Ambiental y de la Salud",
];

export const BLOQUES_PLANIFICACION_MINERD = [
  "1. Datos generales (grado, sección, fecha, área, maestro, tiempo estimado)",
  "2. Competencias Fundamentales a impactar",
  "3. Competencias Específicas del área/grado",
  "4. Contenidos: Conceptuales / Procedimentales / Actitudinales-Valores",
  "5. Estrategias de enseñanza-aprendizaje",
  "6. Actividades: Inicio - Desarrollo - Cierre",
  "7. Recursos y medios didácticos",
  "8. Evaluación: indicadores de logro, técnicas e instrumentos",
];

export const AREAS_CURRICULARES_OFICIALES = [
  "Lengua Española",
  "Matemática",
  "Ciencias Sociales",
  "Ciencias de la Naturaleza",
  "Formación Integral Humana y Religiosa",
  "Inglés",
  "Educación Física",
  "Educación Artística"
];

export const LEVELS = {
  inicial: {
    label: "Esquema Tradicional (Nivel Inicial)",
    descripcion: "Planificación por centros de interés o proyectos de aula para niños de 0 a 6 años.",
    ciclos: [
      "Maternal (0 a 1 año)",
      "Infantes (1 a 2 años)",
      "Párvulos (2 a 3 años)",
      "Pre-Kínder (3 a 4 años)",
      "Kínder (4 a 5 años)",
      "Pre-Primario (5 a 6 años)"
    ],
    areas: AREAS_CURRICULARES_OFICIALES,
    bloques: BLOQUES_PLANIFICACION_MINERD,
    notas: ["Enfoque lúdico y globalizado. Dimensiones integradas según diseño curricular de Nivel Inicial."]
  },

  primario: {
    label: "Esquema Tradicional (Nivel Primario)",
    descripcion: "Planificación por asignaturas para 1ro a 6to grado de Primaria.",
    ciclos: [
      "Primer Ciclo (1ro, 2do, 3ro de Primaria)",
      "Segundo Ciclo (4to, 5to, 6to de Primaria)"
    ],
    areas: AREAS_CURRICULARES_OFICIALES,
    bloques: BLOQUES_PLANIFICACION_MINERD,
    notas: ["Integración de ejes transversales y adecuación curricular oficial del MINERD."]
  },

  secundario: {
    label: "Esquema Tradicional (Nivel Secundario)",
    descripcion: "Planificación especializada por asignaturas para 1ro a 6to de Secundaria.",
    ciclos: [
      "Primer Ciclo (1ro, 2do, 3ro de Secundaria)",
      "Segundo Ciclo Modalidad Académica / Técnica / Artes (4to, 5to, 6to de Secundaria)"
    ],
    areas: [
      ...AREAS_CURRICULARES_OFICIALES,
      "Francés",
      "Filosofía",
      "Informática Educativa / TIC"
    ],
    bloques: BLOQUES_PLANIFICACION_MINERD,
    notas: ["Énfasis en resolución de problemas complejos y competencias preuniversitarias/laborales."]
  },

  especial: {
    label: "Esquema Educación Especial",
    descripcion: "Planificación con adaptaciones curriculares para necesidades educativas especiales (NEE).",
    ciclos: ["Todos los niveles"],
    areas: ["Todas las áreas"],
    bloques: [
      ...BLOQUES_PLANIFICACION_MINERD,
      "9. Adaptaciones Curriculares (acceso, proceso, producto, evaluación diferenciada)",
    ],
    notas: ["Requiere alineación con el Plan Educativo Individualizado (PEI)."]
  },

  conbase: {
    label: "Esquema CON BASE (Primer Ciclo Primaria)",
    descripcion: "Estructura oficial del programa Construyendo la Base de los Aprendizajes (CON BASE) para 1ro, 2do y 3ro de Primaria.",
    ciclos: ["Primer Ciclo de Primaria (1ro, 2do, 3ro)"],
    areas: ["Lengua Española", "Matemática"],
    bloques: [
      "1. Identificación y Contexto (Centro educativo, Docente, Grado, Sección, Área, Fecha, Tiempo)",
      "2. Situación de Aprendizaje (Problema del contexto, Desafío o Pregunta generadora)",
      "3. Competencias Específicas del grado",
      "4. Criterios de Desempeño e Indicadores de Logro",
      "5. Contenidos Curriculares (Conceptuales, Procedimentales, Actitudinales)",
      "6. Momentos Pedagógicos (Momento 1: Rutina e intención, Momento 2: Actividad guiada, Momento 3: Práctica autónoma, Momento 4: Metacognición)",
      "7. Recursos y Materiales CON BASE (Fascículos, Papelógrafos, Letras móviles, Material concreto)",
      "8. Estrategias e Instrumentos de Evaluación Formativa"
    ],
    notas: ["Estructurado según las Guías Didácticas Oficiales CON BASE de Lengua Española y Matemática (MINERD, 2023)."]
  },

  abp: {
    label: "Aprendizaje Basado en Proyectos (ABP)",
    descripcion: "Estrategia articuladora centrada en la resolución de problemas reales y producto final.",
    ciclos: ["Primaria", "Secundaria"],
    areas: ["Multidisciplinar"],
    bloques: [
      "1. Título del Proyecto y Pregunta Desafiante",
      "2. Situación de Aprendizaje contextualizada",
      "3. Competencias Fundamentales y Específicas articuladas",
      "4. Áreas curriculares integradas",
      "5. Fases del Proyecto (Lanzamiento, Indagación, Creación/Desarrollo, Presentación pública)",
      "6. Cronograma y actividades por fase",
      "7. Producto final tangible o comunicable",
      "8. Rúbrica y evaluación formativa del proceso"
    ],
    notas: ["Promueve la interdisciplinariedad y el aprendizaje situado."]
  },

  secuencia_didactica: {
    label: "Secuencia Didáctica por Competencias",
    descripcion: "Conjunto articulado de actividades de aprendizaje y evaluación organizadas en fases progresivas.",
    ciclos: ["Primaria", "Secundaria"],
    areas: AREAS_CURRICULARES_OFICIALES,
    bloques: [
      "1. Identificación y Tema central",
      "2. Competencias a desarrollar e Indicadores de logro",
      "3. Fase 1: Exploración y Diagnóstico (saberes previos, motivación)",
      "4. Fase 2: Conceptualización (construcción del conocimiento, modelado)",
      "5. Fase 3: Aplicación y Transferencia (práctica guiada e independiente)",
      "6. Fase 4: Evaluación y Metacognición (síntesis, autoevaluación, coevaluación)",
      "7. Recursos didácticos y apoyos diferenciados"
    ],
    notas: ["Permite un seguimiento granular de la progresión del estudiante."]
  }
};
