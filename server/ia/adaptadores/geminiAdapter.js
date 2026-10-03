/**
 * server/ia/adaptadores/geminiAdapter.js
 * Adaptador para Google Gemini (Gemini 2.5 Flash, 2.5 Flash-Lite)
 */

async function llamarGemini({
  modelo = "gemini-2.5-flash",
  apiKey,
  prompt,
  contents,
  timeoutMs = 10000,
  imageBase64 = null,
  mediaType = null
}) {
  if (!apiKey) {
    const err = new Error("GEMINI_API_KEY no configurada.");
    err.status = 401;
    err.esConfiguracion = true;
    throw err;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;

  let cuerpoPeticion;
  if (contents) {
    cuerpoPeticion = { contents };
  } else {
    const parts = [];
    if (imageBase64 && mediaType) {
      parts.push({
        inlineData: {
          mimeType: mediaType,
          data: imageBase64
        }
      });
    }
    parts.push({ text: prompt });
    cuerpoPeticion = {
      contents: [{ role: "user", parts }]
    };
  }

  cuerpoPeticion.generationConfig = {
    temperature: 0.1,
    responseMimeType: "application/json"
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpoPeticion),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      const err = new Error(`Error en Gemini (${res.status}): ${errText}`);
      err.status = res.status;
      err.statusText = res.statusText;
      err.retryAfter = res.headers.get("retry-after") || null;
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        err.esConfiguracion = true;
      }
      throw err;
    }

    const data = await res.json();
    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return {
      texto,
      datosCrudos: data,
      modeloUsado: modelo
    };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      const timeErr = new Error(`Tiempo de espera agotado (${timeoutMs}ms) en ${modelo}`);
      timeErr.status = 504;
      timeErr.esTimeout = true;
      throw timeErr;
    }
    throw err;
  }
}

module.exports = {
  llamarGemini
};
