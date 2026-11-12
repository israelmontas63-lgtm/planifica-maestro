// worker/services/planificadorTareas.js
// Motor de razonamiento operativo (ciclo estructurado en 11 etapas) y planificador
// de subtareas con dependencias (DAG), límites de iteración/tiempo y trazabilidad verificable.

export const ETAPAS_CICLO = Object.freeze([
  "PERCEPCION",
  "INTERPRETACION",
  "RECUPERACION_CONTEXTO",
  "PLANIFICACION",
  "SELECCION_HERRAMIENTAS",
  "AUTORIZACION",
  "EJECUCION",
  "OBSERVACION",
  "VERIFICACION",
  "MEMORIA",
  "RESPUESTA",
]);

export const ESTADOS_OPERATIVOS = Object.freeze({
  PLANIFICADA: "PLANIFICADA",
  EN_EJECUCION: "EN_EJECUCION",
  COMPLETADA: "COMPLETADA",
  COMPLETADA_CON_OBSERVACIONES: "COMPLETADA_CON_OBSERVACIONES",
  FALLIDA: "FALLIDA",
  PENDIENTE_DE_AUTORIZACION: "PENDIENTE_DE_AUTORIZACION",
});

export function clasificarIntencionOperativa(texto = "") {
  const q = String(texto || "").trim().toLowerCase();
  if (!q) return { tipo: "SOLICITUD_ACLARACION", requiereHerramientas: false, requierePlanificadorDAG: false };
  const esMultipaso = /(\by\s+luego\b|\bdespu[eé]s\b|\by\s+tambi[eé]n\b|\bpaso\s+a\s+paso\b|\binvestiga\b.*\by\b.*\bplanifica\b|\bbusca\b.*\by\b.*\bplanifica\b)/i.test(q);

  if (/(abre|abrir|ejecuta|envia|enviar|borra|eliminar|crea\s+un\s+archivo|dispositivo|windows|android)/i.test(q)) {
    return { tipo: "ACCION_DISPOSITIVO", requiereHerramientas: true, requierePlanificadorDAG: true };
  }
  if (/(word|docx|documento\s+word|exporta)/i.test(q) && /(planifica|planificacion|planificación|clase)/i.test(q)) {
    return { tipo: "GENERACION_PLANIFICACION", requiereHerramientas: true, incluyeDocumento: true, requierePlanificadorDAG: true };
  }
  if (/(planifica|planificacion|planificación|situaci[oó]n\s+de\s+aprendizaje|unidad)/i.test(q)) {
    return { tipo: "GENERACION_PLANIFICACION", requiereHerramientas: true, incluyeDocumento: false, requierePlanificadorDAG: esMultipaso };
  }
  if (/(investiga|busca\s+en\s+internet|fuentes\s+actuales|noticias|vigente)/i.test(q)) {
    return { tipo: "INVESTIGACION", requiereHerramientas: true, requierePlanificadorDAG: esMultipaso };
  }
  if (/(curriculo|currículo|indicador|competencia|minerd)/i.test(q)) {
    return { tipo: "CONSULTA_CURRICULAR", requiereHerramientas: true, requierePlanificadorDAG: esMultipaso };
  }
  if (/(recuerdas|memoria|mi\s+preferencia|sesion\s+anterior)/i.test(q)) {
    return { tipo: "RECUPERACION_MEMORIA", requiereHerramientas: true, requierePlanificadorDAG: esMultipaso };
  }
  if (/^\s*[\d+\-*/().\s=]+\s*$/.test(q)) {
    return { tipo: "CALCULO", requiereHerramientas: false, requierePlanificadorDAG: false };
  }
  return { tipo: "RESPUESTA_DIRECTA", requiereHerramientas: false, requierePlanificadorDAG: false };
}

