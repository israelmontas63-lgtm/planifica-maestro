/**
 * server/ia/modoConversacional.js
 * 
 * Fachada de compatibilidad hacia shared/modoConversacional.js.
 * Motor del Modo Conversacional y Respuestas Locales de Alta Variedad ($0, < 50 ms).
 * Maneja saludos, cortesía y conocimiento general con personalidad de colega pedagógico.
 */

const shared = require("../../shared/modoConversacional.js");

module.exports = {
  generarRespuestaCharlaLocal: shared.generarRespuestaCharlaLocal,
  SYSTEM_PROMPT_CONVERSACIONAL: shared.SYSTEM_PROMPT_CONVERSACIONAL,
  limpiarSaludoInnecesario: shared.limpiarSaludoInnecesario,
  obtenerHoraSantoDomingo: shared.obtenerHoraSantoDomingo,
  sanearNombreDocente: shared.sanearNombreDocente
};

