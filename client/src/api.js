import { obtenerDocenteId } from "./services/perfilStorage.js";
import { extraerJson, mensajeParaChat, validarCamposPlanificacion } from "./utils/parseadorJsonSeguro.js";

/**
 * Cliente único y centralizado de API para Planifica Maestro.
 * Soporta:
 * - Base URL configurable (VITE_API_URL o mismo origen relativo)
 * - Timeouts configurables con AbortSignal
 * - Reintentos automáticos en fallos transitorios de red
 * - Mensajes amigables y categorización de errores para la UI
 * - Streaming en tiempo real vía Server-Sent Events (SSE)
 * - Exportación docx 100% en cliente sin consumir CPU del servidor
 */

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor({ message, friendlyMessage, type, status, cuota, canRetry = true, raw }) {
    super(message || friendlyMessage);
    this.name = "ApiError";
    this.friendlyMessage = friendlyMessage || message;
    this.type = type || "UNKNOWN"; // OFFLINE | TIMEOUT | QUOTA | SERVER | AUTH | CLIENT
    this.status = status || 0;
    this.cuota = cuota || null;
    this.canRetry = canRetry;
    this.raw = raw || null;
  }
}

export function obtenerOwnerKey() {
  try {
    return sessionStorage.getItem("pm_owner_key") || null;
  } catch (e) {
    return null;
  }
}

function getAuthHeaders(customHeaders = {}) {
  const headers = { ...customHeaders };
  try {
    const appToken = localStorage.getItem("pm_auth_token");
    if (appToken) headers["x-app-key"] = appToken;

    const ownerKey = sessionStorage.getItem("pm_owner_key");
    if (ownerKey) headers["x-owner-key"] = ownerKey;

    const docenteId = obtenerDocenteId();
    if (docenteId) headers["x-docente-id"] = docenteId;
  } catch (e) {}
  return headers;
}

/**
 * Ejecuta una petición HTTP con timeout y reintentos.
 */
async function request(endpoint, options = {}, retries = 2) {
  const url = `${BASE_URL}${endpoint}`;
  const timeoutMs = options.timeout || 45000;
  const method = options.method || "GET";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Si el llamador pasó su propio signal (ej. botón Cancelar)
  let combinedSignal = controller.signal;
  if (options.signal) {
    options.signal.addEventListener("abort", () => controller.abort());
  }

  const mergedHeaders = getAuthHeaders(options.headers || {});
  if (!mergedHeaders["Content-Type"] && options.body && typeof options.body === "string") {
    mergedHeaders["Content-Type"] = "application/json";
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers: mergedHeaders,
      signal: combinedSignal,
    });
    clearTimeout(timeoutId);

    // Manejo de códigos HTTP de error
    if (!res.ok) {
      let data = {};
      try {
        data = await res.json();
      } catch (e) {}

      let type = "SERVER";
      let friendlyMessage = data.error || "Ocurrió un error en el servidor.";
      let canRetry = true;

      if (res.status === 401) {
        type = "AUTH";
        friendlyMessage = "Clave de acceso incorrecta o sesión no autorizada.";
        canRetry = false;
      } else if (res.status === 403) {
        type = "AUTH";
        friendlyMessage = "Acceso restringido: se requieren permisos de propietario.";
        canRetry = false;
      } else if (res.status === 404) {
        type = "CLIENT";
        friendlyMessage = "El servicio o recurso solicitado no fue encontrado.";
        canRetry = false;
      } else if (res.status === 405) {
        type = "SERVER";
        friendlyMessage = "El backend no está atendiendo este método en producción. Verifica el Worker de Cloudflare.";
        canRetry = false;
      } else if (res.status === 429 || data.limiteAlcanzado || data.agotado) {
        type = "QUOTA";
        friendlyMessage = data.error || "Has alcanzado el límite de tu cuota de planificaciones de este periodo.";
        canRetry = false;
      } else if (res.status >= 500) {
        type = "SERVER";
        friendlyMessage = data.error || "El servidor de IA no está disponible temporalmente. Inténtalo de nuevo.";
        canRetry = true;
      }

      throw new ApiError({
        message: data.error || `HTTP ${res.status}`,
        friendlyMessage,
        type,
        status: res.status,
        cuota: data.cuota || null,
        canRetry,
        raw: data,
      });
    }

    return res;
  } catch (err) {
    clearTimeout(timeoutId);

    if (err instanceof ApiError) {
      // Reintentar solo si es error 500+ y quedan reintentos
      if (err.canRetry && err.status >= 500 && retries > 0) {
        await new Promise((r) => setTimeout(r, 1200));
        return request(endpoint, options, retries - 1);
      }
      throw err;
    }

    // Error de red o timeout
    const isTimeout = err.name === "AbortError";
    const isOffline = !navigator.onLine || err.message?.includes("Failed to fetch") || err.message?.includes("NetworkError");

    const apiErr = new ApiError({
      message: err.message,
      friendlyMessage: isOffline
        ? "Sin conexión a internet. Verifica tu conexión de red o WiFi."
        : isTimeout
        ? "La consulta tardó demasiado en responder (tiempo límite agotado)."
        : "No fue posible comunicarse con el servidor.",
      type: isOffline ? "OFFLINE" : isTimeout ? "TIMEOUT" : "NETWORK",
      status: 0,
      canRetry: true,
      raw: err,
    });

    if (retries > 0 && !isTimeout) {
      await new Promise((r) => setTimeout(r, 1200));
      return request(endpoint, options, retries - 1);
    }

    throw apiErr;
  }
}

