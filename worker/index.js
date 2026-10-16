import { LEVELS } from "./levels.js";
import { obtenerContextoConBase } from "./contextoConBase.js";
import { getAiProvider, getGeminiModels, fetchGeminiWithRetry, fetchGeminiConThinking } from "./services/aiProvider.js";
import { generateVoice } from "./services/voiceProvider.js";
import { clasificarIntencion } from "./clasificadorIntencion.js";
import { generarRespuestaCharlaLocal, SYSTEM_PROMPT_CONVERSACIONAL, limpiarSaludoInnecesario } from "./modoConversacional.js";
import { buscarEnGlosario } from "./glosarioDocente.js";
import {
  generarClaveCurricularSha256,
  obtenerRespuestaDeCache,
  obtenerRespuestaDeKv,
  guardarRespuestaEnCache,
  esRespuestaCacheable
} from "./cacheRespuestas.js";
import { tieneIntencionExplicita, identificarImagenWorker, getGeminiVisionModels, analizarCalidadImagen } from "./ojoDigital.js";
import { corregirTextoPedagogico } from "./correctorTexto.js";
import { verificarYSanearCitas } from "./verificadorCitas.js";
import { extraerJson, mensajeParaChat, validarCamposPlanificacion, repararJsonTruncado, extraerBloquesCompletados, planEsRecuperable } from "./parseadorJsonSeguro.js";
import { evaluarPoliticaDignidad } from "./politicaDignidadImagen.js";
import { obtenerOperacionPorId } from "./catalogoEdicionImagen.js";
import { cicloToolCalling } from "../shared/ciclo.js";
import { PROMPT_SISTEMA_V2_TEXTO } from "../shared/promptSistemaV2.js";


/**
 * Planifica Maestro - Cloudflare Worker Backend
 * Atiende todas las rutas /api/* y delega el resto a los assets estáticos de la PWA.
 */

// Rate limit en memoria por IP para intentos de clave de propietario
const ownerLoginAttempts = new Map(); // ip -> { count: number, resetAt: number }

// Rate limit anónimo por hash SHA-256 de IP + fecha (sin almacenar la IP en texto claro)
const anonymousDailyRateLimit = new Map(); // hashHex -> { count: number, resetAt: number }
const cacheConsultasCurriculares = new Map(); // key -> { data, expiraEn }

async function verificarRateLimitAnonimo(clientIp, limiteDiario = 30, env = null) {
  const limiteEfectivo = (env && env.RATE_LIMIT_ANONIMO_DIARIO)
    ? (parseInt(env.RATE_LIMIT_ANONIMO_DIARIO, 10) || limiteDiario)
    : limiteDiario;

  if (!clientIp || clientIp === "127.0.0.1" || clientIp === "localhost") {
    return { permitido: true, restantes: limiteEfectivo };
  }
  try {
    const fechaHoy = new Date().toISOString().substring(0, 10);
    const encoder = new TextEncoder();
    const data = encoder.encode(`${clientIp}_pm_anon_${fechaHoy}`);
    const hashBuf = await crypto.subtle.digest("SHA-256", data);
    const hashHex = Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("")
      .substring(0, 32);

    const now = Date.now();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const resetAt = midnight.getTime();
    const ttlSeconds = Math.floor((resetAt - now) / 1000);

    if (env && env.RATE_LIMIT_KV) {
      try {
        const key = `rl_anon_${hashHex}`;
        let count = 0;
        const val = await env.RATE_LIMIT_KV.get(key);
        if (val) count = parseInt(val, 10);

        if (count >= limiteEfectivo) return { permitido: false, restantes: 0, hash: hashHex };
        
        await env.RATE_LIMIT_KV.put(key, (count + 1).toString(), { expirationTtl: Math.max(60, ttlSeconds) });
        return { permitido: true, restantes: limiteEfectivo - (count + 1), hash: hashHex };
      } catch (kvError) {
        console.error("WARN: Error en KV Rate Limit, cayendo a Map:", kvError);
      }
    }

    if (!globalThis.fallbackAvisado) {
      console.warn("WARN: Usando Map() en memoria para Rate Limit. Configura RATE_LIMIT_KV.");
      globalThis.fallbackAvisado = true;
    }
    const entry = anonymousDailyRateLimit.get(hashHex);
    if (!entry || now > entry.resetAt) {
      anonymousDailyRateLimit.set(hashHex, { count: 1, resetAt });
      return { permitido: true, restantes: limiteEfectivo - 1, hash: hashHex };
    }

    if (entry.count >= limiteEfectivo) {
      return { permitido: false, restantes: 0, hash: hashHex };
    }

    entry.count++;
    return { permitido: true, restantes: limiteEfectivo - entry.count, hash: hashHex };
  } catch (e) {
    return { permitido: true, restantes: limiteEfectivo };
  }
}

// Interruptor de freno de emergencia: IA apagada en KV o variable de entorno
async function verificarIaApagada(env) {
  if (env.IA_APAGADA === "true" || env.IA_APAGADA === "1") return true;
  if (env.PLANIFICA_KV && typeof env.PLANIFICA_KV.get === "function") {
    try {
      const val = await env.PLANIFICA_KV.get("ia_apagada");
      if (val === "true" || val === "1") return true;
    } catch (e) {}
  }
  return false;
}

// Rendimiento: caché por instancia de si la base curricular oficial está cargada en Supabase.
// Evita un viaje de red a Supabase en cada generación (el dato cambia muy rara vez).
const BASE_OFICIAL_TTL_MS = 10 * 60 * 1000; // 10 minutos
let cacheBaseOficial = { valor: null, expiraEn: 0 };

async function verificarBaseOficialCargada(env) {
  if (!env || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return false;
  if (cacheBaseOficial.valor !== null && Date.now() < cacheBaseOficial.expiraEn) {
    return cacheBaseOficial.valor;
  }
  // Nota: no se comparte la promesa entre peticiones (en Workers el I/O no puede cruzar contextos de petición).
  try {
    const checkBaseRes = await fetch(`${env.SUPABASE_URL}/rest/v1/curriculo_fragmentos?select=id&limit=1`, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    if (checkBaseRes.ok) {
      const rows = await checkBaseRes.json();
      const cargada = Array.isArray(rows) && rows.length > 0;
      cacheBaseOficial = { valor: cargada, expiraEn: Date.now() + BASE_OFICIAL_TTL_MS };
      return cargada;
    }
  } catch (e) {}
  // Ante error no se cachea: se reintentará en la próxima petición
  return false;
}

function timingSafeEqualStr(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const encoder = new TextEncoder();
  const aBuf = encoder.encode(a);
  const bBuf = encoder.encode(b);
  if (aBuf.byteLength !== bBuf.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < aBuf.byteLength; i++) {
    diff |= aBuf[i] ^ bBuf[i];
  }
  return diff === 0;
}

/**
 * Función única de redacción y enmascaramiento de secretos en logs y errores.
 * Garantiza que ninguna API key, token o credencial se filtre jamás.
 */
export function enmascararSecretos(texto, env = null) {
  if (texto === null || texto === undefined) return texto;
  let saneado = typeof texto === "string" ? texto : String(texto);

  saneado = saneado
    .replace(/AQ\.[A-Za-z0-9_-]{20,}/g, "[OCULTO]")
    .replace(/AIza[0-9A-Za-z-_]{30,}/g, "[OCULTO]")
    .replace(/gsk_[0-9A-Za-z]{30,}/g, "[OCULTO]")
    .replace(/sk-or-v1-[0-9A-Za-z]{30,}/g, "[OCULTO]")
    .replace(/sk-[0-9A-Za-z]{30,}/g, "[OCULTO]")
    .replace(/cfat_[0-9A-Za-z]{25,}/g, "[OCULTO]")
    .replace(/tvly-[0-9A-Za-z-_]{25,}/g, "[OCULTO]")
    .replace(/RD-Maestro-[0-9]+/g, "[OCULTO]");

  if (env && typeof env === "object") {
    const keysToCheck = [
      env.GEMINI_API_KEY,
      env.GROQ_API_KEY,
      env.OPENROUTER_API_KEY,
      env.ELEVENLABS_API_KEY,
      env.TAVILY_API_KEY,
      env.APP_ACCESS_KEY,
      env.OWNER_MASTER_KEY,
      env.SUPABASE_SERVICE_ROLE_KEY,
      env.CLOUDFLARE_API_TOKEN,
    ];
    for (const k of keysToCheck) {
      if (typeof k === "string" && k.length > 5) {
        saneado = saneado.replaceAll(k, "[OCULTO]");
      }
    }
  }
  return saneado;
}

function generarCodigoSeguro(longitud = 6) {
  const bytes = new Uint8Array(longitud);
  crypto.getRandomValues(bytes);
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(bytes, b => chars[b % chars.length]).join("");
}

async function checkOwnerRateLimit(ip, env = null) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutos
  const maxAttempts = 5;

  if (env && env.RATE_LIMIT_KV) {
    try {
      const key = `rl_owner_${ip}`;
      let count = 0;
      const val = await env.RATE_LIMIT_KV.get(key);
      if (val) count = parseInt(val, 10);
      if (count >= maxAttempts) return false;

      await env.RATE_LIMIT_KV.put(key, (count + 1).toString(), { expirationTtl: 15 * 60 });
      return true;
    } catch (kvError) {
      console.warn("WARN: Error en KV Owner Rate Limit, cayendo a Map:", kvError);
    }
  }

  const entry = ownerLoginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    ownerLoginAttempts.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxAttempts) {
    return false;
  }

  entry.count++;
  return true;
}

// ── Control de Eliminación Segura de Cuenta (JWT + Correo + Token de un solo uso) ──
const pendingAccountDeletions = new Map(); // userId -> { token, email, expiresAt }
const failedDeletionAttempts = new Map(); // userId/ip -> { count: number, resetAt: number }

function checkDeletionRateLimit(identifier) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutos
  const maxAttempts = 3;
  const entry = failedDeletionAttempts.get(identifier);
  if (!entry || now > entry.resetAt) {
    return true;
  }
  return entry.count < maxAttempts;
}

function recordFailedDeletionAttempt(identifier) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const entry = failedDeletionAttempts.get(identifier);
  if (!entry || now > entry.resetAt) {
    failedDeletionAttempts.set(identifier, { count: 1, resetAt: now + windowMs });
  } else {
    entry.count++;
  }
}

// Almacén en memoria para cuotas si Supabase no está configurado
const inMemoryQuotas = new Map(); // docenteId -> { periodo, usadas, limite }

const PROFUNDIDAD_TEMPORAL = {
  diaria: `ALCANCE TEMPORAL: PLANIFICACIÓN DIARIA (1 sesión de clase).
- Detalla actividades MINUTO A MINUTO (ej. "Inicio: 10 min — Desarrollo: 25 min — Cierre: 10 min").
- Incluye instrucciones paso a paso para el aula, preguntas guía y materiales exactos.
- Nivel de detalle: MÁXIMO (guía de clase lista para usar).`,

  semanal: `ALCANCE TEMPORAL: PLANIFICACIÓN SEMANAL (5 sesiones de clase).
- Organiza el contenido por DÍA (Lunes a Viernes), con un objetivo por día.
- Cada día debe tener actividades de Inicio, Desarrollo y Cierre resumidas.
- Nivel de detalle: ALTO.`,

  mensual: `ALCANCE TEMPORAL: PLANIFICACIÓN MENSUAL (4 semanas).
- Organiza el contenido por SEMANA (Semana 1 a Semana 4).
- Subtema central, competencias a trabajar y evaluación sumativa al final del mes.
- Nivel de detalle: MEDIO.`,

  anual: `ALCANCE TEMPORAL: PLANIFICACIÓN ANUAL (10 meses escolares / ~40 semanas).
- Organiza por UNIDAD o BLOQUE TEMÁTICO (8 a 12 unidades por año).
- Título, duración estimada, competencias, contenidos y distribución por periodos.
- Nivel de detalle: GENERAL.`,

  "secuencia didáctica": `ALCANCE TEMPORAL: SECUENCIA DIDÁCTICA (3 a 6 sesiones articuladas).
- Fases: Exploración → Conceptualización → Aplicación → Evaluación.
- Nivel de detalle: ALTO.`,

  "unidad de aprendizaje": `ALCANCE TEMPORAL: UNIDAD DE APRENDIZAJE (2 a 4 semanas).
- Situación de aprendizaje, red de competencias, actividades diferenciadas por momento y evaluación.
- Nivel de detalle: MEDIO-ALTO.`,

  proyecto: `ALCANCE TEMPORAL: PROYECTO (3 a 8 semanas).
- Pregunta guía, fases de investigación, producto final, cronograma y rúbrica.
- Nivel de detalle: MEDIO.`
};

const SYSTEM_PROMPT = `
# [SYSTEM_CORE_PROMPT: PLANIFICA_MAESTRO_PROD_V6]
## ROL Y DIRECTIVA DE OPERACIÓN
Eres el motor pedagógico de "Planifica Maestro". Tu función es asistir al docente en la elaboración de planificaciones educativas reales, precisas y operativas tomando como referencia los documentos curriculares y guías metodológicas del sistema educativo de la República Dominicana (MINERD y CON BASE). No te presentes como representante oficial del MINERD ni certifiques oficialidad.

## FORMATO DE SALIDA (OBLIGATORIO JSON)
Devuelve SIEMPRE tu respuesta en formato JSON estrictamente estructurado:
{
  "mensaje_chat": "String. Tu respuesta conversacional al docente (saludo, explicación o preguntas si falta información).",
  "plan_completado": true,
  "datos_planificacion": {
    // Si plan_completado es true, cada clave debe coincidir EXACTAMENTE con los bloques del esquema seleccionado.
  },
  "confianza_curricular": {
    "nivel_certeza": "alta | media | baja | referencial, no verificado",
    "bloques_aproximados": [],
    "nota_revision": "String con aclaración pedagógica o advertencia referencial si aplica."
  }
}
`;

