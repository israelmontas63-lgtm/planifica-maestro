/**
 * Servicio de Sincronización Offline (Fase 13)
 * Administra la cola de cambios locales pendientes y sincroniza automáticamente
 * con el backend cuando se restablece la conexión a internet.
 */

import { guardarAjustesPlan } from "./api.js";

const SYNC_QUEUE_KEY = "pm_offline_sync_queue";

export function obtenerColaSincronizacion() {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Error leyendo cola de sincronización:", err);
    return [];
  }
}

export function guardarColaSincronizacion(cola) {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(cola));
  } catch (err) {
    console.error("Error guardando cola de sincronización:", err);
  }
}

/**
 * Encola un ajuste manual para sincronizarlo cuando haya conexión
 */
export function encolarAjusteOffline(planId, datosAjustados) {
  const cola = obtenerColaSincronizacion();
  const existingIndex = cola.findIndex((item) => item.planId === planId);

  const item = {
    planId,
    datosAjustados,
    fecha: new Date().toISOString()
  };

  if (existingIndex !== -1) {
    cola[existingIndex] = item;
  } else {
    cola.push(item);
  }

  guardarColaSincronizacion(cola);
}

/**
 * Intenta guardar el ajuste en el backend si hay conexión,
 * o lo encola automáticamente si estamos offline.
 */
export async function registrarAjusteConRespaldoOffline({ planId, datosAjustados }) {
  if (!planId || !datosAjustados) return;

  if (!navigator.onLine) {
    encolarAjusteOffline(planId, datosAjustados);
    return { offline: true, encolado: true };
  }

  try {
    const res = await guardarAjustesPlan({ planId, datosAjustados });
    return { offline: false, sincronizado: true, res };
  } catch (err) {
    // Si la llamada falló por pérdida repentina de red
    console.warn("Fallo de red al enviar ajuste, encolando para sincronización:", err.message);
    encolarAjusteOffline(planId, datosAjustados);
    return { offline: true, encolado: true };
  }
}

/**
 * Procesa la cola de sincronización pendiente cuando vuelve la conexión
 */
export async function sincronizarAjustesPendientes(onNotificacion) {
  if (!navigator.onLine) return;

  const cola = obtenerColaSincronizacion();
  if (!cola.length) return;

  const pendientes = [...cola];
  const exitosos = [];

  for (const item of pendientes) {
    try {
      await guardarAjustesPlan({
        planId: item.planId,
        datosAjustados: item.datosAjustados
      });
      exitosos.push(item.planId);
    } catch (err) {
      console.warn("Error reintentando sincronización de plan:", item.planId, err.message);
      // Mantener en cola si persiste error de red
      break;
    }
  }

  // Filtrar los exitosos de la cola
  if (exitosos.length > 0) {
    const nuevaCola = cola.filter((item) => !exitosos.includes(item.planId));
    guardarColaSincronizacion(nuevaCola);
    if (onNotificacion) {
      onNotificacion({
        totalSincronizados: exitosos.length,
        restantes: nuevaCola.length
      });
    }
  }
}
