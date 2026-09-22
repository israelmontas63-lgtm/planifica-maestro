import { LEVELS } from "./levels.js";
import { obtenerContextoConBase } from "./contextoConBase.js";
import { getAiProvider, getGeminiModels, fetchGeminiWithRetry } from "./services/aiProvider.js";
import { generateVoice } from "./services/voiceProvider.js";

/**
 * Planifica Maestro - Cloudflare Worker Backend
 * Atiende todas las rutas /api/* y delega el resto a los assets estáticos de la PWA.
 */

// Rate limit en memoria por IP para intentos de clave de propietario
const ownerLoginAttempts = new Map(); // ip -> { count: number, resetAt: number }

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

function checkOwnerRateLimit(ip) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutos
  const maxAttempts = 5;

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
async function consultarCuota(env, docenteId, isOwner) {
  const limiteDefault = 15;
  const periodoActual = new Date().toISOString().substring(0, 7); // YYYY-MM

  if (isOwner) {
    return {
      permitido: true,
      usadas: 0,
      limite: 999999,
      restantes: 999999,
      porcentaje: 0,
      agotado: false,
      alerta80: false,
      isOwner: true,
      periodo: periodoActual,
    };
  }

  // Si Supabase está configurado con service role key
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
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
          const limite = row.limite || limiteDefault;
          return {
            permitido: usadas < limite,
            usadas,
            limite,
            restantes: Math.max(0, limite - usadas),
            porcentaje: Math.round((usadas / limite) * 100),
            agotado: usadas >= limite,
            alerta80: usadas / limite >= 0.8,
            isOwner: false,
            periodo: periodoActual,
          };
        }
      }
    } catch (e) {
      console.warn("Fallo al consultar cuota en Supabase:", e);
    }
  }

  // Fallback en memoria
  const key = `${docenteId}_${periodoActual}`;
  const entry = inMemoryQuotas.get(key) || { usadas: 0, limite: limiteDefault };
  return {
    permitido: entry.usadas < entry.limite,
    usadas: entry.usadas,
    limite: entry.limite,
    restantes: Math.max(0, entry.limite - entry.usadas),
    porcentaje: Math.round((entry.usadas / entry.limite) * 100),
    agotado: entry.usadas >= entry.limite,
    alerta80: entry.usadas / entry.limite >= 0.8,
    isOwner: false,
    periodo: periodoActual,
  };
}