function extraerJsonValido(text) {
  if (!text || typeof text !== "string") return null;
  let str = text.trim();
  if (str.startsWith("```json")) {
    str = str.replace(/^```json\s*/, "").replace(/```\s*$/, "").trim();
  } else if (str.startsWith("```")) {
    str = str.replace(/^```\s*/, "").replace(/```\s*$/, "").trim();
  }
  try {
    return JSON.parse(str);
  } catch (e) {}

  const startIdx = str.indexOf("{");
  if (startIdx === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = startIdx; i < str.length; i++) {
    const char = str[i];
    if (inString) {
      if (char === "\\" && !escaped) escaped = true;
      else {
        if (char === '"' && !escaped) inString = false;
        escaped = false;
      }
    } else {
      if (char === '"') inString = true;
      else if (char === "{") depth++;
      else if (char === "}") {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(str.substring(startIdx, i + 1));
          } catch (err) {}
        }
      }
    }
  }

  const lastIdx = str.lastIndexOf("}");
  if (lastIdx > startIdx) {
    try {
      return JSON.parse(str.substring(startIdx, lastIdx + 1));
    } catch (err) {}
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// GESTIÓN DE CUOTAS (SUPABASE CON FALLBACK EN MEMORIA)
// ─────────────────────────────────────────────────────────────
// Rate limit en memoria por dispositivo (SHA-256 de device_id + fecha_YYYY-MM-DD)
const deviceDailyRateLimit = new Map(); // hashHex -> { count: number, resetAt: number }
// Rate limit por red IP escolar (SHA-256 de ip + fecha_YYYY-MM-DD)
const ipDailyRateLimit = new Map(); // hashHex -> { count: number, resetAt: number }
// Contador diario global en memoria
let globalDailyCounter = { date: "", count: 0 };

async function consultarCuota(env, docenteId, isOwner, clientIp = "127.0.0.1") {
  if (isOwner) {
    return {
      permitido: true,
      docenteId: "owner",
      periodo: "dia",
      usadas: 0,
      limite: 999999,
      restantes: 999999,
      restante: 999999,
      porcentaje: 0,
      agotado: false,
      alerta80: false,
      isOwner: true,
      esOwner: true,
      origen_cuota: "owner_bypass",
    };
  }

  const esModoCerrado = env && (env.ACCESO_ABIERTO === "false" || env.REQUIRE_ACCESS_KEY === "true");
  // Si está en Modo Cerrado con Supabase configurado, usar Supabase
  if (esModoCerrado && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const periodoActual = new Date().toISOString().substring(0, 7);
      const url = `${env.SUPABASE_URL}/rest/v1/uso_docentes?docente_id=eq.${encodeURIComponent(docenteId)}&periodo=eq.${periodoActual}&select=*`;
      const res = await fetch(url, {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });
      if (res.ok) {
        const rows = await res.json();
        if (rows && rows.length > 0) {
          const row = rows[0];
          const usadas = row.usadas || 0;
          const limite = row.limite || (env.PLAN_LIMIT_MAX ? parseInt(env.PLAN_LIMIT_MAX, 10) : 20);
          return {
            permitido: usadas < limite,
            docenteId,
            usadas,
            limite,
            restantes: Math.max(0, limite - usadas),
            porcentaje: Math.round((usadas / limite) * 100),
            agotado: usadas >= limite,
            alerta80: usadas / limite >= 0.8,
            isOwner: false,
            periodo: periodoActual,
            origen_cuota: "supabase",
          };
        }
      }
    } catch (e) {
      console.warn("Fallo al consultar cuota en Supabase:", e);
    }
  }

  // BETA ABIERTA: Cuota diaria por dispositivo (Hash SHA-256 de device_id + fecha_YYYY-MM-DD)
  const limiteDispositivo = (env && env.RATE_LIMIT_DISPOSITIVO_DIARIO)
    ? (parseInt(env.RATE_LIMIT_DISPOSITIVO_DIARIO, 10) || 25)
    : 25;

  const fechaHoy = new Date().toISOString().substring(0, 10);
  const now = Date.now();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  const resetAt = midnight.getTime();

  const idParaDispositivo = (docenteId && docenteId !== "docente_default" && docenteId.trim().length > 0)
    ? docenteId.trim()
    : `fallback_ip_${clientIp || "127.0.0.1"}`;

  const encoder = new TextEncoder();
  const devData = encoder.encode(`${idParaDispositivo}_pm_device_${fechaHoy}`);
  const devHashBuf = await crypto.subtle.digest("SHA-256", devData);
  const devHashHex = Array.from(new Uint8Array(devHashBuf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
    .substring(0, 32);

  let devCount = 0;
  if (env && env.RATE_LIMIT_KV) {
    try {
      const devKey = `rl_dev_${devHashHex}`;
      const devVal = await env.RATE_LIMIT_KV.get(devKey);
      if (devVal) devCount = parseInt(devVal, 10);
    } catch (e) {
      console.warn("WARN: Error en KV consultando cuota:", e);
    }
  } else {
    const entry = deviceDailyRateLimit.get(devHashHex);
    if (entry && now <= entry.resetAt) {
      devCount = entry.count;
    }
  }

  const usadas = devCount;
  const restantes = Math.max(0, limiteDispositivo - usadas);
  const porcentaje = Math.round((usadas / limiteDispositivo) * 100);
  const agotado = usadas >= limiteDispositivo;
  const alerta80 = (usadas / limiteDispositivo) >= 0.8 && !agotado;

  return {
    permitido: !agotado,
    docenteId: idParaDispositivo,
    periodo: "dia",
    usadas,
    limite: limiteDispositivo,
    restantes,
    porcentaje,
    agotado,
    alerta80,
    isOwner: false,
    origen_cuota: "dispositivo",
    fechaReinicio: midnight.toISOString(),
  };
}

async function verificarTopesMultinivel({ deviceId, clientIp, env, isOwner }) {
  if (isOwner) {
    return {
      permitido: true,
      cuota: {
        permitido: true,
        docenteId: "owner",
        periodo: "dia",
        usadas: 0,
        limite: 999999,
        restantes: 999999,
        porcentaje: 0,
        agotado: false,
        alerta80: false,
        isOwner: true,
        origen_cuota: "owner_bypass"
      }
    };
  }

  const fechaHoy = new Date().toISOString().substring(0, 10);
  const now = Date.now();
  const encoder = new TextEncoder();

  // 1. Tope Global Diario (Red de seguridad de gasto, por defecto 500)
  const limiteGlobal = (env && env.RATE_LIMIT_GLOBAL_DIARIO)
    ? (parseInt(env.RATE_LIMIT_GLOBAL_DIARIO, 10) || 500)
    : 500;

  const leerGlobalCount = async () => {
    let globalCount = 0;
    if (env && env.RATE_LIMIT_KV) {
      try {
        const gKey = `rl_global_${fechaHoy}`;
        const gVal = await env.RATE_LIMIT_KV.get(gKey);
        if (gVal) globalCount = parseInt(gVal, 10);
      } catch (e) {}
    } else {
      if (globalDailyCounter.date === fechaHoy) {
        globalCount = globalDailyCounter.count;
      }
    }
    return globalCount;
  };

  // 2. Tope de IP de la Red / Escuela (RATE_LIMIT_IP_DIARIO, configurable, por defecto 75)
  const limiteIp = (env && env.RATE_LIMIT_IP_DIARIO)
    ? (parseInt(env.RATE_LIMIT_IP_DIARIO, 10) || 75)
    : 75;

  const leerIpCount = async () => {
    const ipParaHash = clientIp || "unknown";
    const ipData = encoder.encode(`${ipParaHash}_pm_ip_${fechaHoy}`);
    const ipHashBuf = await crypto.subtle.digest("SHA-256", ipData);
    const ipHashHex = Array.from(new Uint8Array(ipHashBuf))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("")
      .substring(0, 32);

    let ipCount = 0;
    if (env && env.RATE_LIMIT_KV) {
      try {
        const ipKey = `rl_ip_${ipHashHex}`;
        const ipVal = await env.RATE_LIMIT_KV.get(ipKey);
        if (ipVal) ipCount = parseInt(ipVal, 10);
      } catch (e) {}
    } else {
      const ipEntry = ipDailyRateLimit.get(ipHashHex);
      if (ipEntry && now <= ipEntry.resetAt) {
        ipCount = ipEntry.count;
      }
    }
    return ipCount;
  };

  // Rendimiento: las tres lecturas (global, IP y dispositivo) se lanzan en paralelo
  // y se evalúan después en el mismo orden de prioridad de siempre.
  const [globalCount, ipCount, cuota] = await Promise.all([
    leerGlobalCount(),
    leerIpCount(),
    // 3. Cuota por Maestro por Dispositivo (RATE_LIMIT_DISPOSITIVO_DIARIO, por defecto 25)
    consultarCuota(env, deviceId, false, clientIp),
  ]);

  if (globalCount >= limiteGlobal) {
    return {
      permitido: false,
      error: "El servicio ha alcanzado su límite diario global de consultas para proteger el presupuesto del sistema. Intenta nuevamente mañana.",
      tipo: "global",
      limiteAlcanzado: true,
      agotado: true,
    };
  }

  if (ipCount >= limiteIp) {
    return {
      permitido: false,
      error: `Demasiadas solicitudes desde esta red escolar hoy (límite de ${limiteIp} consultas/día por red alcanzado). Regresa mañana o utiliza otra conexión.`,
      tipo: "ip",
      limiteAlcanzado: true,
      agotado: true,
    };
  }

  if (!cuota.permitido) {
    return {
      permitido: false,
      error: `Has alcanzado tu cuota diaria de la beta abierta (${cuota.limite} planes). Se reinicia a medianoche. Gracias por probar Planifica Maestro.`,
      tipo: "dispositivo",
      limiteAlcanzado: true,
      agotado: true,
      cuota,
    };
  }

  return {
    permitido: true,
    cuota,
  };
}

async function consumirCuota(env, docenteId, isOwner, clientIp = "127.0.0.1", peso = 1) {
  if (isOwner) return consultarCuota(env, docenteId, true, clientIp);
  const pesoEfectivo = Math.max(1, Math.floor(peso || 1));

  const esModoCerrado = env && (env.ACCESO_ABIERTO === "false" || env.REQUIRE_ACCESS_KEY === "true");
  if (esModoCerrado && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const periodoActual = new Date().toISOString().substring(0, 7);
      const selectUrl = `${env.SUPABASE_URL}/rest/v1/uso_docentes?docente_id=eq.${encodeURIComponent(docenteId)}&periodo=eq.${periodoActual}&select=*`;
      const res = await fetch(selectUrl, {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });
      if (res.ok) {
        const rows = await res.json();
        if (rows && rows.length > 0) {
          const row = rows[0];
          await fetch(`${env.SUPABASE_URL}/rest/v1/uso_docentes?id=eq.${row.id}`, {
            method: "PATCH",
            headers: {
              apikey: env.SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ usadas: (row.usadas || 0) + pesoEfectivo, updated_at: new Date().toISOString() }),
          });
          return consultarCuota(env, docenteId, false, clientIp);
        }
      }
    } catch (e) {}
  }

  // BETA ABIERTA: Consumir en dispositivo, IP y global
  const fechaHoy = new Date().toISOString().substring(0, 10);
  const now = Date.now();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  const resetAt = midnight.getTime();
  const ttlSeconds = Math.max(60, Math.floor((resetAt - now) / 1000));
  const encoder = new TextEncoder();

  // Consumir Global
  if (env && env.RATE_LIMIT_KV) {
    try {
      const gKey = `rl_global_${fechaHoy}`;
      const gVal = await env.RATE_LIMIT_KV.get(gKey);
      const gCount = gVal ? parseInt(gVal, 10) : 0;
      await env.RATE_LIMIT_KV.put(gKey, (gCount + pesoEfectivo).toString(), { expirationTtl: ttlSeconds });
    } catch (e) {}
  } else {
    if (globalDailyCounter.date !== fechaHoy) {
      globalDailyCounter = { date: fechaHoy, count: 0 };
    }
    globalDailyCounter.count += pesoEfectivo;
  }

  // Consumir IP
  const ipParaHash = clientIp || "unknown";
  const ipData = encoder.encode(`${ipParaHash}_pm_ip_${fechaHoy}`);
  const ipHashBuf = await crypto.subtle.digest("SHA-256", ipData);
  const ipHashHex = Array.from(new Uint8Array(ipHashBuf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
    .substring(0, 32);

  if (env && env.RATE_LIMIT_KV) {
    try {
      const ipKey = `rl_ip_${ipHashHex}`;
      const ipVal = await env.RATE_LIMIT_KV.get(ipKey);
      const ipCount = ipVal ? parseInt(ipVal, 10) : 0;
      await env.RATE_LIMIT_KV.put(ipKey, (ipCount + pesoEfectivo).toString(), { expirationTtl: ttlSeconds });
    } catch (e) {}
  } else {
    let ipEntry = ipDailyRateLimit.get(ipHashHex);
    if (!ipEntry || now > ipEntry.resetAt) {
      ipEntry = { count: 0, resetAt };
      ipDailyRateLimit.set(ipHashHex, ipEntry);
    }
    ipEntry.count += pesoEfectivo;
  }

  // Consumir Dispositivo
  const idParaDispositivo = (docenteId && docenteId !== "docente_default" && docenteId.trim().length > 0)
    ? docenteId.trim()
    : `fallback_ip_${clientIp || "127.0.0.1"}`;

  const devData = encoder.encode(`${idParaDispositivo}_pm_device_${fechaHoy}`);
  const devHashBuf = await crypto.subtle.digest("SHA-256", devData);
  const devHashHex = Array.from(new Uint8Array(devHashBuf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
    .substring(0, 32);

  if (env && env.RATE_LIMIT_KV) {
    try {
      const devKey = `rl_dev_${devHashHex}`;
      const devVal = await env.RATE_LIMIT_KV.get(devKey);
      const devCount = devVal ? parseInt(devVal, 10) : 0;
      await env.RATE_LIMIT_KV.put(devKey, (devCount + pesoEfectivo).toString(), { expirationTtl: ttlSeconds });
    } catch (e) {}
  } else {
    let devEntry = deviceDailyRateLimit.get(devHashHex);
    if (!devEntry || now > devEntry.resetAt) {
      devEntry = { count: 0, resetAt };
      deviceDailyRateLimit.set(devHashHex, devEntry);
    }
    devEntry.count += pesoEfectivo;
  }

  return consultarCuota(env, docenteId, false, clientIp);
}

/**
 * Verificación unificada y estricta de acceso institucional (Fail-Closed)
 * - Si es dueño autenticado (x-owner-key), permite acceso inmediato con bypass de cuota.
 * - Si ACCESO_ABIERTO="true" o REQUIRE_ACCESS_KEY="false" (Beta Abierta), permite acceso libre a docentes.
 * - Si ACCESO_ABIERTO="false" (Modo Cerrado):
 *   - 500 si falta APP_ACCESS_KEY en env del servidor.
 *   - 401 si falta o no coincide x-app-key (o x-access-token).
 * - Retorna { errorResponse: Response | null, isOwner: boolean }
 */
function requerirAcceso(request, env, corsHeaders) {
  const ownerKey = request.headers.get("x-owner-key");
  const isOwner = Boolean(
    env &&
    env.OWNER_MASTER_KEY &&
    ownerKey &&
    timingSafeEqualStr(ownerKey.trim(), env.OWNER_MASTER_KEY.trim())
  );

  // 1. Dueño autenticado: acceso concedido sin restricciones
  if (isOwner) {
    return { errorResponse: null, isOwner: true };
  }

  // 2. Beta Abierta: entrada libre sin contraseñas ni registro
  const accesoAbierto = Boolean(
    env &&
    (env.ACCESO_ABIERTO === "true" || env.REQUIRE_ACCESS_KEY === "false")
  );
  if (accesoAbierto) {
    return { errorResponse: null, isOwner: false };
  }

  // 3. Modo Cerrado (Seguridad estricta institucional Fail-Closed)
  if (!env || !env.APP_ACCESS_KEY) {
    return {
      errorResponse: new Response(
        JSON.stringify({ ok: false, error: "Servidor mal configurado. Falta clave institucional." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
      isOwner: false,
    };
  }

  const appKey = request.headers.get("x-app-key") || request.headers.get("x-access-token");
  const isAppKeyValid = Boolean(
    appKey &&
    timingSafeEqualStr(appKey.trim(), env.APP_ACCESS_KEY.trim())
  );

  if (!isAppKeyValid) {
    return {
      errorResponse: new Response(
        JSON.stringify({ ok: false, error: "Acceso no autorizado. Se requiere x-app-key válida." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
      isOwner: false,
    };
  }

  return { errorResponse: null, isOwner: false };
}

// ─────────────────────────────────────────────────────────────
// ROUTER DE API
// ─────────────────────────────────────────────────────────────
async function handleApiRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const clientIp = request.headers.get("cf-connecting-ip") || "unknown";

  // Headers CORS para desarrollo o integración segura
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-docente-id, x-app-key, x-owner-key, authorization",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };

  function generarErrorPlanificacion(codigo, mensaje, sugerencia, reintentable = true, status = 200, cuota = null) {
    const incidentId = "INC-" + generarCodigoSeguro(6);
    const mensajeLimpio = enmascararSecretos(mensaje, env);
    const sugerenciaLimpia = enmascararSecretos(sugerencia, env);
    console.warn(`[PlanError ${incidentId}] ${codigo} - ${mensajeLimpio}`);
    const payload = {
      ok: false,
      isError: true,
      codigo,
      codigoError: codigo,
      mensaje: mensajeLimpio,
      sugerencia: sugerenciaLimpia,
      reintentable,
      incidentId,
      mensaje_chat: `${mensajeLimpio}

💡 Sugerencia: ${sugerenciaLimpia}`,
      plan_completado: false
    };
    if (cuota) payload.cuota = cuota;
    return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }


  if (method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 1. GET /api/health
  if (path === "/api/health" && method === "GET") {
    let tablasDisponibles = [];
    if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      const tablasToCheck = [
        "curriculo_fragmentos",
        "calendario_escolar_oficial",
        "planes_guardados",
        "perfil_docente",
        "docente_eventos",
        "docente_recordatorios",
        "conversaciones",
        "tareas_investigacion",
        "docente_horarios",
        "docente_actividades",
        "docente_notas"
      ];
      await Promise.all(
        tablasToCheck.map(async (tabla) => {
          try {
            const checkRes = await fetch(`${env.SUPABASE_URL}/rest/v1/${tabla}?select=id&limit=0`, {
              method: "GET",
              headers: {
                apikey: env.SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
              },
            });
            if (checkRes.ok) {
              tablasDisponibles.push(tabla);
            }
          } catch (e) {}
        })
      );
    }

    const ownerKey = request.headers.get("x-owner-key");
    const isOwner = Boolean(
      env.OWNER_MASTER_KEY &&
      ownerKey &&
      timingSafeEqualStr(ownerKey.trim(), env.OWNER_MASTER_KEY.trim())
    );

    const services = {
      text_ai: env.GEMINI_API_KEY ? "ok" : "sin_configurar",
      vision_ai: env.GEMINI_API_KEY ? "ok" : "sin_configurar",
      ocr_ai: env.GEMINI_API_KEY ? "ok" : "sin_configurar",
      voice_mode: "browser_speechSynthesis",
      database: (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) ? "ok" : "en_memoria",
      ia_apagada: (await verificarIaApagada(env)) ? "apagada" : "activa",
    };

    if (isOwner) {
      services.auth = env.APP_ACCESS_KEY ? "activa" : "abierta";
      services.owner = env.OWNER_MASTER_KEY ? "configurada" : "sin_configurar";
    }

    const health = {
      status: "ok",
      worker: "cloudflare-workers",
      timestamp: new Date().toISOString(),
      tablas_disponibles: tablasDisponibles,
      services,
    };
    return new Response(JSON.stringify(health, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2. GET o POST /api/auth/verify (Clave institucional o acceso libre en beta abierta)
  if (path === "/api/auth/verify" && (method === "GET" || method === "POST")) {
    const accesoAbierto = Boolean(
      env &&
      (env.ACCESO_ABIERTO === "true" || env.REQUIRE_ACCESS_KEY === "false")
    );
    if (accesoAbierto) {
      return new Response(JSON.stringify({ ok: true, token: "beta_abierta", modo: "abierto", mensaje: "Acceso libre a la beta abierta de Planifica Maestro." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headerKey = request.headers.get("x-app-key");
    const body = (method === "POST") ? await request.json().catch(() => ({})) : {};
    const candidateKey = (headerKey && headerKey.trim()) || (body.password && typeof body.password === "string" ? body.password.trim() : "");
    const expected = env.APP_ACCESS_KEY;
    if (!expected) {
      return new Response(JSON.stringify({ ok: false, error: "Servidor mal configurado. Falta clave institucional." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (candidateKey && timingSafeEqualStr(candidateKey, expected.trim())) {
      return new Response(JSON.stringify({ ok: true, token: expected.trim() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: false, error: "Clave institucional incorrecta." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 3. POST /api/auth/owner-verify (Llave maestra de dueño con rate limit e igualdad en tiempo constante)
  if (path === "/api/auth/owner-verify" && method === "POST") {
    if (!(await checkOwnerRateLimit(clientIp, env))) {
      return new Response(
        JSON.stringify({ ok: false, error: "Demasiados intentos fallidos. Bloqueado temporalmente por 15 minutos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await request.json().catch(() => ({}));
    const expected = env.OWNER_MASTER_KEY;
    if (!expected) {
      return new Response(JSON.stringify({ ok: false, error: "Llave de propietario no configurada en los secretos." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.key && timingSafeEqualStr(body.key.trim(), expected.trim())) {
      return new Response(JSON.stringify({ ok: true, isOwner: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: false, error: "Llave maestra incorrecta." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 4. GET /api/auth/owner-stats
  if (path === "/api/auth/owner-stats" && method === "GET") {
    const ownerKey = request.headers.get("x-owner-key");
    if (!env.OWNER_MASTER_KEY || !ownerKey || !timingSafeEqualStr(ownerKey.trim(), env.OWNER_MASTER_KEY.trim())) {
      return new Response(JSON.stringify({ ok: false, error: "Acceso denegado." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let persistencia = (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) ? "supabase" : "en_memoria";
    let totalDocentes = inMemoryQuotas.size;
    let totalPlanificaciones = Array.from(inMemoryQuotas.values()).reduce((acc, v) => acc + (v.usadas || 0), 0);
    let listaDocentes = Array.from(inMemoryQuotas.entries()).map(([k, v]) => ({
      docenteId: k,
      usadas: v.usadas,
      periodo: new Date().toISOString().substring(0, 7),
    }));

    if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const resUso = await fetch(`${env.SUPABASE_URL}/rest/v1/uso_docentes?select=*`, {
          headers: {
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
        });
        if (resUso.ok) {
          const rows = await resUso.json();
          if (Array.isArray(rows) && rows.length > 0) {
            persistencia = "supabase";
            totalDocentes = rows.length;
            totalPlanificaciones = rows.reduce((acc, r) => acc + (r.usadas || 0), 0);
            listaDocentes = rows.map((r) => ({
              docenteId: r.docente_id,
              usadas: r.usadas || 0,
              periodo: r.periodo || "n/a",
            }));
          }
        }
      } catch (e) {
        console.warn("Fallo al consultar uso_docentes en Supabase:", e);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        stats: {
          totalDocentes,
          totalPlanificaciones,
          listaDocentes,
          persistencia,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 5. GET /api/plan/esquemas
  if (path === "/api/plan/esquemas" && method === "GET") {
    return new Response(JSON.stringify({ ok: true, esquemas: LEVELS }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 6. GET /api/plan/cuota
  if (path === "/api/plan/cuota" && method === "GET") {
    const rawDev = request.headers.get("x-device-id") || request.headers.get("X-Device-Id") || url.searchParams.get("docenteId") || request.headers.get("x-docente-id") || "docente_default";
    const ownerKey = request.headers.get("x-owner-key");
    const isOwner = Boolean(env.OWNER_MASTER_KEY && ownerKey && timingSafeEqualStr(ownerKey.trim(), env.OWNER_MASTER_KEY.trim()));

    const estado = await consultarCuota(env, rawDev, isOwner, clientIp);
    return new Response(JSON.stringify(estado), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 7. POST /api/plan/generate y /api/plan (Generación con Gemini y soporte SSE Streaming)
  if ((path === "/api/plan/generate" || path === "/api/plan") && method === "POST") {
    const auth = requerirAcceso(request, env, corsHeaders);
    if (auth.errorResponse) return auth.errorResponse;
    const isOwner = auth.isOwner;

    const body = await request.json().catch(() => ({}));
    let { messages = [], nivel, periodo = "diaria", docenteId = "docente_default", stream = false } = body;
    if ((!messages || messages.length === 0) && (body.tema || body.prompt)) {
      const query = body.prompt || `Planifica el tema: ${body.tema} (${body.grado || ""} - ${body.area || ""})`;
      messages = [{ role: "user", text: query }];
    }
    const rawDevId = request.headers.get("x-device-id") || request.headers.get("X-Device-Id") || (docenteId && docenteId !== "docente_default" ? docenteId : null) || request.headers.get("x-docente-id") || ("dev_anon_" + clientIp);
    const resolvedDocenteId = rawDevId;

    // Verificar topes multinivel (dispositivo, IP de red y límite global) antes de procesar
    const checkTopes = await verificarTopesMultinivel({
      deviceId: resolvedDocenteId,
      clientIp,
      env,
      isOwner,
    });

    if (!checkTopes.permitido) {
      return new Response(
        JSON.stringify({
          error: checkTopes.error,
          limiteAlcanzado: true,
          agotado: true,
          cuota: checkTopes.cuota || null,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const cheqCuota = checkTopes.cuota;

    const iaApagada = await verificarIaApagada(env);

    if (!messages.length) {
      return new Response(JSON.stringify({ error: "Faltan 'messages'." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ultimoMsg = messages[messages.length - 1] || {};
          const textoConsulta = (ultimoMsg.text || ultimoMsg.content || body.tema || body.prompt || "").trim();

      const esPreguntaPorQue = /^(?:¿?\s*(?:por\s*qu[eé]|c[oó]mo\s*as[ií]|qu[eé]\s*pas[oó]|y\s*eso|explica(?:me)?|por\s*qu[eé]\s*no\s*puedes))/i.test(textoConsulta);
      const previoAssistant = messages[messages.length - 2] || {};
      if (esPreguntaPorQue && previoAssistant.isError && previoAssistant.codigoError) {
        let explicacion = "Hubo un problema t�cnico y no pude completar la solicitud.";
        if (previoAssistant.codigoError === "IA_RESPUESTA_INVALIDA") explicacion = "El modelo de IA devolvi� los datos desordenados, y por seguridad prefer� no mostrarte una planificaci�n rota.";
        if (previoAssistant.codigoError === "DATOS_INCOMPLETOS") explicacion = "Me faltaron datos clave como el grado, el �rea o el tema a planificar para poder cumplir con el curr�culo oficial.";
        if (previoAssistant.codigoError === "IA_NO_DISPONIBLE") explicacion = "El servidor de inteligencia artificial est� saturado o apagado temporalmente debido a la alta demanda.";
        if (previoAssistant.codigoError === "PROVEEDOR_IA_SATURADO") explicacion = "El servicio de inteligencia artificial estuvo temporalmente saturado por alta demanda. No tiene que ver con tu cuenta y suele resolverse en un minuto.";
        if (previoAssistant.codigoError === "CUOTA_DIARIA_AGOTADA") explicacion = "Se agot� el l�mite de planes que puedes generar gratis por hoy. Esto ayuda a mantener el servidor funcionando.";
        if (previoAssistant.codigoError === "ERROR_INTERNO") explicacion = "Mi configuraci�n interna (por ejemplo, las claves de conexi�n al servidor de IA) fall� inesperadamente.";
        return generarErrorPlanificacion(
           previoAssistant.codigoError,
           explicacion,
           previoAssistant.sugerencia || "Intenta nuevamente.",
           previoAssistant.reintentable !== false,
           200
        );
      }
    const imageBase64 = ultimoMsg.imageBase64 || body.imageBase64 || null;
    const mediaType = ultimoMsg.mediaType || body.mediaType || "image/jpeg";

    const forzarOriginal = Boolean(body.forzarOriginal);
    const confirmado = Boolean(body.confirmado);

    let resultadoCorreccion = await corregirTextoPedagogico({
      texto: textoConsulta,
      usarIA: false,
      env
    });

    if (forzarOriginal) {
      resultadoCorreccion = {
        textoOriginal: textoConsulta,
        textoCorregido: textoConsulta,
        cambios: [],
        huboCambios: false,
        cambioEstructural: false,
        tipoCambioEstructural: null,
        detalleConfirmacion: null,
        tieneAmbiguedad: false,
        candidatosAmbiguos: []
      };
    }

    const textoParaProcesar = resultadoCorreccion.textoCorregido || textoConsulta;

    const isStream = Boolean(stream || request.headers.get("accept")?.includes("text/event-stream"));

    function responderWorker({ data, status = 200, estado = "pensando" }) {
      if (resultadoCorreccion) {
        data.texto_original = resultadoCorreccion.textoOriginal;
        data.texto_corregido = resultadoCorreccion.textoCorregido;
        data.correcciones_aplicadas = resultadoCorreccion.cambios || [];
        data.hubo_correcciones = !!resultadoCorreccion.huboCambios;
        data.cambio_significado = Boolean(resultadoCorreccion.cambioSignificado);
      }
      if (data.mensaje_chat && typeof data.mensaje_chat === "string") {
        const tieneSaludoUsuario = /\b(hola|buen(?:os)?\s*días|buenas\s*tardes|buenas\s*noches|saludos|que\s*tal)\b/i.test(textoConsulta);
        const debePermitirSaludo = messages.length <= 1 && tieneSaludoUsuario;
        if (!debePermitirSaludo && data.modo !== "charla") {
          data.mensaje_chat = limpiarSaludoInnecesario(data.mensaje_chat, false);
        }
        data.mensaje_chat = verificarYSanearCitas(data.mensaje_chat, data.datos_planificacion?.fragmentos || []);
      }
      if (status >= 400 || !isStream) {
        return new Response(JSON.stringify(data), {
          status,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const encoder = new TextEncoder();
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();

      (async () => {
        try {
          if (resultadoCorreccion && resultadoCorreccion.huboCambios) {
            await writer.write(encoder.encode(`data: ${JSON.stringify({
              tipo: "correccion",
              texto_original: resultadoCorreccion.textoOriginal,
              texto_corregido: resultadoCorreccion.textoCorregido,
              correcciones_aplicadas: resultadoCorreccion.cambios || [],
              hubo_correcciones: true,
              cambio_significado: Boolean(resultadoCorreccion.cambioSignificado)
            })}\n\n`));
          }
          await writer.write(encoder.encode(`data: ${JSON.stringify({ estado })}\n\n`));
          if (data.mensaje_chat) {
            await writer.write(encoder.encode(`data: ${JSON.stringify({ delta: data.mensaje_chat, estado })}\n\n`));
          }
          await writer.write(encoder.encode(`data: ${JSON.stringify({ final: data })}\n\n`));
          await writer.write(encoder.encode("data: [DONE]\n\n"));
        } catch (e) {
          console.warn("Error en responderWorker:", e.message);
        } finally {
          writer.close();
        }
      })();

      return new Response(readable, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          Connection: "keep-alive"
        }
      });
    }

    // Validación de ambigüedad en Levenshtein (empate de candidatos: no adivinar)
    if (resultadoCorreccion.tieneAmbiguedad && !confirmado && !forzarOriginal) {
      const amb = resultadoCorreccion.candidatosAmbiguos[0];
      const opciones = (amb.candidatos || []).map(c => `Usar "${c}"`).concat([`Mantener "${amb.antes}"`]);
      return responderWorker({
        data: {
          mensaje_chat: `Noté la palabra "${amb.antes}", que podría referirse a varios términos curriculares. ¿Cuál quisiste decir?`,
          plan_completado: false,
          modo: "aclarar_ambiguedad",
          categoria: "ambigua",
          requiereAclaracion: true,
          ambiguedad: amb,
          opciones,
          datos_planificacion: null
        },
        estado: "pensando"
      });
    }

    // Validación de cambios estructurales (grado, área o tema: confirmar antes de actuar)
    if (resultadoCorreccion.cambioEstructural && !confirmado && !forzarOriginal) {
      const det = resultadoCorreccion.detalleConfirmacion;
      const desc = det ? `"${det.antes}" a "${det.despues}" (${resultadoCorreccion.tipoCambioEstructural})` : `en ${resultadoCorreccion.tipoCambioEstructural}`;
      return responderWorker({
        data: {
          mensaje_chat: `He identificado un posible cambio de ${desc}:\n\n**"${resultadoCorreccion.textoCorregido}"**\n\n¿Deseas continuar con esta corrección o mantener tu texto original?`,
          plan_completado: false,
          modo: "confirmar_correccion",
          categoria: "confirmacion",
          requiereConfirmacion: true,
          cambio_estructural: {
            tipo: resultadoCorreccion.tipoCambioEstructural,
            detalle: det
          },
          opciones: [
            `Sí, continuar con "${resultadoCorreccion.textoCorregido}"`,
            `No, usar "${resultadoCorreccion.textoOriginal}"`
          ],
          datos_planificacion: null
        },
        estado: "pensando"
      });
    }

    // DEFENSA DE CÓDIGO (3B.2): Si la imagen es muy pequeña, casi negra o sin contenido, responder mensaje honesto fijo
    if (imageBase64) {
      const calidadImg = analizarCalidadImagen(imageBase64);
      if (calidadImg.ilegible) {
        return responderWorker({
          data: {
            mensaje_chat: "La imagen se ve oscura o ilegible; toma otra foto con más luz o escribe el texto.",
            plan_completado: false,
            modo: "identificacion_visual",
            categoria: "identificacion_visual",
            tipo_visual: "ilegible",
            es_borrosa: true,
            opciones: ["Tomar otra foto con más luz", "Escribir mi consulta"],
            datos_planificacion: null
          },
          estado: "conversando"
        });
      }
    }

    // ETAPA 1: Si hay imagen y no hay instrucción explícita del docente, la identificamos primero (Ojo Digital)
    if (imageBase64 && !tieneIntencionExplicita(textoConsulta)) {
      const idRes = await identificarImagenWorker({
        imageBase64,
        mediaType: ultimoMsg.mediaType || "image/jpeg",
        env
      });

      if (!idRes.exito) {
        return responderWorker({
          data: {
            mensaje_chat: idRes.mensaje,
            plan_completado: false,
            modo: "error_camara",
            error: idRes.error || "camara_no_disponible",
            motivo: idRes.motivo || "error_servicio",
            codigo_http: idRes.codigo_http || null
          },
          estado: "pensando"
        });
      }

      return responderWorker({
        data: {
          mensaje_chat: idRes.descripcion,
          plan_completado: false,
          modo: "identificacion_visual",
          categoria: "identificacion_visual",
          tipo_visual: idRes.tipo_visual,
          es_borrosa: idRes.es_borrosa,
          es_delicado: idRes.es_delicado,
          tema_detectado: idRes.tema_detectado,
          opciones: idRes.opciones,
          datos_planificacion: null
        },
        estado: "conversando"
      });
    }

    // Atender opción de Ojo Digital: "Usarla como material de clase"
    if (textoConsulta.toLowerCase().includes("usarla como material de clase") || textoConsulta.toLowerCase().includes("usar como material")) {
      return responderWorker({
        data: {
          mensaje_chat: "¡Excelente idea pedagógica! Para adaptar las actividades al nivel exacto de tus estudiantes, ¿para qué grado escolar te gustaría preparar esta sesión?",
          plan_completado: false,
          modo: "pregunta_grado_material",
          categoria: "planificacion",
          opciones: [
            "1ro de Primaria",
            "2do de Primaria",
            "3ro de Primaria",
            "4to de Primaria",
            "5to de Primaria",
            "6to de Primaria"
          ],
          datos_planificacion: null
        },
        estado: "conversando"
      });
    }

    // Atender opción de Ojo Digital: "Leer el texto de la imagen"
    if (textoConsulta.toLowerCase().includes("leer el texto de la imagen") || textoConsulta.toLowerCase().includes("leer el texto") || textoConsulta.toLowerCase().includes("extraer texto")) {
      const msgConFoto = [...messages].reverse().find((m) => m.imageBase64);
      if (msgConFoto) {
        try {
          const visionModels = getGeminiVisionModels(env);
          let textoExtraido = "";
          const cleanOcrBase64 = String(msgConFoto.imageBase64).replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "").trim();
          for (const vModel of visionModels) {
            try {
              const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${vModel}:generateContent`;
              const res = await fetchGeminiWithRetry(geminiUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-goog-api-key": env.GEMINI_API_KEY
                },
                body: JSON.stringify({
                  contents: [{
                    role: "user",
                    parts: [
                      { text: "Eres un asistente de lectura pedagógica. Transcribe con exactitud, buena ortografía y puntuación clara todo el texto legible visible en esta imagen. Si hay títulos, subtítulos o listas, organízalos ordenadamente en párrafos. No inventes texto no visible." },
                      { inlineData: { mimeType: msgConFoto.mediaType || "image/jpeg", data: cleanOcrBase64 } }
                    ]
                  }],
                  generationConfig: { temperature: 0.1 }
                })
              });
              if (res && res.ok) {
                const d = await res.json();
                textoExtraido = d.candidates?.[0]?.content?.parts?.[0]?.text || "";
                if (textoExtraido) break;
              }
            } catch (err) {}
          }
          if (!textoExtraido) textoExtraido = "No se detectó texto legible en la imagen.";
          return responderWorker({
            data: {
              mensaje_chat: `📄 **Texto extraído de la imagen:**\n\n${textoExtraido}\n\n¿Qué te gustaría hacer con este material?`,
              plan_completado: false,
              modo: "texto_extraido",
              categoria: "accion_app",
              opciones: [
                "Planificar una clase con esta lectura",
                "Crear preguntas de comprensión",
                "Buscar en el currículo"
              ],
              datos_planificacion: null
            },
            estado: "conversando"
          });
        } catch (ocrErr) {
          return responderWorker({
            data: {
              mensaje_chat: "La cámara no está disponible ahora para leer el texto. Puedes dictarlo o escribir el tema directamente.",
              plan_completado: false,
              modo: "error_camara"
            },
            estado: "conversando"
          });
        }
      }
    }

    // Clasificación de intención (0 ms, reglas deterministas)
    const clasificacion = await clasificarIntencion({ texto: textoParaProcesar, env });

    // 1. MODO CHARLA (Saludos, cortesías) -> Resolución local inmediata < 50ms ($0)
    if (clasificacion.categoria === "charla") {
      const respCharla = generarRespuestaCharlaLocal({
        texto: textoParaProcesar,
        nombreDocente: body.nombreDocente || null
      });
      if (imageBase64) {
        respCharla.mensaje_chat = `${respCharla.mensaje_chat}\n\nVeo la foto que adjuntaste. ¿Qué te gustaría hacer con ella?`;
        respCharla.opciones = [
          "Identificar qué hay en la foto",
          "Usarla como material de clase",
          "Buscar en el currículo"
        ];
      }
      return responderWorker({ data: respCharla, estado: "charla" });
    }

    // 2. MODO ACCION DE APP -> Respuesta local inmediata
    if (clasificacion.categoria === "accion_app") {
      return responderWorker({
        data: {
          mensaje_chat: `Entendido. Procesando acción de la aplicación: ${clasificacion.motivo}`,
          plan_completado: false,
          modo: "accion_app",
          categoria: "accion_app",
          datos_planificacion: null
        },
        estado: "pensando"
      });
    }

    // 3. MODO AMBIGUO -> Pregunta con botones de aclaración (sin adivinar)
    if (clasificacion.categoria === "ambigua") {
      return responderWorker({
        data: {
          mensaje_chat: "No identifiqué con claridad el tema escolar en tu consulta. ¿Deseas: 1) Planificar una clase del currículo oficial del MINERD, 2) Consultar información general, o 3) Ajustar el tema pedagógico?",
          plan_completado: false,
          requiereAclaracion: true,
          modo: "ambigua",
          categoria: "ambigua",
          tipoClasificado: "ambigua",
          confianza: clasificacion.confianza,
          opciones: clasificacion.opciones || [
            "Planificar una clase oficial MINERD",
            "Consultar información general",
            "Ajustar tema pedagógico"
          ],
          motivo: clasificacion.motivo
        },
        estado: "pensando"
      });
    }

    // 3.5. MODO BÚSQUEDA WEB -> Tavily Search
    if (clasificacion.categoria === "busqueda_web") {
      let fuentesCitas = [];
      if (env.TAVILY_API_KEY) {
        try {
          const tavilyRes = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              api_key: env.TAVILY_API_KEY,
              query: textoParaProcesar,
              search_depth: "basic",
              max_results: 5,
              include_answer: true
            })
          });
          if (tavilyRes.ok) {
            const dataT = await tavilyRes.json();
            if (dataT.results) {
              fuentesCitas = dataT.results.map(r => ({
                titulo: r.title,
                url: r.url,
                resumen: r.content ? r.content.slice(0, 200) : ""
              }));
            }
            if (dataT.answer) {
              const fuentesStr = fuentesCitas.map(f => `\n- [${f.titulo}](${f.url})`).join("");
              return responderWorker({
                data: {
                  mensaje_chat: `${dataT.answer}\n\n**Fuentes verificadas en internet:**${fuentesStr}`,
                  plan_completado: false,
                  modo: "busqueda_web",
                  categoria: "busqueda_web",
                  fuentes: fuentesCitas,
                  datos_planificacion: null
                },
                estado: "conversando"
              });
            }
          }
        } catch (eTav) {
          console.warn("Worker Tavily search error:", eTav.message);
        }
      }
    }

    // 4. MODO CONOCIMIENTO GENERAL -> Conversacional directo con modelo sin buscar en currículo oficial
    if (clasificacion.categoria === "conocimiento_general") {
      const aviso = "\n\n*(Nota: Esta es una explicación pedagógica general, no una cita textual del currículo oficial MINERD. Si deseas llevar este concepto a una actividad de clase o situación de aprendizaje, dime el grado y lo armamos.)*";

      if (iaApagada) return generarErrorPlanificacion("IA_NO_DISPONIBLE", "El servicio de inteligencia artificial est� en mantenimiento breve.", "Puedes seguir consultando el curr�culo oficial y las secuencias did�cticas disponibles.", false);

      if (!env.GEMINI_API_KEY) {
        const avisoHonesto = "La consulta de conocimiento general requiere conexión con el modelo de inteligencia artificial. En este momento el servicio externo no está disponible o no tiene cuota configurada. Puedes consultar contenidos directamente del currículo oficial o escribir tu consulta pedagógica.";
        return responderWorker({
          data: {
            mensaje_chat: avisoHonesto,
            plan_completado: false,
            modo: "conocimiento_general",
            categoria: "conocimiento_general",
            datos_planificacion: null
          },
          estado: "conversando"
        });
      }

      // Llamar al modelo de IA con prompt conversacional
      try {
        const models = getGeminiModels(env);
        let textoGenerado = "";
        for (const model of models) {
          try {
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
            const res = await fetchGeminiWithRetry(geminiUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": env.GEMINI_API_KEY,
              },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: textoConsulta }] }],
                systemInstruction: { parts: [{ text: SYSTEM_PROMPT_CONVERSACIONAL }] },
                generationConfig: { temperature: 0.3 }
              }),
              signal: request.signal,
            });
            if (res && res.ok) {
              const data = await res.json();
              textoGenerado = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
              if (textoGenerado) break;
            }
          } catch (e) {}
        }

        if (textoGenerado) {
          const finalChat = textoGenerado.includes("currículo oficial") ? textoGenerado : `${textoGenerado}${aviso}`;
          return responderWorker({
            data: {
              mensaje_chat: finalChat,
              plan_completado: false,
              modo: "conocimiento_general",
              categoria: "conocimiento_general",
              datos_planificacion: null
            },
            estado: "conversando"
          });
        }
      } catch (err) {}

      const avisoHonesto = "La consulta de conocimiento general requiere conexión con el modelo de inteligencia artificial. En este momento el servicio externo no está disponible o no tiene cuota configurada. Puedes consultar contenidos directamente del currículo oficial o escribir tu consulta pedagógica.";
      return responderWorker({
        data: {
          mensaje_chat: avisoHonesto,
          plan_completado: false,
          modo: "conocimiento_general",
          categoria: "conocimiento_general",
          datos_planificacion: null
        },
        estado: "conversando"
      });
    }

    const esquema = LEVELS[nivel] || LEVELS["primario"];
    const instruccionesTemporal = PROFUNDIDAD_TEMPORAL[periodo] || PROFUNDIDAD_TEMPORAL["diaria"];

    // Caché segura en memoria y KV (SHA-256 curricular sin datos personales)
    const claveCache = (!imageBase64 && textoConsulta)
      ? await generarClaveCurricularSha256({
          grado: body.grado || "",
          area: body.area || "",
          tema: textoConsulta,
          nivel: nivel || "primario",
          periodo: periodo || "diaria"
        })
      : null;

    if (claveCache) {
      let respCache = obtenerRespuestaDeCache(claveCache);
      if (!respCache && env && (env.CACHE_KV || env.CURRICULO_KV)) {
        respCache = await obtenerRespuestaDeKv(claveCache, env);
      }
      if (respCache) {
        return responderWorker({
          data: {
            ...respCache,
            planId: "plan_" + Date.now(),
            nivel,
            periodo,
            nivelLabel: esquema.label,
            origen: "cache_en_memoria",
            cuota: cheqCuota
          },
          estado: "curriculo"
        });
      }
    }

    // Fecha de la planificación: indicada por el maestro o calculada hoy en hora de República Dominicana
    let fechaPlanificacion = (body.fecha || "").trim();
    if (!fechaPlanificacion) {
      const parts = new Intl.DateTimeFormat("es-DO", {
        timeZone: "America/Santo_Domingo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date());
      const d = parts.find((p) => p.type === "day")?.value || "01";
      const m = parts.find((p) => p.type === "month")?.value || "01";
      const y = parts.find((p) => p.type === "year")?.value || "2026";
      fechaPlanificacion = `${y}-${m}-${d}`;
    }

    // Comprobar si la base oficial está cargada en Supabase
    let baseOficialCargada = false;
    if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const checkBaseRes = await fetch(`${env.SUPABASE_URL}/rest/v1/curriculo_fragmentos?select=id&limit=1`, {
          headers: {
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
        });
        if (checkBaseRes.ok) {
          const rows = await checkBaseRes.json();
          baseOficialCargada = Array.isArray(rows) && rows.length > 0;
        }
      } catch (e) {}
    }

    const avisoSinVerificar = "Borrador: revísalo con el currículo antes de usarlo";
    let directivaBorrador = "";
    if (!baseOficialCargada) {
      directivaBorrador = `
## ALERTA OBLIGATORIA (BASE OFICIAL NO CARGADA)
1. Debes iniciar OBLIGATORIAMENTE tu campo 'mensaje_chat' con la advertencia:
"[AVISO] ${avisoSinVerificar}"
2. En 'confianza_curricular', establece obligatoriamente:
   - "nivel_certeza": "referencial, no verificado"
   - "bloques_aproximados": []
   - "nota_revision": "Planificación referencial no contrastada con la base curricular oficial. El docente debe validar los indicadores y competencias con su registro de grado."
3. En 'datos_planificacion', cualquier competencia, indicador o contenido que no esté textualmente respaldado por el currículo oficial debe marcarse con [REFERENCIAL / SUGERENCIA].
`;
    }

    // Inyección de CON BASE si aplica (Muestra referencial local no verificada)
    let groundingConBase = "";
    if (nivel === "conbase") {
      const allText = messages.map((m) => m.text || "").join(" ").toLowerCase();
      let grado = body.grado || "";
      if (!grado) {
        if (allText.includes("1ro") || allText.includes("primer")) grado = "1ro de Primaria";
        else if (allText.includes("2do") || allText.includes("segundo")) grado = "2do de Primaria";
        else if (allText.includes("3ro") || allText.includes("tercer")) grado = "3ro de Primaria";
      }

      let area = body.area || "";
      if (!area) {
        if (allText.includes("lengua") || allText.includes("español")) area = "Lengua Española";
        else if (allText.includes("matem")) area = "Matemática";
      }

      const tema = body.tema || (messages[0]?.text ? messages[0].text.substring(0, 100) : "");
      const resConBase = obtenerContextoConBase(grado, area, tema);
      if (resConBase.cubierto) {
        groundingConBase = `\nMUESTRA REFERENCIAL LOCAL (NO VERIFICADA) DEL PROGRAMA CON BASE:\n${resConBase.contexto}\n`;
      }
    }

    // Poda curricular relevante de ciclos y áreas
    let ciclosTexto = esquema.ciclos.join(", ");
    if (body.grado) {
      const gNorm = body.grado.toLowerCase();
      const ciclosFiltrados = esquema.ciclos.filter(c => c.toLowerCase().includes(gNorm.slice(0, 3)));
      if (ciclosFiltrados.length > 0) ciclosTexto = ciclosFiltrados.join(", ");
    }
    let areasTexto = esquema.areas.join(", ");
    if (body.area) {
      const aNorm = body.area.toLowerCase();
      const areasFiltradas = esquema.areas.filter(a => a.toLowerCase().includes(aNorm) || aNorm.includes(a.toLowerCase()));
      if (areasFiltradas.length > 0) areasTexto = areasFiltradas.join(", ");
    }

    const usaPromptV2 = Boolean(env && (env.PROMPT_SISTEMA_V2 === "true" || env.PROMPT_SISTEMA_V2 === true));
    const basePrompt = usaPromptV2 ? PROMPT_SISTEMA_V2_TEXTO : SYSTEM_PROMPT;

    const dynamicPrompt = `${basePrompt}
## ESQUEMA SELECCIONADO: ${esquema.label}
- Ciclo relevante: ${ciclosTexto}
- Área relevante: ${areasTexto}
${instruccionesTemporal}
${groundingConBase}
${directivaBorrador}

## FECHA DE LA PLANIFICACIÓN:
- En 'datos_planificacion', en el bloque de datos generales, el campo 'fecha' debe ser EXACTAMENTE: "${fechaPlanificacion}". Prohibido inventar fechas o usar fechas del pasado.

## BLOQUES OBLIGATORIOS PARA 'datos_planificacion':
${esquema.bloques.map((b) => `"${b}"`).join("\n")}
`;

    // Mapeo de contenido para Gemini
    const contents = messages.map((msg, idx) => {
      const parts = [];
      let text = msg.text || "";
      if (idx === 0 && msg.role === "user") {
        text = `[Contexto: Esquema "${esquema.label}", Periodo: "${periodo}"]\n\n${text}`;
      }
      if (msg.imageBase64 && msg.mediaType) {
        parts.push({
          inlineData: {
            mimeType: msg.mediaType,
            data: msg.imageBase64,
          },
        });
      }
      if (text) {
        parts.push({ text });
      }
      return {
        role: msg.role === "user" ? "user" : "model",
        parts: parts.length > 0 ? parts : [{ text: "..." }],
      };
    });

    if (iaApagada) return generarErrorPlanificacion("IA_NO_DISPONIBLE", "El servicio de inteligencia artificial est� en mantenimiento breve.", "Puedes seguir consultando el curr�culo oficial y las secuencias did�cticas disponibles.", false);

    if (!env.GEMINI_API_KEY) {
        return generarErrorPlanificacion("ERROR_INTERNO", "Tuve un problema interno y no sé la causa exacta; te dejo un código para soporte.", "Falta GEMINI_API_KEY en la configuración del servidor.", false);
      }

    const modeloHeader = request.headers.get("x-gemini-model");
    const modeloBody = body && body.modelo ? body.modelo : null;
    const models = getGeminiModels(env, modeloHeader || modeloBody);

    // Modo Streaming SSE
    if (isStream) {
      let promptParaStreaming = dynamicPrompt;
      let fragmentosRecuperadosTexto = "";
      let consultasAuditadasStreaming = [];

      const usaHerramientasV2 = Boolean(env && (env.HERRAMIENTAS_V2 === "true" || env.HERRAMIENTAS_V2 === true));
      if (usaHerramientasV2) {
        try {
          const modelHerramientas = models[0] || "gemini-3.1-flash-lite";
          const cicloRes = await cicloToolCalling({
            promptUsuario: textoParaProcesar,
            llamadaModeloIA: async (payload) => {
              const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelHerramientas}:generateContent`;
              const gemRes = await fetchGeminiWithRetry(geminiUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-goog-api-key": env.GEMINI_API_KEY,
                },
                body: JSON.stringify({
                  contents: payload.contents,
                  tools: payload.tools,
                  systemInstruction: { parts: [{ text: basePrompt }] },
                  generationConfig: {
                    temperature: 0.0,
                    maxOutputTokens: 2048,
                  },
                }),
                signal: request.signal,
              });
              if (!gemRes || !gemRes.ok) {
                const errTxt = gemRes ? await gemRes.text() : "No response";
                throw new Error(`Gemini call error: ${errTxt}`);
              }
              return await gemRes.json();
            },
            env,
            maxIteraciones: 3,
          });

          if (cicloRes && cicloRes.consultas && cicloRes.consultas.length > 0) {
            consultasAuditadasStreaming = cicloRes.consultas;
            const filasTodas = cicloRes.consultas.flatMap((c) => c.filas || []);
            if (filasTodas.length > 0) {
              fragmentosRecuperadosTexto = filasTodas
                .map((f) => `[Fuente: ${f.fuente_documento || "MINERD"} | Pág: ${f.pagina || "N/A"}] ${f.tema || ""}: ${f.competencia_especifica || ""} - ${f.indicador_logro || f.contenidos_texto_original || ""}`)
                .join("\n");
              promptParaStreaming += `\n=== FRAGMENTOS CURRICULARES OFICIALES RECUPERADOS ===\n<DATO>\n${fragmentosRecuperadosTexto}\n</DATO>\n`;
            }
          }
        } catch (errCicloStreaming) {
          console.warn("[Herramientas V2 Streaming] Falló ciclo de herramientas, procediendo con degradación pedagógica:", errCicloStreaming.message);
        }
      }

      let geminiRes = null;
      let ultimoError = null;
      let ultimoStatus = 500;

      for (const model of models) {
        const geminiStreamUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;
        try {
          const res = await fetchGeminiWithRetry(geminiStreamUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": env.GEMINI_API_KEY,
            },
            body: JSON.stringify({
              contents,
              systemInstruction: { parts: [{ text: promptParaStreaming }] },
              generationConfig: {
                temperature: 0.0,
                responseMimeType: "application/json",
                maxOutputTokens: 8192,
              },
            }),
            signal: request.signal,
          });

          if (res && res.ok) {
            geminiRes = res;
            break;
          } else if (res) {
            ultimoStatus = res.status;
            ultimoError = `HTTP_${res.status}`;
            console.warn(`[AI Warn] Modelo ${model} falló con status ${res.status}`);
          }
        } catch (e) {
          ultimoError = "FETCH_EXCEPTION";
          console.warn(`[AI Warn] Excepción en modelo ${model}`);
        }
      }

      if (!geminiRes) {
        const incidentId = "INC-" + generarCodigoSeguro(6);
        console.error(`[AI Error ${incidentId}] Modelos agotados. Código: ${ultimoStatus} - ${ultimoError}`);
        const codigo = (ultimoStatus === 429)
          ? "PROVEEDOR_IA_SATURADO"
          : (ultimoStatus === 503 || ultimoStatus === 502 || ultimoStatus === 504)
          ? "IA_NO_DISPONIBLE"
          : "ERROR_INTERNO";
        const mensaje = (ultimoStatus === 429)
          ? "Se agotó temporalmente la cuota con el proveedor de IA."
          : (ultimoStatus === 503 || ultimoStatus === 502 || ultimoStatus === 504)
          ? "El servidor de inteligencia artificial está ocupado en este momento."
          : "Ocurrió un problema de configuración o conexión con el proveedor de IA.";
        const sugerencia = (ultimoStatus === 429 || ultimoStatus === 503 || ultimoStatus === 502 || ultimoStatus === 504)
          ? "Espera un minuto y pulsa 'Reintentar'."
          : "Contacta a soporte indicando tu código de incidente.";
        return generarErrorPlanificacion(codigo, mensaje, sugerencia, true, 200);
      }

      // Transformar el stream de Gemini a SSE limpio para el cliente
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const reader = geminiRes.body.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();

      ctx.waitUntil(
        (async () => {
          let fullText = "";
          let corteOcurrio = null;
          const bloquesEmitidos = new Set();
          const streamingProgresivo = (env && env.STREAMING_PROGRESIVO !== undefined)
            ? (env.STREAMING_PROGRESIVO === "true" || env.STREAMING_PROGRESIVO === true)
            : true;

          try {
            await writer.write(encoder.encode(`data: ${JSON.stringify({ estado: "curriculo" })}\n\n`));
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split("\n");
              for (const line of lines) {
                if (line.startsWith("data:")) {
                  const jsonStr = line.replace(/^data:\s*/, "").trim();
                  if (jsonStr && jsonStr !== "[DONE]") {
                    try {
                      const parsedChunk = JSON.parse(jsonStr);
                      const cand = parsedChunk.candidates?.[0];
                      if (cand?.finishReason && cand.finishReason !== "STOP") {
                        corteOcurrio = cand.finishReason;
                      }
                      const part = cand?.content?.parts?.[0]?.text;
                      if (part) {
                        fullText += part;
                        if (streamingProgresivo) {
                          const nuevosBloques = extraerBloquesCompletados(fullText, bloquesEmitidos);
                          for (const b of nuevosBloques) {
                            await writer.write(encoder.encode(`data: ${JSON.stringify(b)}\n\n`));
                          }
                        }
                      }
                    } catch (e) {}
                  }
                }
              }
            }

            // 1. Procesar con parseador seguro
            let parsedFinal = extraerJson(fullText);

            // 2. Si no es válido o hubo corte, intentar reparación sintáctica inteligente de corchetes/llaves
            if (!parsedFinal || !validarCamposPlanificacion(parsedFinal)) {
              const reparado = repararJsonTruncado(fullText);
              if (reparado && typeof reparado === "object") {
                if (planEsRecuperable(reparado)) {
                  if (!reparado.mensaje_chat) {
                    reparado.mensaje_chat = "He organizado la planificación docente para tu clase.";
                  }
                  reparado.plan_completado = true;
                  if (!reparado.confianza_curricular) {
                    reparado.confianza_curricular = {
                      nivel_certeza: "alta",
                      bloques_aproximados: [],
                      nota_revision: "Estructura recuperada exitosamente mediante reparación sintáctica segura."
                    };
                  }
                  parsedFinal = reparado;
                } else {
                  parsedFinal = reparado;
                }
              }
            }

            let esValido = Boolean(parsedFinal && validarCamposPlanificacion(parsedFinal) && !corteOcurrio);

            // 3. Si se recuperaron bloques esenciales (datos_generales + momentos/actividades), armar el plan con lo que hay sin reintentar llamada completa
            if (!esValido && parsedFinal && planEsRecuperable(parsedFinal)) {
              parsedFinal.plan_completado = true;
              esValido = true;
            } else if (!esValido && env.GEMINI_API_KEY && parsedFinal && parsedFinal.datos_planificacion) {
              // 4. Reparación enfocada: solo si faltan bloques críticos, pedir ÚNICAMENTE los bloques faltantes
              const claves = Object.keys(parsedFinal.datos_planificacion).map((k) => k.toLowerCase());
              const faltaSecuencia = !claves.some((k) => k.includes("momento") || k.includes("actividad") || k.includes("secuencia"));
              if (faltaSecuencia) {
                try {
                  const promptEnfocado = `Genera ÚNICAMENTE las actividades didácticas (Inicio, Desarrollo, Cierre) para una clase de grado ${body.grado || "3ro"} área ${body.area || "Ciencias Sociales"} tema ${textoConsulta || "clase"}. Devuelve SOLO un objeto JSON con la clave "momentos": {"inicio": "...", "desarrollo": "...", "cierre": "..."}.`;
                  const retryModel = models[0] || "gemini-3.1-flash-lite";
                  const retryUrl = `https://generativelanguage.googleapis.com/v1beta/models/${retryModel}:generateContent`;
                  const resSec = await fetchGeminiWithRetry(retryUrl, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "x-goog-api-key": env.GEMINI_API_KEY,
                    },
                    body: JSON.stringify({
                      contents: [{ role: "user", parts: [{ text: promptEnfocado }] }],
                      generationConfig: {
                        temperature: 0.0,
                        responseMimeType: "application/json",
                        maxOutputTokens: 1024,
                      },
                    }),
                    signal: request.signal,
                  });
                  if (resSec && resSec.ok) {
                    const dSec = await resSec.json();
                    const tSec = dSec.candidates?.[0]?.content?.parts?.[0]?.text;
                    const pSec = extraerJson(tSec);
                    if (pSec && (pSec.momentos || pSec.actividades)) {
                      parsedFinal.datos_planificacion["6. Actividades: Inicio - Desarrollo - Cierre"] = pSec.momentos || pSec.actividades;
                      parsedFinal.plan_completado = true;
                      esValido = true;
                    }
                  }
                } catch (eFocado) {
                  console.error("[Worker Error] Reparación enfocada de actividades falló:", eFocado.message);
                }
              }
            }

            // 5. Reintento único completo sólo si los pasos anteriores de recuperación fallaron
            if (!esValido && env.GEMINI_API_KEY) {
              try {
                const promptReintento = `${dynamicPrompt}\n\nINSTRUCCIÓN CRÍTICA DE REINTENTO: En el intento previo la respuesta quedó incompleta o con JSON inválido. Por favor, genera la planificación completa en formato JSON estricto pero de manera más breve y sintetizada, asegurando que todos los campos requeridos estén presentes y el JSON cierre perfectamente con '}'.`;
                const retryModel = models[0] || "gemini-3.1-flash-lite";
                const retryUrl = `https://generativelanguage.googleapis.com/v1beta/models/${retryModel}:generateContent`;
                const retryRes = await fetchGeminiWithRetry(retryUrl, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": env.GEMINI_API_KEY,
                  },
                  body: JSON.stringify({
                    contents,
                    systemInstruction: { parts: [{ text: promptReintento }] },
                    generationConfig: {
                      temperature: 0.0,
                      responseMimeType: "application/json",
                      maxOutputTokens: 8192,
                    },
                  }),
                  signal: request.signal,
                });
                if (retryRes && retryRes.ok) {
                  const retryData = await retryRes.json();
                  const retryCand = retryData.candidates?.[0];
                  if (!retryCand?.finishReason || retryCand.finishReason === "STOP") {
                    const retryRaw = retryCand?.content?.parts?.[0]?.text || "";
                    const retryParsed = extraerJson(retryRaw);
                    if (retryParsed && validarCamposPlanificacion(retryParsed)) {
                      parsedFinal = retryParsed;
                      esValido = true;
                    }
                  }
                }
              } catch (errRetry) {
                console.error("[Worker Error] Reintento completo con JSON estricto falló:", errRetry.message);
              }
            }

            if (!esValido || !parsedFinal) {
              const camposFaltantes = [];
              if (!parsedFinal) {
                camposFaltantes.push("estructura JSON válida");
              } else {
                if (!mensajeParaChat(parsedFinal)) camposFaltantes.push("mensaje explicativo");
                if (parsedFinal.plan_completado && (!parsedFinal.datos_planificacion || typeof parsedFinal.datos_planificacion !== "object")) {
                  camposFaltantes.push("bloques de datos_planificacion");
                }
              }

              const motivoDetalle = camposFaltantes.length > 0
                ? `faltó: ${camposFaltantes.join(", ")}`
                : "formato de respuesta no canónico";

              console.error("[Worker Error] Validación de campos fallida para planificación:", {
                esValido,
                corteOcurrio,
                camposFaltantes,
                longitudTexto: (fullText || "").length,
                muestraTexto: (fullText || "").slice(0, 300)
              });

              parsedFinal = {
                ok: false,
                isError: true,
                codigo: "IA_RESPUESTA_INVALIDA",
                mensaje: `El modelo de IA devolvió una estructura incompleta (${motivoDetalle}).`,
                sugerencia: "Intenta pedir la planificación nuevamente indicando el área curricular, grado y un tema específico.",
                reintentable: true,
                mensaje_chat: `Tuve dificultades para organizar los componentes de esta planificación (${motivoDetalle}).\n\n💡 Sugerencia: Intenta solicitarla nuevamente con términos más específicos.`,
                plan_completado: false,
                diagnostico_tecnico: {
                  motivo: "VALIDACION_CAMPOS_FALLIDA",
                  campos_faltantes: camposFaltantes,
                  corte_ocurrio: corteOcurrio,
                  timestamp: new Date().toISOString()
                }
              };
            }

            if (consultasAuditadasStreaming && consultasAuditadasStreaming.length > 0) {
              parsedFinal.consultas_curriculo = consultasAuditadasStreaming;
              if (parsedFinal.plan_completado && !parsedFinal.confianza_curricular) {
                parsedFinal.confianza_curricular = {
                  nivel_certeza: "alta",
                  documento_fuente: "Currículo Oficial MINERD / CON BASE",
                  bloques_aproximados: []
                };
              }
            }

            let estadoActualizado = cheqCuota;
            if (parsedFinal && parsedFinal.plan_completado) {
              estadoActualizado = await consumirCuota(env, resolvedDocenteId, isOwner, clientIp);
            }

            if (!baseOficialCargada && parsedFinal.plan_completado) {
              if (parsedFinal.mensaje_chat && !parsedFinal.mensaje_chat.includes(avisoSinVerificar)) {
                parsedFinal.mensaje_chat = `⚠️ ${avisoSinVerificar}\n\n${parsedFinal.mensaje_chat}`;
              }
              const infoReferencial = {
                nivel_certeza: "referencial, no verificado",
                bloques_aproximados: [],
                nota_revision: "Planificación referencial no contrastada con la base curricular oficial. El docente debe validar los indicadores y competencias con su registro de grado.",
              };
              parsedFinal.confianza_curricular = infoReferencial;
              parsedFinal.confianzaCurricular = infoReferencial;
            }

            // Garantizar fecha real no inventada
            if (parsedFinal && parsedFinal.datos_planificacion) {
              const claveDatos = Object.keys(parsedFinal.datos_planificacion).find((k) => k.toLowerCase().includes("datos generales"));
              if (claveDatos && typeof parsedFinal.datos_planificacion[claveDatos] === "object" && parsedFinal.datos_planificacion[claveDatos] !== null) {
                parsedFinal.datos_planificacion[claveDatos].fecha = fechaPlanificacion;
              }
              if (parsedFinal.datos_planificacion.fecha) {
                parsedFinal.datos_planificacion.fecha = fechaPlanificacion;
              }
            }

            const finalPayload = {
              ...parsedFinal,
              planId: "plan_" + Date.now(),
              nivel,
              periodo,
              nivelLabel: esquema.label,
              cuota: estadoActualizado,
            };

            if (claveCache && esRespuestaCacheable(parsedFinal)) {
              await guardarRespuestaEnCache(claveCache, parsedFinal, undefined, env, ctx);
            }

            await writer.write(encoder.encode(`data: ${JSON.stringify({ final: finalPayload })}\n\n`));
            await writer.write(encoder.encode("data: [DONE]\n\n"));
          } catch (err) {
            await writer.write(
              encoder.encode(`data: ${JSON.stringify({ final: {
                ok: false,
                isError: true,
                codigo: "ERROR_INTERNO",
                mensaje: "Error inesperado al procesar la respuesta del modelo.",
                sugerencia: "Intenta de nuevo en unos momentos.",
                reintentable: true,
                mensaje_chat: "Ocurrió un error inesperado al procesar la planificación.\n\n💡 Sugerencia: Intenta de nuevo.",
                plan_completado: false
              } })}\n\n`)
            );
          } finally {
            writer.close();
          }
        })()
      );

      return new Response(readable, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Modo JSON Estándar (Fallback / Non-Streaming)
    const usaHerramientasV2 = Boolean(env && (env.HERRAMIENTAS_V2 === "true" || env.HERRAMIENTAS_V2 === true));

    if (usaHerramientasV2) {
      try {
        const modelHerramientas = models[0] || "gemini-3.1-flash-lite";
        const cicloRes = await cicloToolCalling({
          promptUsuario: textoParaProcesar,
          llamadaModeloIA: async (payload) => {
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelHerramientas}:generateContent`;
            const gemRes = await fetchGeminiWithRetry(geminiUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": env.GEMINI_API_KEY,
              },
              body: JSON.stringify({
                contents: payload.contents,
                tools: payload.tools,
                systemInstruction: { parts: [{ text: dynamicPrompt }] },
                generationConfig: {
                  temperature: 0.0,
                  maxOutputTokens: 8192,
                },
              }),
              signal: request.signal,
            });
            if (!gemRes || !gemRes.ok) {
              const errTxt = gemRes ? await gemRes.text() : "No response";
              throw new Error(`Gemini call error: ${errTxt}`);
            }
            return await gemRes.json();
          },
          env,
          maxIteraciones: 3,
        });

        if (cicloRes.tipo === "tool_calling_completado" || cicloRes.tipo === "directa") {
          const rawText = cicloRes.texto || "";
          let parsed = extraerJson(rawText);
          if (!parsed) {
            parsed = {
              mensaje_chat: rawText,
              plan_completado: false,
              consultas_curriculo: cicloRes.consultas || [],
            };
          } else {
            parsed.consultas_curriculo = cicloRes.consultas || [];
          }

          let cuotaActualizada = cheqCuota;
          if (parsed.plan_completado) {
            cuotaActualizada = await consumirCuota(env, resolvedDocenteId, isOwner, clientIp);
          }

          if (claveCache && esRespuestaCacheable(parsed)) {
            guardarRespuestaEnCache(claveCache, parsed);
          }

          return new Response(
            JSON.stringify({
              ...parsed,
              planId: "plan_" + Date.now(),
              nivel,
              periodo,
              nivelLabel: esquema.label,
              cuota: cuotaActualizada,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (errCiclo) {
        console.warn("[Herramientas V2] Falló cicloToolCalling, cayendo a flujo estándar:", errCiclo.message);
      }
    }

    let geminiData = null;
    let ultimoError = null;
    let ultimoStatus = 500;

    for (const model of models) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        const geminiRes = await fetchGeminiWithRetry(geminiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY,
          },
          body: JSON.stringify({
            contents,
            systemInstruction: { parts: [{ text: dynamicPrompt }] },
            generationConfig: {
              temperature: 0.0,
              responseMimeType: "application/json",
              maxOutputTokens: 8192,
            },
          }),
          signal: request.signal,
        });

        if (geminiRes && geminiRes.ok) {
          geminiData = await geminiRes.json();
          break;
        } else if (geminiRes) {
          ultimoStatus = geminiRes.status;
          ultimoError = `HTTP_${geminiRes.status}`;
          console.warn(`[AI Warn] Modelo ${model} falló con status ${geminiRes.status}`);
        }
      } catch (err) {
        ultimoError = "FETCH_EXCEPTION";
        console.warn(`[AI Warn] Excepción en modelo ${model}`);
      }
    }

    if (geminiData) {
      const cand = geminiData.candidates?.[0];
      const rawText = cand?.content?.parts?.[0]?.text || "";
      const finishReason = cand?.finishReason;
      let parsed = (finishReason && finishReason !== "STOP") ? null : extraerJson(rawText);
      let esValido = Boolean(parsed && validarCamposPlanificacion(parsed));

      if (!esValido && env.GEMINI_API_KEY) {
        try {
          const promptReintento = `${dynamicPrompt}\n\nINSTRUCCIÓN CRÍTICA DE REINTENTO: En el intento previo la respuesta quedó incompleta o con JSON inválido. Por favor, genera la planificación completa en formato JSON estricto pero de manera más breve y sintetizada, asegurando que todos los campos requeridos estén presentes y el JSON cierre perfectamente con '}'.`;
          const retryModel = models[0] || "gemini-3.1-flash-lite";
          const retryUrl = `https://generativelanguage.googleapis.com/v1beta/models/${retryModel}:generateContent`;
          const retryRes = await fetchGeminiWithRetry(retryUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": env.GEMINI_API_KEY,
            },
            body: JSON.stringify({
              contents,
              systemInstruction: { parts: [{ text: promptReintento }] },
              generationConfig: {
                temperature: 0.0,
                responseMimeType: "application/json",
                maxOutputTokens: 8192,
              },
            }),
            signal: request.signal,
          });
          if (retryRes && retryRes.ok) {
            const retryData = await retryRes.json();
            const retryCand = retryData.candidates?.[0];
            if (!retryCand?.finishReason || retryCand.finishReason === "STOP") {
              const retryRaw = retryCand?.content?.parts?.[0]?.text || "";
              const retryParsed = extraerJson(retryRaw);
              if (retryParsed && validarCamposPlanificacion(retryParsed)) {
                parsed = retryParsed;
                esValido = true;
              }
            }
          }
        } catch (e) {}
      }

      if (!esValido || !parsed) {
        parsed = {
          ok: false,
          isError: true,
          codigo: "IA_RESPUESTA_INVALIDA",
          codigoError: "IA_RESPUESTA_INVALIDA",
          mensaje: "La respuesta generada por el modelo de IA no tiene la estructura requerida.",
          mensaje_chat: "No pude armar la planificación con el formato oficial requerido. ¿Intentamos otra vez con términos más específicos?",
          sugerencia: "Intenta solicitarla nuevamente indicando el grado, área y tema específico.",
          plan_completado: false,
          reintentable: true
        };
      }

      let cuotaActualizada = cheqCuota;
      if (parsed.plan_completado) {
        cuotaActualizada = await consumirCuota(env, resolvedDocenteId, isOwner, clientIp);
      }

      if (!baseOficialCargada && parsed.plan_completado) {
        if (parsed.mensaje_chat && !parsed.mensaje_chat.includes(avisoSinVerificar)) {
          parsed.mensaje_chat = `⚠️ ${avisoSinVerificar}\n\n${parsed.mensaje_chat}`;
        }
        const infoReferencial = {
          nivel_certeza: "referencial, no verificado",
          bloques_aproximados: [],
          nota_revision: "Planificación referencial no contrastada con la base curricular oficial. El docente debe validar los indicadores y competencias con su registro de grado.",
        };
        parsed.confianza_curricular = infoReferencial;
        parsed.confianzaCurricular = infoReferencial;
      }

      // Garantizar fecha real no inventada
      if (parsed && parsed.datos_planificacion) {
        const claveDatos = Object.keys(parsed.datos_planificacion).find((k) => k.toLowerCase().includes("datos generales"));
        if (claveDatos && typeof parsed.datos_planificacion[claveDatos] === "object" && parsed.datos_planificacion[claveDatos] !== null) {
          parsed.datos_planificacion[claveDatos].fecha = fechaPlanificacion;
        }
        if (parsed.datos_planificacion.fecha) {
          parsed.datos_planificacion.fecha = fechaPlanificacion;
        }
      }

      if (claveCache && esRespuestaCacheable(parsed)) {
        guardarRespuestaEnCache(claveCache, parsed);
      }

      return new Response(
        JSON.stringify({
          ...parsed,
          planId: "plan_" + Date.now(),
          nivel,
          periodo,
          nivelLabel: esquema.label,
          cuota: cuotaActualizada,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.error(`[AI Error] Modelos agotados. Código: ${ultimoStatus}`);
    const codigoNoStream = (ultimoStatus === 429)
      ? "PROVEEDOR_IA_SATURADO"
      : (ultimoStatus === 503 || ultimoStatus === 502 || ultimoStatus === 504)
      ? "IA_NO_DISPONIBLE"
      : "ERROR_INTERNO";
    const mensajeMaestro = (ultimoStatus === 503 || ultimoStatus === 429 || ultimoStatus === 502 || ultimoStatus === 504)
      ? "La IA está ocupada, intenta de nuevo en un minuto."
      : (ultimoStatus === 401 || ultimoStatus === 403)
      ? "Hay un problema de configuración en el servicio de generación. Por favor, contacta a soporte."
      : "La IA está ocupada, intenta de nuevo en un minuto.";

    return generarErrorPlanificacion(
      codigoNoStream,
      mensajeMaestro,
      "Espera un minuto y pulsa 'Reintentar'.",
      true,
      (ultimoStatus === 401 || ultimoStatus === 403) ? 500 : 503
    );
  }

  // 8. POST /api/plan/consultar-curriculo
  if (path === "/api/plan/consultar-curriculo" && method === "POST") {
    const auth = requerirAcceso(request, env, corsHeaders);
    if (auth.errorResponse) return auth.errorResponse;
    const isOwner = auth.isOwner;

    if (!isOwner) {
      const rlAnonimo = await verificarRateLimitAnonimo(clientIp, 30, env);
      if (!rlAnonimo.permitido) {
        return new Response(
          JSON.stringify({ ok: false, error: "Has alcanzado el límite diario de consultas para este dispositivo." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const body = await request.json().catch(() => ({}));
    const { nivel = "primario", grado = "3ro de Primaria", area = "Matemática", tema, esquemaActivo = "primario", periodoActivo = "diaria" } = body;

    if (!tema || !tema.trim()) {
      return new Response(JSON.stringify({ error: "Falta el 'tema' a consultar." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cacheKeyCurriculo = `${nivel}|${grado}|${area}|${tema.trim().toLowerCase()}|${esquemaActivo}|${periodoActivo}`;
    const cachedItem = cacheConsultasCurriculares.get(cacheKeyCurriculo);
    if (cachedItem && Date.now() < cachedItem.expiraEn) {
      return new Response(JSON.stringify(cachedItem.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "x-cache": "HIT" },
      });
    }

    if (!env.GEMINI_API_KEY) {
        return generarErrorPlanificacion("ERROR_INTERNO", "Tuve un problema interno y no sé la causa exacta; te dejo un código para soporte.", "Falta GEMINI_API_KEY en la configuración del servidor.", false);
      }

    const esquema = LEVELS[esquemaActivo] || LEVELS["primario"];
    const prompt = `Eres un asistente pedagógico de consulta curricular para República Dominicana:
Requerimiento:
- Nivel: ${nivel}, Grado: ${grado}, Área: ${area}, Tema: "${tema}"
- Esquema: ${esquema.label}, Alcance: ${periodoActivo}

Genera un JSON estricto con:
{
  "tema": "${tema}",
  "grado": "${grado}",
  "area": "${area}",
  "resumen_enfoque": "Enfoque orientativo en 2 líneas.",
  "competencias_especificas": ["..."],
  "indicadores_logro": ["..."],
  "contenidos": { "conceptuales": "...", "procedimentales": "...", "actitudinales": "..." },
  "estrategias_sugeridas": ["..."],
  "actividades_sugeridas": { "inicio": "...", "desarrollo": "...", "cierre": "..." },
  "datos_planificacion": {
    ${esquema.bloques.map((b) => `"${b}": "..."`).join(",\n    ")}
  }
}`;

    const models = getGeminiModels(env);
    let curricularData = null;
    let ultimoError = null;
    let ultimoStatus = 500;

    for (const model of models) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        const geminiRes = await fetchGeminiWithRetry(geminiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY,
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.0, responseMimeType: "application/json" },
          }),
        });

        if (geminiRes && geminiRes.ok) {
          curricularData = await geminiRes.json();
          break;
        } else if (geminiRes) {
          ultimoStatus = geminiRes.status;
          ultimoError = await geminiRes.text();
          console.warn(`[Gemini Curriculo] Modelo ${model} falló con status ${geminiRes.status}: ${ultimoError}`);
        }
      } catch (err) {
        ultimoError = err.message;
        console.warn(`[Gemini Curriculo] Excepción en modelo ${model}: ${err.message}`);
      }
    }

    if (curricularData) {
      const text = curricularData.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const parsed = extraerJsonValido(text);
      if (parsed) {
        if (cacheConsultasCurriculares.size > 200) {
          const primerKey = cacheConsultasCurriculares.keys().next().value;
          cacheConsultasCurriculares.delete(primerKey);
        }
        cacheConsultasCurriculares.set(cacheKeyCurriculo, { data: parsed, expiraEn: Date.now() + 3600000 });
        return new Response(JSON.stringify(parsed), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.error("[Gemini Curriculo Fail] Modelos agotados:", ultimoError);
    const mensajeMaestro = (ultimoStatus === 503 || ultimoStatus === 429 || ultimoStatus === 502 || ultimoStatus === 504)
      ? "La IA está ocupada, intenta de nuevo en un minuto."
      : (ultimoStatus === 401 || ultimoStatus === 403)
      ? "Hay un problema de configuración en el servicio de generación. Por favor, contacta a soporte."
      : "La IA está ocupada, intenta de nuevo en un minuto.";

    return new Response(JSON.stringify({ error: mensajeMaestro }), {
      status: (ultimoStatus === 401 || ultimoStatus === 403) ? 500 : 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 9. POST /api/plan/ajustes-manuales
  if (path === "/api/plan/ajustes-manuales" && method === "POST") {
    return new Response(JSON.stringify({ ok: true, mensaje: "Ajuste registrado." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 9.1 POST /api/usuario/solicitar-eliminacion (Token de confirmación de un solo uso, TTL 5 min)
  if (path === "/api/usuario/solicitar-eliminacion" && method === "POST") {
    const authHeader = request.headers.get("authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Se requiere token de autenticación (Bearer)." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.substring(7).trim();

    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Servicio de autenticación no configurado." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validar token estrictamente con Supabase auth
    const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      },
    });

    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: "Sesión inválida o expirada." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userData = await userRes.json();
    const userId = userData.id;
    const userEmail = userData.email;

    if (!checkDeletionRateLimit(userId)) {
      return new Response(
        JSON.stringify({ error: "Demasiados intentos fallidos. Bloqueado temporalmente por 15 minutos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generar token de confirmación de un solo uso criptográficamente seguro (6 caracteres)
    const confirmationToken = generarCodigoSeguro(6);
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutos TTL

    pendingAccountDeletions.set(userId, {
      token: confirmationToken,
      email: userEmail,
      expiresAt,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        mensaje: "Token de confirmación generado. Para confirmar, escribe tu correo y el token antes de 5 minutos.",
        token_confirmacion: confirmationToken,
        expira_en_segundos: 300,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 9.2 POST /api/usuario/eliminar-cuenta (Validación estricta de JWT + correo + token de un solo uso)
  if (path === "/api/usuario/eliminar-cuenta" && method === "POST") {
    const authHeader = request.headers.get("authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Se requiere token de autenticación (Bearer)." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.substring(7).trim();

    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Servicio de base de datos no configurado." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Validar identidad exclusivamente desde el JWT
    const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      },
    });

    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: "Sesión inválida o expirada." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userData = await userRes.json();
    const userId = userData.id;
    const userEmail = (userData.email || "").toLowerCase();

    // 2. Verificar límite de intentos (máximo 3 intentos fallidos en 15 min)
    if (!checkDeletionRateLimit(userId)) {
      return new Response(
        JSON.stringify({ error: "Demasiados intentos fallidos. Bloqueado temporalmente por 15 minutos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await request.json().catch(() => ({}));
    const emailConfirmacion = (body.emailConfirmacion || "").trim().toLowerCase();
    const tokenConfirmacion = (body.tokenConfirmacion || "").trim().toUpperCase();

    // 3. Validar token de confirmación pendiente
    const pending = pendingAccountDeletions.get(userId);
    if (!pending || Date.now() > pending.expiresAt) {
      recordFailedDeletionAttempt(userId);
      pendingAccountDeletions.delete(userId);
      return new Response(
        JSON.stringify({ error: "El token de confirmación ha expirado o no existe. Solicita uno nuevo." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Validar coincidencia de correo y token
    if (emailConfirmacion !== userEmail || tokenConfirmacion !== pending.token) {
      recordFailedDeletionAttempt(userId);
      return new Response(
        JSON.stringify({ error: "El correo o el token de confirmación no coinciden." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Invalida inmediatamente el token (uso único)
    pendingAccountDeletions.delete(userId);

    // 5. Borrado atómico / tolerante: elimina registros del usuario sin fallar ante tablas inexistentes
    const tablasUsuario = [
      { tabla: "planes_guardados", col: "user_id" },
      { tabla: "perfil_docente", col: "user_id" },
      { tabla: "docente_eventos", col: "user_id" },
      { tabla: "docente_recordatorios", col: "user_id" },
      { tabla: "conversaciones", col: "user_id" },
      { tabla: "tareas_investigacion", col: "user_id" },
      { tabla: "docente_horarios", col: "user_id" },
      { tabla: "docente_actividades", col: "user_id" },
      { tabla: "docente_notas", col: "user_id" },
      { tabla: "uso_docentes", col: "docente_id" },
    ];

    for (const { tabla, col } of tablasUsuario) {
      try {
        const delRes = await fetch(`${env.SUPABASE_URL}/rest/v1/${tabla}?${col}=eq.${encodeURIComponent(userId)}`, {
          method: "DELETE",
          headers: {
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
        });
        // Si la tabla no existe en la base (404 o 400), se continúa de forma segura sin abortar
        if (!delRes.ok && delRes.status !== 404 && delRes.status !== 400) {
          console.warn(`Aviso al limpiar tabla ${tabla} para usuario ${userId}: status ${delRes.status}`);
        }
      } catch (e) {
        // Tolerancia a fallos por tabla
      }
    }

    // 6. Eliminar usuario de auth.users vía Admin API
    const adminDelRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    if (!adminDelRes.ok) {
      const errText = await adminDelRes.text();
      return new Response(
        JSON.stringify({ error: "Error eliminando el usuario de autenticación.", detalle: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, mensaje: "Todos tus datos y cuenta han sido eliminados permanentemente." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 10. GET /api/plan/patrones-docente
  if (path === "/api/plan/patrones-docente" && method === "GET") {
    return new Response(JSON.stringify({ resumen: "Estilo pedagógico participativo y orientado a competencias." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 11. POST /api/voice/generate o /api/voz (Voz de IA fluida: ElevenLabs -> Fallback Local)
  if ((path === "/api/voice/generate" || path === "/api/voz" || path === "/api/voice" || path === "/api/voz/generate") && method === "POST") {
    const auth = requerirAcceso(request, env, corsHeaders);
    if (auth.errorResponse) return auth.errorResponse;
    const isOwner = auth.isOwner;

    if (!isOwner) {
      const rlAnonimo = await verificarRateLimitAnonimo(clientIp, 30, env);
      if (!rlAnonimo.permitido) {
        return new Response(
          JSON.stringify({ ok: false, error: "Has alcanzado el límite diario de consultas para este dispositivo." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    try {
      const body = await request.json().catch(() => ({}));
      const text = body.text || body.texto || "";
      if (!text) {
        return new Response(JSON.stringify({ error: "Falta el texto para la voz." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await generateVoice(text, env, { gender: body.gender || "female" });

      if (result.fallbackLocal) {
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(result.audio, {
        headers: {
          ...corsHeaders,
          "Content-Type": "audio/mpeg",
          "X-Voice-Source": result.source,
        },
      });
    } catch (e) {
      console.warn("Error en /api/voice/generate:", e.message);
      return new Response(JSON.stringify({ fallbackLocal: true, error: e.message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // 12. POST /api/ocr/scan (Gemini Vision con aiProvider)
  if (path === "/api/ocr/scan" && method === "POST") {
    const auth = requerirAcceso(request, env, corsHeaders);
    if (auth.errorResponse) return auth.errorResponse;
    const isOwner = auth.isOwner;

    if (!isOwner) {
      const rlAnonimo = await verificarRateLimitAnonimo(clientIp, 30, env);
      if (!rlAnonimo.permitido) {
        return new Response(
          JSON.stringify({ ok: false, error: "Has alcanzado el límite diario de consultas para este dispositivo." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const body = await request.json().catch(() => ({}));
    if (!body.imageBase64) {
      return new Response(JSON.stringify({ error: "Falta imageBase64." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!env.GEMINI_API_KEY) {
        return generarErrorPlanificacion("ERROR_INTERNO", "Tuve un problema interno y no sé la causa exacta; te dejo un código para soporte.", "Falta GEMINI_API_KEY en la configuración del servidor.", false);
      }

    try {
      const ai = getAiProvider(env);
      const resultado = await ai.generateVision({
        imageBase64: body.imageBase64,
        mediaType: body.mediaType || "image/jpeg",
        prompt: "Analiza pedagógicamente este material escolar del MINERD (República Dominicana). Extrae con precisión: área curricular, grado escolar (priorizando el grado impreso en el material), tema o unidad de aprendizaje, y un resumen descriptivo del contenido.",
      });

      // Validación estricta del resultado
      const area = (resultado.area || "").trim();
      const grado = (resultado.grado || "").trim();
      const tema = (resultado.tema || "").trim();
      const resumen = (resultado.resumen || resultado.contenido_detectado || "").trim();

      return new Response(
        JSON.stringify({
          success: true,
          area: area || "General",
          grado: grado || "No especificado",
          tema: tema || "Material detectado",
          resumen: resumen,
          texto: resumen || `${area} - ${grado}: ${tema}`,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: "No se pudo procesar la imagen con visión artificial.",
          detalle: err.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  }

  // 12.5. POST /api/transcribir y /api/audio/transcribe (Transcripción de audio con Gemini / Groq Whisper)
  if ((path === "/api/transcribir" || path === "/api/audio/transcribe") && method === "POST") {
    // 1. Verificación estricta de x-app-key o x-owner-key (fail-closed)
    const auth = requerirAcceso(request, env, corsHeaders);
    if (auth.errorResponse) return auth.errorResponse;
    const isOwner = auth.isOwner;

    // 2. Control de cuota y rate limiting por IP/docente
    const docenteId = request.headers.get("x-docente-id") || "docente_default";
    const cheqCuota = await consultarCuota(env, docenteId, isOwner);
    if (!cheqCuota.permitido) {
      return new Response(
        JSON.stringify({ ok: false, error: "Has alcanzado tu cuota de uso para este periodo.", limiteAlcanzado: true, agotado: true }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isOwner) {
      const rlAnonimo = await verificarRateLimitAnonimo(clientIp, 30, env);
      if (!rlAnonimo.permitido) {
        return new Response(
          JSON.stringify({ ok: false, error: "Has alcanzado el límite diario de consultas para este dispositivo." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 3. Verificación de tamaño de payload (máximo 2 MB binario / ~2.8 MB base64)
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 2.8 * 1024 * 1024) {
      return new Response(JSON.stringify({ ok: false, error: "El audio supera el tamaño máximo permitido de 2 MB." }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await request.json().catch(() => ({}));
    if (!body.audioBase64) {
      return new Response(JSON.stringify({ ok: false, error: "Falta audioBase64." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanBase64 = body.audioBase64.replace(/^data:[^;]+;base64,/, "");
    if (cleanBase64.length > 2.8 * 1024 * 1024) {
      return new Response(JSON.stringify({ ok: false, error: "El audio supera el tamaño máximo permitido de 2 MB." }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mimeType = body.mimeType || "audio/wav";

    // 4. Intentar transcripción con Groq Whisper si está disponible
    if (env.GROQ_API_KEY) {
      try {
        const binStr = atob(cleanBase64);
        const len = binStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binStr.charCodeAt(i);
        }
        const extension = mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "m4a" : "wav";
        const file = new Blob([bytes], { type: mimeType });
        const formData = new FormData();
        formData.append("file", file, `audio.${extension}`);
        formData.append("model", "whisper-large-v3-turbo");
        formData.append("language", body.idioma || "es");
        formData.append("response_format", "json");

        const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.GROQ_API_KEY}`,
          },
          body: formData,
        });

        if (groqRes.ok) {
          const data = await groqRes.json();
          if (data && data.text) {
            return new Response(JSON.stringify({
              ok: true,
              texto: data.text.trim(),
              proveedor: "groq_whisper",
              modelo: "whisper-large-v3-turbo",
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      } catch (errG) {
        console.warn("Worker Groq Whisper error:", errG.message);
      }
    }

    // 5. Transcripción con Google Gemini (modelo multimodal oficial)
    if (env.GEMINI_API_KEY) {
      const modelosGemini = [env.GEMINI_MODEL || "gemini-3.1-flash-lite", "gemini-3.5-flash-lite"];
      for (const modelo of modelosGemini) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`;
          const gRes = await fetch(geminiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": env.GEMINI_API_KEY
            },
            body: JSON.stringify({
              contents: [{
                role: "user",
                parts: [
                  { inlineData: { mimeType, data: cleanBase64 } },
                  { text: "Transcribe fielmente en español lo que dice la persona en este audio. Devuelve ÚNICAMENTE el texto transcrito, sin comentarios ni explicaciones adicionales." }
                ]
              }],
              generationConfig: {
                temperature: 0.0,
                maxOutputTokens: 1000
              }
            })
          });
          if (gRes.ok) {
            const gData = await gRes.json();
            const texto = gData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
            if (texto) {
              return new Response(JSON.stringify({
                ok: true,
                texto,
                proveedor: "gemini",
                modelo
              }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
              });
            }
          }
        } catch (errGem) {
          console.warn(`Worker Gemini Audio (${modelo}) error:`, errGem.message);
        }
      }
    }

    return new Response(JSON.stringify({ ok: false, error: "No se pudo transcribir el audio." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 12.6. POST /api/imagen/editar (Edición de imágenes con política de dignidad, cuota y motor local/IA)
  if (path === "/api/imagen/editar" && method === "POST") {
    // 1. Verificación unificada de acceso institucional (Fail-Closed)
    const auth = requerirAcceso(request, env, corsHeaders);
    if (auth.errorResponse) return auth.errorResponse;
    const isOwner = auth.isOwner;

    // 2. Parsear cuerpo de la petición
    const body = await request.json().catch(() => ({}));
    const { imagen, operacionId, instruccion, parametros = {}, confirmadoPorUsuario } = body;

    if (!imagen && !operacionId && !instruccion) {
      return new Response(JSON.stringify({ ok: false, error: "Se requiere imagen u operacionId o instruccion." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 3. Evaluar Política de Dignidad primero (Fail-Closed)
    const evaluacionDignidad = evaluarPoliticaDignidad({
      texto: `${instruccion || ""} ${operacionId || ""}`,
      operacionId
    });

    if (evaluacionDignidad.veredicto === "BLOQUEADO") {
      // Rechazo ético inmediato: CERO procesamiento, CERO llamadas a IA externa
      const protocoloEfectivo = evaluacionDignidad.casoEspecialMenorEnRiesgo
        ? "CONANI / Línea Vida (809-200-1202)"
        : (evaluacionDignidad.protocolo || null);

      return new Response(JSON.stringify({
        ok: false,
        bloqueadoPorDignidad: true,
        veredicto: "BLOQUEADO",
        categoria: evaluacionDignidad.categoria || (evaluacionDignidad.casoEspecialMenorEnRiesgo ? "infancia_proteccion_menores" : "dignidad_imagen"),
        motivo: evaluacionDignidad.motivo,
        razon: evaluacionDignidad.motivo,
        protocolo: protocoloEfectivo,
        lineaAyuda: protocoloEfectivo,
        casoEspecialMenorEnRiesgo: evaluacionDignidad.casoEspecialMenorEnRiesgo || false,
        mensaje: evaluacionDignidad.mensajeRespetuoso || "Esta solicitud de edición de imagen ha sido bloqueada por la Política de Dignidad y Protección de Menores.",
        evaluacion: evaluacionDignidad
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (evaluacionDignidad.veredicto === "CONFIRMAR" && !confirmadoPorUsuario) {
      return new Response(JSON.stringify({
        ok: false,
        requiereConfirmacion: true,
        veredicto: "CONFIRMAR",
        advertencia: evaluacionDignidad.mensajeRespetuoso || evaluacionDignidad.advertencia,
        mensaje: evaluacionDignidad.mensajeRespetuoso || evaluacionDignidad.advertencia || "Esta operación requiere confirmación pedagógica del docente."
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 4. Determinar operación del catálogo y peso de cuota
    const operacion = operacionId ? obtenerOperacionPorId(operacionId) : null;
    const pesoCuota = operacion?.pesoCuota || (operacion?.motor === "ia" ? 3 : 1);
    const docenteId = request.headers.get("x-docente-id") || "docente_default";

    // Verificar límites de cuota (diaria por dispositivo / IP / global)
    const cheqCuota = await verificarTopesMultinivel({
      deviceId: docenteId,
      clientIp,
      env,
      isOwner,
    });
    if (!cheqCuota.permitido) {
      return new Response(JSON.stringify({
        ok: false,
        error: cheqCuota.error || "Has alcanzado tu cuota de uso para este periodo.",
        limiteAlcanzado: true,
        agotado: true,
        cuota: cheqCuota.cuota
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 5. Motor IA vs Local (Arranque apagado por defecto: IMAGEN_IA_ACTIVA=false)
    const iaActiva = (env && (env.IMAGEN_IA_ACTIVA === "true" || env.IMAGEN_IA_ACTIVA === "1")) || false;
    const requiereIA = operacion?.motor === "ia" || (!operacion && Boolean(instruccion));

    if (!requiereIA || !iaActiva || !env.GEMINI_API_KEY) {
      if (requiereIA && (!iaActiva || !env.GEMINI_API_KEY)) {
        return new Response(JSON.stringify({
          ok: false,
          motor: "ia",
          estadoIa: "apagado por falta de facturación",
          mensaje: "El motor de IA para imágenes está actualmente apagado por falta de facturación. Puedes utilizar las funciones del motor local.",
          fallbackLocalSugerido: true,
          operacion: operacion || null
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Procesar vía motor local (o devolver instrucción de procesamiento local en cliente)
      await consumirCuota(env, docenteId, isOwner, clientIp, pesoCuota);
      return new Response(JSON.stringify({
        ok: true,
        motor: "local",
        operacionId: operacion?.id || operacionId,
        mensaje: "Operación procesada con éxito por el motor local.",
        cuotaDescontada: pesoCuota
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 6. Si IA está activa, invocar familia de modelos de imagen de Gemini API
    const MODELOS_IMAGEN_GEMINI = [
      "gemini-3.1-flash-lite-image",
      "gemini-nano-banana-2.1",
      "gemini-3.1-flash-image",
      "gemini-3-pro-image",
      "gemini-2.5-flash-image"
    ];

    let respuestaIA = null;
    let modeloUsado = null;

    for (const modelo of MODELOS_IMAGEN_GEMINI) {
      try {
        const cleanBase64 = (imagen || "").replace(/^data:[^;]+;base64,/, "");
        const mimeType = (imagen && imagen.startsWith("data:")) ? imagen.split(";")[0].replace("data:", "") : "image/jpeg";

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`;
        const gRes = await fetch(geminiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY
          },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [
                ...(cleanBase64 ? [{ inlineData: { mimeType, data: cleanBase64 } }] : []),
                { text: instruccion || operacion?.descripcion || "Edita esta imagen para uso pedagógico escolar." }
              ]
            }]
          })
        });

        if (gRes.status === 429 || gRes.status === 403) {
          continue;
        }

        if (gRes.ok) {
          const gData = await gRes.json();
          respuestaIA = gData;
          modeloUsado = modelo;
          break;
        }
      } catch (errG) {
        console.warn(`Error llamando a modelo imagen ${modelo}:`, errG.message);
      }
    }

    if (!respuestaIA) {
      return new Response(JSON.stringify({
        ok: false,
        motor: "ia",
        estadoIa: "apagado por falta de facturación",
        error: "El motor de IA para imágenes no pudo procesar la solicitud debido a facturación inactiva en la API de Google.",
        fallbackDisponible: true
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Descontar cuota ponderada
    await consumirCuota(env, docenteId, isOwner, clientIp, pesoCuota);

    return new Response(JSON.stringify({
      ok: true,
      motor: "ia",
      modelo: modeloUsado,
      resultado: respuestaIA,
      cuotaDescontada: pesoCuota
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // 13. Ruta no encontrada en la API
  return new Response(JSON.stringify({ error: `Ruta API no encontrada: ${method} ${path}` }), {
    status: 404,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─────────────────────────────────────────────────────────────
// EXPORT DEFAULT (HANDLER DEL WORKER)
// ─────────────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Todas las peticiones /api/* van al enrutador del Worker
    if (url.pathname.startsWith("/api/")) {
      return handleApiRequest(request, env, ctx);
    }

    // 2. Todas las demás peticiones se sirven desde los assets estáticos de client/dist
    if (env.ASSETS) {
      const response = await env.ASSETS.fetch(request);
      const ct = response.headers.get("Content-Type") || "";

      // /assets/* con hash en el nombre → caché inmutable de un año
      if (url.pathname.startsWith("/assets/")) {
        if (response.status === 200 && !ct.includes("text/html")) {
          const newHeaders = new Headers(response.headers);
          newHeaders.set("Cache-Control", "public, max-age=31536000, immutable");
          newHeaders.set("X-Content-Type-Options", "nosniff");
          newHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin");
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders,
          });
        } else {
          // Fallback SPA atrapó un asset inexistente
          return new Response("Not Found", {
            status: 404,
            statusText: "Not Found",
            headers: {
              "Content-Type": "text/plain",
              "Cache-Control": "no-cache, no-store, must-revalidate",
              "X-Content-Type-Options": "nosniff",
              "Referrer-Policy": "strict-origin-when-cross-origin",
            }
          });
        }
      }

      // /sw.js, /manifest.webmanifest y cualquier respuesta HTML (incluyendo
      // el fallback SPA a index.html para rutas como /planificacion) → no-cache
      if (
        url.pathname === "/" ||
        url.pathname === "/index.html" ||
        url.pathname === "/sw.js" ||
        url.pathname === "/registerSW.js" ||
        url.pathname === "/manifest.webmanifest" ||
        url.pathname === "/manifest.json" ||
        url.pathname.startsWith("/workbox-") ||
        url.pathname === "/version.json" ||
        ct.includes("text/html")
      ) {
        const newHeaders = new Headers(response.headers);
        newHeaders.set("Cache-Control", "no-cache, no-store, must-revalidate");
        newHeaders.set("Pragma", "no-cache");
        newHeaders.set("Expires", "0");
        newHeaders.set("X-Content-Type-Options", "nosniff");
        newHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin");
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      }

      const fallbackHeaders = new Headers(response.headers);
      fallbackHeaders.set("X-Content-Type-Options", "nosniff");
      fallbackHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: fallbackHeaders,
      });
    }

    return new Response("Assets binding not available", { status: 500 });
  },
};
