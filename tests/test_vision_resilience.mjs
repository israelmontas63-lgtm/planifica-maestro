import test from "node:test";
import assert from "node:assert/strict";
import {
  identificarImagenWorker,
  normalizarImagenVision,
  getGeminiVisionModels,
  MENSAJES_MOTIVO_VISION
} from "../worker/ojoDigital.js";

test("ETAPA B: Ojo Digital - Formato de petición, normalización y resiliencia", async (t) => {
  await t.test("1. Normalización de imagen quita prefijo data:, detecta mime y rechaza inválidas", () => {
    // Caso con prefijo data:image/png;base64,
    const conPrefijo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const res1 = normalizarImagenVision(conPrefijo, "image/png");
    assert.equal(res1.error, undefined);
    assert.ok(!res1.cleanBase64.includes("data:"));
    assert.equal(res1.cleanMime, "image/png");

    // Caso con base64 vacío o corrupto (< 10 chars)
    const resVacio = normalizarImagenVision("", "image/jpeg");
    assert.equal(resVacio.error, "imagen_invalida");

    // Caso con imagen demasiado grande (> 10MB)
    const fakeHuge = "A".repeat(11 * 1024 * 1024);
    const resGrande = normalizarImagenVision(fakeHuge, "image/jpeg");
    assert.equal(resGrande.error, "imagen_muy_grande");

    // Normalización de mime type desconocido a image/jpeg
    const resMimeDesconocido = normalizarImagenVision("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "image/xyz");
    assert.equal(resMimeDesconocido.cleanMime, "image/jpeg");
  });

  await t.test("2. getGeminiVisionModels prioriza GEMINI_VISION_MODELS y GEMINI_MODEL de wrangler.toml", () => {
    // Configurado por GEMINI_VISION_MODELS
    const envVars = {
      GEMINI_VISION_MODELS: "gemini-3.5-flash-lite,gemini-3.5-flash"
    };
    const models1 = getGeminiVisionModels(envVars);
    assert.deepEqual(models1, ["gemini-3.5-flash-lite", "gemini-3.5-flash"]);

    // Sin GEMINI_VISION_MODELS, usa GEMINI_MODEL y defaults
    const envModel = { GEMINI_MODEL: "gemini-3.5-flash-lite" };
    const models2 = getGeminiVisionModels(envModel);
    assert.equal(models2[0], "gemini-3.5-flash-lite");
    assert.ok(models2.includes("gemini-3.5-flash"));
    assert.ok(!models2.includes("gemini-flash-latest"));
  });

  await t.test("3. Verificación del cuerpo JSON real enviado a Gemini", async () => {
    let capturedUrl = "";
    let capturedBody = null;
    let capturedHeaders = null;

    // Mock fetch global para inspeccionar el cuerpo exacto
    const originalFetch = global.fetch;
    global.fetch = async (url, options) => {
      capturedUrl = url;
      capturedHeaders = options.headers;
      capturedBody = JSON.parse(options.body);
      return new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                descripcion: "Página de libro escolar con texto de matemáticas.",
                tipo_visual: "documento_o_texto",
                es_borrosa: false,
                es_delicado: false,
                tema_detectado: "Fracciones"
              })
            }]
          }
        }]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    };

    try {
      const testImg = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
      const res = await identificarImagenWorker({
        imageBase64: testImg,
        mediaType: "image/png",
        env: { GEMINI_API_KEY: "test-fake-key", GEMINI_MODEL: "gemini-3.5-flash-lite" }
      });

      assert.equal(res.exito, true);
      assert.equal(res.descripcion, "Página de libro escolar con texto de matemáticas.");
      assert.equal(res.tipo_visual, "documento_o_texto");

      // Validar estructura exacta del cuerpo JSON requerido por Gemini
      assert.ok(capturedBody.contents, "Debe tener campo contents");
      assert.equal(capturedBody.contents[0].role, "user");
      assert.equal(capturedBody.contents[0].parts.length, 2);

      const inlinePart = capturedBody.contents[0].parts[0];
      assert.ok(inlinePart.inlineData, "Debe tener objeto inlineData");
      assert.equal(inlinePart.inlineData.mimeType, "image/png");
      assert.equal(inlinePart.inlineData.data, testImg);

      const textPart = capturedBody.contents[0].parts[1];
      assert.ok(textPart.text.includes("Ojo Digital"));

      // Validar generationConfig
      assert.equal(capturedBody.generationConfig.temperature, 0.1);
      assert.equal(capturedBody.generationConfig.responseMimeType, "application/json");

      // Validar cabeceras
      assert.equal(capturedHeaders["Content-Type"], "application/json");
      assert.equal(capturedHeaders["x-goog-api-key"], "test-fake-key");
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test("4. Manejo de error 404: no se detiene, pasa al siguiente modelo", async () => {
    let callCount = 0;
    const attemptedModels = [];

    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      callCount++;
      const modelMatch = url.match(/models\/([^:]+):/);
      const model = modelMatch ? modelMatch[1] : "unknown";
      attemptedModels.push(model);

      if (model === "gemini-obsoleto-404") {
        return new Response(JSON.stringify({ error: { code: 404, message: "Model not found" } }), { status: 404 });
      }

      return new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                descripcion: "Foto de una planta en una maceta escolar.",
                tipo_visual: "objeto_o_naturaleza",
                es_borrosa: false,
                es_delicado: false
              })
            }]
          }
        }]
      }), { status: 200 });
    };

    try {
      const res = await identificarImagenWorker({
        imageBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        mediaType: "image/jpeg",
        env: {
          GEMINI_API_KEY: "fake-key",
          GEMINI_VISION_MODELS: "gemini-obsoleto-404,gemini-3.5-flash-lite"
        }
      });

      assert.equal(res.exito, true);
      assert.equal(res.proveedor_utilizado, "gemini-3.5-flash-lite");
      assert.equal(attemptedModels[0], "gemini-obsoleto-404");
      assert.equal(attemptedModels[1], "gemini-3.5-flash-lite");
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test("5. Manejo de error 429 (cuota): reintenta y si falla toda la cadena reporta cuota_gemini", async () => {
    let attempts = 0;
    const originalFetch = global.fetch;
    global.fetch = async () => {
      attempts++;
      return new Response(JSON.stringify({ error: { code: 429, message: "Resource exhausted" } }), { status: 429 });
    };

    try {
      const res = await identificarImagenWorker({
        imageBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        mediaType: "image/jpeg",
        env: {
          GEMINI_API_KEY: "fake-key",
          GEMINI_VISION_MODELS: "gemini-model-test"
        }
      });

      assert.equal(res.exito, false);
      assert.equal(res.motivo, "cuota_gemini");
      assert.equal(res.codigo_http, 429);
      assert.ok(res.mensaje.toLowerCase().includes("cuota"));
      assert.equal(attempts, 2, "Debe haber realizado 1 reintento automático ante 429");
    } finally {
      global.fetch = originalFetch;
    }
  });

  await t.test("6. Manejo de error 500 (error_servicio): reintenta y si falla reporta error_servicio con HTTP 500", async () => {
    let attempts = 0;
    const originalFetch = global.fetch;
    global.fetch = async () => {
      attempts++;
      return new Response(JSON.stringify({ error: { code: 500, message: "Internal server error" } }), { status: 500 });
    };

    try {
      const res = await identificarImagenWorker({
        imageBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        mediaType: "image/jpeg",
        env: {
          GEMINI_API_KEY: "fake-key",
          GEMINI_VISION_MODELS: "gemini-model-500"
        }
      });

      assert.equal(res.exito, false);
      assert.equal(res.motivo, "error_servicio");
      assert.equal(res.codigo_http, 500);
      assert.equal(attempts, 2, "Debe haber realizado 1 reintento automático ante 500");
    } finally {
      global.fetch = originalFetch;
    }
  });
});
