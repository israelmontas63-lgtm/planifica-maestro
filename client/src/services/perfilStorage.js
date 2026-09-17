/**
 * perfilStorage.js
 * Gestión de persistencia del perfil docente e identificación en localStorage.
 * Extraído para evitar importar componentes UI de React dentro de servicios API.
 */
import { obtenerUsuarioIdActual } from "../hooks/useAuth.js";

const PERFIL_KEY = "planifica_maestro_perfil";

export function cargarPerfil() {
  try {
    const saved = localStorage.getItem(PERFIL_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migración Fase 14 / Supabase: Si hay usuario autenticado, su ID prevalece
      const authId = obtenerUsuarioIdActual();
      if (authId) {
        parsed.docenteId = authId;
      } else {
        // Modo invitado: asegurar un ID anónimo independiente
        if (!parsed.anonDocenteId) {
          parsed.anonDocenteId = (parsed.docenteId && parsed.docenteId.startsWith("docente_"))
            ? parsed.docenteId
            : ("docente_" + Math.random().toString(36).substring(2, 10));
        }
        parsed.docenteId = parsed.anonDocenteId;
      }
      return parsed;
    }
  } catch (e) { /* ignore */ }

  const authId = obtenerUsuarioIdActual();
  const anonId = "docente_" + Math.random().toString(36).substring(2, 10);
  const defaultPerfil = {
    docenteId: authId || anonId,
    anonDocenteId: anonId,
    nombre: "",
    escuela: "",
    fecha: new Date().toISOString().split("T")[0]
  };
  try {
    localStorage.setItem(PERFIL_KEY, JSON.stringify(defaultPerfil));
  } catch (e) {}
  return defaultPerfil;
}

export function guardarPerfil(perfil) {
  const authId = obtenerUsuarioIdActual();
  if (authId) {
    perfil.docenteId = authId;
  } else {
    if (!perfil.anonDocenteId) {
      perfil.anonDocenteId = (perfil.docenteId && perfil.docenteId.startsWith("docente_"))
        ? perfil.docenteId
        : ("docente_" + Math.random().toString(36).substring(2, 10));
    }
    perfil.docenteId = perfil.anonDocenteId;
  }
  localStorage.setItem(PERFIL_KEY, JSON.stringify(perfil));
}

export function obtenerDocenteId() {
  const authId = obtenerUsuarioIdActual();
  if (authId) return authId;
  return cargarPerfil().docenteId;
}

export function obtenerPerfil() {
  const perfil = cargarPerfil();
  if (!perfil.fechaManual) {
    perfil.fecha = new Date().toISOString().split("T")[0];
  }
  return perfil;
}
