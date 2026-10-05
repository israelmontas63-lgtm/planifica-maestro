/**
 * worker/ojoDigital.js
 * Ojo Digital Inteligente para Planifica Maestro (Cloudflare Worker - ESM)
 * 
 * Responsabilidades:
 * 1. Identificar y describir qué hay en la foto en 1-2 frases claras antes de cualquier acción curricular.
 * 2. Adaptar opciones interactivas según el tipo visual (documento, objeto/planta, mapa, pizarra).
 * 3. Proteger contra prompt injections dentro de la imagen.
 * 4. Manejo honesto de incertidumbre, fotos borrosas y advertencias en temas delicados.
 * 5. Consumir exactamente 1 llamada de visión con Gemini Flash / Flash-Lite.
 */

import { PROMPT_OJO_DIGITAL, generarOpcionesSegunTipoVisual, tieneIntencionExplicita } from "./constantsOjoDigital.js";

export { generarOpcionesSegunTipoVisual, tieneIntencionExplicita };

export const MENSAJES_MOTIVO_VISION = {
  sin_clave: "La cámara no está disponible ahora (clave de visión no configurada). Por favor, prueba más tarde o escribe tu consulta directamente.",
  cuota_gemini: "La cámara no está disponible ahora (límite de cuota alcanzado). Por favor, prueba más tarde o escribe tu consulta directamente.",
  cuota_app: "La cámara no está disponible ahora (límite diario de consultas alcanzado). Por favor, intenta de nuevo mañana o escribe tu consulta.",
  modelo_no_disponible: "La cámara no está disponible ahora (modelo de visión en actualización). Por favor, prueba más tarde o escribe tu consulta directamente.",
  imagen_invalida: "La cámara no está disponible para procesar esta imagen (imagen no válida o vacía). Por favor, toma la foto de nuevo con buena iluminación.",
  imagen_muy_grande: "La cámara no está disponible para procesar esta imagen (imagen demasiado grande). Por favor, toma una foto más ligera o acércate al texto.",
  timeout: "La cámara no está disponible ahora (tiempo de espera agotado). Por favor, reintenta o escribe tu consulta directamente.",
  error_servicio: "La cámara no está disponible ahora (error temporal del servicio). Por favor, prueba más tarde o escribe tu consulta directamente.",
  sin_red: "La cámara no está disponible ahora (sin conexión de red). Por favor, revisa tu conexión a internet o escribe tu consulta.",
  sin_proveedor_vision: "La cámara no está disponible ahora (sin proveedor de visión disponible). Por favor, prueba más tarde o escribe tu consulta."
};

export function getGeminiVisionModels(env) {
  if (env && env.GEMINI_VISION_MODELS) {
    const list = env.GEMINI_VISION_MODELS.split(",").map((m) => m.trim()).filter(Boolean);
    if (list.length > 0) return list;
  }
  const primary = (env && env.GEMINI_MODEL ? env.GEMINI_MODEL.trim() : "gemini-3.1-flash-lite");
  const defaults = ["gemini-3.1-flash-lite", "gemini-3-flash-preview", "gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-flash-latest"];
  const models = [primary];
  for (const m of defaults) {
    if (!models.includes(m)) models.push(m);
  }
  return models;
}

export function normalizarImagenVision(imageBase64, mediaType = "image/jpeg") {
  if (!imageBase64 || typeof imageBase64 !== "string") {
    return { error: "imagen_invalida" };
  }

  // Quitar cualquier prefijo data:image/...;base64,
  const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "").trim();

  // Rechazar imágenes vacías o corruptas
  if (!cleanBase64 || cleanBase64.length < 10) {
    return { error: "imagen_invalida" };
  }

  // Rechazar imágenes excesivamente pesadas (> 10 MB base64 ~ 7.5 MB binario)
  if (cleanBase64.length > 10 * 1024 * 1024) {
    return { error: "imagen_muy_grande" };
  }

  // Normalizar y sanear MIME type
  let cleanMime = (mediaType || "image/jpeg").toLowerCase().trim();
  const validMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
  if (cleanMime === "image/jpg") cleanMime = "image/jpeg";
  if (!validMimes.includes(cleanMime)) {
    cleanMime = "image/jpeg";
  }

  return {
    cleanBase64,
    cleanMime
  };
}

