/**
 * CAPA 5: Validador de Estructura Curricular Oficial (MINERD)
 * 
 * Revisa que toda planificación generada contenga obligatoriamente:
 * 1. Competencias (Fundamentales y Específicas)
 * 2. Contenidos (Conceptuales, Procedimentales, Actitudinales)
 * 3. Indicadores de Logro
 * 4. Actividades de Aprendizaje (Inicio, Desarrollo y Cierre)
 * 5. Evaluación (Criterios e Instrumentos)
 * 6. Sección "Fuentes" con documento, grado, área y página real.
 * 
 * Estado de validación general: "pendiente de validación por experto".
 */

function validarEstructuraPlanificacion(plan) {
  const bloquesFaltantes = [];
  const advertencias = [];

  if (!plan || typeof plan !== "object") {
    return {
      valido: false,
      bloquesFaltantes: ["planificacion_completa"],
      advertencias: ["El objeto de planificación no fue provisto o no es un objeto válido."],
      estado_validacion: "pendiente de validación por experto"
    };
  }

  // 1. Validar Competencias
  const tieneComp = plan.competencias || plan.competencias_especificas || (plan.bloques && plan.bloques.competencias);
  if (!tieneComp || (Array.isArray(tieneComp) && tieneComp.length === 0)) {
    bloquesFaltantes.push("Competencias (Fundamentales y Específicas)");
  }

  // 2. Validar Contenidos
  const tieneCont = plan.contenidos || (plan.bloques && plan.bloques.contenidos);
  if (!tieneCont || (typeof tieneCont === "object" && Object.keys(tieneCont).length === 0)) {
    bloquesFaltantes.push("Contenidos (Conceptuales, Procedimentales y Actitudinales)");
  }

  // 3. Validar Indicadores de Logro
  const tieneInd = plan.indicadores_logro || plan.indicadores || (plan.bloques && plan.bloques.indicadores_logro);
  if (!tieneInd || (Array.isArray(tieneInd) && tieneInd.length === 0)) {
    bloquesFaltantes.push("Indicadores de Logro");
  }

  // 4. Validar Actividades (Inicio, Desarrollo, Cierre)
  const tieneAct = plan.actividades || (plan.bloques && plan.bloques.actividades);
  if (!tieneAct) {
    bloquesFaltantes.push("Actividades de Aprendizaje");
  } else if (typeof tieneAct === "object") {
    const tieneInicio = tieneAct.inicio || tieneAct.fase_inicio || tieneAct.apertura;
    const tieneDesarrollo = tieneAct.desarrollo || tieneAct.fase_desarrollo;
    const tieneCierre = tieneAct.cierre || tieneAct.fase_cierre;
    if (!tieneInicio || !tieneDesarrollo || !tieneCierre) {
      advertencias.push("Las actividades no detallan explícitamente los tres momentos pedagógicos (Inicio, Desarrollo, Cierre).");
    }
  }

  // 5. Validar Evaluación
  const tieneEval = plan.evaluacion || (plan.bloques && plan.bloques.evaluacion);
  if (!tieneEval) {
    bloquesFaltantes.push("Evaluación (Criterios e Instrumentos)");
  }

  // 6. Validar Sección Fuentes con documento, grado, área y página real
  const fuentes = plan.fuentes || (plan.bloques && plan.bloques.fuentes);
  if (!fuentes) {
    bloquesFaltantes.push("Fuentes Oficiales (Documento, Grado, Área y Página real)");
  } else {
    // Si es un arreglo de fuentes o un objeto
    const listaFuentes = Array.isArray(fuentes) ? fuentes : [fuentes];
    if (listaFuentes.length === 0) {
      bloquesFaltantes.push("Fuentes Oficiales (lista vacía)");
    } else {
      for (const [idx, f] of listaFuentes.entries()) {
        if (!f.documento) advertencias.push(`Fuente #${idx + 1} no especifica el nombre del documento oficial.`);
        if (!f.grado) advertencias.push(`Fuente #${idx + 1} no especifica el grado.`);
        if (!f.area) advertencias.push(`Fuente #${idx + 1} no especifica el área.`);
        if (!f.pagina) advertencias.push(`Fuente #${idx + 1} no especifica la página real del documento.`);
      }
    }
  }

  const esValido = bloquesFaltantes.length === 0 && advertencias.filter(a => a.includes("Fuente")).length === 0;

  return {
    valido: esValido,
    bloquesRevisados: [
      "Competencias",
      "Contenidos",
      "Indicadores de Logro",
      "Actividades (Inicio/Desarrollo/Cierre)",
      "Evaluación",
      "Fuentes (Documento, Grado, Área, Página)"
    ],
    bloquesFaltantes,
    advertencias,
    estado_validacion: "pendiente de validación por experto"
  };
}

module.exports = {
  validarEstructuraPlanificacion
};
