import test from "node:test";
import assert from "node:assert/strict";
import { explicarFallo, clasificarFallo, limpiarDetalle, CODIGOS_FALLO, describirCapacidades, esPreguntaAutodiagnostico } from "../shared/explicadorFallos.js";

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

test("Conflicto: un tema que es nombre de área se explica como área y el grado sale como 2.º", () => {
  const r = explicarFallo({ codigo: "CONFLICTO_AREA_TEMA", datos: { areaPedida: "Ciencias Sociales", areaDelTema: "Matemática", tema: "matemática", grado: "2" } });
  assert.match(r.motivo, /es un área, no un tema/);
  assert.ok(!/pertenece a Matem/.test(r.motivo));
  assert.ok(r.opciones.length === 2 && r.opciones.every((o) => /2\.º/.test(o.mensaje)));
});
test("Datos incompletos: sin texto duplicado y con 6 botones de grado", () => {
  const r = explicarFallo({ codigo: "DATOS_INCOMPLETOS", datos: { faltantes: ["grado"], area: "Matemática", tema: "suma" } });
  assert.equal(r.opciones.length, 6);
  assert.ok(!/Falta: /.test(r.textoUsuario));
  assert.match(r.opciones[1].mensaje, /2\.º tema suma/);
});
test("describirCapacidades dice qué componente falla", () => {
  assert.match(describirCapacidades([{ componente: "Base de datos (Supabase)", estado: "falla", detalle: "sin respuesta" }]), /Supabase.*sin respuesta/);
  assert.match(describirCapacidades([{ componente: "Servicio de IA", estado: "ok", detalle: "" }]), /todos responden bien/);
});

test("Autodiagnóstico: detecta preguntas dirigidas al robot", () => {
  for (const q of ["Por qué no puedes hacer la planificación", "¿Por qué no pudiste?", "por qué falló", "Qué te pasó", "¿Qué pasó con mi planificación?", "Por qué no funciona"]) {
    assert.equal(esPreguntaAutodiagnostico(q), true, q);
  }
});
test("Autodiagnóstico: NO se activa con preguntas pedagógicas normales", () => {
  for (const q of ["¿Qué tienes sobre fracciones en 3.º?", "¿Qué pasó el 27 de febrero de 1844?", "Quiero la planificación de ciencias sociales de 2.º tema la familia", "Por qué no planificamos el tema del agua para la próxima semana en el aula", "hola"]) {
    assert.equal(esPreguntaAutodiagnostico(q), false, q);
  }
});

