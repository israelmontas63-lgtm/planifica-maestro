/**
 * client/src/config/menuActions.js
 * Registro central único de todas las acciones del menú y barra de Planifica Maestro.
 * 
 * Reglas:
 * 1. Cada botón del menú TIENE una entrada aquí.
 * 2. El estado ("listo", "listo_sin_verificar", "requiere_sesion", "proximamente")
 *    se deriva dinámicamente según autenticación y disponibilidad real de tablas/base oficial.
 * 3. Prohibido hardcodear estados o mapear botones a generadores que hagan otra cosa.
 */

export const ACCIONES_MENU = {
  // ── ACCIONES RÁPIDAS (Barra Inferior) ──
  accion_rapida_foto: {
    key: "accion_rapida_foto",
    label: "Foto",
    seccion: "rapida",
    requiereAuth: false,
    requiereTabla: null,
    esPlanGeneral: false,
    metodoCtx: "abrirCamara",
    tipoApertura: "modal",
    metodoHttpApertura: "GET",
    endpointWorker: "/api/ocr/scan",
    metodoHttpWorker: "POST",
    servicioWorker: "aiProvider.generateVision (sin almacenamiento en servidor, EXIF limpio)",
    descripcion: "Escanear material didáctico con visión artificial y tarjeta de confirmación"
  },
  accion_rapida_voz: {
    key: "accion_rapida_voz",
    label: "Voz",
    seccion: "rapida",
    requiereAuth: false,
    requiereTabla: null,
    esPlanGeneral: false,
    metodoCtx: "iniciarVoz",
    tipoApertura: "accion",
    metodoHttpApertura: "local",
    endpointWorker: null,
    metodoHttpWorker: null,
    servicioWorker: "window.speechSynthesis (Navegador) + Web Speech API",
    descripcion: "Dictado sin duplicación (resultIndex), interruptor Voz IA y silencio de micrófono"
  },
  accion_rapida_texto: {
    key: "accion_rapida_texto",
    label: "Texto",
    seccion: "rapida",
    requiereAuth: false,
    requiereTabla: null,
    esPlanGeneral: true,
    metodoCtx: "abrirTexto",
    tipoApertura: "modal",
    metodoHttpApertura: "GET",
    endpointWorker: "/api/plan/generate",
    metodoHttpWorker: "POST",
    servicioWorker: "aiProvider + curriculoService + investigadorService",
    descripcion: "Escribir tema o requerimiento con el teclado"
  },

  // ── SECCIÓN: DIARIA ──
  plan_diario_general: {
    key: "plan_diario_general",
    label: "Plan diario general",
    seccion: "diaria",
    requiereAuth: false,
    requiereTabla: "curriculo_fragmentos",
    esPlanGeneral: true,
    metodoCtx: "generarPlanDiario",
    endpointWorker: "/api/plan/generate",
    servicioWorker: "aiProvider + curriculoService",
    descripcion: "Plan de clase diario con Inicio, Desarrollo y Cierre"
  },
  registro_actividades: {
    key: "registro_actividades",
    label: "Registro de actividades",
    seccion: "diaria",
    requiereAuth: true,
    requiereTabla: "docente_actividades",
    esPlanGeneral: false,
    metodoCtx: "abrirRegistroActividades",
    endpointWorker: "/api/docente/actividades",
    servicioWorker: "Supabase RLS (docente_actividades)",
    descripcion: "Bitácora diaria de actividades ejecutadas en aula"
  },
  horario_semanal_detallado: {
    key: "horario_semanal_detallado",
    label: "Horario semanal detallado",
    seccion: "diaria",
    requiereAuth: true,
    requiereTabla: "docente_horarios",
    esPlanGeneral: false,
    metodoCtx: "abrirHorarioSemanal",
    endpointWorker: "/api/docente/horarios",
    servicioWorker: "Supabase RLS (docente_horarios)",
    descripcion: "Distribución horaria semanal del docente"
  },
  notas_aula: {
    key: "notas_aula",
    label: "Notas de aula",
    seccion: "diaria",
    requiereAuth: true,
    requiereTabla: "docente_notas",
    esPlanGeneral: false,
    metodoCtx: "abrirNotasAula",
    endpointWorker: "/api/docente/notas",
    servicioWorker: "Supabase RLS (docente_notas)",
    descripcion: "Anotaciones pedagógicas e incidencias de aula"
  },
  evaluacion_diaria: {
    key: "evaluacion_diaria",
    label: "Evaluación diaria",
    seccion: "diaria",
    requiereAuth: false,
    requiereTabla: "curriculo_fragmentos",
    esPlanGeneral: false,
    metodoCtx: "abrirEvaluacionDiaria",
    endpointWorker: "/api/plan/generate",
    servicioWorker: "aiProvider + curriculoService",
    descripcion: "Instrumentos y criterios de evaluación diaria"
  },

  // ── SECCIÓN: SEMANAL ──
  plan_semanal_general: {
    key: "plan_semanal_general",
    label: "Plan semanal general",
    seccion: "semanal",
    requiereAuth: false,
    requiereTabla: "curriculo_fragmentos",
    esPlanGeneral: true,
    metodoCtx: "generarPlanSemanal",
    endpointWorker: "/api/plan/generate",
    servicioWorker: "aiProvider + curriculoService",
    descripcion: "Planificación de 5 días articulando áreas"
  },
  distribucion_areas: {
    key: "distribucion_areas",
    label: "Distribución por áreas",
    seccion: "semanal",
    requiereAuth: false,
    requiereTabla: "curriculo_fragmentos",
    esPlanGeneral: false,
    metodoCtx: "abrirDistribucionAreas",
    endpointWorker: "/api/plan/generate",
    servicioWorker: "aiProvider + curriculoService",
    descripcion: "Carga horaria y distribución semanal por áreas MINERD"
  },
  actividades_semana: {
    key: "actividades_semana",
    label: "Actividades de la semana",
    seccion: "semanal",
    requiereAuth: false,
    requiereTabla: "curriculo_fragmentos",
    esPlanGeneral: false,
    metodoCtx: "abrirActividadesSemana",
    endpointWorker: "/api/plan/generate",
    servicioWorker: "aiProvider + curriculoService",
    descripcion: "Secuencia semanal de actividades lunes a viernes"
  },
  recursos_materiales: {
    key: "recursos_materiales",
    label: "Recursos y materiales",
    seccion: "semanal",
    requiereAuth: false,
    requiereTabla: "curriculo_fragmentos",
    esPlanGeneral: false,
    metodoCtx: "abrirRecursosMateriales",
    endpointWorker: "/api/plan/generate",
    servicioWorker: "aiProvider + curriculoService",
    descripcion: "Inventario de recursos didácticos de apoyo semanal"
  },

  // ── SECCIÓN: MENSUAL ──
  plan_mensual_general: {
    key: "plan_mensual_general",
    label: "Plan mensual general",
    seccion: "mensual",
    requiereAuth: false,
    requiereTabla: "curriculo_fragmentos",
    esPlanGeneral: true,
    metodoCtx: "generarPlanMensual",
    endpointWorker: "/api/plan/generate",
    servicioWorker: "aiProvider + curriculoService",
    descripcion: "Planificación de 4 semanas dosificada por subtemas"
  },
  calendario_mes: {
    key: "calendario_mes",
    label: "Calendario del mes",
    seccion: "mensual",
    requiereAuth: false,
    requiereTabla: "calendario_escolar_oficial",
    esPlanGeneral: false,
    metodoCtx: "abrirCalendarioMes",
    endpointWorker: "/api/calendario/mes",
    servicioWorker: "Supabase (calendario_escolar_oficial)",
    descripcion: "Efemérides y fechas del Calendario Escolar Oficial"
  },
  competencias_mes: {
    key: "competencias_mes",
    label: "Competencias del mes",
    seccion: "mensual",
    requiereAuth: false,
    requiereTabla: "curriculo_fragmentos",
    esPlanGeneral: false,
    metodoCtx: "abrirCompetenciasMes",
    endpointWorker: "/api/plan/generate",
    servicioWorker: "aiProvider + curriculoService",
    descripcion: "Competencias e indicadores priorizados para el mes"
  },

  // ── SECCIÓN: ANUAL ──
  plan_anual_general: {
    key: "plan_anual_general",
    label: "Plan anual general",
    seccion: "anual",
    requiereAuth: false,
    requiereTabla: "curriculo_fragmentos",
    esPlanGeneral: true,
    metodoCtx: "generarPlanAnual",
    endpointWorker: "/api/plan/generate",
    servicioWorker: "aiProvider + curriculoService",
    descripcion: "Planificación anual y distribución de unidades temáticas"
  },
  distribucion_periodos: {
    key: "distribucion_periodos",
    label: "Distribución por períodos",
    seccion: "anual",
    requiereAuth: false,
    requiereTabla: "curriculo_fragmentos",
    esPlanGeneral: false,
    metodoCtx: "abrirDistribucionPeriodos",
    endpointWorker: "/api/plan/generate",
    servicioWorker: "aiProvider + curriculoService",
    descripcion: "Dosificación curricular por periodos lectivos (P1-P4)"
  },
  proyeccion_anio: {
    key: "proyeccion_anio",
    label: "Proyección del año",
    seccion: "anual",
    requiereAuth: false,
    requiereTabla: "calendario_escolar_oficial",
    esPlanGeneral: false,
    metodoCtx: "abrirProyeccionAnio",
    endpointWorker: "/api/calendario/anio",
    servicioWorker: "Supabase (calendario_escolar_oficial)",
    descripcion: "Metas anuales y efemérides del año escolar oficial"
  },

  // ── SECCIÓN: UNIDAD DE APRENDIZAJE ──
  nueva_unidad: {
    key: "nueva_unidad",
    label: "Nueva unidad",
    seccion: "unidad",
    requiereAuth: false,
    requiereTabla: "curriculo_fragmentos",
    esPlanGeneral: true,
    metodoCtx: "generarNuevaUnidad",
    endpointWorker: "/api/plan/generate",
    servicioWorker: "aiProvider + curriculoService",
    descripcion: "Unidad didáctica completa con situación y evaluación"
  },
  situacion_aprendizaje: {
    key: "situacion_aprendizaje",
    label: "Situación de aprendizaje",
    seccion: "unidad",
    requiereAuth: false,
    requiereTabla: "curriculo_fragmentos",
    esPlanGeneral: false,
    metodoCtx: "abrirSituacionAprendizaje",
    endpointWorker: "/api/plan/generate",
    servicioWorker: "aiProvider + curriculoService",
    descripcion: "Situación auténtica de contexto dominicano"
  },
  competencias_indicadores: {
    key: "competencias_indicadores",
    label: "Competencias e indicadores",
    seccion: "unidad",
    requiereAuth: false,
    requiereTabla: "curriculo_fragmentos",
    esPlanGeneral: false,
    metodoCtx: "abrirCompetenciasIndicadores",
    endpointWorker: "/api/plan/generate",
    servicioWorker: "aiProvider + curriculoService",
    descripcion: "Matriz de competencias fundamentales y específicas"
  },
  secuencia_actividades: {
    key: "secuencia_actividades",
    label: "Secuencia de actividades",
    seccion: "unidad",
    requiereAuth: false,
    requiereTabla: "curriculo_fragmentos",
    esPlanGeneral: false,
    metodoCtx: "abrirSecuenciaActividades",
    endpointWorker: "/api/plan/generate",
    servicioWorker: "aiProvider + curriculoService",
    descripcion: "Secuencia didáctica por fases pedagógicas"
  },
  evaluacion_unidad: {
    key: "evaluacion_unidad",
    label: "Evaluación de la unidad",
    seccion: "unidad",
    requiereAuth: false,
    requiereTabla: "curriculo_fragmentos",
    esPlanGeneral: false,
    metodoCtx: "abrirEvaluacionUnidad",
    endpointWorker: "/api/plan/generate",
    servicioWorker: "aiProvider + curriculoService",
    descripcion: "Criterios, rúbricas e instrumentos de la unidad"
  },

  // ── SECCIÓN: PROYECTO ──
  nuevo_proyecto: {
    key: "nuevo_proyecto",
    label: "Nuevo proyecto",
    seccion: "proyecto",
    requiereAuth: false,
    requiereTabla: null,
    esPlanGeneral: true,
    metodoCtx: "generarNuevoProyecto",
    endpointWorker: "/api/plan/generate",
    servicioWorker: "aiProvider (Esquema ABP)",
    descripcion: "Proyecto pedagógico usando el esquema ABP"
  },
  proyecto_aula: {
    key: "proyecto_aula",
    label: "Proyecto de aula",
    seccion: "proyecto",
    requiereAuth: false,
    requiereTabla: "curriculo_fragmentos",
    esPlanGeneral: false,
    metodoCtx: "abrirProyectoAula",
    endpointWorker: "/api/plan/generate",
    servicioWorker: "aiProvider + curriculoService",
    descripcion: "Proyecto de aula (pendiente documentación oficial MINERD)"
  },
  proyecto_institucional: {
    key: "proyecto_institucional",
    label: "Proyecto institucional",
    seccion: "proyecto",
    requiereAuth: false,
    requiereTabla: "curriculo_fragmentos",
    esPlanGeneral: false,
    metodoCtx: "abrirProyectoInstitucional",
    endpointWorker: "/api/plan/generate",
    servicioWorker: "aiProvider + curriculoService",
    descripcion: "Proyecto de centro (pendiente documentación oficial MINERD)"
  },
  evaluacion_proyecto: {
    key: "evaluacion_proyecto",
    label: "Evaluación del proyecto",
    seccion: "proyecto",
    requiereAuth: false,
    requiereTabla: "curriculo_fragmentos",
    esPlanGeneral: false,
    metodoCtx: "abrirEvaluacionProyecto",
    endpointWorker: "/api/plan/generate",
    servicioWorker: "aiProvider + curriculoService",
    descripcion: "Evaluación de proyectos (pendiente documentación oficial MINERD)"
  },

  // ── SECCIÓN: MI ESPACIO ──
  mis_planificaciones: {
    key: "mis_planificaciones",
    label: "Mis planificaciones",
    seccion: "espacio",
    requiereAuth: true,
    requiereTabla: null,
    esPlanGeneral: false,
    metodoCtx: "abrirBiblioteca",
    endpointWorker: "/api/plan/mis-planificaciones",
    servicioWorker: "bibliotecaStorage (scoped por userId)",
    descripcion: "Historial de planificaciones guardadas del docente"
  },
  curriculo_nacional: {
    key: "curriculo_nacional",
    label: "Malla Curricular",
    seccion: "espacio",
    requiereAuth: false,
    requiereTabla: "curriculo_fragmentos",
    esPlanGeneral: false,
    metodoCtx: "abrirCurriculo",
    tipoApertura: "pantalla",
    metodoHttpApertura: "GET",
    endpointWorker: "/api/plan/consultar-curriculo",
    metodoHttpWorker: "POST",
    servicioWorker: "curriculoService (Visor Curricular)",
    descripcion: "Explorar competencias, contenidos e indicadores oficiales"
  },
  esquemas_planificacion: {
    key: "esquemas_planificacion",
    label: "Esquemas de planificación",
    seccion: "espacio",
    requiereAuth: false,
    requiereTabla: null,
    esPlanGeneral: false,
    metodoCtx: "abrirEsquemas",
    tipoApertura: "pantalla",
    metodoHttpApertura: "GET",
    endpointWorker: "/api/plan/esquemas",
    metodoHttpWorker: "GET",
    servicioWorker: "Worker LEVELS",
    descripcion: "Seleccionar esquemas curriculares del MINERD"
  },

  // ── SECCIÓN: CUENTA Y APP ──
  perfil_docente: {
    key: "perfil_docente",
    label: "Mi Perfil",
    seccion: "cuenta",
    requiereAuth: true,
    requiereTabla: null,
    esPlanGeneral: false,
    metodoCtx: "abrirPerfil",
    tipoApertura: "pantalla",
    metodoHttpApertura: "GET",
    endpointWorker: "/api/docente/perfil",
    metodoHttpWorker: "POST",
    servicioWorker: "perfilStorage (scoped por userId)",
    descripcion: "Datos personales y centro educativo del docente"
  },
  ajustes: {
    key: "ajustes",
    label: "Ajustes",
    seccion: "cuenta",
    requiereAuth: false,
    requiereTabla: null,
    esPlanGeneral: false,
    metodoCtx: "abrirConfiguracion",
    tipoApertura: "modal",
    metodoHttpApertura: "GET",
    endpointWorker: "/api/plan/cuota",
    metodoHttpWorker: "GET",
    servicioWorker: "App settings + cuota",
    descripcion: "Configuración de la aplicación y cuota docente"
  },
  ayuda: {
    key: "ayuda",
    label: "Ayuda",
    seccion: "cuenta",
    requiereAuth: false,
    requiereTabla: null,
    esPlanGeneral: false,
    metodoCtx: "abrirAyuda",
    tipoApertura: "modal",
    metodoHttpApertura: "local",
    endpointWorker: null,
    metodoHttpWorker: null,
    servicioWorker: "Modal Ayuda y Tutorial",
    descripcion: "Centro de ayuda y tutorial docente"
  }
};

