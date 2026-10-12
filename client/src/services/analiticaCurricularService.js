/**
 * client/src/services/analiticaCurricularService.js
 * Motor de cálculo pedagógico y analítica curricular institucional.
 * Estándar Ministerial MINERD — Ordenanza 04-2023 y Adecuación Curricular 2023.
 *
 * Funciones clave:
 * - Cálculo de cobertura de las 7 Competencias Fundamentales.
 * - Desglose de estados y ratios de aprobación por Área y Grado.
 * - Monitoreo de adopción inclusiva (DUA / NEAE).
 * - Generación de diagnósticos proactivos y alertas pedagógicas tempranas.
 */

// Las 7 Competencias Fundamentales del Currículo Dominicano
export const COMPETENCIAS_FUNDAMENTALES_MINERD = [
  { id: "etica_ciudadana", nombre: "Ética y Ciudadana", clave: "etica" },
  { id: "comunicativa", nombre: "Comunicativa", clave: "comunicativa" },
  { id: "pensamiento_logico", nombre: "Pensamiento Lógico, Creativo y Crítico", clave: "logico" },
  { id: "resolucion_problemas", nombre: "Resolución de Problemas", clave: "resolucion" },
  { id: "cientifica_tecnologica", nombre: "Científica y Tecnológica", clave: "cientifica" },
  { id: "ambiental_salud", nombre: "Ambiental y de la Salud", clave: "ambiental" },
  { id: "desarrollo_personal", nombre: "Desarrollo Personal y Espiritual", clave: "personal" }
];

