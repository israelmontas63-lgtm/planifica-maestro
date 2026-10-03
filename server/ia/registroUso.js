/**
 * server/ia/registroUso.js
 * Registro de telemetría transparente y anónima de proveedores de IA.
 * 
 * Reglas de Privacidad Estricta:
 * - NO guarda texto de prompts de maestros ni de estudiantes.
 * - NO guarda nombres de personas ni de escuelas.
 * - NO almacena imágenes ni archivos de audio.
 * - Registra exclusivamente metadatos operativos: proveedor, modelo, latencia, resultado y si fue respaldo.
 */

const MAX_HISTORIAL_REGISTROS = 100;
const registros = [];

function registrarLlamada({
  proveedorId,
  modelo,
  tipoOperacion = "texto",
  duracionMs,
  exito = true,
  codigoError = null,
  tipoFallo = null,
  esRespaldo = false,
  origen = "ia_generativa",
  tipoClasificado = null,
  fuenteUsada = null,
  metodoUsado = null,
  confianza = null
}) {
  const entrada = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    proveedorId: String(proveedorId || "desconocido"),
    modelo: String(modelo || "desconocido"),
    tipoOperacion,
    duracionMs: Number(duracionMs) || 0,
    exito: Boolean(exito),
    codigoError: codigoError ? String(codigoError) : null,
    tipoFallo: tipoFallo || undefined,
    esRespaldo: Boolean(esRespaldo),
    origen,
    tipoClasificado: tipoClasificado || undefined,
    fuenteUsada: fuenteUsada || undefined,
    metodoUsado: metodoUsado || undefined,
    confianza: typeof confianza === "number" ? Math.round(confianza * 100) / 100 : undefined
  };

  registros.unshift(entrada);
  if (registros.length > MAX_HISTORIAL_REGISTROS) {
    registros.pop();
  }

  return entrada;
}

function obtenerMetricas() {
  const total = registros.length;
  if (total === 0) {
    return {
      totalLlamadas: 0,
      tasaExito: 100,
      latenciaPromedioMs: 0,
      usosRespaldo: 0,
      ultimosRegistros: []
    };
  }

  const exitosas = registros.filter((r) => r.exito).length;
  const respaldos = registros.filter((r) => r.esRespaldo).length;
  const sumaLatencia = registros.reduce((acc, r) => acc + r.duracionMs, 0);

  return {
    totalLlamadas: total,
    tasaExito: Math.round((exitosas / total) * 100),
    latenciaPromedioMs: Math.round(sumaLatencia / total),
    usosRespaldo: respaldos,
    ultimosRegistros: registros.slice(0, 15)
  };
}

function limpiarMetricas() {
  registros.length = 0;
}

module.exports = {
  registrarLlamada,
  obtenerMetricas,
  limpiarMetricas
};
