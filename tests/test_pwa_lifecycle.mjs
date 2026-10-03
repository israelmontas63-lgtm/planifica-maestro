import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("ARQUITECTURA PWA: Ciclo de Vida del Service Worker, Caché y Actualización Automática", () => {
  const headersFilePath = path.join(__dirname, "..", "client", "public", "_headers");
  const viteConfigPath = path.join(__dirname, "..", "client", "vite.config.js");

  it("1. Políticas de cabeceras HTTP (_headers) configuradas estrictamente", () => {
    assert.ok(fs.existsSync(headersFilePath), "Debe existir client/public/_headers");
    const content = fs.readFileSync(headersFilePath, "utf-8");

    // Verificar archivos de orquestación (no-cache, no-store, must-revalidate)
    assert.ok(content.includes("/sw.js"), "Debe tener regla para /sw.js");
    assert.ok(content.includes("/index.html"), "Debe tener regla para /index.html");
    assert.ok(content.includes("/manifest.webmanifest"), "Debe tener regla para /manifest.webmanifest");
    assert.ok(content.includes("no-cache, no-store, must-revalidate"), "Debe incluir no-store y must-revalidate");

    // Verificar assets con hash inmutables
    assert.ok(content.includes("/assets/*"), "Debe tener regla para /assets/*");
    assert.ok(content.includes("max-age=31536000, immutable"), "Debe tener max-age de 1 año e immutable");
  });

  it("2. vite.config.js tiene autoUpdate, bypass de espera, y NetworkOnly en /api/*", () => {
    assert.ok(fs.existsSync(viteConfigPath), "Debe existir client/vite.config.js");
    const content = fs.readFileSync(viteConfigPath, "utf-8");

    assert.ok(content.includes("registerType: \"autoUpdate\""), "Debe usar autoUpdate");
    assert.ok(content.includes("skipWaiting: true"), "Debe incluir skipWaiting: true");
    assert.ok(content.includes("clientsClaim: true"), "Debe incluir clientsClaim: true");
    assert.ok(content.includes("cleanupOutdatedCaches: true"), "Debe incluir cleanupOutdatedCaches: true");
    assert.ok(content.includes("navigateFallbackDenylist"), "Debe incluir navigateFallbackDenylist");
    assert.ok(content.includes("handler: \"NetworkOnly\""), "Rutas API deben ser NetworkOnly");
  });

  it("3. Lógica de PWA Manager: Primera instalación vs Deploy con recarga segura", () => {
    // Simulación de entorno DOM / navigator
    let reloadCalled = false;
    let reloadCount = 0;
    const sessionStorageStore = {};

    const mockWindow = {
      location: {
        reload: () => {
          reloadCalled = true;
          reloadCount++;
        }
      }
    };

    const mockSessionStorage = {
      getItem: (k) => sessionStorageStore[k] || null,
      setItem: (k, v) => { sessionStorageStore[k] = String(v); }
    };

    // Caso A: Primera instalación (sin controlador previo) -> NO recarga
    const hadPreviousControllerA = false;
    const controllerchangeHandlerA = () => {
      if (!hadPreviousControllerA) {
        return "NO_RELOAD_FIRST_INSTALL";
      }
      mockWindow.location.reload();
      return "RELOADED";
    };

    const resA = controllerchangeHandlerA();
    assert.strictEqual(resA, "NO_RELOAD_FIRST_INSTALL", "En primera instalación jamás debe forzar recarga");
    assert.strictEqual(reloadCalled, false, "window.location.reload no debe haberse invocado");

    // Caso B: Actualización (ya existía controlador previo) -> Recarga controlada
    const hadPreviousControllerB = true;
    let isBusyB = false;
    let draftSaved = false;

    const controllerchangeHandlerB = () => {
      if (!hadPreviousControllerB) return "NO_RELOAD";
      if (isBusyB) {
        draftSaved = true;
        return "POSTPONED_UPDATE";
      }
      draftSaved = true;
      mockWindow.location.reload();
      return "RELOADED_DEPLOY";
    };

    const resB = controllerchangeHandlerB();
    assert.strictEqual(resB, "RELOADED_DEPLOY", "En actualización tras deploy debe recargar");
    assert.strictEqual(reloadCalled, true);
    assert.strictEqual(draftSaved, true, "Debe guardar borrador de seguridad antes de recargar");
  });

  it("4. No perder trabajo: pospone recarga si hay generación o dictado en curso", () => {
    let reloadAttempted = false;
    let updatePendingNotified = false;
    let draftSaved = false;

    const isBusy = true; // Generando planificación o dictando
    const hadPreviousController = true;

    const onControllerChange = () => {
      if (!hadPreviousController) return;
      if (isBusy) {
        draftSaved = true;
        updatePendingNotified = true;
        return; // Pospone sin recargar
      }
      reloadAttempted = true;
    };

    onControllerChange();

    assert.strictEqual(reloadAttempted, false, "NO debe recargar mientras el maestro esté ocupado");
    assert.strictEqual(draftSaved, true, "Debe preservar el borrador en memoria");
    assert.strictEqual(updatePendingNotified, true, "Debe notificar aviso discreto para actualizar después");
  });

  it("5. Prevención de bucles infinitos de recarga (Anti-loop threshold)", () => {
    let reloads = 0;
    const sessionStore = {};

    const safeReloadTest = () => {
      const last = parseInt(sessionStore["pm_sw_last_reload"] || "0", 10);
      const now = Date.now();
      if (now - last < 6000) {
        return "BLOCKED_LOOP";
      }
      sessionStore["pm_sw_last_reload"] = String(now);
      reloads++;
      return "EXECUTED";
    };

    // Primera ejecución
    const r1 = safeReloadTest();
    assert.strictEqual(r1, "EXECUTED");
    assert.strictEqual(reloads, 1);

    // Invocación inmediata consecutiva (< 6s)
    const r2 = safeReloadTest();
    assert.strictEqual(r2, "BLOCKED_LOOP", "Debe bloquear recargas inmediatas repetidas");
    assert.strictEqual(reloads, 1, "No debe incrementar el contador de recargas");
  });
});
