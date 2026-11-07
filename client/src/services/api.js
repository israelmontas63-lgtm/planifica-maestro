/**
 * Re-exportación para retrocompatibilidad total con componentes existentes.
 * El cliente oficial centralizado vive en client/src/api.js.
 */
export * from "../api.js";
export { planificarClaseCerebro, parsearMatrizPlanificacion } from "./planificacionCerebroService.js";
export { exportarDocxNativo } from "./exportadorDocxNativo.js";

