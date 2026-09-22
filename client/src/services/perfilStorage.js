/**
 * client/src/services/perfilStorage.js
 * Gestión de persistencia del perfil docente en localStorage por usuario.
 * 
 * Reglas estrictas:
 * 1. SIN MODO INVITADO PARA DATOS PERSONALES: Prohibido guardar datos personales
 *    en claves compartidas o para usuarios no autenticados.
 * 2. Cada docente tiene su propia clave aislada: pm_perfil_${userId}.
 * 3. Al cerrar sesión o cambiar de usuario, se borran todos los datos locales del usuario anterior.
 */
import { obtenerUsuarioIdActual } from "../hooks/useAuth.js";

function getPerfilKey(userId) {
  if (!userId) return null;
  return `pm_perfil_${userId}`;
}

export function cargarPerfil(userIdOverride) {
  const userId = userIdOverride || obtenerUsuarioIdActual();
  if (!userId) {
    // Sin sesión activa, no hay perfil guardado
    return null;
  }

  const key = getPerfilKey(userId);
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn("Error leyendo perfil de localStorage:", e);
  }

  const defaultPerfil = {
    docenteId: userId,
    nombre: "",
    escuela: "",
    tanda: "",
    grado: "",
    materias: [],
    fecha: new Date().toISOString().split("T")[0]
  };

  try {
    localStorage.setItem(key, JSON.stringify(defaultPerfil));
  } catch (e) {}

  return defaultPerfil;
}

export function guardarPerfil(perfil, userIdOverride) {
  const userId = userIdOverride || obtenerUsuarioIdActual();
  if (!userId) {
    console.warn("No se puede guardar perfil sin un usuario autenticado.");
    return;
  }

  const key = getPerfilKey(userId);
  const dataToSave = {
    ...perfil,
    docenteId: userId,
  };

  try {
    localStorage.setItem(key, JSON.stringify(dataToSave));
  } catch (e) {
    console.error("Error guardando perfil:", e);
  }
}

export function obtenerDocenteId() {
  return obtenerUsuarioIdActual() || null;
}

export function obtenerPerfil(userIdOverride) {
  const perfil = cargarPerfil(userIdOverride);
  if (!perfil) return null;
  if (!perfil.fechaManual) {
    perfil.fecha = new Date().toISOString().split("T")[0];
  }
  return perfil;
}

/**
 * Limpia todos los datos almacenados localmente para un usuario específico.
 * Se ejecuta al cerrar sesión o cambiar de usuario.
 * @param {string} userId - ID del usuario a limpiar.
 */
export function limpiarDatosUsuario(userId) {
  if (!userId) return;

  const prefijos = [
    `pm_perfil_${userId}`,
    `pm_biblioteca_${userId}`,
    `pm_hablar_respuestas_${userId}`,
    `pm_horario_${userId}`,
    `pm_actividades_${userId}`,
    `pm_notas_${userId}`,
    `pm_recordatorios_${userId}`,
  ];

  for (const key of prefijos) {
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  }

  // Limpiar claves legadas compartidas para evitar filtraciones
  try {
    localStorage.removeItem("planifica_maestro_perfil");
    localStorage.removeItem("pm_biblioteca_planificaciones");
  } catch (e) {}
}
