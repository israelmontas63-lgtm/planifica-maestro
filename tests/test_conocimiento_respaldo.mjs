import test from "node:test";
import assert from "node:assert/strict";
import { marcarSinRespaldo, AVISO_SIN_RESPALDO } from "../worker/respaldoConocimiento.js";

test("1. Reemplaza referencias a documentos oficiales por sin respaldo y agrega aviso final", () => {
  const entrada = "Según el Diseño Curricular (Adecuación Curricular 2023, Área de Matemática, 3.º Grado), los contenidos y el enfoque son los siguientes:";
  const salida = marcarSinRespaldo(entrada);
  assert.ok(!salida.includes("Adecuación Curricular"), "No debe contener 'Adecuación Curricular'");
  assert.ok(!salida.includes("Diseño Curricular"), "No debe contener 'Diseño Curricular'");
  assert.ok(salida.includes("sin respaldo en los documentos oficiales indexados"), "Debe contener la marca de sin respaldo");
  assert.ok(salida.endsWith(AVISO_SIN_RESPALDO), "Debe terminar con el aviso sin respaldo");
});

test("2. Idempotencia: aplicar la función dos veces produce exactamente el mismo resultado", () => {
  const entrada = "Según el Diseño Curricular (Adecuación Curricular 2023, Área de Matemática, 3.º Grado), los contenidos y el enfoque son los siguientes:";
  const primera = marcarSinRespaldo(entrada);
  const segunda = marcarSinRespaldo(primera);
  assert.strictEqual(segunda, primera, "marcarSinRespaldo debe ser idempotente");
});

test("3. Cadena vacía y valores no string se devuelven sin cambios", () => {
  assert.strictEqual(marcarSinRespaldo(""), "");
  assert.strictEqual(marcarSinRespaldo("   "), "   ");
  assert.strictEqual(marcarSinRespaldo(null), null);
  assert.strictEqual(marcarSinRespaldo(undefined), undefined);
  assert.strictEqual(marcarSinRespaldo(123), 123);
  assert.deepStrictEqual(marcarSinRespaldo({}), {});
});

test("4. Un texto sin citas solo recibe el aviso final y lo anterior queda intacto", () => {
  const entrada = "Para enseñar la fotosíntesis, se recomienda utilizar experimentos sencillos con plantas y luz solar.";
  const salida = marcarSinRespaldo(entrada);
  assert.ok(salida.startsWith(entrada), "El texto inicial debe quedar intacto");
  assert.strictEqual(salida, `${entrada}\n\n${AVISO_SIN_RESPALDO}`, "Debe agregar únicamente el aviso final");
});
