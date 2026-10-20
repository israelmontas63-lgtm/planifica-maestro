import { test } from "node:test";
import assert from "node:assert/strict";
import { clasificarPorReglas } from "../shared/clasificadorIntencion.js";
import { generarRespuestaCharlaLocal } from "../shared/modoConversacional.js";

test("1) Desahogo docente -> categoría charla con confianza >= 0.75", () => {
  const res = clasificarPorReglas("Estoy agotado, tengo tres grados en un aula y no me da tiempo");
  assert.equal(res.categoria, "charla");
  assert.ok(res.confianza >= 0.75, `Esperado confianza >= 0.75, obtenido: ${res.confianza}`);
});

test("2) generarRespuestaCharlaLocal con desahogo docente", () => {
  const res = generarRespuestaCharlaLocal({
    texto: "Estoy agotado, tengo tres grados en un aula y no me da tiempo",
    fecha: new Date("2026-10-20T11:00:00Z")
  });
  assert.ok(res.mensaje_chat, "Debe tener mensaje_chat");
  assert.ok(!res.mensaje_chat.includes("No identifiqué con claridad el tema escolar"), "No debe contener frase de tema no identificado");
  assert.ok(!/^(hola|buen)/i.test(res.mensaje_chat.trim()), "No debe empezar por Hola o Buen");
  assert.ok(res.mensaje_chat.includes("te entiendo"), "Debe incluir 'te entiendo'");
  assert.ok(Array.isArray(res.opciones) && res.opciones.length >= 2, "Debe ofrecer al menos 2 opciones");
});

test("3) Actividad de lectura para multigrado -> categoría planificación con confianza >= 0.75", () => {
  const res = clasificarPorReglas("Hazme una actividad de lectura para primero y segundo");
  assert.equal(res.categoria, "planificacion");
  assert.ok(res.confianza >= 0.75, `Esperado confianza >= 0.75, obtenido: ${res.confianza}`);
});

test("4) Casos de Control", () => {
  // Control a: "Hola" -> charla
  const c1 = clasificarPorReglas("Hola");
  assert.equal(c1.categoria, "charla");

  // Control b: "Hazme una planificación de Lengua Española para 2do grado" -> planificacion con confianza 0.98
  const c2 = clasificarPorReglas("Hazme una planificación de Lengua Española para 2do grado");
  assert.equal(c2.categoria, "planificacion");
  assert.equal(c2.confianza, 0.98);

  // Control c: "no me gustó el resultado" -> charla
  const c3 = clasificarPorReglas("no me gustó el resultado");
  assert.equal(c3.categoria, "charla");

  // Control d: "¿Qué competencias trabajo en Lengua Española?" -> consulta_curricular
  const c4 = clasificarPorReglas("¿Qué competencias trabajo en Lengua Española?");
  assert.equal(c4.categoria, "consulta_curricular");
});

test("5) Mensaje mixto de desahogo + planificación específica -> planificacion", () => {
  const res = clasificarPorReglas("Estoy agotado, hazme una planificación de matemática para 3er grado");
  assert.equal(res.categoria, "planificacion");
});
