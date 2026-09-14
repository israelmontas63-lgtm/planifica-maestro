/**
 * Cerebro curricular MINERD — República Dominicana
 * Basado en el currículo por competencias vigente del
 * Ministerio de Educación (MINERD), niveles Inicial, Primario y Secundario.
 *
 * Editar este archivo para ajustar terminología cuando el MINERD
 * emita una revisión curricular oficial.
 */

// ─────────────────────────────────────────────────────────────
// 7 COMPETENCIAS FUNDAMENTALES DEL CURRÍCULO DOMINICANO
// Se movilizan en todos los niveles y áreas.
// ─────────────────────────────────────────────────────────────
const COMPETENCIAS_FUNDAMENTALES = [
  "Comunicativa",
  "Pensamiento Lógico, Creativo y Crítico",
  "Resolución de Problemas",
  "Ética y Ciudadana",
  "Desarrollo Personal y Espiritual",
  "Científica y Tecnológica",
  "Ambiental y de la Salud",
];

// ─────────────────────────────────────────────────────────────
// ESTRUCTURA OBLIGATORIA DE PLANIFICACIÓN MINERD (8 bloques)
// ─────────────────────────────────────────────────────────────
const BLOQUES_PLANIFICACION_MINERD = [
  "1. Datos generales (nivel, grado/ciclo, área curricular, tiempo estimado)",
  "2. Competencias Fundamentales movilizadas y cómo se desarrollan en la clase",
  "3. Competencias Específicas del área/grado (redactadas en términos de desempeño del estudiante)",
  "4. Contenidos: Conceptuales (saber) / Procedimentales (saber hacer) / Actitudinales-Valores (saber ser)",
  "5. Estrategias de enseñanza-aprendizaje (metodología y rol docente)",
  "6. Actividades: Inicio (motivación/saberes previos) — Desarrollo (construcción) — Cierre (síntesis)",
  "7. Recursos y medios didácticos",
  "8. Evaluación: indicadores de logro, técnicas e instrumentos, tipo (diagnóstica/formativa/sumativa)",
];

