/**
 * tests/test_analisis_imagen_pixeles.mjs
 * 
 * Verificación 3C.6: Análisis de píxeles reales (luminancia, contraste y Laplaciano)
 */

import test from "node:test";
import assert from "node:assert/strict";
import { calcularMetricasPixeles } from "../client/src/utils/analizadorCalidadImagen.js";

test("ANÁLISIS DE PÍXELES REALES: LUMINANCIA, CONTRASTE Y NITIDEZ (3C.6)", async (t) => {
  // 1. Imagen completamente negra 100x100
  await t.test("1. Imagen negra es rechazada por baja luminancia", () => {
    const w = 100, h = 100;
    const data = new Uint8ClampedArray(w * h * 4); // Todos en 0 (negro)
    for (let i = 3; i < data.length; i += 4) data[i] = 255; // Alfa 255

    const res = calcularMetricasPixeles(data, w, h);
    assert.equal(res.esValida, false);
    assert.equal(res.motivo, "oscura");
    assert.ok(res.metricas.luminancia < 5);
  });

  // 2. Imagen plana uniforme gris (sin contraste)
  await t.test("2. Imagen gris plana uniforme es rechazada por falta de contraste", () => {
    const w = 100, h = 100;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 120;     // R
      data[i + 1] = 120; // G
      data[i + 2] = 120; // B
      data[i + 3] = 255; // A
    }

    const res = calcularMetricasPixeles(data, w, h);
    assert.equal(res.esValida, false);
    assert.equal(res.motivo, "sin_contraste");
    assert.ok(res.metricas.contraste < 5);
  });

  // 3. Imagen borrosa (gradiente muy suave, sin bordes de alta frecuencia)
  await t.test("3. Imagen borrosa/desenfocada es rechazada por baja varianza Laplaciana", () => {
    const w = 100, h = 100;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const val = Math.floor(50 + (x / w) * 100); // Gradiente muy suave
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }

    const res = calcularMetricasPixeles(data, w, h);
    assert.equal(res.esValida, false);
    assert.equal(res.motivo, "borrosa");
    assert.ok(res.metricas.nitidez < 45);
  });

  // 4. Imagen nítida de texto (patrón de alto contraste tipo tablero de ajedrez / caracteres negros sobre fondo blanco)
  await t.test("4. Imagen nítida con texto/bordes pasa satisfactoriamente", () => {
    const w = 100, h = 100;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        // Simular trazos negros sobre fondo blanco (como letras impresas)
        const esBordeOTrazo = (x % 10 === 0 && y % 5 === 0) || (x % 8 === 0);
        const val = esBordeOTrazo ? 20 : 230;
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }

    const res = calcularMetricasPixeles(data, w, h);
    assert.equal(res.esValida, true);
    assert.equal(res.motivo, "ok");
    assert.ok(res.metricas.luminancia > 50);
    assert.ok(res.metricas.contraste > 30);
    assert.ok(res.metricas.nitidez > 100);
  });
});