// ─────────────────────────────────────────────────────────────
// ENDPOINTS OFICIALES DE PLANIFICA MAESTRO
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/health
 * Estado de salud y diagnóstico de cada servicio sin revelar secretos.
 */
export async function checkHealth() {
  const res = await request("/api/health", { method: "GET" }, 1);
  return res.json();
}

/**
 * POST /api/auth/verify
 * Verifica la clave institucional
 */
export async function verificarClaveInstitucional(password) {
  const res = await request("/api/auth/verify", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  return res.json();
}

/**
 * POST /api/auth/owner-verify
 * Verifica la llave maestra de dueño
 */
export async function verificarLlaveMaestra(key) {
  const res = await request("/api/auth/owner-verify", {
    method: "POST",
    body: JSON.stringify({ key }),
  });
  return res.json();
}

/**
 * GET /api/auth/owner-stats
 * Métricas del sistema para el propietario
 */
export async function obtenerOwnerStats() {
  const res = await request("/api/auth/owner-stats", { method: "GET" });
  const data = await res.json();
  return data.stats;
}

/**
 * GET /api/plan/estado-ia
 * Estado en tiempo real de los proveedores de IA y circuito
 */
export async function obtenerEstadoIA() {
  try {
    const res = await request("/api/plan/estado-ia", { method: "GET" }, 1);
    const data = await res.json();
    return data.proveedores || [];
  } catch (e) {
    return [];
  }
}

/**
 * GET /api/plan/esquemas
 * Retorna las definiciones oficiales de esquemas
 */
export async function obtenerEsquemasCurriculares() {
  try {
    const res = await request("/api/plan/esquemas", { method: "GET" }, 1);
    const data = await res.json();
    if (data.esquemas) {
      try {
        localStorage.setItem("pm_esquemas_cache", JSON.stringify(data.esquemas));
      } catch (e) {}
      return data.esquemas;
    }
  } catch (err) {
    console.warn("Aviso: usando esquemas locales por fallo en red");
  }
  try {
    const cached = localStorage.getItem("pm_esquemas_cache");
    if (cached) return JSON.parse(cached);
  } catch (e) {}
  return null;
}

/**
 * GET /api/plan/cuota
 * Consulta la cuota mensual del docente
 */
export async function obtenerCuotaDocente(docenteIdOverride) {
  const docenteId = docenteIdOverride || obtenerDocenteId();
  const res = await request(`/api/plan/cuota?docenteId=${encodeURIComponent(docenteId)}`, {
    method: "GET",
  }, 1);
  return res.json();
}

/**
 * POST /api/plan/generate
 * Generación de plan curricular con IA (soporta JSON o SSE Streaming).
 */
export async function generarPlanificacion({
  messages,
  nivel,
  periodo,
  forzarOriginal = false,
  confirmado = false,
  signal,
  onChunk,
}) {
  const docenteId = obtenerDocenteId();
  let modeloPreferido = "gemini-3.1-flash-lite";
  try {
    modeloPreferido = localStorage.getItem("pm_modelo_ia") || "gemini-3.1-flash-lite";
  } catch (e) {}

  const payload = {
    messages,
    nivel,
    periodo,
    docenteId,
    modelo: modeloPreferido,
    forzarOriginal: Boolean(forzarOriginal),
    confirmado: Boolean(confirmado),
    permitirBusquedaWeb: true,
    stream: Boolean(onChunk),
  };

  const headers = {
    Accept: onChunk ? "text/event-stream, application/json" : "application/json",
    "x-gemini-model": modeloPreferido,
  };

  const res = await request(
    "/api/plan/generate",
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal,
      timeout: 65000, // 65s para IA generativa
    },
    1
  );

  const contentType = res.headers.get("content-type") || "";

  // 1. Respuesta en Streaming SSE
  if (contentType.includes("text/event-stream") && onChunk && res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = "";
    let finalData = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data:")) {
            const jsonStr = trimmed.replace(/^data:\s*/, "");
            if (jsonStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.estado) {
                onChunk("", "", parsed.estado);
              }
              if (parsed.delta) {
                accumulatedText += parsed.delta;
              }
              if (parsed.final) {
                finalData = parsed.final;
              }
            } catch (e) {}
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (finalData) {
      if (finalData.ok === false || finalData.isError) return finalData;
      if (validarCamposPlanificacion(finalData)) return finalData;
    }
    const parsedAccum = extraerJson(accumulatedText);
    if (parsedAccum) {
      if (parsedAccum.ok === false || parsedAccum.isError) return parsedAccum;
      if (validarCamposPlanificacion(parsedAccum)) return parsedAccum;
    }
    return finalData || {
      ok: false,
      isError: true,
      codigo: "IA_RESPUESTA_INVALIDA",
      mensaje: "El modelo de IA devolvió una respuesta incompleta o desordenada.",
      sugerencia: "Intenta pedir la planificación nuevamente con términos más específicos.",
      reintentable: true,
      mensaje_chat: "Tuve dificultades para organizar los componentes de esta planificación.\n\n💡 Sugerencia: Intenta solicitarla nuevamente.",
      plan_completado: false
    };
  }

  // 2. Respuesta estándar JSON
  const resJson = await res.json().catch(() => null);
  if (resJson) {
    if (resJson.ok === false || resJson.isError) return resJson;
    if (validarCamposPlanificacion(resJson)) return resJson;
  }
  return {
    ok: false,
    isError: true,
    codigo: resJson?.codigo || "ERROR_INTERNO",
    mensaje: resJson?.mensaje || "Error al procesar la respuesta del servidor.",
    sugerencia: resJson?.sugerencia || "Intenta de nuevo en unos momentos.",
    mensaje_chat: (resJson && mensajeParaChat(resJson)) || resJson?.mensaje || "Tuve un problema técnico y no pude completar la solicitud.",
    plan_completado: Boolean(resJson?.plan_completado && resJson?.datos_planificacion),
    ...resJson
  };
}