export async function identificarImagenWorker({
  imageBase64,
  mediaType = "image/jpeg",
  env
}) {
  if (!env || !env.GEMINI_API_KEY) {
    return {
      exito: false,
      error: "camara_no_disponible",
      motivo: "sin_clave",
      codigo_http: null,
      mensaje: MENSAJES_MOTIVO_VISION.sin_clave
    };
  }

  // Normalización y validación estricta de la imagen
  const norm = normalizarImagenVision(imageBase64, mediaType);
  if (norm.error) {
    const mot = norm.error;
    return {
      exito: false,
      error: "camara_no_disponible",
      motivo: mot,
      codigo_http: 400,
      mensaje: MENSAJES_MOTIVO_VISION[mot] || MENSAJES_MOTIVO_VISION.imagen_invalida
    };
  }

  const models = getGeminiVisionModels(env);
  let lastMotivo = "error_servicio";
  let lastHttpCode = null;

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const bodyPayload = JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: norm.cleanMime,
                data: norm.cleanBase64,
              },
            },
            {
              text: PROMPT_OJO_DIGITAL,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    });

    // Intentar con reintento automático único ante errores transitorios (429, 5xx, timeout)
    const MAX_ATTEMPTS = 2;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s de reloj

        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY,
          },
          body: bodyPayload,
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          lastHttpCode = res.status;
          const errText = await res.text().catch(() => "");
          console.warn(`[Worker Ojo Digital] Modelo ${model} intento ${attempt}/${MAX_ATTEMPTS} falló con HTTP ${res.status}: ${errText.slice(0, 160)}`);

          if (res.status === 404) {
            lastMotivo = "modelo_no_disponible";
            // 404 no se reintenta, se pasa de inmediato al siguiente modelo
            break;
          } else if (res.status === 429) {
            lastMotivo = "cuota_gemini";
            if (attempt < MAX_ATTEMPTS) {
              await new Promise((r) => setTimeout(r, 1200));
              continue;
            }
          } else if (res.status >= 500) {
            lastMotivo = "error_servicio";
            if (attempt < MAX_ATTEMPTS) {
              await new Promise((r) => setTimeout(r, 1000));
              continue;
            }
          } else if (res.status === 400) {
            lastMotivo = "imagen_invalida";
            break;
          } else {
            lastMotivo = "error_servicio";
            break;
          }
          continue;
        }

        const data = await res.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          let parsed = null;
          try {
            parsed = JSON.parse(rawText);
          } catch (e) {
            const match = rawText.match(/\{[\s\S]*\}/);
            if (match) parsed = JSON.parse(match[0]);
          }

          if (parsed && parsed.descripcion) {
            const esBorrosa = Boolean(parsed.es_borrosa);
            const esDelicado = Boolean(parsed.es_delicado);
            let descripcion = String(parsed.descripcion || "").trim();

            if (esDelicado) {
              descripcion += "\n\n*(⚠️ Aviso importante: La identificación de plantas, hongos o sustancias por fotografía es orientativa. No consumas ni administres nada basándote únicamente en una foto; verifica siempre con guías oficiales o expertos.)*";
            }

            const tipoVisual = parsed.tipo_visual || (esBorrosa ? "ilegible" : "objeto_o_naturaleza");
            const opciones = generarOpcionesSegunTipoVisual(tipoVisual, esBorrosa);

            return {
              exito: true,
              descripcion,
              tipo_visual: tipoVisual,
              es_borrosa: esBorrosa,
              es_delicado: esDelicado,
              tema_detectado: parsed.tema_detectado || null,
              texto_resumen_ocr: parsed.texto_resumen_ocr || null,
              opciones,
              proveedor_utilizado: model,
              codigo_http: 200
            };
          }
        }
      } catch (err) {
        console.warn(`[Worker Ojo Digital] Excepción en modelo ${model} intento ${attempt}:`, err.message);
        if (err.name === "AbortError" || String(err.message).toLowerCase().includes("timeout")) {
          lastMotivo = "timeout";
        } else {
          lastMotivo = "sin_red";
        }
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
  }

  // Toda la cadena de visión falló; devolver el motivo real y honesto con código HTTP
  const mensajeFinal = MENSAJES_MOTIVO_VISION[lastMotivo] || MENSAJES_MOTIVO_VISION.error_servicio;
  return {
    exito: false,
    error: "camara_no_disponible",
    motivo: lastMotivo,
    codigo_http: lastHttpCode,
    mensaje: mensajeFinal
  };
}
