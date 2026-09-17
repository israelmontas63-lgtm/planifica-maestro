/**
 * Cerebro curricular y metodológico - Planifica Maestro
 * Base de datos de esquemas de planificación pedagógica.
 */

const COMPETENCIAS_FUNDAMENTALES = [
  "Comunicativa",
  "Pensamiento Lógico, Creativo y Crítico",
  "Resolución de Problemas",
  "Ética y Ciudadana",
  "Desarrollo Personal y Espiritual",
  "Científica y Tecnológica",
  "Ambiental y de la Salud",
];

const BLOQUES_PLANIFICACION_MINERD = [
  "1. Datos generales (grado, sección, fecha, área, maestro, tiempo estimado)",
  "2. Competencias Fundamentales a impactar",
  "3. Competencias Específicas del área/grado",
  "4. Contenidos: Conceptuales / Procedimentales / Actitudinales-Valores",
  "5. Estrategias de enseñanza-aprendizaje",
  "6. Actividades: Inicio - Desarrollo - Cierre",
  "7. Recursos y medios didácticos",
  "8. Evaluación: indicadores de logro, técnicas e instrumentos",
];

// Las 8 áreas curriculares oficiales del currículo dominicano MINERD
const AREAS_CURRICULARES_OFICIALES = [
  "Lengua Española",
  "Matemática",
  "Ciencias Sociales",
  "Ciencias de la Naturaleza",
  "Formación Integral Humana y Religiosa",
  "Inglés",
  "Educación Física",
  "Educación Artística"
];

const LEVELS = {
  // ─────────────────────────────────────────────
  // ESQUEMAS TRADICIONALES (POR NIVELES)
  // ─────────────────────────────────────────────
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

  // ─────────────────────────────────────────────
  // ESQUEMAS METODOLÓGICOS ESPECÍFICOS
  // ─────────────────────────────────────────────
  conbase: {
    label: "Esquema 'Con Base' (Aprendizaje Basado en Competencias)",
    descripcion: "Programa 'Construyendo la Base de los Aprendizajes' del MINERD, articulando competencias fundamentales, específicas y alfabetización inicial.",
    ciclos: ["1ro, 2do y 3ro de Primaria"],
    areas: [
      "Lengua Española (Fascículos Con Base)",
      "Matemática (Fascículos Con Base)",
      "Ciencias Sociales",
      "Ciencias de la Naturaleza"
    ],
    bloques: [
      "1. Datos generales (grado, sección, fascículo/secuencia, tiempo estimado)",
      "2. Situación de Aprendizaje (contexto, reto o necesidad de alfabetización/cálculo y producto)",
      "3. Competencias Específicas del grado",
      "4. Criterios de Desempeño e Indicadores de Logro",
      "5. Momentos Pedagógicos Con Base: Encuentro de grupo / Actividad guiada / Práctica independiente / Cierre",
      "6. Evidencias de Aprendizaje (producciones escritas, resolución y cuaderno de trabajo)",
      "7. Recursos y materiales manipulativos (letras móviles, fascículos, tarjetas)",
      "8. Evaluación formativa y retroalimentación"
    ],
    notas: [
      "Integra la situación de aprendizaje contextualizada con los 4 momentos del programa Con Base y el enfoque de competencias del MINERD."
    ]
  },

  abp: {
    label: "Aprendizaje Basado en Proyectos (ABP)",
    descripcion: "Planificación centrada en la resolución de un problema real mediante la creación de un producto.",
    ciclos: ["Primaria (Segundo Ciclo), Secundaria, Universidad"],
    areas: ["Multidisciplinar / Transversal"],
    bloques: [
      "1. Título del Proyecto y Pregunta Guía (Reto)",
      "2. Competencias Fundamentales y Específicas a desarrollar",
      "3. Producto final esperado",
      "4. Fase 1: Lanzamiento y exploración de saberes (Investigación)",
      "5. Fase 2: Planificación y diseño por los estudiantes",
      "6. Fase 3: Creación y ejecución del producto",
      "7. Fase 4: Presentación pública y difusión",
      "8. Evaluación: Rúbricas del proceso y del producto final"
    ],
    notas: ["El docente actúa como facilitador; los estudiantes dirigen el proceso investigativo."]
  },

  competencias_situacion: {
    label: "Planificación por Situación de Aprendizaje",
    descripcion: "Esquema avanzado donde todo el contenido se ancla a un escenario o problema del contexto del estudiante.",
    ciclos: ["Secundaria, Universidad"],
    areas: ["Todas las áreas"],
    bloques: [
      "1. Contextualización y Datos Generales",
      "2. Situación de Aprendizaje (Redacción del escenario, problema y producto)",
      "3. Red de Competencias (Fundamentales y Específicas)",
      "4. Malla Temática (Contenidos conceptuales, procedimentales, actitudinales)",
      "5. Secuencia de Actividades articuladas a la situación",
      "6. Estrategias de mediación pedagógica",
      "7. Criterios e Indicadores de Evaluación continua",
      "8. Evidencias de aprendizaje y Recursos"
    ],
    notas: ["Todo el conocimiento debe estar aplicado a resolver la situación de aprendizaje descrita."]
  },

  secuencia_didactica: {
    label: "Secuencia Didáctica (Fases detalladas)",
    descripcion: "Planificación micro-curricular enfocada en el paso a paso de 1 a 3 sesiones de clase.",
    ciclos: ["Todos los niveles"],
    areas: ["Todas las áreas"],
    bloques: [
      "1. Identificación (Asignatura, Tiempo, Tema)",
      "2. Intención Pedagógica del Día (Objetivo meta)",
      "3. Actividad de Apertura (Recuperación, conflicto cognitivo) [Con tiempos exactos]",
      "4. Actividad de Desarrollo (Construcción del conocimiento, ejercitación) [Con tiempos exactos]",
      "5. Actividad de Cierre (Metacognición, institucionalización) [Con tiempos exactos]",
      "6. Tareas asignadas para la casa (Ampliación)",
      "7. Instrumentos de evaluación (Lista de cotejo, preguntas orales)"
    ],
    notas: ["Ideal para el plan de clase diario o semanal con control estricto del tiempo."]
  }
};

const PERIODOS = ["diaria", "semanal", "mensual", "anual", "secuencia didáctica", "unidad de aprendizaje", "proyecto"];

module.exports = {
  LEVELS,
  PERIODOS,
  COMPETENCIAS_FUNDAMENTALES,
  BLOQUES_PLANIFICACION_MINERD,
  AREAS_CURRICULARES_OFICIALES
};
