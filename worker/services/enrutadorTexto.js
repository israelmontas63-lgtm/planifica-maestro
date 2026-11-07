// worker/services/enrutadorTexto.js
// Respaldo de TEXTO cuando Gemini no responde: Groq -> OpenRouter (gratis) -> Cloudflare Workers AI.
// Solo texto. Si la petición trae imagen NO se usa respaldo (visión solo con proveedores aprobados).
// Nunca registra ni devuelve claves.
import { fetchConLimite, esTimeoutIntento } from "./timeoutIntento.js";

const pausas = new Map();   // id -> { hasta, motivo }
const modelos = new Map();  // id -> { modelo, hasta }
const SEIS_HORAS = 6 * 60 * 60 * 1000;

export function proveedorDisponible(id, ahora = Date.now()) {
  const p = pausas.get(id);
  return !p || p.hasta <= ahora;
}
function pausar(id, ms, motivo) { pausas.set(id, { hasta: Date.now() + ms, motivo }); }
export function estadoProveedoresTexto() {
  const ahora = Date.now();
  const out = {};
  for (const [id, p] of pausas) out[id] = p.hasta > ahora ? { enPausa: true, segundos: Math.ceil((p.hasta - ahora) / 1000), motivo: p.motivo } : { enPausa: false };
  return out;
}
export function reiniciarEstadoTexto() { pausas.clear(); modelos.clear(); }

// Convierte el formato Gemini (contents/parts) a mensajes tipo OpenAI.
export function contentsAMensajes(systemPrompt, contents, json = true) {
  const mensajes = [];
  const sys = String(systemPrompt || "") + (json ? "\n\nResponde ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después." : "");
  if (sys.trim()) mensajes.push({ role: "system", content: sys });
  let hayImagen = false;
  for (const c of Array.isArray(contents) ? contents : []) {
    const partes = Array.isArray(c && c.parts) ? c.parts : [];
    if (partes.some((p) => p && p.inlineData)) hayImagen = true;
    const texto = partes.filter((p) => p && typeof p.text === "string").map((p) => p.text).join("\n");
    if (texto) mensajes.push({ role: c.role === "model" ? "assistant" : "user", content: texto });
  }
  return { mensajes, hayImagen };
}

async function listarModelos(url, apiKey, signal) {
  const res = await fetchConLimite(url, { headers: { Authorization: `Bearer ${apiKey}` }, signal }, 6000);
  if (!res.ok) { const e = new Error(`HTTP_${res.status}`); e.status = res.status; throw e; }
  const data = await res.json();
  return Array.isArray(data && data.data) ? data.data : [];
}

const PREFERIDOS = [/llama-3\.3-70b/i, /gpt-oss-120b/i, /qwen.*(72|70|32|27|30)b/i, /llama.*70b/i, /gemma.*(27|12)b/i, /mistral.*(small|large)/i, /deepseek/i];
function elegirPorPreferencia(ids) {
  for (const rx of PREFERIDOS) { const hit = ids.find((id) => rx.test(id)); if (hit) return hit; }
  return ids[0] || null;
}

async function modeloGroq(env, apiKey, signal) {
  if (env.GROQ_MODEL) return env.GROQ_MODEL;
  const c = modelos.get("groq");
  if (c && c.hasta > Date.now()) return c.modelo;
  const lista = await listarModelos("https://api.groq.com/openai/v1/models", apiKey, signal);
  const ids = lista.map((m) => m && m.id).filter((id) => typeof id === "string" && !/whisper|guard|tts|orpheus|playai|embed|safeguard/i.test(id));
  const m = elegirPorPreferencia(ids);
  if (!m) { const e = new Error("SIN_MODELO"); e.status = 502; throw e; }
  modelos.set("groq", { modelo: m, hasta: Date.now() + SEIS_HORAS });
  return m;
}

async function modeloOpenRouter(env, apiKey, signal) {
  if (env.OPENROUTER_MODEL) return env.OPENROUTER_MODEL;
  const c = modelos.get("openrouter");
  if (c && c.hasta > Date.now()) return c.modelo;
  const lista = await listarModelos("https://openrouter.ai/api/v1/models", apiKey, signal);
  const gratis = lista.filter((m) => m && typeof m.id === "string"
    && (m.id.endsWith(":free") || (m.pricing && Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0))
    && Number(m.context_length || 0) >= 32000
    && !/vision|image|audio|embed|guard|whisper|tts|video/i.test(m.id));
  const m = elegirPorPreferencia(gratis.map((x) => x.id)) || (gratis[0] && gratis[0].id) || null;
  if (!m) { const e = new Error("SIN_MODELO_GRATIS"); e.status = 502; throw e; }
  modelos.set("openrouter", { modelo: m, hasta: Date.now() + SEIS_HORAS });
  return m;
}

async function llamarCompatible({ url, apiKey, modelo, mensajes, maxTokens, json, usarFormatoJson, signal, timeoutMs, extra = {} }) {
  const body = { model: modelo, messages: mensajes, temperature: 0.1, max_tokens: Math.min(maxTokens, 8000) };
  if (json && usarFormatoJson) body.response_format = { type: "json_object" };
  const res = await fetchConLimite(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, ...extra },
    body: JSON.stringify(body),
    signal,
  }, timeoutMs);
  if (!res.ok) {
    const e = new Error(`HTTP_${res.status}`);
    e.status = res.status;
    e.retryAfter = Number(res.headers && res.headers.get && res.headers.get("retry-after")) || 0;
    throw e;
  }
  const data = await res.json();
  const choice = data && data.choices && data.choices[0];
  const texto = choice && choice.message && typeof choice.message.content === "string" ? choice.message.content : "";
  if (!texto.trim()) { const e = new Error("RESPUESTA_VACIA"); e.status = 502; throw e; }
  return { texto, finish: (choice && choice.finish_reason) || null };
}

