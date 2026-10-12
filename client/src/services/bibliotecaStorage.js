/**
 * client/src/services/bibliotecaStorage.js
 * Servicio de Almacenamiento Local para "Mis Planificaciones" aislado por usuario.
 * 
 * Reglas estrictas:
 * 1. SIN MODO INVITADO PARA DATOS PERSONALES: Si no hay usuario autenticado,
 *    retorna lista vacía y no guarda datos.
 * 2. Cada docente tiene su propia clave aislada: pm_biblioteca_${userId}.
 */
import { obtenerDocenteId } from "./perfilStorage.js";

function getStorageKey(userId) {
  const uid = userId || obtenerDocenteId();
  if (!uid) return null;
  return `pm_biblioteca_${uid}`;
}

export function obtenerTodasLasPlanificaciones(userId) {
  const key = getStorageKey(userId);
  if (!key) return [];

  try {
    const data = localStorage.getItem(key);
    if (!data) return [];
    const lista = JSON.parse(data);
    return lista.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  } catch (err) {
    console.error("Error leyendo biblioteca de planificaciones:", err);
    return [];
  }
}

export function guardarPlanEnBiblioteca({
  id,
  titulo,
  area,
  grado,
  nivel,
  periodo,
  esquemaLabel,
  datosPlanificacion
}, userId) {
  const key = getStorageKey(userId);
  if (!key) {
    console.warn("No se puede guardar planificación en biblioteca sin sesión de usuario.");
    return null;
  }

  try {
    const lista = obtenerTodasLasPlanificaciones(userId);
    const planId = id || "plan_" + Date.now();
    const existingIndex = lista.findIndex((p) => p.id === planId);

    const registro = {
      id: planId,
      titulo: titulo || "Planificación Sin Título",
      area: area || "General",
      grado: grado || "Grado no especificado",
      nivel: nivel || "primario",
      periodo: periodo || "diaria",
      esquemaLabel: esquemaLabel || "Tradicional",
      estado: (existingIndex !== -1 && lista[existingIndex].estado) || "borrador",
      fecha: new Date().toISOString(),
      datosPlanificacion: datosPlanificacion || {}
    };

    if (existingIndex !== -1) {
      lista[existingIndex] = { ...lista[existingIndex], ...registro, fecha: new Date().toISOString() };
    } else {
      lista.unshift(registro);
    }

    localStorage.setItem(key, JSON.stringify(lista));
    return registro;
  } catch (err) {
    console.error("Error guardando en biblioteca:", err);
    return null;
  }
}

export function actualizarEstadoPlanEnBiblioteca(id, nuevoEstado, revision, userId) {
  const key = getStorageKey(userId);
  if (!key) return null;

  try {
    const lista = obtenerTodasLasPlanificaciones(userId);
    const idx = lista.findIndex((p) => p.id === id);
    if (idx === -1) return null;

    lista[idx].estado = nuevoEstado;
    if (revision) {
      lista[idx].ultimaRevision = revision;
      if (!lista[idx].revisiones) lista[idx].revisiones = [];
      lista[idx].revisiones.unshift(revision);
    }
    lista[idx].actualizado_en = new Date().toISOString();

    localStorage.setItem(key, JSON.stringify(lista));
    return lista[idx];
  } catch (err) {
    console.error("Error actualizando estado del plan en biblioteca:", err);
    return null;
  }
}

export function duplicarPlanEnBiblioteca(id, userId) {
  const key = getStorageKey(userId);
  if (!key) return null;

  try {
    const lista = obtenerTodasLasPlanificaciones(userId);
    const original = lista.find((p) => p.id === id);
    if (!original) return null;

    const copia = {
      ...original,
      id: "plan_" + Date.now() + "_copia",
      titulo: `Copia de ${original.titulo}`,
      fecha: new Date().toISOString(),
      datosPlanificacion: JSON.parse(JSON.stringify(original.datosPlanificacion))
    };

    lista.unshift(copia);
    localStorage.setItem(key, JSON.stringify(lista));
    return copia;
  } catch (err) {
    console.error("Error duplicando planificación:", err);
    return null;
  }
}

export function eliminarPlanDeBiblioteca(id, userId, supabaseClient) {
  const key = getStorageKey(userId);
  if (!key) return false;

  try {
    const lista = obtenerTodasLasPlanificaciones(userId);
    const nuevaLista = lista.filter((p) => p.id !== id);
    localStorage.setItem(key, JSON.stringify(nuevaLista));

    if (supabaseClient && userId) {
      supabaseClient
        .from("planes_guardados")
        .delete()
        .eq("id", id)
        .eq("user_id", userId)
        .then(() => {})
        .catch((err) => console.warn("Aviso eliminando de Supabase:", err.message));
    }

    return true;
  } catch (err) {
    console.error("Error eliminando de biblioteca:", err);
    return false;
  }
}

