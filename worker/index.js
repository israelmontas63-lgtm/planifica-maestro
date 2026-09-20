import { LEVELS } from "./levels.js";
import { obtenerContextoConBase } from "./contextoConBase.js";

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

// Almacén en memoria para cuotas e historial si Supabase aún no está cargado
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
# [SYSTEM_CORE_PROMPT: PLANIFICA_MAESTRO_MINERD_PROD_V5]
## ROL Y DIRECTIVA DE OPERACIÓN
Eres el motor cognitivo de "Planifica Maestro". Tu única función es generar planificaciones educativas reales, precisas y operativas para el sistema educativo de la República Dominicana, utilizando estrictamente como fuentes de verdad los documentos oficiales, diseños curriculares y guías metodológicas del MINERD y CON BASE.

## FORMATO DE SALIDA (OBLIGATORIO JSON)
Devuelve SIEMPRE tu respuesta en formato JSON estrictamente estructurado:
{
  "mensaje_chat": "String. Tu respuesta conversacional al docente (saludo, explicación o preguntas si falta información).",
  "plan_completado": true,
  "datos_planificacion": {
    // Si plan_completado es true, cada clave debe coincidir EXACTAMENTE con los bloques del esquema seleccionado.
  },
  "confianza_curricular": {
    "nivel_certeza": "alta | media | baja",
    "bloques_aproximados": [],
    "nota_revision": "String con recomendación pedagógica si aplica."
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
    const health = {
      status: "ok",
      worker: "cloudflare-workers",
      timestamp: new Date().toISOString(),
      services: {
        text_ai: env.GEMINI_API_KEY ? "ok" : "sin_configurar",
        vision_ai: env.GEMINI_API_KEY ? "ok" : "sin_configurar",
        voice_tts: env.ELEVENLABS_API_KEY ? "ok" : "sin_configurar",
        ocr_ai: env.ANTHROPIC_API_KEY ? "ok" : "sin_configurar",
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

    // Inyección de CON BASE si aplica
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
        groundingConBase = `\nCONTEXTO OFICIAL CON BASE (usa esto como fuente estricta):\n${resConBase.contexto}\n`;
      }
    }

    const dynamicPrompt = `${SYSTEM_PROMPT}
## ESQUEMA SELECCIONADO: ${esquema.label}
- Ciclos: ${esquema.ciclos.join(", ")}
- Áreas: ${esquema.areas.join(", ")}
${instruccionesTemporal}
${groundingConBase}

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
        JSON.stringify({ error: "La clave de IA (GEMINI_API_KEY) no está configurada en los secretos de Cloudflare." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Modelos a probar en orden de velocidad y cuota
    const models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-flash-latest"];

    // Modo Streaming SSE
    if (stream) {
      const model = models[0];
      const geminiStreamUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${env.GEMINI_API_KEY}`;

      const geminiRes = await fetch(geminiStreamUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: dynamicPrompt }] },
          generationConfig: { temperature: 0.0, responseMimeType: "application/json" },
        }),
      });

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        return new Response(JSON.stringify({ error: "Error en el proveedor de IA.", detail: errText }), {
          status: 502,
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
                      const textPart = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
                      if (textPart) {
                        fullText += textPart;
                        await writer.write(
                          encoder.encode(`data: ${JSON.stringify({ delta: textPart })}\n\n`)
                        );
                      }
                    } catch (e) {}
                  }
                }
              }
            }

            // Procesar el resultado completo
            const parsedFinal = extraerJsonValido(fullText);
            let estadoActualizado = cheqCuota;
            if (parsedFinal && parsedFinal.plan_completado) {
              estadoActualizado = await consumirCuota(env, resolvedDocenteId, isOwner);
            }

            const finalPayload = {
              ...(parsedFinal || { mensaje_chat: fullText }),
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
    let ultimoError = null;
    for (const model of models) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
        const geminiRes = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            systemInstruction: { parts: [{ text: dynamicPrompt }] },
            generationConfig: { temperature: 0.0, responseMimeType: "application/json" },
          }),
        });

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
          const parsed = extraerJsonValido(rawText);

          if (parsed) {
            let cuotaActualizada = cheqCuota;
            if (parsed.plan_completado) {
              cuotaActualizada = await consumirCuota(env, resolvedDocenteId, isOwner);
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
        } else {
          ultimoError = await geminiRes.text();
        }
      } catch (err) {
        ultimoError = err.message;
      }
    }

    return new Response(
      JSON.stringify({ error: "Error procesando con Gemini.", detail: ultimoError }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY no configurada." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const esquema = LEVELS[esquemaActivo] || LEVELS["primario"];
    const prompt = `Eres el Especialista Curricular del MINERD:
Requerimiento:
- Nivel: ${nivel}, Grado: ${grado}, Área: ${area}, Tema: "${tema}"
- Esquema: ${esquema.label}, Alcance: ${periodoActivo}

Genera un JSON estricto con:
{
  "tema": "${tema}",
  "grado": "${grado}",
  "area": "${area}",
  "resumen_enfoque": "Enfoque oficial en 2 líneas.",
  "competencias_especificas": ["..."],
  "indicadores_logro": ["..."],
  "contenidos": { "conceptuales": "...", "procedimentales": "...", "actitudinales": "..." },
  "estrategias_sugeridas": ["..."],
  "actividades_sugeridas": { "inicio": "...", "desarrollo": "...", "cierre": "..." },
  "datos_planificacion": {
    ${esquema.bloques.map((b) => `"${b}": "..."`).join(",\n    ")}
  }
}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.0, responseMimeType: "application/json" },
        }),
      }
    );

    if (geminiRes.ok) {
      const data = await geminiRes.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const parsed = extraerJsonValido(text);
      if (parsed) {
        return new Response(JSON.stringify(parsed), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Error consultando el currículo." }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 9. POST /api/plan/ajustes-manuales
  if (path === "/api/plan/ajustes-manuales" && method === "POST") {
    return new Response(JSON.stringify({ ok: true, mensaje: "Ajuste registrado." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 10. GET /api/plan/patrones-docente
  if (path === "/api/plan/patrones-docente" && method === "GET") {
    return new Response(JSON.stringify({ resumen: "Estilo pedagógico participativo y orientado a competencias." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 11. POST /api/voice/generate (ElevenLabs TTS)
  if (path === "/api/voice/generate" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (!body.text) {
      return new Response(JSON.stringify({ error: "Se requiere texto." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!env.ELEVENLABS_API_KEY) {
      return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY no configurada." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const VOICE_ID = "XrExE9yKIg1WjnnlVkGX"; // Matilda - español
    const elevenRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": env.ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: body.text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!elevenRes.ok) {
      const err = await elevenRes.text();
      return new Response(JSON.stringify({ error: "Error en ElevenLabs.", detail: err }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audioBuffer = await elevenRes.arrayBuffer();
    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
      },
    });
  }

  // 12. POST /api/ocr/scan (Anthropic Claude)
  if (path === "/api/ocr/scan" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (!body.imageBase64) {
      return new Response(JSON.stringify({ error: "Falta imageBase64." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!env.ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY no configurada." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: body.mediaType || "image/jpeg",
                  data: body.imageBase64,
                },
              },
              {
                type: "text",
                text: "Transcribe fielmente los temas, contenidos y actividades pedagógicas de esta foto para planificar una clase.",
              },
            ],
          },
        ],
      }),
    });

    if (claudeRes.ok) {
      const data = await claudeRes.json();
      const texto = data.content?.filter((b) => b.type === "text").map((b) => b.text).join("\n") || "";
      return new Response(JSON.stringify({ texto }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const errDetail = await claudeRes.text();
    return new Response(JSON.stringify({ error: "Error procesando imagen.", detail: errDetail }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      return env.ASSETS.fetch(request);
    }

    return new Response("Assets binding not available", { status: 500 });
  },
};
