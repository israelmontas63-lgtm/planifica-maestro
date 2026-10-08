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

export function obtenerDocenteId() {
  return obtenerUsuarioIdActual() || null;
}

export function cargarPerfil(userIdOverride) {
  const userId = userIdOverride || obtenerDocenteId();
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
  } catch (err) {
    console.error("Error cargando perfil:", err);
  }
  return null;
}

export function guardarPerfil(perfil, userIdOverride) {
  const userId = userIdOverride || obtenerDocenteId();
  if (!userId) {
    console.warn("No se puede guardar perfil sin un usuario autenticado.");
    return;
  }

  const key = getPerfilKey(userId);
  const dataToSave = {
    ...(perfil || {}),
    docenteId: userId,
  };

  try {
    localStorage.setItem(key, JSON.stringify(dataToSave));
  } catch (err) {
    console.error("Error guardando perfil:", err);
  }
}

export function obtenerPerfil(userIdOverride) {
  const perfil = cargarPerfil(userIdOverride);
  if (!perfil) return null;
  if (!perfil.fechaManual) {
    perfil.fecha = new Date().toISOString().split("T")[0];
  }
  if (!perfil.tanda) {
    perfil.tanda = "Jornada Escolar Extendida (JEE)";
  }
  if (!perfil.seccion) {
    perfil.seccion = "A";
  }
  return perfil;
}

/**
 * Sincroniza el perfil docente local con Supabase (tabla perfil_docente con RLS).
 * Si hay datos en la nube y no en local, los descarga; si hay datos en local, los sube.
 */
export async function sincronizarPerfilConNube({ supabaseClient, userId }) {
  if (!supabaseClient || !userId) return null;

  try {
    const perfilLocal = cargarPerfil(userId);

    // 1. Consultar perfil en Supabase
    const { data: perfilNube, error } = await supabaseClient
      .from("perfil_docente")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.warn("Aviso al consultar perfil en Supabase:", error.message);
    }

    if (perfilLocal) {
      // Subir o actualizar en la nube con RLS
      const payload = {
        user_id: userId,
        nombre: perfilLocal.nombreDocente || perfilLocal.nombre || "Docente",
        centro_educativo: perfilLocal.centroEducativo || "",
        tanda: perfilLocal.tanda || "",
        seccion: perfilLocal.seccion || "",
        regional: perfilLocal.regional || "",
        distrito: perfilLocal.distrito || "",
        grado: perfilLocal.grado || "",
        materias: Array.isArray(perfilLocal.materias) ? perfilLocal.materias : [],
        updated_at: new Date().toISOString()
      };
      await supabaseClient.from("perfil_docente").upsert(payload);
      return perfilLocal;
    } else if (perfilNube) {
      // Descargar de la nube al almacenamiento local aislado
      const restaurado = {
        docenteId: userId,
        nombreDocente: perfilNube.nombre,
        centroEducativo: perfilNube.centro_educativo,
        tanda: perfilNube.tanda,
        seccion: perfilNube.seccion,
        regional: perfilNube.regional,
        distrito: perfilNube.distrito,
        grado: perfilNube.grado,
        materias: perfilNube.materias || []
      };
      guardarPerfil(restaurado, userId);
      return restaurado;
    }
  } catch (err) {
    console.warn("Aviso en sincronización de perfil con la nube:", err.message);
  }
  return cargarPerfil(userId);
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
    `pm_modelo_ia_${userId}`
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
    localStorage.removeItem("pm_local_user");
  } catch (e) {}
}
