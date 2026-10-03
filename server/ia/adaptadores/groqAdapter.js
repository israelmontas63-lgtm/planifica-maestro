/**
 * server/ia/adaptadores/groqAdapter.js
 * Adaptador para Groq Cloud (Inferencia ultra rápida con Llama 3.3 70B / 8B)
 * Se activa automáticamente al configurar GROQ_API_KEY en secretos y activar en proveedores.json.
 */

async function llamarGroq({
  modelo = "llama-3.3-70b-versatile",
  apiKey,
  prompt,
  timeoutMs = 6000
}) {
  if (!apiKey) {
    const err = new Error("GROQ_API_KEY no configurada.");
    err.status = 401;
    err.esConfiguracion = true;
    throw err;
  }

  const url = "https://api.groq.com/openai/v1/chat/completions";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Connection": "keep-alive"
      },
      body: JSON.stringify({
        model: modelo,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1
      }),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      const err = new Error(`Error en Groq (${res.status}): ${errText}`);
      err.status = res.status;
      err.retryAfter = res.headers.get("retry-after") || null;
      if (res.status === 401 || res.status === 403) {
        err.esConfiguracion = true;
      }
      throw err;
    }

    const data = await res.json();
    const texto = data.choices?.[0]?.message?.content || "";
    return {
      texto,
      datosCrudos: data,
      modeloUsado: modelo
    };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      const timeErr = new Error(`Tiempo de espera agotado (${timeoutMs}ms) en Groq`);
      timeErr.status = 504;
      timeErr.esTimeout = true;
      throw timeErr;
    }
    throw err;
  }
}

module.exports = {
  llamarGroq
};
