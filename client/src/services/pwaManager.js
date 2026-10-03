/**
 * client/src/services/pwaManager.js
 * 
 * Gestor del Ciclo de Vida del Service Worker y Estrategia de Actualización PWA.
 * 
 * Diseñado según directrices de arquitectura frontend para PWA:
 * 1. updateViaCache: 'none' en registro nativo.
 * 2. Bypass de espera y toma de control inmediata (skipWaiting + clientsClaim).
 * 3. Detección controlada de controllerchange:
 *    - No recarga en la primera instalación.
 *    - Protección contra bucles infinitos con sessionStorage y flag en memoria.
 *    - No interrumpe trabajos en curso (generación, dictado, foto): pospone y guarda borrador.
 * 4. Captura de vite:preloadError para chunks obsoletos tras un nuevo deploy.
 * 5. Comprobación periódica throttled (10 min mínimo en visibilitychange/focus).
 */

const hadPreviousController = typeof navigator !== "undefined" && "serviceWorker" in navigator && Boolean(navigator.serviceWorker.controller);

let isReloading = false;

export function safeReload() {
  if (isReloading) return;
  isReloading = true;

  try {
    const lastReload = parseInt(sessionStorage.getItem("pm_sw_last_reload") || "0", 10);
    const now = Date.now();
    if (now - lastReload < 6000) {
      console.warn("[PWA] Recarga abortada para evitar bucle continuo.");
      return;
    }
    sessionStorage.setItem("pm_sw_last_reload", String(now));
  } catch (e) {}

  window.location.reload();
}

/**
 * Inicializa la PWA y coordina la actualización en segundo plano
 * @param {Object} options
 * @param {Function} [options.isBusy] - Retorna true si hay generación, dictado o escaneo activo
 * @param {Function} [options.saveDraft] - Guarda en localStorage el borrador actual antes de recargar
 * @param {Function} [options.onUpdatePending] - Callback si la actualización debe esperar a que termine el trabajo
 */
export async function initPWA({ isBusy, saveDraft, onUpdatePending } = {}) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  // Capturar errores de carga dinámica de chunks (vite:preloadError) tras un despliegue
  window.addEventListener("vite:preloadError", () => {
    console.warn("[PWA] Error de carga en bundle dinámico (chunk obsoleto). Aplicando recarga limpia...");
    if (saveDraft) saveDraft();
    safeReload();
  });

  // Escuchar controllerchange: un nuevo Service Worker tomó el control
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // Si es la PRIMERA instalación de la PWA, no se recarga
    if (!hadPreviousController) {
      console.log("[PWA] Primera instalación completada. Controlador activo.");
      return;
    }

    console.log("[PWA] Nuevo Service Worker en control. Preparando actualización...");

    // Si el maestro está generando una planificación, dictando o subiendo una foto
    if (isBusy && isBusy()) {
      console.warn("[PWA] Trabajo en curso. Notificando aviso discreto sin interrumpir.");
      if (saveDraft) saveDraft();
      if (onUpdatePending) {
        onUpdatePending(safeReload);
      }
      return;
    }

    // Si la app está inactiva, guardar borrador si hay texto y recargar de inmediato
    if (saveDraft) saveDraft();
    safeReload();
  });

  let registration = null;
  try {
    registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none" // Garantiza que el navegador consulte a la red byte a byte
    });
    console.log("[PWA] Service Worker registrado con updateViaCache: 'none'");
  } catch (err) {
    console.warn("[PWA] Error en registro de Service Worker:", err);
    return null;
  }

  // Comprobación de actualizaciones con estrangulamiento (mínimo 10 min entre peticiones)
  let lastCheck = Date.now();
  const THROTTLE_MS = 10 * 60 * 1000;

  const triggerUpdate = async () => {
    const now = Date.now();
    if (now - lastCheck < THROTTLE_MS) return;
    lastCheck = now;

    try {
      if (registration) {
        await registration.update();
      }
    } catch (e) {
      // Ignorar errores transitorios de red
    }
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      triggerUpdate();
    }
  });

  window.addEventListener("focus", triggerUpdate);
  window.addEventListener("online", triggerUpdate);

  // Verificación periódica cada 30 minutos mientras la app esté abierta
  setInterval(triggerUpdate, 30 * 60 * 1000);

  return {
    registration,
    triggerUpdateNow: () => {
      lastCheck = 0;
      return registration ? registration.update() : Promise.resolve();
    },
    reload: safeReload
  };
}
