import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import * as compartido from "../shared/resolvedorFechas.mjs";

const require = createRequire(import.meta.url);
const servidor = require("../server/utils/fechaRD.js");

const MUESTRAS = [
  "2026-01-01T00:00:00.000Z",
  "2026-03-15T03:59:59.999Z",
  "2026-03-15T04:00:00.000Z",
  "2026-11-12T19:30:00.000Z",
  "2026-11-13T02:00:00.000Z",
  "2026-12-31T23:00:00.000Z",
  "2027-01-01T03:59:59.999Z",
  "2028-02-29T12:00:00.000Z",
];

test("el helper del servidor da lo mismo que el módulo compartido", () => {
  for (const instante of MUESTRAS) {
    const f = new Date(instante);
    for (const nombre of ["fechaLocalRD", "inicioDiaSiguienteRD", "inicioMesSiguienteRD"]) {
      assert.equal(servidor[nombre](f), compartido[nombre](f), `${nombre} en ${instante}`);
    }
  }
});

test("fecha inválida lanza TypeError en el helper del servidor", () => {
  for (const nombre of ["fechaLocalRD", "inicioDiaSiguienteRD", "inicioMesSiguienteRD"]) {
    assert.throws(() => servidor[nombre](new Date("x")), TypeError);
  }
});