import test from "node:test";
import assert from "node:assert/strict";
import { obtenerHoraSantoDomingo, obtenerFranjaSaludo, generarRespuestaCharlaLocal } from "../shared/modoConversacional.js";

test("C3 - 14:00 UTC (10:00 local Santo Domingo) -> Buenos días", () => {
  const fecha = new Date("2026-10-16T14:00:00.000Z");
  const hora = obtenerHoraSantoDomingo(fecha);
  const franja = obtenerFranjaSaludo(fecha);
  assert.equal(hora, 10, "14:00 UTC debe ser las 10:00 en Santo Domingo");
  assert.equal(franja, "manana", "10:00 debe corresponder a franja manana");

  const resp = generarRespuestaCharlaLocal({
    texto: "hola",
    nombreDocente: "Laura",
    fecha
  });
  assert.match(resp.mensaje_chat, /buenos d[ií]as/i, "Debe contener 'Buenos días'");
});

test("C3 - 19:00 UTC (15:00 local Santo Domingo) -> Buenas tardes", () => {
  const fecha = new Date("2026-10-16T19:00:00.000Z");
  const hora = obtenerHoraSantoDomingo(fecha);
  const franja = obtenerFranjaSaludo(fecha);
  assert.equal(hora, 15, "19:00 UTC debe ser las 15:00 en Santo Domingo");
  assert.equal(franja, "tarde", "15:00 debe corresponder a franja tarde");

  const resp = generarRespuestaCharlaLocal({
    texto: "hola",
    nombreDocente: "Laura",
    fecha
  });
  assert.match(resp.mensaje_chat, /buenas tardes/i, "Debe contener 'Buenas tardes'");
});

test("C3 - 20:06 UTC (16:06 local Santo Domingo) -> Buenas tardes (no Buenas noches)", () => {
  const fecha = new Date("2026-10-16T20:06:00.000Z");
  const hora = obtenerHoraSantoDomingo(fecha);
  const franja = obtenerFranjaSaludo(fecha);
  assert.equal(hora, 16, "20:06 UTC debe ser las 16:06 (hora 16) en Santo Domingo");
  assert.equal(franja, "tarde", "16:06 debe ser franja tarde (12:00-18:59)");

  const resp = generarRespuestaCharlaLocal({
    texto: "hola",
    nombreDocente: "Laura",
    reloj: () => fecha
  });
  assert.match(resp.mensaje_chat, /buenas tardes/i, "A las 4:06 p.m. local debe saludar 'Buenas tardes'");
  assert.doesNotMatch(resp.mensaje_chat, /buenas noches/i, "No debe decir Buenas noches a las 4:06 p.m.");
});

test("C3 - 01:00 UTC del día siguiente (21:00 local Santo Domingo) -> Buenas noches", () => {
  const fecha = new Date("2026-10-17T01:00:00.000Z");
  const hora = obtenerHoraSantoDomingo(fecha);
  const franja = obtenerFranjaSaludo(fecha);
  assert.equal(hora, 21, "01:00 UTC del día siguiente debe ser las 21:00 en Santo Domingo");
  assert.equal(franja, "noche", "21:00 debe corresponder a franja noche");

  const resp = generarRespuestaCharlaLocal({
    texto: "hola",
    nombreDocente: "Laura",
    fecha
  });
  assert.match(resp.mensaje_chat, /buenas noches/i, "Debe contener 'Buenas noches'");
});

test("C3 - Límites de franjas horarias: 05:00 (mañana), 12:00 (tarde), 19:00 (noche), 04:59 (noche)", () => {
  assert.equal(obtenerFranjaSaludo(new Date("2026-10-16T09:00:00.000Z")), "manana"); // 05:00 local
  assert.equal(obtenerFranjaSaludo(new Date("2026-10-16T15:59:00.000Z")), "manana"); // 11:59 local
  assert.equal(obtenerFranjaSaludo(new Date("2026-10-16T16:00:00.000Z")), "tarde");  // 12:00 local
  assert.equal(obtenerFranjaSaludo(new Date("2026-10-16T22:59:00.000Z")), "tarde");  // 18:59 local
  assert.equal(obtenerFranjaSaludo(new Date("2026-10-16T23:00:00.000Z")), "noche");  // 19:00 local
  assert.equal(obtenerFranjaSaludo(new Date("2026-10-16T08:59:00.000Z")), "noche");  // 04:59 local
});
