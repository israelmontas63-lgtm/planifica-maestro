/**
 * client/src/utils/parseadorJsonSeguro.js
 * Fachada de compatibilidad que reexporta desde shared/parseadorJsonSeguro.js
 */

export {
  extraerJson,
  extraerJson as extraerJsonFlexible,
  objetoDesde,
  mensajeParaChat,
  validarCamposPlanificacion,
  repararJsonTruncado,
  extraerBloquesCompletados,
  planEsRecuperable
} from "../../../shared/parseadorJsonSeguro.js";