async function llamarWorkersAI(env, { mensajes, maxTokens, json, timeoutMs }) {
  const modelo = env.CF_AI_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
  let timer;
  const limite = new Promise((_, rej) => { timer = setTimeout(() => rej(Object.assign(new Error("TIMEOUT_INTENTO:" + timeoutMs + "ms"), { status: 504 })), timeoutMs); });
  try {
    const out = await Promise.race([
      env.AI.run(modelo, { messages: mensajes, max_tokens: Math.min(maxTokens, 4096), ...(json ? { response_format: { type: "json_object" } } : {}) }),
      limite,
    ]);
    let texto = out && out.response;
    if (texto && typeof texto === "object") texto = JSON.stringify(texto);
    if (typeof texto !== "string" || !texto.trim()) { const e = new Error("RESPUESTA_VACIA"); e.status = 502; throw e; }
    return { texto, finish: null, modelo };
  } finally { clearTimeout(timer); }
}

/**
 * Genera texto con respaldo. Devuelve { texto, proveedor, modelo, ms, finish, intentos }
 * o null si la petición trae imagen. Lanza Error("RESPALDO_AGOTADO") con .intentos si todo falla.
 */
export async function generarTextoConRespaldo(env, { systemPrompt, contents, maxTokens = 4096, json = true, signal, presupuestoMs = 40000 } = {}) {
  const { mensajes, hayImagen } = contentsAMensajes(systemPrompt, contents, json);
  if (hayImagen || mensajes.length === 0) return null;
  const t0 = Date.now();
  const intentos = [];
  const cadena = [
    { id: "groq", activo: Boolean(env && env.GROQ_API_KEY), timeoutMs: 12000 },
    { id: "openrouter", activo: Boolean(env && env.OPENROUTER_API_KEY), timeoutMs: 20000 },
    { id: "workers_ai", activo: Boolean(env && env.AI && typeof env.AI.run === "function"), timeoutMs: 15000 },
  ];
  for (const p of cadena) {
    if (!p.activo) { intentos.push({ id: p.id, estado: "sin_configurar" }); continue; }
    if (!proveedorDisponible(p.id)) { intentos.push({ id: p.id, estado: "en_pausa" }); continue; }
    if (presupuestoMs - (Date.now() - t0) < 2000) { intentos.push({ id: p.id, estado: "sin_presupuesto" }); break; }
    if (signal && signal.aborted) { intentos.push({ id: p.id, estado: "cancelado" }); break; }
    try {
      let r; let modelo;
      if (p.id === "groq") {
        modelo = await modeloGroq(env, env.GROQ_API_KEY, signal);
        r = await llamarCompatible({ url: "https://api.groq.com/openai/v1/chat/completions", apiKey: env.GROQ_API_KEY, modelo, mensajes, maxTokens, json, usarFormatoJson: true, signal, timeoutMs: p.timeoutMs });
      } else if (p.id === "openrouter") {
        modelo = await modeloOpenRouter(env, env.OPENROUTER_API_KEY, signal);
        r = await llamarCompatible({ url: "https://openrouter.ai/api/v1/chat/completions", apiKey: env.OPENROUTER_API_KEY, modelo, mensajes, maxTokens, json, usarFormatoJson: env.OPENROUTER_JSON_MODE === "true", signal, timeoutMs: p.timeoutMs, extra: { "X-Title": "Planifica Maestro" } });
      } else {
        r = await llamarWorkersAI(env, { mensajes, maxTokens, json, timeoutMs: p.timeoutMs });
        modelo = r.modelo;
      }
      intentos.push({ id: p.id, estado: "ok" });
      return { texto: r.texto, proveedor: p.id, modelo, ms: Date.now() - t0, finish: r.finish, intentos };
    } catch (e) {
      const st = Number(e && e.status) || 0;
      const timeout = esTimeoutIntento(e);
      if (st === 401 || st === 403) pausar(p.id, 60 * 60 * 1000, "configuracion");
      else if (st === 429) pausar(p.id, Math.max((e.retryAfter || 0) * 1000, 60000), "cuota");
      else if (timeout) pausar(p.id, 30000, "lento");
      else pausar(p.id, 20000, "error");
      intentos.push({ id: p.id, estado: "fallo", status: st || null, timeout });
    }
  }
  const err = new Error("RESPALDO_AGOTADO");
  err.intentos = intentos;
  throw err;
}

// Respuesta con forma de stream de Gemini para reutilizar el lector SSE existente sin tocarlo.
export function respuestaSSEDeGemini(texto, finish = null) {
  const finishReason = finish === "length" ? "MAX_TOKENS" : "STOP";
  const payload = { candidates: [{ content: { role: "model", parts: [{ text: texto }] }, finishReason }] };
  return new Response(`data: ${JSON.stringify(payload)}\n\n`, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}
