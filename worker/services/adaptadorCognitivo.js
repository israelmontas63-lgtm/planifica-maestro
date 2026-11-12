// worker/services/adaptadorCognitivo.js
// Adaptador productivo que conecta las herramientas reales de shared/herramientas.mjs
// con registroHerramientas.js y planificadorTareas.js (ejecutarCicloOperativo).

import { HANDLERS, validarArgs } from "../../shared/herramientas.mjs";
import { crearRegistroHerramientas, NIVEL_RIESGO } from "./registroHerramientas.js";
import {
  clasificarIntencionOperativa,
  crearPlanTareas,
  ejecutarCicloOperativo,
} from "./planificadorTareas.js";

export function resolverPermisosServidor({ isOwner = false, docenteId = "", env = null } = {}) {
  if (isOwner) {
    return ["*"];
  }
  if (!docenteId || String(docenteId).startsWith("dev_anon_")) {
    return ["docente", "curriculo"];
  }
  const base = ["docente", "curriculo", "investigacion"];
  if (env?.HABILITAR_ACCIONES_SISTEMA_DOCENTE === "true") {
    base.push("accion_sistema");
  }
  return base;
}

export function crearRegistroHerramientasProductivo({ env = {}, opciones = {} } = {}) {
  const registro = crearRegistroHerramientas();

  registro.registrar({
    nombre: "consultar_base_datos",
    descripcion: "Consulta fragmentos curriculares oficiales MINERD en Supabase.",
    permisos: ["curriculo"],
    nivelRiesgo: NIVEL_RIESGO.NIVEL_1_CONSULTA,
    efectosSecundarios: false,
    esquemaEntrada: { required: ["nivel", "grado", "area", "tema_o_concepto"] },
    criterioVerificacion: (res) => Boolean(res && !res.error && Array.isArray(res.resultado)),
    ejecutar: async (params) => {
      const errArgs = validarArgs(params);
      if (errArgs) throw new Error(errArgs);
      return await HANDLERS.consultar_base_datos(params, env, opciones);
    },
  });

  registro.registrar({
    nombre: "consultar_fuente_curricular",
    descripcion: "Busca normativa oficial en documentos curriculares MINERD específicos.",
    permisos: ["curriculo"],
    nivelRiesgo: NIVEL_RIESGO.NIVEL_1_CONSULTA,
    efectosSecundarios: false,
    esquemaEntrada: { required: ["fuente", "grado", "area", "termino"] },
    criterioVerificacion: (res) => Boolean(res && !res.error && Array.isArray(res.fragmentos)),
    ejecutar: async (params) => {
      return await HANDLERS.consultar_fuente_curricular(params, env, opciones);
    },
  });

  registro.registrar({
    nombre: "buscar_contexto_web",
    descripcion: "Búsqueda web educativa controlada (Tavily) para efemérides, calendario y normativa.",
    permisos: ["investigacion"],
    nivelRiesgo: NIVEL_RIESGO.NIVEL_1_CONSULTA,
    efectosSecundarios: false,
    esquemaEntrada: { required: ["consulta"] },
    criterioVerificacion: (res) => Boolean(res && !res.error),
    ejecutar: async (params) => {
      return await HANDLERS.buscar_contexto_web(params, env, opciones);
    },
  });

  registro.registrar({
    nombre: "accion_externa_nivel_3",
    descripcion: "Acción de impacto externo (Nivel 3) con autorización explícita e idempotencia.",
    permisos: ["accion_sistema"],
    nivelRiesgo: NIVEL_RIESGO.NIVEL_3_ACCION_CON_IMPACTO,
    efectosSecundarios: true,
    esquemaEntrada: { required: ["accion"] },
    criterioVerificacion: (res) => Boolean(res && res.ok === true),
    ejecutar: async (params) => {
      return {
        ok: true,
        accion: params.accion,
        parametros: params.parametros || {},
        verificado: true,
      };
    },
  });

  return registro;
}

function normalizarNivelLabel(nivel = "primario") {
  const n = String(nivel || "primario").toLowerCase();
  if (n.includes("ini")) return "Inicial";
  if (n.includes("sec")) return "Secundario";
  return "Primario";
}

function normalizarGradoOrdinal(grado) {
  const g = String(grado || "1").trim();
  const map = { "1": "1ro", "2": "2do", "3": "3ro", "4": "4to", "5": "5to", "6": "6to" };
  return map[g] || (/^(1ro|2do|3ro|4to|5to|6to)$/i.test(g) ? g : "1ro");
}

