/**
 * client/src/services/pwaManager.js
 * 
 * Gestor del Ciclo de Vida del Service Worker y Estrategia de Actualización PWA.
 * 
 * Basado en vite-plugin-pwa (virtual:pwa-register):
 * 1. registerSW con immediate: true y updateViaCache: 'none'.
 * 2. Verificación de actualización en 4 momentos clave:
 *    - Al abrir la app (inmediato, sin throttling que lo impida).
 *    - Al volver a primer plano (evento visibilitychange).
 *    - Al recuperar foco de ventana o conexión (focus, online).
 *    - Cada 15 minutos en segundo plano (registration.update()).
 * 3. onNeedRefresh detecta la nueva versión y recarga automáticamente con updateSW(true),
 *    SIN pedir confirmación al usuario.
 * 4. Protección contra bucles de recarga infinitos mediante sessionStorage.
 * 5. Protección de trabajo docente: guarda borrador de seguridad en localStorage antes de recargar.
 */

import { registerSW } from "virtual:pwa-register";

let isReloading = false;
let updateSWFn = null;
let currentRegistration = null;

/**
 * Recarga la aplicación protegiendo contra bucles infinitos en sessionStorage
 */
export function safeReload() {
  if (isReloading) return;
  isReloading = true;

  try {
    const lastReload = parseInt(sessionStorage.getItem("pm_sw_last_reload") || "0", 10);
    const now = Date.now();
    if (now - lastReload < 8000) {
      console.warn("[PWA] Recarga pospuesta para evitar bucle continuo.");
      isReloading = false;
      return;
    }
    sessionStorage.setItem("pm_sw_last_reload", String(now));
  } catch (e) {}

  window.location.reload();
}

/**
 * Inicializa la PWA y coordina la actualización automática en segundo plano
 * @param {Object} options
 * @param {Function} [options.isBusy] - Retorna true si hay generación, dictado o escaneo activo
 * @param {Function} [options.saveDraft] - Guarda en localStorage el borrador actual antes de recargar
 * @param {Function} [options.onUpdatePending] - Callback si la actualización debe esperar a que termine el trabajo
 */
export async function initPWA({ isBusy, saveDraft, onUpdatePending } = {}) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  // Capturar errores de carga dinámica de chunks (vite:preloadError) tras un nuevo despliegue
  window.addEventListener("unhandledrejection", (e) => {
    if (e.reason && e.reason.message && e.reason.message.includes("Failed to fetch dynamically imported module")) {
      e.preventDefault();
      console.warn("[PWA] Mdulo dinmico no encontrado. Limpiando cach...");
      if (saveDraft) saveDraft();
      if (navigator.serviceWorker) {
         navigator.serviceWorker.getRegistrations().then(regs => {
           for(let r of regs) r.unregister();
           safeReload();
         });
      } else {
         safeReload();
      }
    }
  });
  window.addEventListener("vite:preloadError", () => {
    console.warn("[PWA] Error de carga en bundle dinámico (chunk obsoleto). Aplicando recarga limpia...");
    if (saveDraft) saveDraft();
    safeReload();
  });

  const aplicarActualizacionSegura = (customReloadTrigger) => {
    // Si el docente está dictando, generando o escaneando foto, posponer recarga y avisar discretamente
    if (isBusy && isBusy()) {
      console.warn("[PWA] Docente en actividad. Pospone recarga automática y guarda borrador.");
      if (saveDraft) saveDraft();
      if (onUpdatePending) {
        onUpdatePending(customReloadTrigger || safeReload);
      }
      return;
    }

    // Si la app está inactiva, guardar borrador de seguridad y recargar de inmediato
    if (saveDraft) saveDraft();
    if (customReloadTrigger) {
      customReloadTrigger();
    } else {
      safeReload();
    }
  };

  try {
    updateSWFn = registerSW({
      immediate: true,
      onNeedRefresh() {
        console.log("[PWA] 🔄 Nueva versión detectada en Cloudflare (onNeedRefresh). Aplicando actualización...");
        aplicarActualizacionSegura(() => {
          if (typeof updateSWFn === "function") {
            updateSWFn(true);
          } else {
            safeReload();
          }
        });
      },
      onOfflineReady() {
        console.log("[PWA] ✓ PWA lista para operar sin conexión (Service Worker activo).");
      },
      onRegisteredSW(swUrl, registration) {
        currentRegistration = registration;
        console.log("[PWA] Service Worker registrado exitosamente vía virtual:pwa-register:", swUrl);

        if (registration) {
          // 1. Verificación inmediata al abrir la app (sin throttling que la bloquee)
          checkVersionAndUpdate(registration);

          // 2. Verificación al volver a primer plano (visibilitychange)
          document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") {
              checkVersionAndUpdate(registration);
            }
          });

          // 3. Verificación al recuperar el foco de la ventana o conectividad
          window.addEventListener("focus", () => {
            checkVersionAndUpdate(registration);
          });
          window.addEventListener("online", () => {
            checkVersionAndUpdate(registration);
          });

          // 4. Verificación periódica cada 15 minutos mientras la app esté abierta
          setInterval(() => {
            checkVersionAndUpdate(registration);
          }, 15 * 60 * 1000);
        }
      },
      onRegisterError(error) {
        console.warn("[PWA] Error en registro de Service Worker:", error);
      }
    });

    // Escuchar controllerchange como garantía adicional cuando el nuevo SW toma control
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      console.log("[PWA] Nuevo Service Worker tomó control (controllerchange).");
      aplicarActualizacionSegura();
    });

    return {
      registration: currentRegistration,
      updateSW: updateSWFn,
      triggerUpdateNow: () => currentRegistration ? currentRegistration.update() : Promise.resolve(),
      reload: safeReload
    };
  } catch (err) {
    console.warn("[PWA] Fallo iniciando registro virtual:pwa-register:", err);
    return null;
  }
}
