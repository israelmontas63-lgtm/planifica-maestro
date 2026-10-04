/**
 * server/ia/gestorGasto.js
 * Protección de presupuesto y control de gasto para la infraestructura de IA.
 * 
 * Reglas:
 * - Ningún proveedor de pago se activa sin autorización explícita.
 * - Límite diario de consultas configurable para prevenir consumos accidentales o abusos.
 */

const { cargarEstadoGasto, guardarEstadoGasto } = require("./persistenciaEstado.js");

const estadoInicial = cargarEstadoGasto();
let consultasHoy = typeof estadoInicial.consultasHoy === "number" ? estadoInicial.consultasHoy : (typeof estadoInicial.consultasRealizadas === "number" ? estadoInicial.consultasRealizadas : 0);
let fechaActual = estadoInicial.fecha || new Date().toISOString().substring(0, 10);

function comprobarYResetearDia() {
  const hoy = new Date().toISOString().substring(0, 10);
  if (hoy !== fechaActual) {
    fechaActual = hoy;
    consultasHoy = 0;
    guardarEstadoGasto({ fecha: fechaActual, consultasHoy });
  }
}

function puedeRealizarConsulta(limiteDiario = 500) {
  comprobarYResetearDia();
  return consultasHoy < limiteDiario;
}

function registrarConsultaRealizada() {
  comprobarYResetearDia();
  consultasHoy++;
  guardarEstadoGasto({ fecha: fechaActual, consultasHoy });
  return consultasHoy;
}

function obtenerEstadoGasto(limiteDiario = 500) {
  comprobarYResetearDia();
  return {
    fecha: fechaActual,
    consultasHoy,
    limiteDiario,
    restantes: Math.max(0, limiteDiario - consultasHoy),
    porcentajeConsumido: Math.round((consultasHoy / limiteDiario) * 100),
    bloqueadoPorPresupuesto: consultasHoy >= limiteDiario
  };
}

function reiniciarContadorParaPruebas(cantidad = 0) {
  consultasHoy = Number(cantidad) || 0;
  fechaActual = new Date().toISOString().substring(0, 10);
  guardarEstadoGasto({ fecha: fechaActual, consultasHoy });
}

module.exports = {
  puedeRealizarConsulta,
  registrarConsultaRealizada,
  obtenerEstadoGasto,
  reiniciarContadorParaPruebas
};
