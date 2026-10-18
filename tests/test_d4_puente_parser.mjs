import test from "node:test";
import assert from "node:assert/strict";
import * as puente from "../client/src/utils/parseadorJsonSeguro.js";

test("D4 - Puente client/src/utils/parseadorJsonSeguro.js exporta todos los símbolos requeridos sin ser undefined", () => {
  const simbolosEsperados = [
    "extraerJson",
    "extraerJsonFlexible",
    "objetoDesde",
    "mensajeParaChat",
    "validarCamposPlanificacion",
    "repararJsonTruncado",
    "extraerBloquesCompletados",
    "planEsRecuperable"
  ];

  for (const s of simbolosEsperados) {
    assert.ok(s in puente, `El símbolo '${s}' debe estar exportado por el puente`);
    assert.notEqual(puente[s], undefined, `El símbolo exportado '${s}' no puede ser undefined`);
    assert.equal(typeof puente[s], "function", `El símbolo '${s}' debe ser una función`);
  }

  // Verificar que extraerJsonFlexible es alias funcional de extraerJson
  assert.equal(puente.extraerJsonFlexible, puente.extraerJson, "extraerJsonFlexible debe ser idéntico a extraerJson");
});