// ─────────────────────────────────────────────────────────────
// NIVELES Y ÁREAS CURRICULARES MINERD
// ─────────────────────────────────────────────────────────────
const LEVELS = {
  // ── NIVEL INICIAL ──────────────────────────────────────────
  inicial: {
    label: "Nivel Inicial (MINERD)",
    descripcion: "Educación Inicial — niños de 0 a 6 años. Organizado en Ciclos: Primer Ciclo (0-3) y Segundo Ciclo (3-6).",
    ciclos: ["Primer Ciclo (0-3 años)", "Segundo Ciclo (3-6 años)"],
    areas: [
      "Comunicación y Lenguajes",
      "Relaciones con el Entorno Natural y Social",
      "Relaciones Lógico-Matemáticas",
      "Formación Personal, Social y Espiritual",
      "Expresión Artística",
      "Educación Física",
    ],
    bloques: BLOQUES_PLANIFICACION_MINERD,
    notas: [
      "El Nivel Inicial no trabaja asignaturas separadas sino ámbitos de desarrollo integrado.",
      "Las actividades deben ser lúdicas, globalizadas y respetar el ritmo de desarrollo del niño.",
      "La evaluación es cualitativa y observacional; se usan registros anecdóticos y listas de cotejo.",
    ],
  },

  // ── NIVEL PRIMARIO ─────────────────────────────────────────
  primario: {
    label: "Nivel Primario (MINERD)",
    descripcion: "Educación Primaria — 1.° a 6.° grado. Organizado en dos ciclos: Primer Ciclo (1.°–3.°) y Segundo Ciclo (4.°–6.°).",
    ciclos: ["Primer Ciclo: 1.°, 2.° y 3.° grado", "Segundo Ciclo: 4.°, 5.° y 6.° grado"],
    areas: [
      "Lengua Española",
      "Matemática",
      "Ciencias Sociales",
      "Ciencias de la Naturaleza",
      "Formación Integral Humana y Religiosa (FIHR)",
      "Educación Artística",
      "Educación Física",
      "Lenguas Extranjeras (Inglés / Francés)",
      "Tecnología de la Información y Comunicación (TIC)",
    ],
    bloques: BLOQUES_PLANIFICACION_MINERD,
    notas: [
      "En el Primer Ciclo predomina el enfoque globalizado; en el Segundo Ciclo se avanza hacia mayor especialización por área.",
      "Las competencias específicas se articulan con las 7 Competencias Fundamentales en cada unidad de aprendizaje.",
      "La evaluación combina técnicas cualitativas (observación, portafolios) y cuantitativas (pruebas, rúbricas).",
    ],
  },

  // ── PROGRAMA CON BASE (MINERD) ──────────────────────────────
  conbase: {
    label: "Programa 'Con Base' (MINERD)",
    descripcion: "Programa 'Construyendo la base de los aprendizajes' (Alfabetización Inicial). Dirigido específicamente a 1ro, 2do y 3ro de Primaria.",
    ciclos: ["Primer Ciclo de Primaria: 1.°, 2.° y 3.° grado"],
    areas: [
      "Lengua Española (Fascículos Con Base)",
      "Matemática (Fascículos Con Base)"
    ],
    bloques: [
      "1. Datos generales (grado, fascículo, secuencia, actividad, tiempo)",
      "2. Competencias Específicas e Indicadores de Logro de la secuencia",
      "3. Primer momento: Encuentro de grupo (recuperación de saberes, motivación)",
      "4. Segundo momento: Actividad grupal guiada (trabajo con el texto/concepto)",
      "5. Tercer momento: Práctica independiente (trabajo individual en cuadernos o fascículos)",
      "6. Cuarto momento: Cierre y reflexión (compartir lo aprendido)",
      "7. Recursos (fascículos, papelógrafos, tarjetas de letras/números)",
      "8. Evaluación (observación del progreso individual)"
    ],
    notas: [
      "ESTE ESQUEMA REEMPLAZA LOS 8 BLOQUES TRADICIONALES POR LOS 4 MOMENTOS DIARIOS DEL PROGRAMA CON BASE.",
      "La planificación 'Con Base' es altamente estructurada y guiada.",
      "Se centra intensivamente en lectura, escritura y matemáticas iniciales."
    ],
  },

  // ── NIVEL SECUNDARIO ───────────────────────────────────────
  secundario: {
    label: "Nivel Secundario (MINERD)",
    descripcion: "Educación Secundaria — 1.° a 6.° grado. Organizado en dos ciclos: Primer Ciclo (1.°–3.°) y Segundo Ciclo (4.°–6.°, Bachillerato).",
    ciclos: [
      "Primer Ciclo: 1.°, 2.° y 3.° de Secundaria",
      "Segundo Ciclo (Bachillerato): 4.°, 5.° y 6.° de Secundaria",
    ],
    areas: [
      "Lengua Española y Literatura",
      "Matemática",
      "Historia y Geografía",
      "Ciencias de la Naturaleza (Biología, Física, Química)",
      "Formación Integral Humana y Religiosa (FIHR)",
      "Educación Artística",
      "Educación Física",
      "Lenguas Extranjeras (Inglés / Francés)",
      "Tecnología de la Información y Comunicación (TIC)",
      "Filosofía (Segundo Ciclo)",
      "Orientación y Psicología (Segundo Ciclo)",
    ],
    bloques: BLOQUES_PLANIFICACION_MINERD,
    notas: [
      "En el Segundo Ciclo (Bachillerato) se incorporan modalidades: General, Técnico-Profesional y en Arte.",
      "Las competencias específicas se expresan como 'el/la estudiante será capaz de...' en términos de desempeño observable.",
      "El MINERD establece evaluación continua: diagnóstica al inicio, formativa durante el proceso, sumativa al final de la unidad.",
    ],
  },

  // ── EDUCACIÓN ESPECIAL (referencia) ────────────────────────
  especial: {
    label: "Educación Especial (MINERD)",
    descripcion: "Modalidad de educación inclusiva para estudiantes con necesidades educativas especiales (NEE). Sigue el mismo currículo con adaptaciones curriculares.",
    ciclos: ["Se adapta según el nivel y grado correspondiente al estudiante"],
    areas: ["Las mismas áreas del nivel que corresponda, con adaptaciones curriculares individualizadas"],
    bloques: [
      ...BLOQUES_PLANIFICACION_MINERD,
      "9. Adaptaciones Curriculares (acceso, proceso, producto y evaluación diferenciada)",
    ],
    notas: [
      "Toda planificación debe incluir el bloque de Adaptaciones Curriculares para estudiantes con NEE.",
      "El Plan Educativo Individualizado (PEI) orienta los ajustes al currículo general.",
    ],
  },
};

const PERIODOS = ["diaria", "semanal", "mensual", "anual", "secuencia didáctica", "unidad de aprendizaje"];

module.exports = { LEVELS, PERIODOS, COMPETENCIAS_FUNDAMENTALES, BLOQUES_PLANIFICACION_MINERD };

