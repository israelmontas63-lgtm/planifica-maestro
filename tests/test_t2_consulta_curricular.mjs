import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";

const env = {
  APP_ACCESS_KEY: "clave-institucional-test",
  RATE_LIMIT_DISPOSITIVO_DIARIO: "100"
};

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

  const res = await worker.fetch(req, env);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.modo, "consulta_curricular");
  assert.equal(data.categoria, "consulta_curricular");
  assert.equal(data.plan_completado, false);
  assert.equal(data.datos_planificacion, null);
  assert.match(data.mensaje_chat, /Consulta Curricular/i);
  assert.match(data.mensaje_chat, /Fuente:\s*[^(\r\n]+(?:\s*\(pág\.\s*\d+\))?/);
  assert.equal(Array.isArray(data.fragmentos), true);
  assert.ok(data.fragmentos.length > 0);
  assert.ok(data.fragmentos[0].fuente_documento || data.fragmentos[0].fuente);
});

test("R3.1 - Pedir 5to de Secundaria Lengua Española no devuelve bloques rotulados '4to de Primaria'", async () => {
  const req = new Request("http://localhost/api/plan/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-app-key": "clave-institucional-test",
      "x-docente-id": "docente_test_r3_secundaria"
    },
    body: JSON.stringify({
      confirmado: true,
      messages: [
        { role: "user", text: "¿Cuáles son los contenidos de Lengua Española para 5to de Secundaria?" }
      ]
    })
  });

  const res = await worker.fetch(req, env);
  assert.equal(res.status, 200);
  const data = await res.json();

  // No debe devolver bloques rotulados como 4to de Primaria
  assert.doesNotMatch(data.mensaje_chat, /4to\s+de\s+Primaria/i);
  assert.doesNotMatch(data.mensaje_chat, /4\.°\s+de\s+Primaria/i);
  assert.doesNotMatch(data.mensaje_chat, /4\.°\s+Grado/i);

  // Debe advertir la falta de secuencias de 5.° de Secundaria antes del contenido general
  assert.match(data.mensaje_chat, /No encontré secuencias específicas de 5\.\s*°\s*de\s*Secundaria/i);
});

test("R3.2 - El texto final no contiene ',.' ni duplicaciones de 'Documento:'", async () => {
  const req = new Request("http://localhost/api/plan/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-app-key": "clave-institucional-test",
      "x-docente-id": "docente_test_r3_puntuacion"
    },
    body: JSON.stringify({
      confirmado: true,
      messages: [
        { role: "user", text: "¿Cuáles son las competencias de matemática para 2do grado?" }
      ]
    })
  });

  const res = await worker.fetch(req, env);
  const data = await res.json();

  // Sin coma-punto ni puntuación inválida
  assert.equal(data.mensaje_chat.includes(",."), false, "El texto no debe contener ',.'");
  assert.equal(data.mensaje_chat.includes(".."), false, "El texto no debe contener '..'");

  // Sin duplicaciones de 'Documento:'
  const matchesDoc = data.mensaje_chat.match(/Documento:/gi) || [];
  assert.ok(matchesDoc.length <= 1, "No debe duplicar 'Documento:'");
});

test("R3.3 - La fuente queda formateada exactamente como 'Fuente: <documento> (pág. N)'", async () => {
  const req = new Request("http://localhost/api/plan/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-app-key": "clave-institucional-test",
      "x-docente-id": "docente_test_r3_fuente"
    },
    body: JSON.stringify({
      confirmado: true,
      messages: [
        { role: "user", text: "¿Cuáles son las competencias de lectura según el currículo oficial MINERD para 3er grado de primaria?" }
      ]
    })
  });

  const res = await worker.fetch(req, env);
  const data = await res.json();

  // Debe cumplir con el formato exacto Fuente: <documento> (pág. N)
  const regexFuenteExacta = /Fuente:\s*[^(\r\n]+\s*\(pág\.\s*\d+\)$/m;
  assert.match(data.mensaje_chat, regexFuenteExacta, "La fuente debe tener formato 'Fuente: <documento> (pág. N)'");
});
