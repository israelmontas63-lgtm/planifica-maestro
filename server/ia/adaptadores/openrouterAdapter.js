/**
 * server/ia/adaptadores/openrouterAdapter.js
 * Adaptador para OpenRouter (Pasarela multi-modelo con opciones gratuitas :free)
 * Se activa automáticamente al configurar OPENROUTER_API_KEY en secretos y activar en proveedores.json.
 */

async function llamarOpenRouter({
  modelo = "apodex/apodex-1.1-mini:free",
  apiKey,
  prompt,
  timeoutMs = 8000
}) {
  if (!apiKey) {
    const err = new Error("OPENROUTER_API_KEY no configurada.");
    err.status = 401;
    err.esConfiguracion = true;
    throw err;
  }

  const url = "https://openrouter.ai/api/v1/chat/completions";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://planifica-maestro.israelmontas65.workers.dev",
        "X-Title": "Planifica Maestro",
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
      const err = new Error(`Error en OpenRouter (${res.status}): ${errText}`);
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
      const timeErr = new Error(`Tiempo de espera agotado (${timeoutMs}ms) en OpenRouter`);
      timeErr.status = 504;
      timeErr.esTimeout = true;
      throw timeErr;
    }
    throw err;
  }
}

module.exports = {
  llamarOpenRouter
};
