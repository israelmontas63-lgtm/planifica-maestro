// worker/services/planificadorProactivo.js
// Gestión de tareas periódicas autorizadas con zona horaria America/Santo_Domingo (UTC-4)
// y control idempotente de ejecuciones. No permite auto-modificar código ni políticas.

import { ZONA_HORARIA } from "../../shared/resolvedorFechas.mjs";

export const ZONA_HORARIA_DEFAULT = ZONA_HORARIA; // UTC-4 permanente (sin DST)

export function santoDomingoAUtcIso(fechaLocalIsoSinOffset) {
  // Convierte "YYYY-MM-DDTHH:mm:ss" en America/Santo_Domingo (UTC-4) a ISO UTC.
  const limpia = String(fechaLocalIsoSinOffset || "").trim();
  const base = limpia.endsWith("Z") ? limpia : `${limpia}-04:00`;
  const d = new Date(base);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Fecha local inválida: ${fechaLocalIsoSinOffset}`);
  }
  return d.toISOString();
}

export function crearGestorTareasProactivas() {
  const tareas = new Map();
  const ejecucionesIdempotentes = new Set();

  function programarTarea({
    id,
    propietario,
    descripcion,
    frecuencia,
    zonaHoraria = ZONA_HORARIA_DEFAULT,
    permisos = [],
    proximaEjecucionLocal,
    politicaCancelacion = "cancelable_por_propietario",
    autorizadaPorPropietario = false,
  }) {
    if (!autorizadaPorPropietario) {
      return { ok: false, codigo: "REQUIERE_AUTORIZACION_PROPIETARIO" };
    }
    if (!propietario || !descripcion || !frecuencia) {
      return { ok: false, codigo: "DATOS_TAREA_INCOMPLETOS" };
    }

    const tareaId = id || `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const proximaEjecucionUtc = proximaEjecucionLocal
      ? santoDomingoAUtcIso(proximaEjecucionLocal)
      : new Date().toISOString();

    const tarea = {
      id: tareaId,
      propietario,
      descripcion,
      frecuencia,
      zonaHoraria,
      estado: "PROGRAMADA",
      permisos: Array.isArray(permisos) ? permisos : [],
      proximaEjecucionUtc,
      politicaCancelacion,
      registroResultados: [],
    };
    tareas.set(tareaId, tarea);
    return { ok: true, tarea };
  }

  async function ejecutarSiCorresponde(tareaId, claveIdempotencia, ejecutorFn) {
    const tarea = tareas.get(tareaId);
    if (!tarea) return { ok: false, codigo: "TAREA_NO_ENCONTRADA" };
    if (tarea.estado === "CANCELADA") return { ok: false, codigo: "TAREA_CANCELADA" };
    if (!claveIdempotencia) return { ok: false, codigo: "FALTA_CLAVE_IDEMPOTENCIA" };

    if (ejecucionesIdempotentes.has(claveIdempotencia)) {
      return { ok: true, duplicada: true, mensaje: "Ejecución omitida por idempotencia." };
    }
    ejecucionesIdempotentes.add(claveIdempotencia);

    try {
      const resultado = await ejecutorFn(tarea);
      tarea.registroResultados.push({
        claveIdempotencia,
        timestamp: new Date().toISOString(),
        ok: Boolean(resultado?.ok !== false),
        resumen: resultado?.resumen || "Ejecutada",
      });
      return { ok: true, duplicada: false, resultado };
    } catch (err) {
      tarea.registroResultados.push({
        claveIdempotencia,
        timestamp: new Date().toISOString(),
        ok: false,
        resumen: String(err?.message || err).slice(0, 160),
      });
      return { ok: false, codigo: "ERROR_EJECUCION_TAREA", mensaje: String(err?.message || err) };
    }
  }

  function cancelarTarea(tareaId, solicitante) {
    const tarea = tareas.get(tareaId);
    if (!tarea) return { ok: false, codigo: "TAREA_NO_ENCONTRADA" };
    if (tarea.propietario !== solicitante) return { ok: false, codigo: "NO_AUTORIZADO" };
    tarea.estado = "CANCELADA";
    return { ok: true, estado: tarea.estado };
  }

  return { programarTarea, ejecutarSiCorresponde, cancelarTarea, obtener: (id) => tareas.get(id) || null };
}
