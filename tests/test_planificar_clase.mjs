import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";

test("Ruta POST /api/planificar-clase", async (t) => {
  const mockEnv = {
    ACCESO_ABIERTO: "true",
    MODO_PRUEBA: "true",
    GEMINI_API_KEY: "mock_gemini_key",
    SUPABASE_URL: "https://mock.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "mock_key"
  };

  await t.test("acepta petición directa con grado, area y tema devolviendo status 200", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes("/rest/v1/rpc/")) {
        return new Response(JSON.stringify([{
          id: 1,
          grado: "2.º",
          area: "Matemática",
          tema: "La suma",
          secuencia: "Secuencia 1",
          coincide_tema: true,
          estado_validacion: "validado"
        }]), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
    };

    try {
      const req = new Request("https://planifica-maestro.test/api/planificar-clase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-id": "dev_test_planificar_clase"
        },
        body: JSON.stringify({
          grado: "2.º",
          area: "Matemática",
          tema: "La suma",
          docente: "Prof. Maria",
          centro: "Escuela Central",
          stream: false
        })
      });

      const res = await worker.fetch(req, mockEnv, {});
      assert.equal(res.status, 200, "Debe responder con HTTP 200");
      const json = await res.json();
      assert.ok(json, "Debe retornar un objeto JSON");
      assert.ok(json.mensaje_chat || json.plan || json.datos_planificacion, "Debe contener respuesta o plan");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