export function construirPlanOperativoSolicitud({
  solicitud,
  intencion,
  grado = "1ro",
  area = "Matemática",
  nivel = "Primario",
}) {
  const tareas = [];
  const nivelNorm = normalizarNivelLabel(nivel);
  const gradoNorm = normalizarGradoOrdinal(grado);
  const areaNorm = String(area || "General").trim();

  if (intencion.tipo === "ACCION_DISPOSITIVO") {
    tareas.push({
      id: "T1",
      objetivo: "Validar y preparar acción de impacto",
      dependencias: [],
      herramientaRequerida: "accion_externa_nivel_3",
      datosNecesarios: { accion: solicitud },
      nivelAutorizacion: NIVEL_RIESGO.NIVEL_3_ACCION_CON_IMPACTO,
      resultadoEsperado: "Acción autorizada y verificada",
    });
  } else {
    tareas.push({
      id: "T1",
      objetivo: "Consultar currículo oficial MINERD",
      dependencias: [],
      herramientaRequerida: "consultar_base_datos",
      idempotente: true,
      datosNecesarios: {
        nivel: nivelNorm,
        grado: gradoNorm,
        area: areaNorm,
        tema_o_concepto: String(solicitud || "").slice(0, 120),
      },
      nivelAutorizacion: NIVEL_RIESGO.NIVEL_1_CONSULTA,
      resultadoEsperado: "Fragmentos curriculares oficiales",
    });

    const requiereWeb = /(investiga|busca|internet|web|actual|efem[eé]rides|calendario|normativa)/i.test(solicitud);
    if (requiereWeb || intencion.tipo === "INVESTIGACION") {
      tareas.push({
        id: "T2",
        objetivo: "Investigar contexto educativo actualizado",
        dependencias: ["T1"],
        herramientaRequerida: "buscar_contexto_web",
        idempotente: true,
        datosNecesarios: { consulta: String(solicitud || "").slice(0, 180) },
        nivelAutorizacion: NIVEL_RIESGO.NIVEL_1_CONSULTA,
        resultadoEsperado: "Resultados web verificados",
      });
    }

    tareas.push({
      id: "T_CONSOLIDAR",
      objetivo: "Consolidar evidencia para generación",
      dependencias: [tareas[tareas.length - 1].id],
      herramientaRequerida: null,
      resultadoEsperado: "Contexto consolidado",
    });
  }

  return crearPlanTareas({
    objetivo: String(solicitud || "").slice(0, 200),
    tareas,
    presupuestoMs: 25000,
    maxIteraciones: 10,
  });
}

export async function ejecutarOrquestacionCognitivaSiAplica({
  solicitud = "",
  env = {},
  body = {},
  isOwner = false,
  docenteId = "",
  dispositivoId = "pwa",
  grado = "1ro",
  area = "General",
  nivel = "Primario",
  opciones = {},
  registroPersonalizado = null,
}) {
  const intencion = clasificarIntencionOperativa(solicitud);
  const forzarPlanificador = Boolean(body?.usarPlanificador || Array.isArray(body?.tareasPlan));

  if (!intencion.requierePlanificadorDAG && !forzarPlanificador) {
    return { activado: false, intencion };
  }

  const registro = registroPersonalizado || crearRegistroHerramientasProductivo({ env, opciones });
  const plan = Array.isArray(body?.tareasPlan)
    ? crearPlanTareas({ objetivo: solicitud, tareas: body.tareasPlan })
    : construirPlanOperativoSolicitud({ solicitud, intencion, grado, area, nivel });

  const permisosUsuario = resolverPermisosServidor({ isOwner, docenteId, env });
  const origenFuente = String(body?.origenFuente || "usuario");

  const resultadoCiclo = await ejecutarCicloOperativo({
    solicitud,
    plan,
    registroHerramientas: registro,
    contexto: {
      usuarioId: docenteId || "anonimo",
      usuarioAutenticado: Boolean(docenteId && docenteId !== "anonimo"),
      dispositivoId,
      permisosUsuario,
      origenFuente,
      autorizacionExplicitaUsuario: body?.autorizacionExplicitaUsuario === true,
      accionAutorizada: body?.accionAutorizada || undefined,
      claveIdempotencia: body?.claveIdempotencia || `req_${Date.now()}`,
    },
  });

  return {
    activado: true,
    intencion,
    resultadoCiclo,
    auditoriaHerramientas: registro.obtenerAuditoria(),
  };
}
