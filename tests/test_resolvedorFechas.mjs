import test from "node:test";
import assert from "node:assert/strict";
import { resolverFechaRelativa, ZONA_HORARIA } from "../shared/resolvedorFechas.mjs";

// Jueves 12 de noviembre de 2026, 3:30 p. m. en Santo Domingo (UTC-4) = 19:30 UTC
const AHORA = new Date("2026-11-12T19:30:00.000Z");
const r = (texto, ahora = AHORA) => resolverFechaRelativa(texto, ahora);

function esperar(res, desde, hasta) {
  assert.equal(res.reconocida, true);
  assert.equal(res.desde, desde);
  assert.equal(res.hasta, hasta);
}

test("hoy, ayer y anteayer", () => {
  esperar(r("hoy"), "2026-11-12T04:00:00.000Z", "2026-11-13T04:00:00.000Z");
  esperar(r("la de ayer"), "2026-11-11T04:00:00.000Z", "2026-11-12T04:00:00.000Z");
  esperar(r("anteayer"), "2026-11-10T04:00:00.000Z", "2026-11-11T04:00:00.000Z");
  esperar(r("antes de ayer"), "2026-11-10T04:00:00.000Z", "2026-11-11T04:00:00.000Z");
});

test("zona horaria: cerca de la medianoche local", () => {
  // 22:00 locales del 12 de noviembre = 02:00Z del 13
  esperar(r("hoy", new Date("2026-11-13T02:00:00.000Z")), "2026-11-12T04:00:00.000Z", "2026-11-13T04:00:00.000Z");
  // 01:00 locales del 13 de noviembre = 05:00Z del 13
  esperar(r("hoy", new Date("2026-11-13T05:00:00.000Z")), "2026-11-13T04:00:00.000Z", "2026-11-14T04:00:00.000Z");
});

test("dia de la semana: el martes devuelve el mas reciente y una alternativa", () => {
  const res = r("Búscame la planificación del Martes");
  esperar(res, "2026-11-10T04:00:00.000Z", "2026-11-11T04:00:00.000Z");
  assert.equal(res.alternativas.length, 1);
  assert.equal(res.alternativas[0].desde, "2026-11-03T04:00:00.000Z");
  assert.equal(res.aproximado, false);
  assert.equal(res.zona, ZONA_HORARIA);
});

test("dia de la semana: acentos y mayusculas", () => {
  esperar(r("MIÉRCOLES"), "2026-11-11T04:00:00.000Z", "2026-11-12T04:00:00.000Z");
});

test("dia de la semana: hoy es jueves", () => {
  esperar(r("el jueves"), "2026-11-12T04:00:00.000Z", "2026-11-13T04:00:00.000Z");
  esperar(r("el jueves pasado"), "2026-11-05T04:00:00.000Z", "2026-11-06T04:00:00.000Z");
});

test("dia de la semana con semana pasada o esta semana", () => {
  esperar(r("el martes de la semana pasada"), "2026-11-03T04:00:00.000Z", "2026-11-04T04:00:00.000Z");
  const futuro = r("el viernes de esta semana");
  esperar(futuro, "2026-11-13T04:00:00.000Z", "2026-11-14T04:00:00.000Z");
  assert.equal(futuro.futuro, true);
});

test("hace N minutos u horas (ventana aproximada)", () => {
  const unaHora = r("la que hice hace una hora");
  esperar(unaHora, "2026-11-12T18:00:00.000Z", "2026-11-12T19:00:00.000Z");
  assert.equal(unaHora.aproximado, true);
  esperar(r("hace 2 horas"), "2026-11-12T16:30:00.000Z", "2026-11-12T18:30:00.000Z");
  esperar(r("hace media hora"), "2026-11-12T18:45:00.000Z", "2026-11-12T19:15:00.000Z");
  // el limite superior nunca pasa de "ahora"
  esperar(r("hace 5 minutos"), "2026-11-12T19:15:00.000Z", "2026-11-12T19:30:00.000Z");
});

test("hace N dias y semanas", () => {
  esperar(r("hace 3 dias"), "2026-11-09T04:00:00.000Z", "2026-11-10T04:00:00.000Z");
  esperar(r("hace un dia"), "2026-11-11T04:00:00.000Z", "2026-11-12T04:00:00.000Z");
  const semana = r("hace una semana");
  esperar(semana, "2026-11-04T04:00:00.000Z", "2026-11-07T04:00:00.000Z");
  assert.equal(semana.aproximado, true);
});

test("partes del dia de hoy", () => {
  esperar(r("esta mañana"), "2026-11-12T09:00:00.000Z", "2026-11-12T16:00:00.000Z");
  esperar(r("esta tarde"), "2026-11-12T16:00:00.000Z", "2026-11-12T23:00:00.000Z");
  esperar(r("esta noche"), "2026-11-12T23:00:00.000Z", "2026-11-13T04:00:00.000Z");
});

test("semanas y meses", () => {
  esperar(r("esta semana"), "2026-11-09T04:00:00.000Z", "2026-11-16T04:00:00.000Z");
  esperar(r("la semana pasada"), "2026-11-02T04:00:00.000Z", "2026-11-09T04:00:00.000Z");
  esperar(r("este mes"), "2026-11-01T04:00:00.000Z", "2026-12-01T04:00:00.000Z");
  esperar(r("el mes pasado"), "2026-10-01T04:00:00.000Z", "2026-11-01T04:00:00.000Z");
});

test("sin expresion temporal o entrada invalida: no inventa", () => {
  assert.equal(r("ciencias sociales de cuarto grado").reconocida, false);
  assert.equal(r("").reconocida, false);
  assert.equal(r(null).reconocida, false);
  assert.equal(r("hace cero horas").reconocida, false);
  assert.equal(r("hace 5000 horas").reconocida, false);
  assert.equal(resolverFechaRelativa("hoy", "no es fecha").reconocida, false);
});

test("es determinista", () => {
  assert.deepEqual(r("el martes"), r("el martes"));
});
