import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const code = fs.readFileSync(path.resolve(process.cwd(), "worker/index.js"), "utf8");
const fijos = [...code.matchAll(/maxOutputTokens:\s*8192/g)];
assert.equal(fijos.length, 0, `Quedan ${fijos.length} llamadas con maxOutputTokens fijo en 8192`);

const conPresupuesto = [...code.matchAll(/maxOutputTokens:\s*construirMaxSalida\(env\)/g)];
assert.ok(
  conPresupuesto.length >= 5,
  `Las 5 llamadas JSON de planificación deben usar construirMaxSalida(env); encontradas: ${conPresupuesto.length}`
);

const conPensamiento = [...code.matchAll(/maxOutputTokens:\s*construirMaxSalida\(env\),\s*\.\.\.construirThinkingConfig\(env\)/g)];
assert.equal(
  conPensamiento.length,
  conPresupuesto.length,
  "Cada construirMaxSalida(env) debe ir con ...construirThinkingConfig(env)"
);

console.log("✅ test_bloque9_presupuesto_reintentos: OK");
