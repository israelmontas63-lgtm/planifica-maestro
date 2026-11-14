"use strict";
// Ayudantes de fecha de Santo Domingo para el servidor (CommonJS).
// America/Santo_Domingo es UTC-4 permanente (sin horario de verano), por eso se usa un desfase fijo.
// Espejo de shared/resolvedorFechas.mjs: tests/test_fechaRD_paridad.mjs verifica que ambos den lo mismo.

const OFFSET_UTC_MS = 4 * 60 * 60 * 1000;

function fechaValida(f) {
  return f instanceof Date && !Number.isNaN(f.getTime());
}

function componentesLocales(ahora) {
  const l = new Date(ahora.getTime() - OFFSET_UTC_MS);
  return { y: l.getUTCFullYear(), m: l.getUTCMonth(), d: l.getUTCDate() };
}

// "YYYY-MM-DD" del calendario de Santo Domingo.
function fechaLocalRD(ahora = new Date()) {
  if (!fechaValida(ahora)) throw new TypeError("fechaLocalRD: fecha inválida");
  const { y, m, d } = componentesLocales(ahora);
  return `${String(y).padStart(4, "0")}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// ISO UTC de la próxima medianoche de Santo Domingo.
function inicioDiaSiguienteRD(ahora = new Date()) {
  if (!fechaValida(ahora)) throw new TypeError("inicioDiaSiguienteRD: fecha inválida");
  const { y, m, d } = componentesLocales(ahora);
  return new Date(Date.UTC(y, m, d + 1, 4, 0, 0, 0)).toISOString();
}

// ISO UTC del primer día del mes siguiente a las 00:00 de Santo Domingo.
function inicioMesSiguienteRD(ahora = new Date()) {
  if (!fechaValida(ahora)) throw new TypeError("inicioMesSiguienteRD: fecha inválida");
  const { y, m } = componentesLocales(ahora);
  return new Date(Date.UTC(y, m + 1, 1, 4, 0, 0, 0)).toISOString();
}

module.exports = { fechaLocalRD, inicioDiaSiguienteRD, inicioMesSiguienteRD };