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

export function eliminarPlanDeBiblioteca(id, userId) {
  const key = getStorageKey(userId);
  if (!key) return false;

  try {
    const lista = obtenerTodasLasPlanificaciones(userId);
    const nuevaLista = lista.filter((p) => p.id !== id);
    localStorage.setItem(key, JSON.stringify(nuevaLista));
    return true;
  } catch (err) {
    console.error("Error eliminando de biblioteca:", err);
    return false;
  }
}
