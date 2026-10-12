/**
 * server/utils/parseadorJsonSeguro.js (CommonJS)
 * Fachada para Node.js re-exportando desde shared/parseadorJsonSeguro.js.
 */

const shared = require("../../shared/parseadorJsonSeguro.js");

module.exports = {
  objetoDesde: shared.objetoDesde,
  extraerJson: shared.extraerJson,
  mensajeParaChat: shared.mensajeParaChat,
  validarCamposPlanificacion: shared.validarCamposPlanificacion
};
