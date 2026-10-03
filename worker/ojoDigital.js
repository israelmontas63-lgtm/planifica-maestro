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

export async function identificarImagenWorker({
  imageBase64,
  mediaType = "image/jpeg",
  env
}) {
  if (!env.GEMINI_API_KEY) {
    return {
      exito: false,
      error: "camara_no_disponible",
      mensaje: "La cámara no está disponible ahora (clave de visión no configurada). Por favor, prueba más tarde o escribe tu consulta directamente."
    };
  }

  const models = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    try {
      const parts = [
        {
          inlineData: {
            mimeType: mediaType,
            data: imageBase64,
          },
        },
        {
          text: PROMPT_OJO_DIGITAL,
        },
      ];

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
      });

      if (!res.ok) {
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
          let descripcion = parsed.descripcion.trim();

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
            proveedor_utilizado: model
          };
        }
      }
    } catch (err) {
      console.warn(`[Worker Ojo Digital] Falló ${model}:`, err.message);
    }
  }

  return {
    exito: false,
    error: "camara_no_disponible",
    mensaje: "La cámara no está disponible ahora (límite de visión alcanzado o sin conexión con el servicio). Por favor, prueba más tarde o escribe tu consulta directamente."
  };
}
