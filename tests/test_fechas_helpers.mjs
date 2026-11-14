import test from "node:test";
import assert from "node:assert/strict";
import { fechaLocalRD, inicioDiaSiguienteRD, inicioMesSiguienteRD } from "../shared/resolvedorFechas.mjs";

test("fechaLocalRD usa el calendario de Santo Domingo (UTC-4)", () => {
  // 22:00 locales del 12 de noviembre = 02:00Z del 13
  assert.equal(fechaLocalRD(new Date("2026-11-13T02:00:00.000Z")), "2026-11-12");
  // 01:00 locales del 13 de noviembre = 05:00Z del 13
  assert.equal(fechaLocalRD(new Date("2026-11-13T05:00:00.000Z")), "2026-11-13");
});

test("inicioDiaSiguienteRD devuelve la próxima medianoche local en ISO UTC", () => {
  assert.equal(inicioDiaSiguienteRD(new Date("2026-11-12T19:30:00.000Z")), "2026-11-13T04:00:00.000Z");
  assert.equal(inicioDiaSiguienteRD(new Date("2026-11-13T02:00:00.000Z")), "2026-11-13T04:00:00.000Z");
});

test("inicioMesSiguienteRD cruza el cambio de año", () => {
  assert.equal(inicioMesSiguienteRD(new Date("2026-11-12T19:30:00.000Z")), "2026-12-01T04:00:00.000Z");
  assert.equal(inicioMesSiguienteRD(new Date("2026-12-31T23:00:00.000Z")), "2027-01-01T04:00:00.000Z");
});

test("fecha inválida lanza TypeError", () => {
  assert.throws(() => fechaLocalRD(new Date("x")), TypeError);
});