export function crearPlanTareas({ objetivo, tareas = [], presupuestoMs = 30000, maxIteraciones = 12 }) {
  return {
    objetivo: String(objetivo || ""),
    presupuestoMs: Math.min(Math.max(Number(presupuestoMs) || 30000, 1000), 120000),
    maxIteraciones: Math.min(Math.max(Number(maxIteraciones) || 12, 1), 25),
    tareas: tareas.map((t, idx) => ({
      id: t.id || `T${idx + 1}`,
      objetivo: String(t.objetivo || ""),
      dependencias: Array.isArray(t.dependencias) ? t.dependencias : [],
      herramientaRequerida: t.herramientaRequerida || null,
      datosNecesarios: t.datosNecesarios || {},
      nivelAutorizacion: Number(t.nivelAutorizacion || 1),
      estado: "PENDIENTE",
      resultadoEsperado: String(t.resultadoEsperado || ""),
      criterioFinalizacion: typeof t.criterioFinalizacion === "function"
        ? t.criterioFinalizacion
        : (res) => Boolean(res && res.ok !== false),
      timeoutMs: Number(t.timeoutMs || 10000),
      resultado: null,
    })),
  };
}

export async function ejecutarCicloOperativo({
  solicitud,
  plan,
  registroHerramientas,
  contexto = {},
  recuperarContextoFn = null,
  guardarMemoriaFn = null,
}) {
  const tInicio = Date.now();
  const etapasRecorridas = [];
  const herramientasConsultadas = [];
  const verificacionesRealizadas = [];
  const limitaciones = [];

  // 1. PERCEPCIÓN & 2. INTERPRETACIÓN
  etapasRecorridas.push("PERCEPCION", "INTERPRETACION");
  const interpretacion = clasificarIntencionOperativa(solicitud);

  // 3. RECUPERACIÓN DE CONTEXTO
  etapasRecorridas.push("RECUPERACION_CONTEXTO");
  let contextoRecuperado = null;
  if (typeof recuperarContextoFn === "function") {
    try {
      contextoRecuperado = await recuperarContextoFn(solicitud, contexto);
    } catch (e) {
      limitaciones.push(`Contexto no recuperado: ${String(e?.message || e).slice(0, 100)}`);
    }
  }

  // 4. PLANIFICACIÓN & 5. SELECCIÓN DE HERRAMIENTAS
  etapasRecorridas.push("PLANIFICACION", "SELECCION_HERRAMIENTAS");
  const tareas = plan?.tareas || [];
  const completadas = new Set();
  let iteraciones = 0;
  let pendienteAutorizacion = null;
  let falloCritico = null;

  // Bucle DAG acotado por maxIteraciones y presupuestoMs (prohíbe ciclos infinitos)
  while (completadas.size < tareas.length) {
    iteraciones++;
    if (iteraciones > (plan?.maxIteraciones || 12)) {
      limitaciones.push("Se alcanzó el límite máximo de iteraciones del planificador.");
      break;
    }
    if (Date.now() - tInicio > (plan?.presupuestoMs || 30000)) {
      limitaciones.push("Se alcanzó el presupuesto máximo de tiempo de ejecución.");
      break;
    }

    const siguiente = tareas.find(
      (t) => t.estado === "PENDIENTE" && t.dependencias.every((dep) => completadas.has(dep))
    );
    if (!siguiente) {
      limitaciones.push("No hay tareas ejecutables por dependencias incumplidas o ciclo en el grafo.");
      break;
    }

    // 6. AUTORIZACIÓN & 7. EJECUCIÓN
    if (!etapasRecorridas.includes("AUTORIZACION")) etapasRecorridas.push("AUTORIZACION");
    if (!etapasRecorridas.includes("EJECUCION")) etapasRecorridas.push("EJECUCION");

    const paramsConContexto = {
      ...siguiente.datosNecesarios,
      _resultadosPrevios: Object.fromEntries(
        siguiente.dependencias.map((d) => [d, tareas.find((x) => x.id === d)?.resultado || null])
      ),
    };

    let resEjec = { ok: true, datos: { nota: "Paso analítico sin herramienta externa" } };
    if (siguiente.herramientaRequerida) {
      const intentosMax = siguiente.idempotente === true ? Math.min(Number(siguiente.reintentosMax || 1), 2) : 0;
      for (let intento = 0; intento <= intentosMax; intento++) {
        resEjec = await registroHerramientas.ejecutar(siguiente.herramientaRequerida, paramsConContexto, contexto);
        if (resEjec.ok || resEjec.requiereAutorizacion || ["PERMISO_DENEGADO", "USUARIO_NO_AUTENTICADO", "BLOQUEO_SEGURIDAD_INYECCION", "PARAMETROS_INVALIDOS", "HERRAMIENTA_DESHABILITADA", "HERRAMIENTA_NO_REGISTRADA"].includes(resEjec.codigo)) {
          break;
        }
      }
      herramientasConsultadas.push(siguiente.herramientaRequerida);
    }

    // 8. OBSERVACIÓN & 9. VERIFICACIÓN
    if (!etapasRecorridas.includes("OBSERVACION")) etapasRecorridas.push("OBSERVACION");
    if (!etapasRecorridas.includes("VERIFICACION")) etapasRecorridas.push("VERIFICACION");

    if (resEjec.requiereAutorizacion) {
      siguiente.estado = "ESPERANDO_AUTORIZACION";
      pendienteAutorizacion = resEjec;
      limitaciones.push(resEjec.mensaje);
      break;
    }

    const pasoVerificado = resEjec.ok && siguiente.criterioFinalizacion(resEjec);
    verificacionesRealizadas.push({
      tareaId: siguiente.id,
      ok: pasoVerificado,
      criterio: siguiente.resultadoEsperado || "Resultado válido",
    });

    if (!pasoVerificado) {
      siguiente.estado = "FALLIDA";
      siguiente.resultado = resEjec;
      falloCritico = resEjec.mensaje || `La tarea ${siguiente.id} no superó la verificación.`;
      limitaciones.push(falloCritico);
      break;
    }

    siguiente.estado = "COMPLETADA";
    siguiente.resultado = resEjec.datos;
    completadas.add(siguiente.id);
  }

  // 10. MEMORIA
  etapasRecorridas.push("MEMORIA");
  if (!falloCritico && !pendienteAutorizacion && typeof guardarMemoriaFn === "function") {
    try {
      await guardarMemoriaFn({ solicitud, completadas: Array.from(completadas), contexto });
    } catch (e) {
      limitaciones.push(`No se pudo consolidar memoria: ${String(e?.message || e).slice(0, 100)}`);
    }
  }

  // 11. RESPUESTA
  etapasRecorridas.push("RESPUESTA");

  const okFinal = !falloCritico && !pendienteAutorizacion && completadas.size === tareas.length;
  let estadoOperativo = ESTADOS_OPERATIVOS.COMPLETADA;
  if (pendienteAutorizacion) {
    estadoOperativo = ESTADOS_OPERATIVOS.PENDIENTE_DE_AUTORIZACION;
  } else if (!okFinal) {
    estadoOperativo = ESTADOS_OPERATIVOS.FALLIDA;
  } else if (limitaciones.length > 0) {
    estadoOperativo = ESTADOS_OPERATIVOS.COMPLETADA_CON_OBSERVACIONES;
  }

  return {
    ok: okFinal,
    estadoOperativo,
    requiereAutorizacion: Boolean(pendienteAutorizacion),
    detalleAutorizacion: pendienteAutorizacion,
    etapasRecorridas,
    trazabilidad: {
      objetivoEntendido: plan?.objetivo || interpretacion.tipo,
      informacionUtilizada: contextoRecuperado ? "Contexto recuperado + parámetros" : "Parámetros de solicitud",
      herramientasConsultadas,
      verificacionesRealizadas,
      resultadoConseguido: completadas.size === tareas.length && !falloCritico
        ? `Completadas ${completadas.size}/${tareas.length} tareas verificadas.`
        : `Detenido (${completadas.size}/${tareas.length} completadas).`,
      limitaciones,
    },
    tareas: tareas.map(({ criterioFinalizacion, ...rest }) => rest),
  };
}
