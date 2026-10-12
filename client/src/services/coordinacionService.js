/**
 * client/src/services/coordinacionService.js
 * Servicio Institucional de Coordinación Pedagógica y Supervisión MINERD (Fase 12).
 * 
 * Reglas de confiabilidad y resiliencia auditadas:
 * 1. Alineación 100% con la base de datos Supabase:
 *    - Estados de planificaciones: 'borrador', 'enviada_revision', 'aprobada', 'observada'.
 *    - Estados de revisión: 'aprobada', 'requiere_ajustes', 'sugerencias'.
 *    - Roles válidos: 'docente', 'coordinador_area', 'director', 'admin'.
 * 2. Tolerancia total a fallos y modo offline: si Supabase no está configurado
 *    o el dispositivo no tiene red, persiste y recupera del almacenamiento local.
 */
import { obtenerTodasLasPlanificaciones } from "./bibliotecaStorage.js";

const LOCAL_COORDINACION_KEY = "pm_coordinacion_supervision_planes";
const LOCAL_REVISIONES_KEY = "pm_coordinacion_revisiones";

// ── HELPERS LOCALES RESILIENTES ──

function leerPlanesLocalesSupervision() {
  try {
    const raw = localStorage.getItem(LOCAL_COORDINACION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function guardarPlanesLocalesSupervision(planes) {
  try {
    localStorage.setItem(LOCAL_COORDINACION_KEY, JSON.stringify(planes));
  } catch (e) {}
}

function leerRevisionesLocales() {
  try {
    const raw = localStorage.getItem(LOCAL_REVISIONES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function guardarRevisionesLocales(revisiones) {
  try {
    localStorage.setItem(LOCAL_REVISIONES_KEY, JSON.stringify(revisiones));
  } catch (e) {}
}

/**
 * Envía una planificación a coordinación pedagógica para revisión.
 * Cambia el estado a 'enviada_revision'.
 */
export async function enviarPlanACoordinacion({
  supabaseClient,
  plan,
  userId,
  escuelaId,
  docenteNombre = "Docente"
}) {
  if (!plan || !plan.id) {
    throw new Error("Planificación inválida para enviar a coordinación.");
  }

  const planActualizado = {
    ...plan,
    estado: "enviada_revision",
    docenteNombre,
    docente_id: userId || plan.docente_id || "docente_local",
    escuela_id: escuelaId || plan.escuela_id || "escuela_general",
    fecha_envio: new Date().toISOString(),
    actualizado_en: new Date().toISOString()
  };

  // 1. Guardar copia en el pool local de coordinación (para visibilidad offline)
  const locales = leerPlanesLocalesSupervision();
  const idx = locales.findIndex((p) => p.id === plan.id);
  if (idx !== -1) {
    locales[idx] = planActualizado;
  } else {
    locales.unshift(planActualizado);
  }
  guardarPlanesLocalesSupervision(locales);

  // 2. Si hay conexión a Supabase autenticada, enviar a la tabla oficial
  if (supabaseClient && userId) {
    try {
      const { error } = await supabaseClient
        .from("planificaciones")
        .upsert({
          id: plan.id,
          escuela_id: escuelaId || null,
          docente_id: userId,
          titulo: plan.titulo || "Planificación Docente",
          nivel: plan.nivel || "primario",
          grado: plan.grado || "General",
          area: plan.area || "General",
          periodo: plan.periodo || "diaria",
          esquema_id: plan.esquema_id || plan.esquemaLabel || "primario",
          datos_planificacion: plan.datosPlanificacion || {},
          ajustes_manuales: plan.ajustesManuales || {},
          estado: "enviada_revision",
          actualizado_en: new Date().toISOString()
        });

      if (error) {
        console.warn("Aviso al registrar en Supabase (planificaciones):", error.message);
      }
    } catch (e) {
      console.warn("Error de red al sincronizar plan con coordinación:", e.message);
    }
  }

  return planActualizado;
}

/**
 * Obtiene las planificaciones supervisables de un centro educativo.
 * Si el usuario es docente, solo ve las suyas.
 * Si es coordinador o director, ve todas las enviadas a revisión, aprobadas u observadas.
 */
export async function obtenerPlanificacionesParaSupervision({
  supabaseClient,
  escuelaId,
  rol = "coordinador_area",
  userId
}) {
  let planes = [];

  // 1. Consultar Supabase si hay cliente activo
  if (supabaseClient && userId) {
    try {
      let query = supabaseClient
        .from("planificaciones")
        .select(`
          id,
          escuela_id,
          docente_id,
          titulo,
          nivel,
          grado,
          area,
          periodo,
          esquema_id,
          datos_planificacion,
          ajustes_manuales,
          estado,
          creado_en,
          actualizado_en
        `);

      if (rol === "coordinador_area" || rol === "director" || rol === "admin") {
        query = query.in("estado", ["enviada_revision", "aprobada", "observada"]);
        if (escuelaId) {
          query = query.eq("escuela_id", escuelaId);
        }
      } else {
        query = query.eq("docente_id", userId);
      }

      const { data, error } = await query.order("actualizado_en", { ascending: false });
      if (!error && data) {
        planes = data;
      }
    } catch (e) {
      console.warn("Error consultando planificaciones en Supabase:", e.message);
    }
  }

  // 2. Fallback / Enriquecimiento con planes del almacenamiento local y revisiones
  const localesSupervision = leerPlanesLocalesSupervision();
  const misPlanesLocales = obtenerTodasLasPlanificaciones(userId);
  const revsLocales = leerRevisionesLocales();

  // Mezclar evitando duplicados y vinculando la última revisión pedagógica
  const mapa = new Map();
  planes.forEach((p) => {
    const revs = revsLocales[p.id] || [];
    mapa.set(p.id, {
      ...p,
      ultimaRevision: p.ultimaRevision || revs[0] || null
    });
  });

  localesSupervision.forEach((p) => {
    const revs = revsLocales[p.id] || [];
    if (!mapa.has(p.id)) {
      mapa.set(p.id, {
        ...p,
        ultimaRevision: p.ultimaRevision || revs[0] || null
      });
    } else {
      const exist = mapa.get(p.id);
      if (!exist.ultimaRevision && (p.ultimaRevision || revs[0])) {
        exist.ultimaRevision = p.ultimaRevision || revs[0];
      }
    }
  });

  // Si no hay planes en la nube ni de supervisión, mostrar los locales del docente para facilitar pruebas
  if (mapa.size === 0 && misPlanesLocales.length > 0) {
    misPlanesLocales.forEach((p) => {
      const revs = revsLocales[p.id] || [];
      mapa.set(p.id, {
        ...p,
        docente_id: userId || "docente_local",
        estado: p.estado || "borrador",
        ultimaRevision: p.ultimaRevision || revs[0] || null
      });
    });
  }

  return Array.from(mapa.values());
}

/**
 * Guarda el dictamen pedagógico emitido por el coordinador.
 */
export async function guardarRevisionPedagogica({
  supabaseClient,
  planificacionId,
  coordinadorId,
  coordinadorNombre = "Coordinador Pedagógico",
  estadoRevision = "aprobada", // 'aprobada' | 'requiere_ajustes' | 'sugerencias'
  comentariosGenerales = "",
  bloquesObservados = {} // { secuencia_didactica: "...", dua: "..." }
}) {
  if (!planificacionId) throw new Error("ID de planificación requerido.");

  // Mapear estado_revision a nuevo estado de la planificacion
  const nuevoEstadoPlan = estadoRevision === "aprobada" ? "aprobada" : "observada";

  const revisionObj = {
    id: "rev_" + Date.now(),
    planificacion_id: planificacionId,
    coordinador_id: coordinadorId || "coordinador_local",
    coordinadorNombre,
    estado_revision: estadoRevision,
    comentarios_generales: comentariosGenerales,
    bloques_observados: bloquesObservados,
    fecha_revision: new Date().toISOString()
  };

  // 1. Guardar revisión en almacenamiento local
  const revsLocales = leerRevisionesLocales();
  if (!revsLocales[planificacionId]) {
    revsLocales[planificacionId] = [];
  }
  revsLocales[planificacionId].unshift(revisionObj);
  guardarRevisionesLocales(revsLocales);

  // 2. Actualizar el estado del plan en el pool de coordinación local
  const locales = leerPlanesLocalesSupervision();
  const idx = locales.findIndex((p) => p.id === planificacionId);
  if (idx !== -1) {
    locales[idx].estado = nuevoEstadoPlan;
    locales[idx].ultimaRevision = revisionObj;
    guardarPlanesLocalesSupervision(locales);
  }

  // 3. Persistir en Supabase si hay cliente activo
  if (supabaseClient && coordinadorId) {
    try {
      // a) Insertar en revisiones_coordinador
      await supabaseClient.from("revisiones_coordinador").insert({
        planificacion_id: planificacionId,
        coordinador_id: coordinadorId,
        estado_revision: estadoRevision,
        comentarios_generales: comentariosGenerales,
        bloques_observados: bloquesObservados
      });

      // b) Actualizar estado en planificaciones
      await supabaseClient
        .from("planificaciones")
        .update({
          estado: nuevoEstadoPlan,
          actualizado_en: new Date().toISOString()
        })
        .eq("id", planificacionId);
    } catch (e) {
      console.warn("Aviso en guardado de revisión en Supabase:", e.message);
    }
  }

  return { revision: revisionObj, nuevoEstadoPlan };
}

/**
 * Obtiene el historial de revisiones de una planificación.
 */
export async function obtenerRevisionesPlan({ supabaseClient, planificacionId }) {
  if (!planificacionId) return [];

  let revisiones = [];

  // 1. Consultar Supabase
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from("revisiones_coordinador")
        .select("*")
        .eq("planificacion_id", planificacionId)
        .order("fecha_revision", { ascending: false });

      if (!error && data) {
        revisiones = data;
      }
    } catch (e) {}
  }

  // 2. Combinar con revisiones locales
  const revsLocales = leerRevisionesLocales();
  const localesDelPlan = revsLocales[planificacionId] || [];

  const mapa = new Map();
  revisiones.forEach((r) => mapa.set(r.id, r));
  localesDelPlan.forEach((r) => {
    if (!mapa.has(r.id)) mapa.set(r.id, r);
  });

  return Array.from(mapa.values()).sort(
    (a, b) => new Date(b.fecha_revision) - new Date(a.fecha_revision)
  );
}
