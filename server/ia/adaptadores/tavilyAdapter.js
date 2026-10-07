/**
 * server/ia/adaptadores/tavilyAdapter.js
 * Adaptador de búsqueda web en tiempo real con Tavily API
 */

async function buscarEnTavily({
  query,
  apiKey = process.env.TAVILY_API_KEY,
  maxResults = 5,
  includeAnswer = true,
  timeoutMs = 8000
}) {
  if (!apiKey) {
    const err = new Error("TAVILY_API_KEY no configurada.");
    err.status = 401;
    err.esConfiguracion = true;
    throw err;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        include_answer: includeAnswer,
        max_results: maxResults,
        include_domains: []
      }),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      const err = new Error(`Error en Tavily (${res.status}): ${errText}`);
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    const results = (data.results || []).map(r => ({
      titulo: r.title,
      url: r.url,
      resumen: r.content,
      score: r.score
    }));

    return {
      ok: true,
      query,
      respuestaDirecta: data.answer || null,
      resultados: results,
      total: results.length
    };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      const timeErr = new Error(`Tiempo de espera agotado (${timeoutMs}ms) en búsqueda Tavily`);
      timeErr.status = 504;
      timeErr.esTimeout = true;
      throw timeErr;
    }
    throw err;
  }
}

module.exports = {
  buscarEnTavily
};
