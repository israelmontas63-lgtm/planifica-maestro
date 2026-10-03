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
  mediaType = null,
  onChunk = null
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

  // Modo Streaming SSE en tiempo real si se provee callback onChunk
  if (typeof onChunk === "function") {
    const streamUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:streamGenerateContent?alt=sse&key=${apiKey}`;
    try {
      const res = await fetch(streamUrl, {
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

      let textoCompleto = "";
      if (res.body && typeof res.body.getReader === "function") {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data:")) {
              const jsonStr = line.replace(/^data:\s*/, "").trim();
              if (jsonStr && jsonStr !== "[DONE]") {
                try {
                  const parsed = JSON.parse(jsonStr);
                  const part = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                  if (part) {
                    textoCompleto += part;
                    onChunk(part);
                  }
                } catch (e) {}
              }
            }
          }
        }
      } else {
        const rawText = await res.text();
        textoCompleto = rawText;
      }

      return {
        texto: textoCompleto,
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
