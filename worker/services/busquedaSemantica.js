// worker/services/busquedaSemantica.js
// Búsqueda curricular HÍBRIDA (texto completo + vectores) con Supabase pgvector y embeddings de Cloudflare Workers AI.
// Un solo modelo de embeddings para todo (mezclar modelos rompe la comparación). Si falla, devuelve null
// y el flujo curricular actual (consultarCurriculoMINERD) sigue como siempre.
import { fetchConLimite } from "./timeoutIntento.js";

export const MODELO_EMBEDDING = "@cf/baai/bge-m3"; // 1024 dimensiones: debe coincidir con vector(1024) del SQL
export const DIMENSION = 1024;

export async function generarEmbeddings(env, textos) {
  if (!env || !env.AI || typeof env.AI.run !== "function") return null;
  const lista = (Array.isArray(textos) ? textos : [textos]).map((t) => String(t || "").slice(0, 2000));
  if (!lista.length || lista.some((t) => !t.trim())) return null;
  try {
    const out = await env.AI.run(MODELO_EMBEDDING, { text: lista });
    const vecs = out && out.data;
    if (!Array.isArray(vecs) || vecs.length !== lista.length) return null;
    if (vecs.some((v) => !Array.isArray(v) || v.length !== DIMENSION)) return null;
    return vecs;
  } catch (e) {
    console.warn("[Embeddings] fallo:", String((e && e.message) || e).slice(0, 160));
    return null;
  }
}

const aVectorSql = (v) => `[${v.join(",")}]`;
const cabeceras = (env) => ({ "Content-Type": "application/json", apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` });
const baseUrl = (env) => String(env.SUPABASE_URL || "").replace(/\/+$/, "");

export async function buscarCurriculoHibrido(env, { consulta, grado = null, area = null, limite = 8, signal } = {}) {
  if (!env || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const q = String(consulta || "").trim();
  if (!q) return null;
  const vecs = await generarEmbeddings(env, [q]);
  if (!vecs) return null;
  try {
    const res = await fetchConLimite(`${baseUrl(env)}/rest/v1/rpc/buscar_curriculo_hibrido`, {
      method: "POST",
      headers: cabeceras(env),
      body: JSON.stringify({ query_text: q, query_embedding: aVectorSql(vecs[0]), match_count: limite, filtro_grado: grado, filtro_area: area }),
      signal,
    }, 6000);
    if (!res.ok) return null;
    const filas = await res.json();
    return Array.isArray(filas) ? filas : null;
  } catch (e) {
    console.warn("[BusquedaHibrida] fallo:", String((e && e.message) || e).slice(0, 160));
    return null;
  }
}

// Indexa por lotes las filas de curriculo_secuencias que aún no tienen embedding.
// Se invoca desde una ruta /api/owner/* ya protegida con OWNER_MASTER_KEY (nunca pública).
export async function indexarEmbeddingsLote(env, { limite = 40 } = {}) {
  const h = cabeceras(env);
  const lim = Math.min(Math.max(Number(limite) || 40, 1), 100);
  const yaRes = await fetchConLimite(`${baseUrl(env)}/rest/v1/curriculo_embeddings?select=secuencia_id`, { headers: h }, 10000);
  const ya = new Set(yaRes.ok ? (await yaRes.json()).map((r) => String(r.secuencia_id)) : []);
  const secRes = await fetchConLimite(`${baseUrl(env)}/rest/v1/curriculo_secuencias?select=*&order=id&limit=2000`, { headers: h }, 15000);
  if (!secRes.ok) return { ok: false, motivo: `HTTP_${secRes.status}` };
  const pendientes = (await secRes.json()).filter((s) => !ya.has(String(s.id))).slice(0, lim);
  if (!pendientes.length) return { ok: true, indexadas: 0, pendientes: 0 };
  const textoDe = (s) => [s.area, s.grado_num != null ? `${s.grado_num}.° grado` : "", s.tema, s.titulo, s.competencias, s.indicadores, s.contenido].filter((x) => typeof x === "string" && x.trim()).join(" | ").slice(0, 1800);
  const textos = pendientes.map(textoDe);
  const vecs = await generarEmbeddings(env, textos);
  if (!vecs) return { ok: false, motivo: "EMBEDDINGS_NO_DISPONIBLES" };
  const filas = pendientes.map((s, i) => ({ secuencia_id: String(s.id), contenido: textos[i], embedding: aVectorSql(vecs[i]) }));
  const ins = await fetchConLimite(`${baseUrl(env)}/rest/v1/curriculo_embeddings`, { method: "POST", headers: { ...h, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(filas) }, 20000);
  if (!ins.ok) return { ok: false, motivo: `HTTP_${ins.status}` };
  return { ok: true, indexadas: filas.length, pendientes: Math.max(0, pendientes.length - filas.length) };
}