function normalizarTexto(txt) {
  return (txt || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .trim();
}

/**
 * Determina si una planificación trabaja activamente una competencia fundamental
 */
function contieneCompetencia(planTexto, clave) {
  const norm = normalizarTexto(planTexto);
  if (clave === "etica") {
    return norm.includes("etica") || norm.includes("ciudadan");
  }
  if (clave === "comunicativa") {
    return norm.includes("comunicativ") || norm.includes("expresion") || norm.includes("lectura");
  }
  if (clave === "logico") {
    return norm.includes("logico") || norm.includes("creativo") || norm.includes("critico") || norm.includes("pensamiento");
  }
  if (clave === "resolucion") {
    return norm.includes("resolucion") || norm.includes("problema");
  }
  if (clave === "cientifica") {
    return norm.includes("cientific") || norm.includes("tecnolog");
  }
  if (clave === "ambiental") {
    return norm.includes("ambiental") || norm.includes("salud") || norm.includes("naturaleza");
  }
  if (clave === "personal") {
    return norm.includes("desarrollo personal") || norm.includes("espiritual") || norm.includes("socioemocional");
  }
  return false;
}

/**
 * Calcula la analítica consolidada de un conjunto de planificaciones
 */
export function calcularAnaliticaInstitucional(planes = []) {
  const lista = Array.isArray(planes) ? planes : [];
  const total = lista.length;

  if (total === 0) {
    return {
      total: 0,
      tasaAprobacion: 0,
      tasaDua: 0,
      tasaObservadas: 0,
      tasaPendientes: 0,
      conteoEstados: { pendientes: 0, aprobadas: 0, observadas: 0, otros: 0 },
      coberturaCompetencias: COMPETENCIAS_FUNDAMENTALES_MINERD.map((c) => ({
        ...c,
        conteo: 0,
        porcentaje: 0,
        nivelTrabajo: "Sin datos"
      })),
      distribucionAreas: [],
      distribucionGrados: [],
      alertasPedagogicas: [
        {
          tipo: "info",
          titulo: "Sin planificaciones registradas",
          descripcion: "No hay planificaciones entregadas en el período seleccionado para calcular métricas.",
          recomendacion: "Invita a los docentes a enviar sus secuencias didácticas al pool de coordinación."
        }
      ]
    };
  }

  // 1. Desglose de estados
  let pendientes = 0;
  let aprobadas = 0;
  let observadas = 0;
  let conDua = 0;
  let conSlaVencido = 0;
  const hoy = Date.now();

  lista.forEach((p) => {
    if (p.estado === "enviada_revision") pendientes++;
    else if (p.estado === "aprobada") aprobadas++;
    else if (p.estado === "observada") observadas++;

    // Detección de adecuaciones DUA / NEAE
    const tieneDua =
      Boolean(p.tiene_dua) ||
      Boolean(p.bloques_observados?.dua) ||
      Boolean(p.datosPlanificacion && (
        p.datosPlanificacion.actividades_diferenciadas ||
        p.datosPlanificacion["Actividades Diferenciadas (Atención a la Diversidad)"] ||
        p.datosPlanificacion.dua
      )) ||
      (typeof p.texto === "string" && (p.texto.toLowerCase().includes("diferenciad") || p.texto.toLowerCase().includes("dua")));
    if (tieneDua) conDua++;

    // SLA de supervisión: si está pendiente y fue enviada hace más de 3 días (259,200,000 ms)
    if (p.estado === "enviada_revision" && p.fecha_envio) {
      const fechaEnvio = new Date(p.fecha_envio).getTime();
      if (!isNaN(fechaEnvio) && hoy - fechaEnvio > 3 * 86400000) {
        conSlaVencido++;
      }
    }
  });

  const tasaAprobacion = Math.round((aprobadas / total) * 100);
  const tasaDua = Math.round((conDua / total) * 100);
  const tasaObservadas = Math.round((observadas / total) * 100);
  const tasaPendientes = Math.round((pendientes / total) * 100);

  // 2. Cobertura de las 7 Competencias Fundamentales
  const conteoCompetencias = {};
  COMPETENCIAS_FUNDAMENTALES_MINERD.forEach((c) => {
    conteoCompetencias[c.id] = 0;
  });

  lista.forEach((p) => {
    const textoCompleto = [
      p.titulo || "",
      p.area || "",
      typeof p.texto === "string" ? p.texto : "",
      JSON.stringify(p.datosPlanificacion || {})
    ].join(" ");

    COMPETENCIAS_FUNDAMENTALES_MINERD.forEach((c) => {
      if (contieneCompetencia(textoCompleto, c.clave)) {
        conteoCompetencias[c.id]++;
      }
    });
  });

  const coberturaCompetencias = COMPETENCIAS_FUNDAMENTALES_MINERD.map((c) => {
    const conteo = conteoCompetencias[c.id] || 0;
    const porcentaje = Math.round((conteo / total) * 100);
    let nivelTrabajo = "Adecuado";
    if (porcentaje < 25) nivelTrabajo = "Bajo";
    else if (porcentaje >= 65) nivelTrabajo = "Destacado";

    return {
      ...c,
      conteo,
      porcentaje,
      nivelTrabajo
    };
  });

  // 3. Distribución por Área Curricular
  const mapaAreas = {};
  lista.forEach((p) => {
    const areaNom = p.area && String(p.area).trim() ? String(p.area).trim() : "Otras Áreas";
    if (!mapaAreas[areaNom]) {
      mapaAreas[areaNom] = { area: areaNom, total: 0, aprobadas: 0, observadas: 0, pendientes: 0 };
    }
    mapaAreas[areaNom].total++;
    if (p.estado === "aprobada") mapaAreas[areaNom].aprobadas++;
    else if (p.estado === "observada") mapaAreas[areaNom].observadas++;
    else if (p.estado === "enviada_revision") mapaAreas[areaNom].pendientes++;
  });

  const distribucionAreas = Object.values(mapaAreas).sort((a, b) => b.total - a.total);

  // 4. Distribución por Grado Escolar
  const mapaGrados = {};
  lista.forEach((p) => {
    const gradoNom = p.grado && String(p.grado).trim() ? String(p.grado).trim() : "Grado no especificado";
    if (!mapaGrados[gradoNom]) {
      mapaGrados[gradoNom] = { grado: gradoNom, total: 0, aprobadas: 0, observadas: 0, pendientes: 0 };
    }
    mapaGrados[gradoNom].total++;
    if (p.estado === "aprobada") mapaGrados[gradoNom].aprobadas++;
    else if (p.estado === "observada") mapaGrados[gradoNom].observadas++;
    else if (p.estado === "enviada_revision") mapaGrados[gradoNom].pendientes++;
  });

  const distribucionGrados = Object.values(mapaGrados).sort((a, b) =>
    a.grado.localeCompare(b.grado, "es", { numeric: true })
  );

  // 5. Diagnósticos Pedagógicos y Alertas Proactivas
  const alertasPedagogicas = [];

  // Alerta de SLA de supervisión
  if (conSlaVencido > 0) {
    alertasPedagogicas.push({
      tipo: "advertencia",
      titulo: `⚡ ${conSlaVencido} ${conSlaVencido === 1 ? "planificación supera" : "planificaciones superan"} los 3 días en espera`,
      descripcion: "Existen entregas docentes pendientes de dictamen que superan el estándar de tiempo de respuesta.",
      recomendacion: "Priorizar la revisión de las planificaciones más antiguas en el panel."
    });
  }

  // Alerta de Aprobación Institucional
  if (tasaAprobacion >= 75) {
    alertasPedagogicas.push({
      tipo: "exito",
      titulo: `✓ Alta consolidación curricular (${tasaAprobacion}% de aprobación)`,
      descripcion: "La gran mayoría de las planificaciones cumplen los requerimientos de la Adecuación Curricular 2023.",
      recomendacion: "Socializar las mejores prácticas docentes en la reunión de ciclo pedagógico."
    });
  } else if (tasaObservadas >= 40) {
    alertasPedagogicas.push({
      tipo: "atencion",
      titulo: `⚠️ Alto índice de observaciones pedagógicas (${tasaObservadas}%)`,
      descripcion: "Una proporción considerable de secuencias requiere ajustes en momentos de clase o instrumentos.",
      recomendacion: "Organizar un taller de microplanificación CON BASE en las áreas más observadas."
    });
  }

  // Alerta de Inclusión DUA / NEAE
  if (tasaDua < 40) {
    alertasPedagogicas.push({
      tipo: "atencion",
      titulo: `🧩 Oportunidad de fortalecimiento inclusivo (${tasaDua}% con DUA)`,
      descripcion: "Menos del 40% de las planificaciones cuenta con adecuaciones diferenciadas para la diversidad.",
      recomendacion: "Articular con el Equipo de Orientación y Psicología el diseño de apoyos visuales y tiempo extendido."
    });
  } else {
    alertasPedagogicas.push({
      tipo: "exito",
      titulo: `🧩 Sólida adopción de pautas DUA (${tasaDua}% de inclusión)`,
      descripcion: "Los docentes incorporan actividades diferenciadas para estudiantes con ritmos diversos y NEAE.",
      recomendacion: "Continuar evidenciando las adaptaciones en el Registro de Grado."
    });
  }

  // Alerta de Competencias Fundamentales Rezagadas
  const competenciasRezagadas = coberturaCompetencias.filter((c) => c.porcentaje < 25);
  if (competenciasRezagadas.length > 0) {
    const nombres = competenciasRezagadas.map((c) => c.nombre).join(", ");
    alertasPedagogicas.push({
      tipo: "atencion",
      titulo: `📚 Competencias con baja cobertura: ${nombres}`,
      descripcion: "Estas competencias fundamentales están siendo poco trabajadas en las secuencias actuales.",
      recomendacion: "Sugerir a los docentes intenciones pedagógicas transversales que integren estas competencias."
    });
  }

  return {
    total,
    tasaAprobacion,
    tasaDua,
    tasaObservadas,
    tasaPendientes,
    conteoEstados: { pendientes, aprobadas, observadas, total },
    coberturaCompetencias,
    distribucionAreas,
    distribucionGrados,
    alertasPedagogicas
  };
}
