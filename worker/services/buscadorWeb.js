// worker/services/buscadorWeb.js
// Búsqueda web con varios motores y respaldo. Nunca inventa resultados: si nada responde, devuelve ok:false.
// Modos: "general" | "oficial" (solo dominios MINERD de investigadorService) | "academico".
import { fetchConLimite } from "./timeoutIntento.js";
import { DOMINIOS_OFICIALES, esUrlPermitida } from "./investigadorService.js";

const UA = "PlanificaMaestro-Bot/1.0 (+https://planifica-maestro.israelmontas65.workers.dev)";
const pausas = new Map();
export function reiniciarEstadoBusqueda() { pausas.clear(); }

const limpiar = (t, n = 300) => String(t == null ? "" : t).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, n);

async function tavily(env, q, { max, oficial, signal, timeoutMs }) {
  if (!env.TAVILY_API_KEY) return { sinConfig: true };
  const body = { api_key: env.TAVILY_API_KEY, query: q, search_depth: "basic", max_results: max, include_answer: true };
  if (oficial) body.include_domains = DOMINIOS_OFICIALES;
  const res = await fetchConLimite("https://api.tavily.com/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal }, timeoutMs);
  if (!res.ok) { const e = new Error(`HTTP_${res.status}`); e.status = res.status; throw e; }
  const d = await res.json();
  return { respuesta: d.answer ? limpiar(d.answer, 1200) : null, fuentes: (d.results || []).map((r) => ({ titulo: limpiar(r.title, 160), url: r.url, resumen: limpiar(r.content) })) };
}

async function geminiGrounding(env, q, { signal, timeoutMs }) {
  if (!env.GEMINI_API_KEY) return { sinConfig: true };
  const base = env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com";
  const modelo = env.GEMINI_GROUNDING_MODEL || env.GEMINI_MODEL || "gemini-3.1-flash-lite";
  const res = await fetchConLimite(`${base}/v1beta/models/${modelo}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: q }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.1, maxOutputTokens: 1024 } }),
    signal,
  }, timeoutMs);
  if (!res.ok) { const e = new Error(`HTTP_${res.status}`); e.status = res.status; throw e; }
  const d = await res.json();
  const cand = d && d.candidates && d.candidates[0];
  const chunks = (cand && cand.groundingMetadata && cand.groundingMetadata.groundingChunks) || [];
  const fuentes = chunks.filter((c) => c && c.web && c.web.uri).map((c) => ({ titulo: limpiar(c.web.title || c.web.uri, 160), url: c.web.uri, resumen: "" }));
  const texto = ((cand && cand.content && cand.content.parts) || []).filter((p) => p && typeof p.text === "string" && p.thought !== true).map((p) => p.text).join("");
  return { respuesta: fuentes.length ? limpiar(texto, 1200) : null, fuentes };
}

async function exa(env, q, { max, oficial, signal, timeoutMs }) {
  if (!env.EXA_API_KEY) return { sinConfig: true };
  const body = { query: q, numResults: max, type: "auto", contents: { text: { maxCharacters: 400 } } };
  if (oficial) body.includeDomains = DOMINIOS_OFICIALES;
  const res = await fetchConLimite("https://api.exa.ai/search", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": env.EXA_API_KEY }, body: JSON.stringify(body), signal }, timeoutMs);
  if (!res.ok) { const e = new Error(`HTTP_${res.status}`); e.status = res.status; throw e; }
  const d = await res.json();
  return { respuesta: null, fuentes: (d.results || []).map((r) => ({ titulo: limpiar(r.title, 160), url: r.url, resumen: limpiar(r.text) })) };
}

async function wikipediaEs(env, q, { max, signal, timeoutMs }) {
  const res = await fetchConLimite(`https://es.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(q)}&limit=${max}`, { headers: { "User-Agent": UA, Accept: "application/json" }, signal }, timeoutMs);
  if (!res.ok) { const e = new Error(`HTTP_${res.status}`); e.status = res.status; throw e; }
  const d = await res.json();
  return { respuesta: null, fuentes: (d.pages || []).map((p) => ({ titulo: limpiar(p.title, 160), url: `https://es.wikipedia.org/wiki/${encodeURIComponent(p.key || p.title)}`, resumen: limpiar(p.description || p.excerpt) })) };
}

async function openAlex(env, q, { max, signal, timeoutMs }) {
  const res = await fetchConLimite(`https://api.openalex.org/works?search=${encodeURIComponent(q)}&per-page=${max}`, { headers: { "User-Agent": UA, Accept: "application/json" }, signal }, timeoutMs);
  if (!res.ok) { const e = new Error(`HTTP_${res.status}`); e.status = res.status; throw e; }
  const d = await res.json();
  return { respuesta: null, fuentes: (d.results || []).map((w) => ({ titulo: limpiar(w.display_name || w.title, 160), url: w.doi || (w.primary_location && w.primary_location.landing_page_url) || w.id, resumen: w.publication_year ? `Publicado en ${w.publication_year}` : "" })).filter((f) => f.url) };
}

const MOTORES = { tavily, gemini_grounding: geminiGrounding, exa, wikipedia: wikipediaEs, openalex: openAlex };
const ORDEN = {
  general: ["tavily", "gemini_grounding", "exa", "wikipedia"],
  oficial: ["tavily", "exa"],
  academico: ["openalex", "tavily", "wikipedia", "exa"],
};

export async function buscarWebMulti(env, consulta, { modo = "general", max = 5, signal, timeoutMs = 8000, minFuentes = 1 } = {}) {
  const q = String(consulta || "").trim().slice(0, 400);
  const intentos = [];
  if (!q) return { ok: false, fuentes: [], respuesta: null, motor: null, intentos };
  const oficial = modo === "oficial";
  const orden = ORDEN[modo] || ORDEN.general;
  const vistas = new Set();
  let fuentes = [];
  let respuesta = null;
  let motor = null;
  for (const id of orden) {
    if (signal && signal.aborted) { intentos.push({ id, estado: "cancelado" }); break; }
    const p = pausas.get(id);
    if (p && p > Date.now()) { intentos.push({ id, estado: "en_pausa" }); continue; }
    try {
      const r = await MOTORES[id](env || {}, q, { max, oficial, signal, timeoutMs });
      if (r && r.sinConfig) { intentos.push({ id, estado: "sin_configurar" }); continue; }
      let encontrados = (r && r.fuentes) || [];
      if (oficial) encontrados = encontrados.filter((f) => f.url && esUrlPermitida(f.url));
      const nuevos = encontrados.filter((f) => f.url && !vistas.has(f.url));
      intentos.push({ id, estado: nuevos.length ? "ok" : "sin_resultados" });
      for (const f of nuevos) { vistas.add(f.url); fuentes.push({ ...f, motor: id }); }
      if (nuevos.length && !motor) { motor = id; respuesta = (r && r.respuesta) || null; }
      if (fuentes.length >= minFuentes) break;
    } catch (e) {
      const st = Number(e && e.status) || 0;
      pausas.set(id, Date.now() + (st === 401 || st === 403 ? 3600000 : st === 429 ? 60000 : 20000));
      intentos.push({ id, estado: "fallo", status: st || null });
    }
  }
  fuentes = fuentes.slice(0, max);
  return { ok: fuentes.length > 0, fuentes, respuesta: fuentes.length ? respuesta : null, motor, intentos };
}
