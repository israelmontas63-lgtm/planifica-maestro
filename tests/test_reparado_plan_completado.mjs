import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { extraerJson, repararJsonTruncado, validarCamposPlanificacion } from "../worker/parseadorJsonSeguro.js";

function esReparadoAceptable(fullText) {
  const reparado = repararJsonTruncado(fullText);
  return Boolean(reparado && validarCamposPlanificacion(reparado) && typeof reparado.plan_completado === "boolean");
}

const truncadoT2 = '{"mensaje_chat":"Interpreté «1ro» como «1.º».\\n\\n[AVISO] Borrador: revísalo con';
assert.equal(extraerJson(truncadoT2), null);
assert.equal(esReparadoAceptable(truncadoT2), false);

const truncadoConversacion = '{"plan_completado":false,"mensaje_chat":"¡Hola profe! ¿Para qué grado deseas planificar';
assert.equal(esReparadoAceptable(truncadoConversacion), true);

const indexCode = fs.readFileSync(path.resolve(process.cwd(), "worker/index.js"), "utf8");
assert.ok(indexCode.includes('typeof reparado.plan_completado === "boolean"'));
assert.ok(indexCode.includes('maxOutputTokens: construirMaxSalida(env)'));

console.log("✅ test_reparado_plan_completado: APROBADO");
