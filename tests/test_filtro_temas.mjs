import test from "node:test"; import assert from "node:assert/strict";
import { esTemaValido, filtrarTemas } from "../worker/filtroTemas.js";
test("fragmento suelto inválido", () => { assert.equal(esTemaValido("naturales como mínimo"), false); });
test("títulos válidos, incluso cortos", () => { for (const t of ["Secuencia 1: Conteo, organizacion y representacion de numeros","El cuento","Fracciones","La célula","Los seres vivos"]) assert.equal(esTemaValido(t), true, t); });
test("no-strings e inválidos", () => { for (const t of [null, undefined, 5, "", "  ", "ab"]) assert.equal(esTemaValido(t), false); });
test("filtrarTemas quita fragmentos y duplicados, conserva orden", () => { assert.deepEqual(filtrarTemas(["Secuencia 1: Conteo","naturales como mínimo","Secuencia 1: Conteo","El cuento"]), ["Secuencia 1: Conteo","El cuento"]); });
test("filtrarTemas con entrada no-array", () => { assert.deepEqual(filtrarTemas(null), []); });