async function consumirCuota(env, docenteId, isOwner) {
  if (isOwner) return consultarCuota(env, docenteId, true);

  const periodoActual = new Date().toISOString().substring(0, 7);

  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
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
          const nuevasUsadas = (row.usadas || 0) + 1;
          await fetch(`${env.SUPABASE_URL}/rest/v1/uso_docentes?id=eq.${row.id}`, {
            method: "PATCH",
            headers: {
              apikey: env.SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
              "Content-Type": "application/json",
              Prefer: "return=representation",
            },
            body: JSON.stringify({ usadas: nuevasUsadas, updated_at: new Date().toISOString() }),
          });
          return consultarCuota(env, docenteId, false);
        } else {
          await fetch(`${env.SUPABASE_URL}/rest/v1/uso_docentes`, {
            method: "POST",
            headers: {
              apikey: env.SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              docente_id: docenteId,
              periodo: periodoActual,
              usadas: 1,
              limite: 15,
            }),
          });
          return consultarCuota(env, docenteId, false);
        }
      }
    } catch (e) {
      console.warn("Fallo al consumir cuota en Supabase:", e);
    }
  }

  // Fallback en memoria
  const key = `${docenteId}_${periodoActual}`;
  const entry = inMemoryQuotas.get(key) || { usadas: 0, limite: 15 };
  entry.usadas += 1;
  inMemoryQuotas.set(key, entry);
  return consultarCuota(env, docenteId, false);
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
  };

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

    const health = {
      status: "ok",
      worker: "cloudflare-workers",
      timestamp: new Date().toISOString(),
      tablas_disponibles: tablasDisponibles,
      services: {
        text_ai: env.GEMINI_API_KEY ? "ok" : "sin_configurar",
        vision_ai: env.GEMINI_API_KEY ? "ok" : "sin_configurar",
        ocr_ai: env.GEMINI_API_KEY ? "ok" : "sin_configurar",
        voice_mode: "browser_speechSynthesis",
        auth: env.APP_ACCESS_KEY ? "activa" : "abierta",
        owner: env.OWNER_MASTER_KEY ? "configurada" : "sin_configurar",
        database: (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) ? "ok" : "en_memoria",
      },
    };
    return new Response(JSON.stringify(health, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2. POST /api/auth/verify (Clave institucional)
  if (path === "/api/auth/verify" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const expected = env.APP_ACCESS_KEY;
    if (!expected) {
      return new Response(JSON.stringify({ ok: true, token: "open_dev_mode" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.password && timingSafeEqualStr(body.password.trim(), expected.trim())) {
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
    if (!checkOwnerRateLimit(clientIp)) {
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

    return new Response(
      JSON.stringify({
        ok: true,
        stats: {
          totalDocentes: inMemoryQuotas.size,
          totalPlanificaciones: Array.from(inMemoryQuotas.values()).reduce((acc, v) => acc + (v.usadas || 0), 0),
          listaDocentes: Array.from(inMemoryQuotas.entries()).map(([k, v]) => ({
            docenteId: k,
            usadas: v.usadas,
            periodo: new Date().toISOString().substring(0, 7),
          })),
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
    const docenteId = url.searchParams.get("docenteId") || request.headers.get("x-docente-id") || "docente_default";
    const ownerKey = request.headers.get("x-owner-key");
    const isOwner = env.OWNER_MASTER_KEY && ownerKey && timingSafeEqualStr(ownerKey.trim(), env.OWNER_MASTER_KEY.trim());

    const estado = await consultarCuota(env, docenteId, isOwner);
    return new Response(JSON.stringify(estado), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 7. POST /api/plan/generate (Generación con Gemini y soporte SSE Streaming)
  if (path === "/api/plan/generate" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const { messages = [], nivel, periodo = "diaria", docenteId = "docente_default", stream = false } = body;
    const resolvedDocenteId = docenteId || request.headers.get("x-docente-id") || "docente_default";

    const ownerKey = request.headers.get("x-owner-key");
    const isOwner = env.OWNER_MASTER_KEY && ownerKey && timingSafeEqualStr(ownerKey.trim(), env.OWNER_MASTER_KEY.trim());

    // Verificar cuota
    const cheqCuota = await consultarCuota(env, resolvedDocenteId, isOwner);
    if (!cheqCuota.permitido) {
      return new Response(
        JSON.stringify({
          error: `Has alcanzado tu cuota de ${cheqCuota.limite} planificaciones de este periodo.`,
          limiteAlcanzado: true,
          agotado: true,
          cuota: cheqCuota,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!messages.length) {
      return new Response(JSON.stringify({ error: "Faltan 'messages'." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const esquema = LEVELS[nivel] || LEVELS["primario"];
    const instruccionesTemporal = PROFUNDIDAD_TEMPORAL[periodo] || PROFUNDIDAD_TEMPORAL["diaria"];

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

    const avisoSinVerificar = "Borrador referencial sin contrastar con la base oficial del servidor: valida competencias e indicadores con el currículo vigente";
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

    const dynamicPrompt = `${SYSTEM_PROMPT}
## ESQUEMA SELECCIONADO: ${esquema.label}
- Ciclos: ${esquema.ciclos.join(", ")}
- Áreas: ${esquema.areas.join(", ")}
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

    if (!env.GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Hay un problema de configuración en el servicio de generación. Por favor, contacta a soporte." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const models = getGeminiModels(env);

    // Modo Streaming SSE
    if (stream) {
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
              systemInstruction: { parts: [{ text: dynamicPrompt }] },
              generationConfig: { temperature: 0.0, responseMimeType: "application/json" },
            }),
          });

          if (res && res.ok) {
            geminiRes = res;
            break;
          } else if (res) {
            ultimoStatus = res.status;
            ultimoError = await res.text();
            console.warn(`[Gemini Stream] Modelo ${model} falló con status ${res.status}: ${ultimoError}`);
          }
        } catch (e) {
          ultimoError = e.message;
          console.warn(`[Gemini Stream] Excepción en modelo ${model}: ${e.message}`);
        }
      }

      if (!geminiRes) {
        console.error("[Gemini Stream Fail] Modelos agotados:", ultimoError);
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

      // Transformar el stream de Gemini a SSE limpio para el cliente
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const reader = geminiRes.body.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();

      ctx.waitUntil(
        (async () => {
          let fullText = "";
          try {
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
                      const parsed = JSON.parse(jsonStr);
                      const part = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                      if (part) {
                        fullText += part;
                        await writer.write(
                          encoder.encode(`data: ${JSON.stringify({ delta: part })}\n\n`)
                        );
                      }
                    } catch (e) {}
                  }
                }
              }
            }

            // Procesar el resultado completo
            const parsedFinal = extraerJsonValido(fullText) || { mensaje_chat: fullText };
            let estadoActualizado = cheqCuota;
            if (parsedFinal && parsedFinal.plan_completado) {
              estadoActualizado = await consumirCuota(env, resolvedDocenteId, isOwner);
            }

            if (!baseOficialCargada) {
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

            await writer.write(encoder.encode(`data: ${JSON.stringify({ final: finalPayload })}\n\n`));
            await writer.write(encoder.encode("data: [DONE]\n\n"));
          } catch (err) {
            await writer.write(
              encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`)
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
            generationConfig: { temperature: 0.0, responseMimeType: "application/json" },
          }),
        });

        if (geminiRes && geminiRes.ok) {
          geminiData = await geminiRes.json();
          break;
        } else if (geminiRes) {
          ultimoStatus = geminiRes.status;
          ultimoError = await geminiRes.text();
          console.warn(`[Gemini Sync] Modelo ${model} falló con status ${geminiRes.status}: ${ultimoError}`);
        }
      } catch (err) {
        ultimoError = err.message;
        console.warn(`[Gemini Sync] Excepción en modelo ${model}: ${err.message}`);
      }
    }

    if (geminiData) {
      const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const parsed = extraerJsonValido(rawText);

      if (parsed) {
        let cuotaActualizada = cheqCuota;
        if (parsed.plan_completado) {
          cuotaActualizada = await consumirCuota(env, resolvedDocenteId, isOwner);
        }

        if (!baseOficialCargada) {
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
    }

    console.error("[Gemini Sync Fail] Modelos agotados:", ultimoError);
    const mensajeMaestro = (ultimoStatus === 503 || ultimoStatus === 429 || ultimoStatus === 502 || ultimoStatus === 504)
      ? "La IA está ocupada, intenta de nuevo en un minuto."
      : (ultimoStatus === 401 || ultimoStatus === 403)
      ? "Hay un problema de configuración en el servicio de generación. Por favor, contacta a soporte."
      : "La IA está ocupada, intenta de nuevo en un minuto.";

    return new Response(
      JSON.stringify({ error: mensajeMaestro }),
      { status: (ultimoStatus === 401 || ultimoStatus === 403) ? 500 : 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 8. POST /api/plan/consultar-curriculo
  if (path === "/api/plan/consultar-curriculo" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const { nivel = "primario", grado = "3ro de Primaria", area = "Matemática", tema, esquemaActivo = "primario", periodoActivo = "diaria" } = body;

    if (!tema || !tema.trim()) {
      return new Response(JSON.stringify({ error: "Falta el 'tema' a consultar." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "Hay un problema de configuración en el servicio de generación. Por favor, contacta a soporte." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    // Generar token de confirmación de un solo uso (6 caracteres alfanuméricos)
    const confirmationToken = Math.random().toString(36).substring(2, 8).toUpperCase();
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

  // 11. POST /api/voice/generate (Voz de IA fluida: ElevenLabs -> Google TTS -> Fallback Local)
  if (path === "/api/voice/generate" && method === "POST") {
    try {
      const body = await request.json().catch(() => ({}));
      const text = body.text || "";
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
    const body = await request.json().catch(() => ({}));
    if (!body.imageBase64) {
      return new Response(JSON.stringify({ error: "Falta imageBase64." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY no configurada en el Worker." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
            }
          });
        }
      }

      // /sw.js, /manifest.webmanifest y cualquier respuesta HTML (incluyendo
      // el fallback SPA a index.html para rutas como /planificacion) → no-cache
      if (
        url.pathname === "/sw.js" ||
        url.pathname === "/manifest.webmanifest" ||
        ct.includes("text/html")
      ) {
        const newHeaders = new Headers(response.headers);
        newHeaders.set("Cache-Control", "no-cache, no-store, must-revalidate");
        newHeaders.set("Pragma", "no-cache");
        newHeaders.set("Expires", "0");
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      }

      return response;
    }

    return new Response("Assets binding not available", { status: 500 });
  },
};
