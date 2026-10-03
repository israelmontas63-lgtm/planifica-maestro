import { describe, it } from "node:test";
import assert from "node:assert";

describe("PWA Dual-Build Simulation: Actualización Automática entre Versiones Consecutivas", () => {
  it("Simula Build 1 -> Deploy Build 2: el cliente detecta SW2, asume control y recarga exactamente 1 vez", async () => {
    // 1. Simulación de estado inicial del navegador en Build 1
    let reloadsCount = 0;
    const sessionStore = {};
    let draftSavedCount = 0;
    let updateBannerShown = false;

    // Al cargar la app en Build 1, el controlador SW1 ya está activo
    const clientState = {
      controller: { version: "v2026.10.02-build1", state: "activated" },
      sessionStorage: {
        getItem: (k) => sessionStore[k] || null,
        setItem: (k, v) => { sessionStore[k] = String(v); }
      },
      reload: () => {
        const last = parseInt(sessionStore["pm_sw_last_reload"] || "0", 10);
        const now = Date.now();
        if (now - last < 6000) {
          throw new Error("BUCLE_INFINITO_DETECTADO");
        }
        sessionStore["pm_sw_last_reload"] = String(now);
        reloadsCount++;
      }
    };

    // 2. Simulación de deploy de Build 2 en el servidor
    const build2 = {
      version: "v2026.10.02-build2",
      swUrl: "/sw.js?v=build2",
      skipWaiting: true,
      clientsClaim: true
    };

    // 3. El nuevo Service Worker SW2 se instala y activa
    // En install: self.skipWaiting()
    // En activate: clients.claim()
    const sw2 = { version: build2.version, state: "activated" };

    // 4. Simulador del listener controllerchange del cliente
    const handleControllerChange = ({ isBusy = false } = {}) => {
      const hadPreviousController = Boolean(clientState.controller);
      if (!hadPreviousController) {
        return "FIRST_INSTALL_IGNORED";
      }

      // Si está ocupado
      if (isBusy) {
        draftSavedCount++;
        updateBannerShown = true;
        return "UPDATE_POSTPONED_BANNER_SHOWN";
      }

      // Si está inactivo, guarda borrador y recarga seguro
      draftSavedCount++;
      clientState.reload();
      clientState.controller = sw2; // Actualiza al nuevo controlador
      return "RELOAD_SUCCESS";
    };

    // Caso 1: Actualización con usuario inactivo (flujo estándar)
    const resultIdle = handleControllerChange({ isBusy: false });
    assert.strictEqual(resultIdle, "RELOAD_SUCCESS", "Debe recargar limpiamente");
    assert.strictEqual(reloadsCount, 1, "Debe haber recargado exactamente una vez");
    assert.strictEqual(draftSavedCount, 1, "Debe haber asegurado el borrador");
    assert.strictEqual(clientState.controller.version, "v2026.10.02-build2", "El cliente ahora corre Build 2");

    // Caso 2: Intento inmediato duplicado (protección contra bucle)
    assert.throws(() => {
      clientState.reload();
    }, /BUCLE_INFINITO_DETECTADO/, "Debe bloquear cualquier recarga duplicada en menos de 6 segundos");

    // Caso 3: Actualización mientras el usuario está generando un plan (isBusy: true)
    // El usuario está redactando / generando con IA
    reloadsCount = 1;
    draftSavedCount = 1;
    const resultBusy = handleControllerChange({ isBusy: true });
    assert.strictEqual(resultBusy, "UPDATE_POSTPONED_BANNER_SHOWN", "No debe interrumpir la generación");
    assert.strictEqual(updateBannerShown, true, "Debe alertar con banner discreto");
    assert.strictEqual(draftSavedCount, 2, "Debe salvar el borrador de emergencia");
    assert.strictEqual(reloadsCount, 1, "No debe forzar recarga mientras está ocupado");
  });
});
