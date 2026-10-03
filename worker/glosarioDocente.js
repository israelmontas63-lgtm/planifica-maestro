/**
 * worker/glosarioDocente.js
 * 
 * Glosario Docente Dominicano en memoria para Cloudflare Worker (ESM, 0 ms, sin fs).
 */

export const GLOSARIO_DOCENTE = {
  "tanda_extendida": {
    "termino": "Tanda Extendida",
    "definicion": "Jornada escolar completa (8:00 AM a 4:00 PM) implementada por el MINERD en centros públicos dominicanos con almuerzo y talleres curriculares.",
    "categoria": "organizacion_escolar"
  },
  "registro_de_grado": {
    "termino": "Registro de Grado",
    "definicion": "Instrumento oficial obligatorio del MINERD para asentar asistencia, calificaciones, competencias e indicadores de logro por estudiante.",
    "categoria": "evaluacion_oficial"
  },
  "situacion_de_aprendizaje": {
    "termino": "Situación de Aprendizaje",
    "definicion": "Contextualización pedagógica de un reto o problemática real del entorno que articula y motiva las actividades del currículo dominicano.",
    "categoria": "metodologia"
  },
  "secuencia_didactica": {
    "termino": "Secuencia Didáctica",
    "definicion": "Conjunto articulado de sesiones con fases progresivas: Exploración, Conceptualización, Aplicación y Evaluación.",
    "categoria": "metodologia"
  },
  "momentos_de_la_clase": {
    "termino": "Momentos de la Clase",
    "definicion": "Estructura operativa de toda sesión escolar dominicana: Inicio (saberes previos e intención), Desarrollo (construcción activa) y Cierre (metacognición).",
    "categoria": "metodologia"
  },
  "competencias_fundamentales": {
    "termino": "Competencias Fundamentales",
    "definicion": "Las 7 competencias transversales del diseño curricular MINERD que expresan las intenciones educativas de mayor relevancia para el desarrollo pleno.",
    "categoria": "curriculo"
  },
  "competencias_especificas": {
    "termino": "Competencias Específicas",
    "definicion": "Capacidades que el estudiante debe desarrollar en cada área curricular y grado escolar según la malla curricular oficial.",
    "categoria": "curriculo"
  },
  "indicadores_de_logro": {
    "termino": "Indicadores de Logro",
    "definicion": "Criterios observables y evaluables fijados en el currículo MINERD que evidencian el nivel de dominio alcanzado por el estudiante.",
    "categoria": "evaluacion_oficial"
  },
  "adecuacion_curricular": {
    "termino": "Adecuación Curricular",
    "definicion": "Marco curricular oficial vigente emitido por el MINERD que prioriza y reorganiza competencias y contenidos en Inicial, Primaria y Secundaria.",
    "categoria": "normativa"
  },
  "con_base": {
    "termino": "CON BASE",
    "definicion": "Programa oficial de Construir Base en Primer Ciclo de Primaria (1.º, 2.º y 3.º) enfocado en alfabetización inicial y pensamiento matemático.",
    "categoria": "programa_oficial"
  },
  "izamiento_de_bandera": {
    "termino": "Izamiento de Bandera",
    "definicion": "Acto cívico solemne matutino en centros educativos dominicanos donde se rinde homenaje a la patria y se entona el Himno Nacional.",
    "categoria": "civismo"
  },
  "efemerides": {
    "termino": "Efemérides",
    "definicion": "Conmemoraciones históricas y cívicas establecidas en el calendario escolar oficial del MINERD para su celebración en el aula.",
    "categoria": "civismo"
  },
  "pizarra": {
    "termino": "Pizarra",
    "definicion": "Pizarrón escolar donde el maestro modela, ejemplifica conceptos y los estudiantes presentan sus ejercicios prácticos.",
    "categoria": "recursos_aula"
  },
  "cuadernillo": {
    "termino": "Cuadernillo",
    "definicion": "Material didáctico impreso oficial distribuido por el MINERD con actividades guiadas e interdisciplinares.",
    "categoria": "recursos_aula"
  },
  "distrito_educativo": {
    "termino": "Distrito Educativo",
    "definicion": "Dependencia territorial intermedia del MINERD que acompaña, supervisa y da seguimiento pedagógico a los centros educativos.",
    "categoria": "organizacion_escolar"
  },
  "regional_de_educacion": {
    "termino": "Regional de Educación",
    "definicion": "Órgano descentralizado del MINERD que coordina los distritos educativos de una provincia o región geográfica.",
    "categoria": "organizacion_escolar"
  },
  "politecnico": {
    "termino": "Politécnico",
    "definicion": "Centro de educación secundaria que ofrece la modalidad técnico-profesional habilitando al estudiante para el trabajo técnico.",
    "categoria": "organizacion_escolar"
  },
  "dua": {
    "termino": "DUA (Diseño Universal para el Aprendizaje)",
    "definicion": "Enfoque metodológico inclusivo que ofrece múltiples formas de representación, expresión y motivación para atender la diversidad en el aula.",
    "categoria": "inclusion"
  }
};

export function buscarEnGlosario(termino) {
  if (!termino || typeof termino !== "string") return null;
  const norm = termino.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  
  for (const [clave, item] of Object.entries(GLOSARIO_DOCENTE)) {
    const claveNorm = clave.replace(/_/g, " ");
    const terminoNorm = (item.termino || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (norm === claveNorm || norm.includes(claveNorm) || norm === terminoNorm || norm.includes(terminoNorm)) {
      return item;
    }
  }
  return null;
}
