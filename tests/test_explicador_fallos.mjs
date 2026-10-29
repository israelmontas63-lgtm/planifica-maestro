import test from "node:test";
import assert from "node:assert/strict";
import { explicarFallo, clasificarFallo, limpiarDetalle, CODIGOS_FALLO } from "../shared/explicadorFallos.js";

const PROHIBIDAS = /int[eé]ntalo|intenta (de nuevo|nuevamente)|m[aá]s tarde|tuve dificultades/i;

test("Ningún código produce frases genéricas y todos dicen motivo y qué falta", () => {
  for (const codigo of CODIGOS_FALLO) {
    const r = explicarFallo({ codigo });
    assert.equal(r.error, true);
    assert.ok(r.motivo.length > 20, codigo);
    assert.ok(r.queFalta.length > 5, codigo);
    assert.ok(!PROHIBIDAS.test(r.textoUsuario), codigo);
  }
});
test("Código desconocido cae en ERROR_INTERNO con explicación", () => {
  const r = explicarFallo({ codigo: "XYZ" });
  assert.equal(r.codigoError, "ERROR_INTERNO");
  assert.ok(!PROHIBIDAS.test(r.textoUsuario));
});
test("Conflicto área/tema ofrece 2 opciones tocables con mensaje listo para enviar", () => {
  const r = explicarFallo({ codigo: "CONFLICTO_AREA_TEMA", datos: { areaPedida: "Ciencias Sociales", areaDelTema: "Matemática", tema: "matemática", grado: "2.º" } });
  assert.equal(r.opciones.length, 2);
  assert.match(r.motivo, /Ciencias Sociales/);
  assert.match(r.motivo, /Matemática/);
  assert.ok(r.opciones.every((o) => o.texto && o.mensaje));
});
test("Tema sin datos ofrece temas cercanos como opciones", () => {
  const r = explicarFallo({ codigo: "CURRICULO_SIN_DATOS", datos: { tema: "dinosaurios cuánticos", area: "Ciencias Naturales", grado: "2.º", cercanos: ["Los seres vivos", "El cuerpo humano"] } });
  assert.equal(r.opciones.length, 2);
  assert.match(r.motivo, /dinosaurios cuánticos/);
});
test("Red: distingue sin internet de servidor caído", () => {
  assert.match(explicarFallo({ codigo: "SERVIDOR_NO_RESPONDE", datos: { sinInternet: true } }).motivo, /internet/);
  assert.match(explicarFallo({ codigo: "SERVIDOR_NO_RESPONDE" }).motivo, /caído o saturado/);
});
test("limpiarDetalle oculta claves", () => {
  const out = limpiarDetalle("fallo con key=AIzaSyA1234567890abcdefghijklmnopqrstu y Bearer abcdefghijklmnopqrstuvwxyz0123456789");
  assert.ok(!/AIzaSy/.test(out));
  assert.ok(!/abcdefghijklmnopqrstuvwxyz0123456789/.test(out));
});
test("clasificarFallo mapea causas reales", () => {
  assert.equal(clasificarFallo({ mensaje: "API key should be set when using the Gemini API." }), "SIN_CLAVE_IA");
  assert.equal(clasificarFallo({ status: 429 }), "CUOTA_IA_AGOTADA");
  assert.equal(clasificarFallo({ status: 503 }), "PROVEEDOR_IA_SATURADO");
  assert.equal(clasificarFallo({ nombre: "AbortError" }), "PROVEEDOR_IA_SATURADO");
  assert.equal(clasificarFallo({ mensaje: "Unexpected token in JSON" }), "IA_RESPUESTA_INVALIDA");
  assert.equal(clasificarFallo({ mensaje: "relation curriculo_secuencias does not exist" }), "CURRICULO_NO_CONECTADO");
  assert.equal(clasificarFallo({}), "ERROR_INTERNO");
});
