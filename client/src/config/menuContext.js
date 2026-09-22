/**
 * client/src/config/menuContext.js
 * Construcción del objeto 'ctx' (contexto de ejecución de acciones) para Planifica Maestro.
 * 
 * Cada método aquí implementado se conecta con el Worker o con el flujo correspondiente en la app.
 */
import { ACCIONES_MENU } from "./menuActions.js";

/**
 * Crea el contexto de ejecución de acciones para el menú y barra de acciones.
 * 
 * @param {Object} handlers - Callbacks y despachadores provistos por App.jsx
 * @returns {Object} ctx con todos los métodos requeridos por ACCIONES_MENU
 */
export function crearMenuContext(handlers = {}) {
  const {
    enviarMensaje,
    abrirTextoModal,
    abrirCamaraInput,
    iniciarVozHandler,
    abrirBibliotecaHandler,
    abrirCurriculoHandler,
    abrirEsquemasHandler,
    abrirPerfilHandler,
    abrirConfiguracionHandler,
    abrirAyudaHandler,
    abrirAuthHandler,
    setToastMsg,
    user
  } = handlers;

  return {
    // ── ACCIONES RÁPIDAS ──
    abrirCamara: () => {
      abrirCamaraInput?.();
    },
    iniciarVoz: () => {
      iniciarVozHandler?.();
    },
    abrirTexto: (prompt, titulo) => {
      abrirTextoModal?.(prompt, titulo);
    },

    // ── PLANES GENERALES (Llaman a POST /api/plan/generate vía abrirTextoModal / enviarMensaje) ──
    generarPlanDiario: (prompt, titulo) => {
      abrirTextoModal?.(prompt || "Plan diario general de clase para: ", titulo || "Plan Diario General");
    },
    generarPlanSemanal: (prompt, titulo) => {
      abrirTextoModal?.(prompt || "Planificación semanal completa para: ", titulo || "Plan Semanal General");
    },
    generarPlanMensual: (prompt, titulo) => {
      abrirTextoModal?.(prompt || "Planificación mensual alineada al Calendario Escolar Oficial para: ", titulo || "Plan Mensual General");
    },
    generarPlanAnual: (prompt, titulo) => {
      abrirTextoModal?.(prompt || "Planificación anual general y dosificación curricular para: ", titulo || "Plan Anual General");
    },
    nuevaUnidad: (prompt, titulo) => {
      abrirTextoModal?.(prompt || "Nueva unidad de aprendizaje para: ", titulo || "Nueva Unidad de Aprendizaje");
    },
    generarNuevaUnidad: (prompt, titulo) => {
      abrirTextoModal?.(prompt || "Nueva unidad de aprendizaje para: ", titulo || "Nueva Unidad de Aprendizaje");
    },
    generarNuevoProyecto: (prompt, titulo) => {
      abrirTextoModal?.(prompt || "Nuevo proyecto pedagógico usando esquema ABP para: ", titulo || "Nuevo Proyecto Pedagógico (ABP)");
    },

    // ── PANTALLAS DE DATOS DOCENTE (Fase 2 - Requieren sesión) ──
    abrirRegistroActividades: () => {
      if (!user) {
        setToastMsg?.("Inicia sesión para usar esta función");
        abrirAuthHandler?.();
        return;
      }
      setToastMsg?.("Módulo de Registro de actividades: Próximamente");
    },
    abrirHorarioSemanal: () => {
      if (!user) {
        setToastMsg?.("Inicia sesión para usar esta función");
        abrirAuthHandler?.();
        return;
      }
      setToastMsg?.("Módulo de Horario semanal detallado: Próximamente");
    },
    abrirNotasAula: () => {
      if (!user) {
        setToastMsg?.("Inicia sesión para usar esta función");
        abrirAuthHandler?.();
        return;
      }
      setToastMsg?.("Módulo de Notas de aula: Próximamente");
    },

    // ── ACCIONES PENDIENTES DE BASE OFICIAL O DECISIÓN (Fase 3 y 4) ──
    abrirEvaluacionDiaria: () => {
      setToastMsg?.("Módulo de Evaluación diaria: Próximamente");
    },
    abrirDistribucionAreas: () => {
      setToastMsg?.("Módulo de Distribución por áreas: Próximamente");
    },
    abrirActividadesSemana: () => {
      setToastMsg?.("Módulo de Actividades de la semana: Próximamente");
    },
    abrirRecursosMateriales: () => {
      setToastMsg?.("Módulo de Recursos y materiales: Próximamente");
    },
    abrirCalendarioMes: () => {
      setToastMsg?.("Módulo de Calendario del mes: Próximamente");
    },
    abrirCompetenciasMes: () => {
      setToastMsg?.("Módulo de Competencias del mes: Próximamente");
    },
    abrirDistribucionPeriodos: () => {
      setToastMsg?.("Módulo de Distribución por períodos: Próximamente");
    },
    abrirProyeccionAnio: () => {
      setToastMsg?.("Módulo de Proyección del año: Próximamente");
    },
    abrirSituacionAprendizaje: () => {
      setToastMsg?.("Módulo de Situación de aprendizaje: Próximamente");
    },
    abrirCompetenciasIndicadores: () => {
      setToastMsg?.("Módulo de Competencias e indicadores: Próximamente");
    },
    abuenciaActividades: () => {
      setToastMsg?.("Módulo de Secuencia de actividades: Próximamente");
    },
    abrirSecuenciaActividades: () => {
      setToastMsg?.("Módulo de Secuencia de actividades: Próximamente");
    },
    abrirEvaluacionUnidad: () => {
      setToastMsg?.("Módulo de Evaluación de la unidad: Próximamente");
    },
    abrirProyectoAula: () => {
      setToastMsg?.("Módulo de Proyecto de aula: Próximamente");
    },
    abrirProyectoInstitucional: () => {
      setToastMsg?.("Módulo de Proyecto institucional: Próximamente");
    },
    abrirEvaluacionProyecto: () => {
      setToastMsg?.("Módulo de Evaluación del proyecto: Próximamente");
    },

    // ── MI ESPACIO Y CUENTA ──
    abrirBiblioteca: () => {
      if (!user) {
        setToastMsg?.("Inicia sesión para usar esta función");
        abrirAuthHandler?.();
        return;
      }
      abrirBibliotecaHandler?.();
    },
    abrirCurriculo: () => {
      abrirCurriculoHandler?.();
    },
    abrirEsquemas: () => {
      abrirEsquemasHandler?.();
    },
    abrirPerfil: () => {
      if (!user) {
        setToastMsg?.("Inicia sesión para usar esta función");
        abrirAuthHandler?.();
        return;
      }
      abrirPerfilHandler?.();
    },
    abrirConfiguracion: () => {
      abrirConfiguracionHandler?.();
    },
    abrirAyuda: () => {
      abrirAyudaHandler?.();
    }
  };
}
