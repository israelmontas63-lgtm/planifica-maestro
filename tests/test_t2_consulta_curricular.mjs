import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";

test("T2 - Consulta curricular oficial devuelve fuente y modo consulta_curricular sin caer en planificacion", async () => {
  const req = new Request("http://localhost/api/plan/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-app-key": "clave-institucional-test",
      "x-docente-id": "docente_test_t2"
    },
    body: JSON.stringify({
      confirmado: true,
      messages: [
        { role: "user", text: "¿Cuáles son las competencias fundamentales según el currículo oficial MINERD para 2do grado?" }
      ]
    })
  });

  const env = {
    APP_ACCESS_KEY: "clave-institucional-test",
    RATE_LIMIT_DISPOSITIVO_DIARIO: "100"
  };

  const res = await worker.fetch(req, env);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.modo, "consulta_curricular");
  assert.equal(data.categoria, "consulta_curricular");
  assert.equal(data.plan_completado, false);
  assert.equal(data.datos_planificacion, null);
  assert.match(data.mensaje_chat, /Consulta Curricular/i);
  assert.match(data.mensaje_chat, /Fuente Oficial:/i);
  assert.equal(Array.isArray(data.fragmentos), true);
  assert.ok(data.fragmentos.length > 0);
  assert.ok(data.fragmentos[0].fuente_documento || data.fragmentos[0].fuente);
});
