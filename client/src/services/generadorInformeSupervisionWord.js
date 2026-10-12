/**
 * client/src/services/generadorInformeSupervisionWord.js
 * Generador y descargador en cliente del Informe Oficial de Acompañamiento y Supervisión Pedagógica MINERD.
 * 
 * Utiliza el constructor canónico de shared/construirInformeSupervisionDocx.js y docx ^9.7.1.
 */

import { Packer } from "docx";
import { construirDocumentoInformeSupervision } from "../../../shared/construirInformeSupervisionDocx.js";

/**
 * Genera el documento Word y desencadena la descarga en el navegador.
 * 
 * @param {Object} params
 * @param {Object} params.escuelaInfo - Datos del centro escolar
 * @param {Array} params.planes - Lista de planificaciones del centro
 * @param {Array} params.revisiones - Historial de revisiones pedagógicas
 * @param {string} [params.periodoMes] - Mes del informe (ej: "Octubre 2026")
 * @param {string} [params.coordinadorNombre] - Nombre del coordinador o supervisor
 * @param {string} [params.directorNombre] - Nombre del director/a del centro
 * @param {string} [params.anioLectivo] - Año escolar (ej: "2026-2027")
 * @returns {Promise<boolean>}
 */
export async function descargarInformeSupervisionWord({
  escuelaInfo = {},
  planes = [],
  revisiones = [],
  periodoMes,
  coordinadorNombre,
  directorNombre,
  anioLectivo = "2026-2027"
} = {}) {
  // Determinar mes actual formateado en español si no se suministra
  const mesActual = periodoMes || new Intl.DateTimeFormat("es-DO", {
    month: "long",
    year: "numeric"
  }).format(new Date());

  // Capitalizar primera letra del mes
  const periodoFormateado = mesActual.charAt(0).toUpperCase() + mesActual.slice(1);

  const doc = construirDocumentoInformeSupervision({
    escuelaInfo,
    planes,
    revisiones,
    periodoMes: periodoFormateado,
    coordinadorNombre: coordinadorNombre || "Coordinador/a Pedagógico/a",
    directorNombre: directorNombre || "Director/a del Centro Educativo",
    anioLectivo
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;

  const escuelaLimpia = (escuelaInfo.nombre || "Centro_Educativo")
    .replace(/[^\w\d\sáéíóúÁÉÍÓÚñÑ_-]/g, "")
    .trim()
    .replace(/\s+/g, "_");

  const mesLimpio = periodoFormateado.replace(/\s+/g, "_");
  a.download = `Informe_Supervision_MINERD_${escuelaLimpia}_${mesLimpio}.docx`;

  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  return true;
}
