import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";

const CODIGOS_CERRADOS = [
  "IA_RESPUESTA_INVALIDA",
  "DATOS_INCOMPLETOS",
  "IA_NO_DISPONIBLE",
  "PROVEEDOR_IA_SATURADO",
  "CUOTA_DIARIA_AGOTADA",
  "ERROR_INTERNO"
];

test("T7 - Error con código desconocido en historial se mapea a ERROR_INTERNO", async () => {
  const req = new Request("http://localhost/api/plan/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-app-key": "clave-institucional-test",
      "x-docente-id": "docente_test_t7"
    },
    body: JSON.stringify({
      messages: [
        { role: "assistant", isError: true, codigoError: "CODIGO_DESCONOCIDO_EXTERNO_999", mensaje: "Fallo raro" },
        { role: "user", text: "¿Por qué no puedes?" }
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
  assert.equal(data.ok, false);
  assert.equal(data.isError, true);
  assert.equal(data.codigoError, "ERROR_INTERNO");
  assert.ok(CODIGOS_CERRADOS.includes(data.codigoError));
});

test("T7 - Los 6 códigos cerrados permitidos se preservan", async () => {
  for (const cod of CODIGOS_CERRADOS) {
    const req = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-key": "clave-institucional-test",
        "x-docente-id": "docente_test_t7_loop"
      },
      body: JSON.stringify({
        messages: [
          { role: "assistant", isError: true, codigoError: cod, mensaje: "Mensaje previo" },
          { role: "user", text: "¿Por qué falló?" }
        ]
      })
    });

    const env = {
      APP_ACCESS_KEY: "clave-institucional-test",
      RATE_LIMIT_DISPOSITIVO_DIARIO: "100"
    };

    const res = await worker.fetch(req, env);
    const data = await res.json();
    assert.equal(data.isError, true);
    assert.equal(data.codigoError, cod);
  }
});
