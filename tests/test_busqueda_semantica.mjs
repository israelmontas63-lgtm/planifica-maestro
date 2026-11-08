import test from "node:test"; import assert from "node:assert/strict";
import { generarEmbeddings, buscarCurriculoHibrido, indexarEmbeddingsLote, DIMENSION } from "../worker/services/busquedaSemantica.js";
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
const vec = () => Array.from({ length: DIMENSION }, (_, i) => i / DIMENSION);
const AI = { run: async (m, { text }) => ({ data: text.map(vec) }) };
const original = globalThis.fetch; let ll = [];
const sim = (fn) => { ll = []; globalThis.fetch = async (u, o = {}) => { ll.push({ u: String(u), o }); return fn(String(u), o); }; };
test.afterEach(() => { globalThis.fetch = original; });
const env = { AI, SUPABASE_URL: "https://x.supabase.co/", SUPABASE_SERVICE_ROLE_KEY: "srv" };
test("sin binding AI no hay embeddings", async () => { assert.equal(await generarEmbeddings({}, ["x"]), null); });
test("devuelve un vector por texto y rechaza dimensión incorrecta", async () => { assert.equal((await generarEmbeddings({ AI }, ["a", "b"])).length, 2); assert.equal(await generarEmbeddings({ AI: { run: async () => ({ data: [[1, 2]] }) } }, ["a"]), null); });
test("búsqueda híbrida llama a la función RPC con filtros", async () => { sim(() => J([{ secuencia_id: "1", score: 0.03 }])); const r = await buscarCurriculoHibrido(env, { consulta: "fracciones", grado: 3, area: "Matemática" }); assert.equal(r.length, 1); const b = JSON.parse(ll[0].o.body); assert.equal(b.filtro_grado, 3); assert.ok(b.query_embedding.startsWith("[")); assert.ok(ll[0].u.endsWith("/rest/v1/rpc/buscar_curriculo_hibrido")); });
test("si Supabase falla devuelve null y no rompe el flujo", async () => { sim(() => J({}, 500)); assert.equal(await buscarCurriculoHibrido(env, { consulta: "x" }), null); });
test("el indexado omite lo ya indexado", async () => { sim((u, o) => u.includes("curriculo_embeddings") && !o.method ? J([{ secuencia_id: "1" }]) : u.includes("curriculo_secuencias") ? J([{ id: 1, tema: "a" }, { id: 2, tema: "b", area: "Matemática", grado_num: 2 }, { id: 3, tema: "c" }]) : J({}, 201)); const r = await indexarEmbeddingsLote(env, { limite: 10 }); assert.equal(r.indexadas, 2); assert.deepEqual(JSON.parse(ll.at(-1).o.body).map((f) => f.secuencia_id), ["2", "3"]); });
test("indexarEmbeddingsLote incluye competencias_especificas, contenidos_texto_original e indicadores_logro en el texto indexado", async () => {
  sim((u, o) => {
    if (u.includes("curriculo_embeddings") && !o.method) return J([]);
    if (u.includes("curriculo_secuencias")) {
      return J([{
        id: "sec-10",
        area: "Lengua Española",
        grado_num: 2,
        tema: "La Noticia",
        bloque_guia: "Bloque 1",
        competencias_especificas: "Comunica noticias orales y escritas",
        contenidos_texto_original: "Estructura de la noticia: titular, cuerpo",
        indicadores_logro: ["Identifica la noticia", "Escribe titulares"]
      }]);
    }
    return J({}, 201);
  });
  const res = await indexarEmbeddingsLote(env, { limite: 5 });
  assert.equal(res.ok, true);
  assert.equal(res.indexadas, 1);
  const payloadIns = JSON.parse(ll.at(-1).o.body);
  assert.equal(payloadIns[0].secuencia_id, "sec-10");
  assert.ok(payloadIns[0].contenido.includes("Comunica noticias orales y escritas"));
  assert.ok(payloadIns[0].contenido.includes("Estructura de la noticia"));
  assert.ok(payloadIns[0].contenido.includes("Identifica la noticia Escribe titulares"));
});
