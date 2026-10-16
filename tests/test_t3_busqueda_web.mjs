import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";

test("T3 - Búsqueda web sin clave devuelve error cerrado IA_NO_DISPONIBLE sin planificar", async () => {
  const req = new Request("http://localhost/api/plan/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-app-key": "clave-institucional-test",
      "x-docente-id": "docente_test_t3"
    },
    body: JSON.stringify({
      confirmado: true,
      messages: [
        { role: "user", text: "busca en internet noticias educativas recientes sobre república dominicana" }
      ]
    })
  });

  const env = {
    APP_ACCESS_KEY: "clave-institucional-test",
    RATE_LIMIT_DISPOSITIVO_DIARIO: "100"
    // Sin TAVILY_API_KEY
  };

  const res = await worker.fetch(req, env);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.ok, false);
  assert.equal(data.isError, true);
  assert.equal(data.codigoError, "IA_NO_DISPONIBLE");
  assert.equal(data.plan_completado, false);
  assert.match(data.mensaje, /búsqueda web/i);
});

test("T3 - Búsqueda web con fallo de red en Tavily devuelve error cerrado IA_NO_DISPONIBLE", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes("api.tavily.com")) {
      throw new Error("Conexión rechazada al proveedor de búsqueda");
    }
    return originalFetch(url, opts);
  };

  try {
    const req = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-key": "clave-institucional-test",
        "x-docente-id": "docente_test_t3"
      },
      body: JSON.stringify({
        confirmado: true,
        messages: [
          { role: "user", text: "busca en internet noticias educativas recientes sobre república dominicana" }
        ]
      })
    });

    const env = {
      APP_ACCESS_KEY: "clave-institucional-test",
      RATE_LIMIT_DISPOSITIVO_DIARIO: "100",
      TAVILY_API_KEY: "tavily-clave-falsa"
    };

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.ok, false);
    assert.equal(data.isError, true);
    assert.equal(data.codigoError, "IA_NO_DISPONIBLE");
    assert.equal(data.plan_completado, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
