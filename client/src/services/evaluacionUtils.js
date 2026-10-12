/**
 * client/src/services/evaluacionUtils.js
 * Utilitarios curriculares para estructuración de instrumentos de evaluación formativa.
 * Alineado al Sistema de Evaluación del Currículo Dominicano (Ordenanza 04-2023)
 * y la Adecuación Curricular 2023 del MINERD.
 *
 * Niveles Oficiales de Dominio por Competencias:
 * 1. Destacado / Estratégico (D): Supera el estándar, transfiere aprendizajes o propone soluciones creativas.
 * 2. Logrado / Autónomo (L): Desempeño consistente y autónomo según el indicador esperado.
 * 3. En Proceso / Básico (P): Aplica conceptos y procedimientos básicos con apoyo o mediación ocasional.
 * 4. Incipiente / Inicial (I): Comprensión inicial; requiere acompañamiento continuo y modelado docente.
 */

function normalizarTexto(txt) {
  return (txt || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Busca un valor en los datos de la planificación por múltiples claves
 */
export function buscarEnObjeto(obj, claves) {
  if (!obj || typeof obj !== "object") return "";
  const entries = Object.entries(obj);
  for (const c of claves) {
    const cNorm = normalizarTexto(c);
    for (const [k, v] of entries) {
      if (normalizarTexto(k).includes(cNorm)) {
        return typeof v === "string" ? v.trim() : String(v || "");
      }
    }
  }
  return "";
}

/**
 * Extrae y desglosa los criterios e indicadores de evaluación del plan
 */
export function extraerCriteriosEvaluacion(datosPlan = {}, textoPlan = "") {
  const datos = datosPlan && typeof datosPlan === "object" ? datosPlan : {};

  const textoEvaluacion =
    buscarEnObjeto(datos, ["evaluacion", "evaluación", "criterios de evaluacion", "instrumentos"]) ||
    "";
  const textoCompetencias =
    buscarEnObjeto(datos, ["competencias especificas", "especificas", "específicas"]) ||
    "";
  const textoIntencion =
    buscarEnObjeto(datos, ["intencion pedagogica", "intención pedagógica", "proposito", "meta"]) ||
    "";
  const textoDua =
    buscarEnObjeto(datos, ["actividades diferenciadas", "diferenciadas", "adaptaciones", "dua"]) ||
    "";
  const area =
    buscarEnObjeto(datos, ["area", "área", "asignatura", "materia"]) ||
    "Área Curricular";

  // Intentar descomponer el texto de evaluación si viene enumerado o con viñetas
  const lineasCriterios = (textoEvaluacion || textoCompetencias || textoPlan)
    .split(/\n|;|\.\s+(?=[A-Z0-9])/)
    .map((l) => l.trim().replace(/^[-•*📌\d.)\s]+/, ""))
    .filter((l) => l.length > 15 && !l.toLowerCase().startsWith("evaluación") && !l.toLowerCase().startsWith("instrumento"));

  const criterios = [];

  if (lineasCriterios.length >= 2) {
    // Tomar hasta 4 criterios claros
    const candidatos = lineasCriterios.slice(0, 4);
    candidatos.forEach((cand, idx) => {
      criterios.push({
        id: `crit_${idx + 1}`,
        nombre: `Criterio ${idx + 1}: ${cand.substring(0, 80)}${cand.length > 80 ? "..." : ""}`,
        descripcion: cand,
        indicador: cand
      });
    });
  } else {
    // Plantilla curricular canónica adaptada al área
    const c1 = textoIntencion || `Comprensión de los conceptos fundamentales y procedimientos del área de ${area}.`;
    const c2 = textoCompetencias || `Aplicación de estrategias para la resolución de situaciones de aprendizaje.`;
    const c3 = textoEvaluacion || `Comunicación clara, argumentación y uso de vocabulario técnico del grado.`;

    criterios.push(
      {
        id: "crit_1",
        nombre: "Comprensión Conceptual y Procedimental",
        descripcion: c1,
        indicador: `Demuestra comprensión de los conceptos clave aplicados en la secuencia didáctica.`
      },
      {
        id: "crit_2",
        nombre: "Aplicación y Resolución de Actividades",
        descripcion: c2,
        indicador: `Aplica estrategias procedimentales en la resolución de tareas individuales y colaborativas.`
      },
      {
        id: "crit_3",
        nombre: "Comunicación y Reflexión Metacognitiva",
        descripcion: c3,
        indicador: `Comunica y justifica sus resultados empleando el lenguaje propio del área curricular.`
      }
    );
  }

  return {
    criterios,
    area,
    intencion: textoIntencion,
    adaptacionesDua: textoDua
  };
}

/**
 * Genera la matriz oficial de 4 niveles de la Rúbrica Analítica MINERD
 */
export function estructurarMatrizRubrica(criteriosList = [], { area = "", adaptacionesDua = "" } = {}) {
  return criteriosList.map((crit, idx) => {
    const desc = crit.descripcion || crit.nombre || `Criterio ${idx + 1}`;

    return {
      id: crit.id || `crit_${idx + 1}`,
      criterio: crit.nombre || `Criterio ${idx + 1}`,
      indicador: crit.indicador || desc,
      ponderacion: "25%",
      niveles: {
        destacado: {
          codigo: "D",
          etiqueta: "Destacado (4 pts)",
          descriptor: `Supera el estándar esperado: Aplica de forma autónoma, precisa y creativa los aprendizajes relativos a "${desc}". Justifica sus respuestas, transfiere los conocimientos a nuevas situaciones y apoya a sus compañeros.`
        },
        logrado: {
          codigo: "L",
          etiqueta: "Logrado (3 pts)",
          descriptor: `Cumple el estándar curricular: Demuestra dominio consistente y autónomo en "${desc}". Resuelve las consignas correctamente y explica con claridad el procedimiento utilizado.`
        },
        en_proceso: {
          codigo: "P",
          etiqueta: "En Proceso (2 pts)",
          descriptor: `En desarrollo: Comprende los aspectos básicos de "${desc}", pero requiere orientación o mediación docente ocasional para completar la tarea con precisión.`
        },
        incipiente: {
          codigo: "I",
          etiqueta: "Incipiente (1 pt)",
          descriptor: `Nivel inicial: Muestra dificultad para identificar o aplicar los elementos de "${desc}". Requiere modelado directo, material concreto y acompañamiento pedagógico continuo.`
        }
      },
      observacionDua: adaptacionesDua
        ? `Ajuste DUA / NEAE: ${adaptacionesDua}`
        : "Permitir apoyos visuales y tiempo adicional según pautas DUA."
    };
  });
}

/**
 * Genera la estructura de la Lista de Cotejo Formativa con indicadores y casillas
 */
export function estructurarListaCotejo(criteriosList = [], { adaptacionesDua = "" } = {}) {
  return criteriosList.map((crit, idx) => ({
    numero: idx + 1,
    indicador: crit.indicador || crit.descripcion || crit.nombre,
    evidencia: "Producción en cuaderno / Participación oral / Ficha de trabajo",
    escala: ["Logrado (L)", "En Proceso (P)", "Iniciado (I)"],
    ajusteDua: adaptacionesDua || "Apoyos multisensoriales y consignas dosificadas."
  }));
}
