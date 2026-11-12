// worker/services/memoriaEpisodica.js
// Cliente fiable para robot_memoria_experiencias (@cf/baai/bge-m3, 1024 dimensiones).
// Valida dimensiones antes de enviar y comprueba siempre response.ok y códigos HTTP.

import { DIMENSION, generarEmbeddings } from "./busquedaSemantica.js";

export function esVectorValido1024(vector) {
  return Array.isArray(vector)
    && vector.length === DIMENSION
    && vector.every((v) => typeof v === "number" && Number.isFinite(v));
}

function clasificarErrorHttp(status, detalle = "") {
  if (status === 401 || status === 403) return "PERMISOS_O_AUTENTICACION";
  if (status === 400 || status === 422) {
    return /vector|dimension/i.test(detalle) ? "INCOMPATIBILIDAD_DIMENSIONES" : "DATOS_INVALIDOS";
  }
  if (status >= 500) return "ERROR_SERVIDOR_SUPABASE";
  return `HTTP_${status}`;
}

export async function consultarMemoriaEpisodica(env, consultaTexto, { umbral = 0.95, limite = 1 } = {}) {
  if (!env || !env.AI || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, motivo: "CONFIGURACION_INCOMPLETA", filas: [] };
  }
  const texto = String(consultaTexto || "").trim();
  if (!texto) return { ok: false, motivo: "CONSULTA_VACIA", filas: [] };

  try {
    const vecs = await generarEmbeddings(env, [texto]);
    if (!vecs || !esVectorValido1024(vecs[0])) {
      return { ok: false, motivo: "EMBEDDING_NO_DISPONIBLE_O_DIMENSION_INVALIDA", filas: [] };
    }

    const baseUrl = String(env.SUPABASE_URL).replace(/\/+$/, "");
    const res = await fetch(`${baseUrl}/rest/v1/rpc/consultar_memoria_robot`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        p_embedding: `[${vecs[0].join(",")}]`,
        p_umbral_similitud: umbral,
        p_limite: limite,
      }),
    });

    if (!res.ok) {
      const errTxt = (await res.text().catch(() => "")).slice(0, 200);
      const tipo = clasificarErrorHttp(res.status, errTxt);
      console.warn(`[MemoriaRobot] Error consulta (${res.status} ${tipo}): ${errTxt}`);
      return { ok: false, motivo: tipo, status: res.status, filas: [] };
    }

    const filas = await res.json();
    return { ok: true, filas: Array.isArray(filas) ? filas : [] };
  } catch (err) {
    console.warn("[MemoriaRobot] Error de red/parseo en consulta:", String(err?.message || err).slice(0, 160));
    return { ok: false, motivo: "ERROR_RED_O_PARSEO", filas: [] };
  }
}

export async function guardarExperienciaEpisodica(env, {
  docenteId,
  gradoNivel,
  areaCurricular,
  temaConsulta,
  datosPlanificacion,
  esValido,
}) {
  if (!esValido) {
    return { ok: false, motivo: "NO_VALIDADO_POR_AUDITOR" };
  }
  if (!env || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, motivo: "CONFIGURACION_INCOMPLETA" };
  }
  const tema = String(temaConsulta || "").trim();
  if (!tema || !datosPlanificacion) {
    return { ok: false, motivo: "DATOS_INCOMPLETOS" };
  }

  try {
    let vectorStr = null;
    if (env.AI) {
      const vecs = await generarEmbeddings(env, [tema]);
      if (!vecs || !esVectorValido1024(vecs[0])) {
        console.warn("[MemoriaRobot] Embedding inválido o no disponible al guardar; abortando persistencia sin vector válido.");
        return { ok: false, motivo: "EMBEDDING_NO_DISPONIBLE_O_DIMENSION_INVALIDA" };
      }
      vectorStr = `[${vecs[0].join(",")}]`;
    } else {
      return { ok: false, motivo: "WORKERS_AI_NO_DISPONIBLE" };
    }

    const baseUrl = String(env.SUPABASE_URL).replace(/\/+$/, "");
    const res = await fetch(`${baseUrl}/rest/v1/robot_memoria_experiencias`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        docente_id: docenteId || "Israel Montás",
        grado_nivel: String(gradoNivel || "Primario"),
        area_curricular: areaCurricular || "General",
        tema_consulta: tema,
        embedding: vectorStr,
        planificacion_salida: JSON.stringify(datosPlanificacion),
        calificacion_calidad: 5,
        validado_por_auditor: true,
      }),
    });

    if (!res.ok) {
      const errTxt = (await res.text().catch(() => "")).slice(0, 200);
      const tipo = clasificarErrorHttp(res.status, errTxt);
      console.warn(`[MemoriaRobot] Error inserción (${res.status} ${tipo}): ${errTxt}`);
      return { ok: false, motivo: tipo, status: res.status };
    }

    const insertado = await res.json().catch(() => null);
    const idInsertado = Array.isArray(insertado) && insertado[0]?.id ? insertado[0].id : null;
    return { ok: true, id: idInsertado };
  } catch (err) {
    console.warn("[MemoriaRobot] Error de red en inserción:", String(err?.message || err).slice(0, 160));
    return { ok: false, motivo: "ERROR_RED" };
  }
}