/**
 * Sincroniza la biblioteca de planes local con Supabase planes_guardados (con RLS).
 */
export async function sincronizarBibliotecaConNube({ supabaseClient, userId }) {
  if (!supabaseClient || !userId) return obtenerTodasLasPlanificaciones(userId);

  try {
    const planesLocales = obtenerTodasLasPlanificaciones(userId);

    // 1. Consultar planes en Supabase
    const { data: planesNube, error } = await supabaseClient
      .from("planes_guardados")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Aviso al consultar planes en Supabase:", error.message);
      return planesLocales;
    }

    // 2. Mapear y fusionar por ID
    const mapaPlanes = new Map();

    // Cargar planes de la nube primero
    if (Array.isArray(planesNube)) {
      for (const pn of planesNube) {
        mapaPlanes.set(pn.id, {
          id: pn.id,
          titulo: pn.titulo,
          area: pn.area || "General",
          grado: pn.grado || "Grado no especificado",
          nivel: pn.nivel || "primario",
          periodo: pn.periodo || "diaria",
          esquemaLabel: pn.esquema_label || "Tradicional",
          fecha: pn.created_at || new Date().toISOString(),
          datosPlanificacion: pn.datos_planificacion || {}
        });
      }
    }

    // Fusionar o subir planes locales que falten en la nube
    for (const pl of planesLocales) {
      if (!mapaPlanes.has(pl.id)) {
        mapaPlanes.set(pl.id, pl);
        // Subir a Supabase en background
        supabaseClient
          .from("planes_guardados")
          .upsert({
            id: pl.id,
            user_id: userId,
            titulo: pl.titulo || "Planificación",
            nivel: pl.nivel || "primario",
            periodo: pl.periodo || "diaria",
            area: pl.area || "General",
            grado: pl.grado || "General",
            esquema_label: pl.esquemaLabel || "Tradicional",
            datos_planificacion: pl.datosPlanificacion || {},
            created_at: pl.fecha || new Date().toISOString()
          })
          .then(() => {})
          .catch((e) => console.warn("Aviso al subir plan local a Supabase:", e.message));
      }
    }

    const listaFinal = Array.from(mapaPlanes.values()).sort(
      (a, b) => new Date(b.fecha) - new Date(a.fecha)
    );

    const key = getStorageKey(userId);
    if (key) {
      localStorage.setItem(key, JSON.stringify(listaFinal));
    }

    return listaFinal;
  } catch (err) {
    console.warn("Aviso en sincronización de biblioteca con la nube:", err.message);
    return obtenerTodasLasPlanificaciones(userId);
  }
}

/**
 * Limpia la biblioteca local de un docente específico.
 */
export function limpiarBibliotecaUsuario(userId) {
  if (!userId) return;
  try {
    localStorage.removeItem(`pm_biblioteca_${userId}`);
  } catch (e) {}
}

/**
 * FASE 12: Sincroniza las planificaciones locales del docente hacia la tabla multiusuario institucional 'planificaciones'.
 * @param {object} options
 * @param {object} options.supabaseClient - Cliente Supabase autenticado
 * @param {string} options.userId - ID del docente autenticado
 * @param {string} options.escuelaId - ID de la escuela del docente
 */
export async function sincronizarPlanificacionesInstitucionales({ supabaseClient, userId, escuelaId }) {
  if (!supabaseClient || !userId || !escuelaId) return { total: 0, sincronizados: 0 };
  const locales = obtenerTodasLasPlanificaciones(userId);
  if (!locales.length) return { total: 0, sincronizados: 0 };

  let sincronizados = 0;
  for (const pl of locales) {
    try {
      const { error } = await supabaseClient
        .from("planificaciones")
        .upsert({
          id: pl.id,
          escuela_id: escuelaId,
          docente_id: userId,
          titulo: pl.titulo || "Planificación Docente",
          nivel: pl.nivel || "primario",
          grado: pl.grado || "General",
          area: pl.area || "General",
          periodo: pl.periodo || "diaria",
          esquema_id: pl.esquema_id || pl.esquemaLabel || "primario",
          datos_planificacion: pl.datosPlanificacion || {},
          ajustes_manuales: pl.ajustesManuales || {},
          estado: pl.estado || "borrador",
          creado_en: pl.fecha || new Date().toISOString(),
          actualizado_en: new Date().toISOString()
        });
      if (!error) sincronizados++;
    } catch (e) {
      console.warn("Aviso en sincronización institucional de plan:", pl.id, e.message);
    }
  }

  return { total: locales.length, sincronizados };
}
