import test from "node:test";
import assert from "node:assert/strict";
import { verificarSupabase } from "../scripts/verificar_supabase.mjs";

test("F1 - Contrato de RPC buscar_curriculo_secuencias y verificación mockeada", async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async (url, opts) => {
      const urlStr = String(url);
      // Ping
      if (urlStr.endsWith("/rest/v1/")) {
        return new Response(JSON.stringify({ swagger: "2.0" }), { status: 200 });
      }
      // RPC
      if (urlStr.includes("/rpc/buscar_curriculo_secuencias")) {
        const body = JSON.parse(opts.body || "{}");
        assert.equal(body.p_nivel, "Primario");
        assert.equal(body.p_grado, 2);
        assert.equal(body.p_area, "Lengua Española");

        return new Response(JSON.stringify([
          {
            source_id: "SEC-PRI-2-ESP-001",
            tema: "La Noticia",
            grado_num: 2,
            area: "Lengua Española",
            competencias_especificas: "Comprende noticias sencillas.",
            indicadores_logro: ["Identifica el hecho ocurrido."],
            fuente_documento: "Adecuación Curricular Nivel Primario (MINERD)",
            pagina: "75",
            coincide_tema: true,
            relevancia: 1.0
          }
        ]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response("Not found", { status: 404 });
    };

    const res = await verificarSupabase({
      urlOverride: "https://mock-supabase.test.co",
      keyOverride: "mock-anon-key"
    });

    assert.equal(res.ok, true, "La verificación debe resultar OK con datos válidos");
    assert.equal(res.conexionOk, true);
    assert.equal(res.rpcOk, true);
    assert.equal(res.registrosCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
