// worker/services/hydeService.js
/**
 * HyDE (Hypothetical Document Embeddings)
 * Basado en: Gao et al., Carnegie Mellon University & Univ. of Waterloo (arXiv:2212.10496)
 *
 * Transforma consultas cortas o coloquiales del docente ("sumas con llevada", "el cuento")
 * en un pasaje curricular hipotético con la terminología formal del MINERD
 * ("adición de números naturales con reagrupación", contenidos conceptuales, procedimentales e indicadores).
 * Este documento hipotético se vectoriza para capturar con alta fidelidad el espacio latente del currículo oficial.
 */

import { fetchConLimite } from "./timeoutIntento.js";

export async function generarDocumentoHipotetico(env, consulta, grado = null, area = null) {
  const queryCruda = String(consulta || "").trim();
  if (!queryCruda) return "";

  // Si no hay GEMINI_API_KEY en env, retornar la consulta intacta como fallback
  if (!env || !env.GEMINI_API_KEY) {
    return queryCruda;
  }

  const modelo = env.GEMINI_MODEL || "gemini-2.5-flash";
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`;

  const gradoTxt = grado ? `${grado}.° grado de Primaria` : "Educación Primaria";
  const areaTxt = area ? `en el área de ${area}` : "del diseño curricular oficial";

  const systemPrompt = `Eres un redactor curricular senior del Ministerio de Educación de la República Dominicana (MINERD).
Tu tarea es generar un breve fragmento curricular hipotético y formal para ${gradoTxt} ${areaTxt}.
Usa terminología técnica oficial del MINERD (contenidos conceptuales, procedimientos clave e indicadores de logro).
Responde en un solo párrafo compacto de máximo 3 o 4 oraciones. No incluyas preámbulos, saludos ni explicaciones.`;

  const userPrompt = `Genera el pasaje curricular oficial hipotético para el tema: "${queryCruda}"`;

  try {
    const res = await fetchConLimite(
      geminiUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 120,
            responseMimeType: "text/plain",
          },
        }),
      },
      3500 // Timeout ultra-rápido de 3.5s para no penalizar la latencia
    );

    if (!res || !res.ok) {
      return queryCruda;
    }

    const data = await res.json();
    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (texto && texto.length > 20) {
      return `${queryCruda} | ${texto}`;
    }

    return queryCruda;
  } catch (err) {
    console.warn("[HyDE] Fallback a consulta cruda por excepción:", String((err && err.message) || err).slice(0, 100));
    return queryCruda;
  }
}
