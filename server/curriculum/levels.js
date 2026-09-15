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

const LEVELS = {
  // ─────────────────────────────────────────────
  // ESQUEMAS TRADICIONALES (POR NIVELES)
  // ─────────────────────────────────────────────
  inicial: {
    label: "Esquema Tradicional (Nivel Inicial)",
    descripcion: "Planificación por centros de interés o proyectos de aula para niños de 0 a 6 años.",
    ciclos: ["Todos los niveles iniciales"],
    areas: ["Comunicación", "Entorno Natural/Social", "Lógico-Matemática", "Desarrollo Personal", "Expresión Artística", "Educación Física"],
    bloques: BLOQUES_PLANIFICACION_MINERD,
    notas: ["Enfoque lúdico y globalizado. No hay materias separadas."]
  },

  primario: {
    label: "Esquema Tradicional (Nivel Primario)",
    descripcion: "Planificación por asignaturas para 1ro a 6to grado de Primaria.",
    ciclos: ["Primer y Segundo Ciclo de Primaria"],
    areas: ["Lengua Española", "Matemática", "Ciencias Sociales", "Ciencias de la Naturaleza", "FIHR", "Artística", "Ed. Física", "Inglés/Francés"],
    bloques: BLOQUES_PLANIFICACION_MINERD,
    notas: ["Integración de ejes transversales en las áreas curriculares."]
  },

  secundario: {
    label: "Esquema Tradicional (Nivel Secundario)",
    descripcion: "Planificación especializada por asignaturas para 1ro a 6to de Secundaria.",
    ciclos: ["Primer Ciclo y Segundo Ciclo (Bachillerato)"],
    areas: ["Lengua Española", "Matemática", "Ciencias Sociales/Historia", "Ciencias de la Naturaleza/Biología", "FIHR", "Artística", "Ed. Física", "Idiomas", "TIC", "Filosofía"],
    bloques: BLOQUES_PLANIFICACION_MINERD,
    notas: ["Énfasis en resolución de problemas complejos y preparación pre-universitaria/técnica."]
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
    label: "Esquema 'Con Base' (Alfabetización)",
    descripcion: "Programa 'Construyendo la base de los aprendizajes' del MINERD, centrado en alfabetización inicial.",
    ciclos: ["1ro, 2do y 3ro de Primaria"],
    areas: ["Lengua Española (Fascículos)", "Matemática (Fascículos)"],
    bloques: [
      "1. Datos generales (grado, fascículo, secuencia, actividad)",
      "2. Competencias e Indicadores de Logro",
      "3. Primer momento: Encuentro de grupo (recuperación de saberes)",
      "4. Segundo momento: Actividad grupal guiada",
      "5. Tercer momento: Práctica independiente",
      "6. Cuarto momento: Cierre y reflexión",
      "7. Recursos de apoyo",
      "8. Evaluación formativa (observación)"
    ],
    notas: ["Reemplaza los bloques tradicionales por 4 momentos cronológicos exactos."]
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

module.exports = { LEVELS, PERIODOS, COMPETENCIAS_FUNDAMENTALES, BLOQUES_PLANIFICACION_MINERD };