/**
 * POST /api/plan/consultar-curriculo
 * Consulta específica al currículo oficial MINERD
 */
export async function consultarCurriculo({
  nivel,
  grado,
  area,
  tema,
  esquemaActivo,
  periodoActivo,
  signal,
}) {
  const res = await request(
    "/api/plan/consultar-curriculo",
    {
      method: "POST",
      body: JSON.stringify({ nivel, grado, area, tema, esquemaActivo, periodoActivo }),
      signal,
      timeout: 50000,
    },
    1
  );
  return res.json();
}

/**
 * POST /api/plan/ajustes-manuales
 * Registra en el historial los cambios manuales hechos por el docente
 */
export async function guardarAjustesPlan({ planId, datosAjustados }) {
  try {
    const res = await request("/api/plan/ajustes-manuales", {
      method: "POST",
      body: JSON.stringify({ planId, datosAjustados }),
    });
    return res.json();
  } catch (e) {
    return null;
  }
}

/**
 * GET /api/plan/patrones-docente
 * Obtiene preferencias pedagógicas históricas
 */
export async function obtenerPatronesDocente({ area, nivel } = {}) {
  try {
    const params = new URLSearchParams();
    if (area) params.append("area", area);
    if (nivel) params.append("nivel", nivel);
    const res = await request(`/api/plan/patrones-docente?${params.toString()}`, {
      method: "GET",
    });
    return res.json();
  } catch (e) {
    return null;
  }
}

/**
 * POST /api/voice/generate
 * Generación de voz con ElevenLabs en el servidor (retorna URL de blob audio/mpeg)
 */
export async function generarVoz(text) {
  const res = await request("/api/voice/generate", {
    method: "POST",
    body: JSON.stringify({ text }),
    timeout: 30000,
  });
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await res.json();
    if (data.fallbackLocal) throw new Error("Fallback local");
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/**
 * POST /api/ocr/scan
 * Analiza una imagen de material educativo con visión artificial
 * Retorna datos estructurados: { success, area, grado, tema, resumen, texto }
 */
export async function escanearMaterial({ imageBase64, mediaType = "image/jpeg", signal }) {
  const res = await request(
    "/api/ocr/scan",
    {
      method: "POST",
      body: JSON.stringify({ imageBase64, mediaType }),
      signal,
      timeout: 45000,
    },
    1
  );
  return res.json();
}

/**
 * Exportar a Word (.docx) — Formato Oficial MINERD / CON BASE (A4 Horizontal, 17 filas)
 * 100% en el cliente sin consumir CPU del servidor.
 */
export async function exportarWord({ titulo = "Planificacion", plan = "", datos = null, perfil = null }) {
  if (!plan && (!datos || Object.keys(datos).length === 0)) {
    throw new Error("No hay contenido de planificación para exportar.");
  }

  const { descargarWordConBase } = await import("./services/generadorWordConBase.js");
  return descargarWordConBase({ titulo, plan, datos, perfil });
}