/**
 * Deriva dinámicamente el estado de una acción.
 * 
 * Posibles estados:
 * - "requiere_sesion": La acción requiere estar autenticado y no hay usuario.
 * - "listo_sin_verificar": Plan general o Malla Curricular ejecutable como borrador/muestra mientras la base oficial no esté cargada.
 * - "listo": Todos los requerimientos (auth y base oficial si aplica) están cumplidos.
 * - "proximamente": La acción requiere tablas o datos oficiales aún no disponibles.
 * 
 * @param {string} accionKey - Clave de la acción en ACCIONES_MENU.
 * @param {Object} options
 * @param {Object|null} options.user - Objeto de usuario autenticado o null.
 * @param {Array<string>} options.tablasDisponibles - Tablas comprobadas realmente desde el Worker.
 * @returns {"listo" | "listo_sin_verificar" | "requiere_sesion" | "proximamente"}
 */
export function obtenerEstadoAccion(accionKey, { user = null, tablasDisponibles = [] } = {}) {
  const accion = ACCIONES_MENU[accionKey];
  if (!accion) {
    return "proximamente";
  }

  // 1. Evaluación de Autenticación
  if (accion.requiereAuth && !user) {
    return "requiere_sesion";
  }

  // 2. Malla Curricular: sin base oficial cargada queda en "listo_sin_verificar"
  if (accionKey === "curriculo_nacional") {
    const tablaExiste = Array.isArray(tablasDisponibles) && tablasDisponibles.includes("curriculo_fragmentos");
    return tablaExiste ? "listo" : "listo_sin_verificar";
  }

  // 3. Si la acción requiere una tabla específica
  if (accion.requiereTabla) {
    const tablaExiste = Array.isArray(tablasDisponibles) && tablasDisponibles.includes(accion.requiereTabla);

    if (!tablaExiste) {
      // Si es un plan general, puede operar como borrador sin verificar
      if (accion.esPlanGeneral) {
        return "listo_sin_verificar";
      }
      // Si depende estrictamente de la tabla oficial (ej. calendario, evaluaciones), queda próximamente
      return "proximamente";
    }
  }

  // 4. Casos explícitos que quedan como pronto hasta decisión oficial
  if (["proyecto_aula", "proyecto_institucional", "evaluacion_proyecto"].includes(accionKey)) {
    return "proximamente";
  }

  return "listo";
}
