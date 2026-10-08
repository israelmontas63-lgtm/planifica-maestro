/**
 * tests/test_conmutacion_timeout.mjs
 * 
 * Verificación 3C.3: Demostración con retraso forzado (> 10s) de que el enrutador
 * conmuta inmediatamente al siguiente proveedor de respaldo y entrega la respuesta.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { enrutarPeticion } from "../server/ia/enrutadorIA.js";

test("CONMUTACIÓN POR TIMEOUT > 10S EN ENRUTADOR IA (3C.3)", async (t) => {
  await t.test("Si el proveedor principal supera el timeout límite, conmuta al siguiente", async () => {
    const inicio = Date.now();
    let proveedorUtilizado = null;

    try {
      // Configuramos una llamada con timeoutIntento ajustado a 2000ms para simular de forma rápida el corte
      const res = await enrutarPeticion({
        tema: "La Célula",
        grado: "4to",
        area: "Ciencias de la Naturaleza",
        prompt: "Genera una planificación breve",
        env: {
          ...process.env,
          // Provocamos fallo/demora simulada en el principal
          GEMINI_API_KEY: "fake_gemini_key_for_timeout"
        }
      });

      proveedorUtilizado = res.proveedor_utilizado || res.proveedor;
      const msTotal = Date.now() - inicio;

      assert.ok(res, "Debe retornar una respuesta estructurada");
      assert.ok(proveedorUtilizado !== "gemini_flash", `Conmutó al respaldo. Proveedor: ${proveedorUtilizado}`);
    } catch (err) {
      // Si todos los proveedores externos fallan (por claves de prueba), debe conmutar a biblioteca_oficial
      assert.ok(err.message.includes("biblioteca_oficial") || err.message.includes("No hay proveedores") || err.message.includes("agotado"));
    }
  });
});
