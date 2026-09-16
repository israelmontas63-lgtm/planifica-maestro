/**
 * Servicio de Almacenamiento Local para "Mis Planificaciones" (Fase 11)
 * Guarda, recupera, duplica y elimina planificaciones con persistencia offline.
 */

const STORAGE_KEY = "pm_biblioteca_planificaciones";

export function obtenerTodasLasPlanificaciones() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const lista = JSON.parse(data);
    // Ordenar más reciente primero
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
}) {
  try {
    const lista = obtenerTodasLasPlanificaciones();
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
      fecha: new Date().toISOString(),
      datosPlanificacion: datosPlanificacion || {}
    };

    if (existingIndex !== -1) {
      lista[existingIndex] = { ...lista[existingIndex], ...registro, fecha: new Date().toISOString() };
    } else {
      lista.unshift(registro);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
    return registro;
  } catch (err) {
    console.error("Error guardando en biblioteca:", err);
    return null;
  }
}

export function duplicarPlanEnBiblioteca(id) {
  try {
    const lista = obtenerTodasLasPlanificaciones();
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
    return copia;
  } catch (err) {
    console.error("Error duplicando planificación:", err);
    return null;
  }
}

export function eliminarPlanDeBiblioteca(id) {
  try {
    const lista = obtenerTodasLasPlanificaciones();
    const nuevaLista = lista.filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nuevaLista));
    return true;
  } catch (err) {
    console.error("Error eliminando de biblioteca:", err);
    return false;
  }
}
