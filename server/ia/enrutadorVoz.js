const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { registrarLlamada } = require("./registroUso.js");
const { calcularCooldown429 } = require("./enrutadorIA.js");

/**
 * server/ia/enrutadorVoz.js
 * 
 * Enrutador de Voz (TTS) con Respaldo Automático y Circuit Breaker:
 * 1. ElevenLabs (respuestas cortas <= 500 chars, voz de alta naturalidad)
 * 2. Gemini TTS (respuestas más largas o respaldo si ElevenLabs falla)
 * 3. speechSynthesis del navegador (piso garantizado, 100% gratuito y offline)
 * 
 * Incluye:
 * - Caché de audio en memoria con LRU y TTL (24h).
 * - Recorte seguro en frontera de oraciones.
 * - Circuit breaker inteligente (429 RPD/RPM/Retry-After, 5xx tiempo corto).
 * - Telemetría estrictamente anónima (cero texto, cero audio guardado).
 */

const estadosCircuitoVoz = new Map();
const cacheAudio = new Map(); // hash -> { buffer, contentType, proveedor, timestamp, lastAccess }

let cacheConfiguracionVoz = null;

function cargarConfiguracion(forzarRecarga = false) {
  if (cacheConfiguracionVoz && !forzarRecarga) {
    return cacheConfiguracionVoz;
  }
  const rutaConfig = path.join(__dirname, "proveedores.json");
  if (fs.existsSync(rutaConfig)) {
    try {
      cacheConfiguracionVoz = JSON.parse(fs.readFileSync(rutaConfig, "utf-8"));
      return cacheConfiguracionVoz;
    } catch (e) {
      console.warn("⚠️ Error leyendo proveedores.json en voz:", e.message);
    }
  }
  cacheConfiguracionVoz = { proveedores_voz: [] };
  return cacheConfiguracionVoz;
}

function limpiarCacheExpirada(maxItems = 50, ttlMs = 86400000) {
  const ahora = Date.now();
  // 1. Eliminar entradas que hayan superado el TTL
  for (const [hash, entrada] of cacheAudio.entries()) {
    if (ahora - entrada.timestamp > ttlMs) {
      cacheAudio.delete(hash);
    }
  }
  // 2. Si excede maxItems, desalojar las menos recientemente accedidas (LRU)
  if (cacheAudio.size > maxItems) {
    const ordenadas = [...cacheAudio.entries()].sort((a, b) => (a[1].lastAccess || a[1].timestamp) - (b[1].lastAccess || b[1].timestamp));
    const cantidadABorrar = cacheAudio.size - maxItems;
    for (let i = 0; i < cantidadABorrar; i++) {
      cacheAudio.delete(ordenadas[i][0]);
    }
  }
}

function calcularHashTexto(texto, voiceId = "") {
  return crypto.createHash("sha256").update(`${voiceId}:${texto}`).digest("hex");
}

function recortarEnLimiteOracion(texto, maxChars) {
  if (!texto || typeof texto !== "string") return "";
  const t = texto.trim();
  if (t.length <= maxChars) return t;

  const sub = t.substring(0, maxChars);
  // Buscar último signo de puntuación fuerte
  const lastPunct = Math.max(
    sub.lastIndexOf("."),
    sub.lastIndexOf("!"),
    sub.lastIndexOf("?"),
    sub.lastIndexOf(";")
  );

  if (lastPunct > maxChars * 0.5) {
    return sub.substring(0, lastPunct + 1).trim();
  }

  // Fallback: buscar último espacio
  const lastSpace = sub.lastIndexOf(" ");
  if (lastSpace > 0) {
    return sub.substring(0, lastSpace) + "...";
  }

  return sub;
}

function obtenerEstadoCircuitoVoz(provId) {
  const ahora = Date.now();
  let est = estadosCircuitoVoz.get(provId);
  if (!est) {
    est = {
      estado: "CERRADO",
      fallosConsecutivos: 0,
      pausaHastaMs: 0,
      ultimoError: null,
      motivoPausa: null
    };
    estadosCircuitoVoz.set(provId, est);
  }

  if (est.estado === "ABIERTO" && ahora >= est.pausaHastaMs) {
    est.estado = "SEMI_ABIERTO";
  }

  return est;
}

function registrarExitoVoz(provId) {
  const est = obtenerEstadoCircuitoVoz(provId);
  est.estado = "CERRADO";
  est.fallosConsecutivos = 0;
  est.pausaHastaMs = 0;
  est.ultimoError = null;
  est.motivoPausa = null;
}

function registrarFalloVoz(provId, err) {
  const ahora = Date.now();
  const est = obtenerEstadoCircuitoVoz(provId);
  est.fallosConsecutivos++;
  est.ultimoError = err.message;

  const es429 = err.status === 429 || (err.message && err.message.includes("429"));
  const config = cargarConfiguracion();

  if (es429) {
    const { cooldownMs, tipo } = calcularCooldown429(err, config.configuracion_general);
    est.estado = "ABIERTO";
    est.pausaHastaMs = ahora + cooldownMs;
    est.motivoPausa = `429_${tipo}`;
  } else if (est.fallosConsecutivos >= 2 || est.estado === "SEMI_ABIERTO") {
    est.estado = "ABIERTO";
    est.pausaHastaMs = ahora + ((config.configuracion_general?.circuito_cooldown_error_ms) || 60000);
    est.motivoPausa = "error_repetido";
  }
}

async function sintetizarElevenLabs({ texto, apiKey, voiceId, modelo, timeoutMs = 6000 }) {
  if (!apiKey) {
    const err = new Error("ELEVENLABS_API_KEY no configurada.");
    err.esConfiguracion = true;
    err.status = 401;
    throw err;
  }

  const voice = voiceId || "XrExE9yKIg1WjnnlVkGX";
  const model = modelo || "eleven_multilingual_v2";
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": apiKey
      },
      body: JSON.stringify({
        text: texto,
        model_id: model,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const err = new Error(errData.detail?.message || `Error ElevenLabs HTTP ${res.status}`);
      err.status = res.status;
      if (res.status === 401 || res.status === 403) err.esConfiguracion = true;
      throw err;
    }

    const arrayBuffer = await res.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: "audio/mpeg"
    };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      const timeoutErr = new Error("Tiempo de espera agotado en ElevenLabs");
      timeoutErr.status = 504;
      timeoutErr.esTimeout = true;
      throw timeoutErr;
    }
    throw err;
  }
}

async function sintetizarGeminiTTS({ texto, apiKey, modelo, timeoutMs = 8000 }) {
  if (!apiKey) {
    const err = new Error("GEMINI_API_KEY no configurada.");
    err.esConfiguracion = true;
    err.status = 401;
    throw err;
  }

  const model = modelo || "gemini-2.5-flash-preview-tts";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: texto }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Puck"
              }
            }
          }
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!res.ok) {
      const err = new Error(`Error Gemini TTS HTTP ${res.status}`);
      err.status = res.status;
      if (res.status === 400 || res.status === 401 || res.status === 403) err.esConfiguracion = true;
      throw err;
    }

    const data = await res.json();
    const inlinePart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!inlinePart || !inlinePart.inlineData?.data) {
      throw new Error("Gemini TTS no devolvió datos de audio en la respuesta.");
    }

    const audioBuf = Buffer.from(inlinePart.inlineData.data, "base64");
    return {
      buffer: audioBuf,
      contentType: inlinePart.inlineData.mimeType || "audio/wav"
    };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      const timeoutErr = new Error("Tiempo de espera agotado en Gemini TTS");
      timeoutErr.status = 504;
      timeoutErr.esTimeout = true;
      throw timeoutErr;
    }
    throw err;
  }
}

/**
 * Enruta la generación de voz según longitud, disponibilidad y circuit breaker
 */
async function enrutarVoz({ texto, env = {} }) {
  if (!texto || typeof texto !== "string" || !texto.trim()) {
    throw new Error("Se requiere texto para sintetizar voz.");
  }

  const config = cargarConfiguracion();
  const proveedoresVoz = config.proveedores_voz || [];
  const tiempoInicio = Date.now();

  // 1. Comprobar caché por hash del texto
  const hash = calcularHashTexto(texto.trim());
  if (cacheAudio.has(hash)) {
    const cached = cacheAudio.get(hash);
    cached.lastAccess = Date.now();
    return {
      desdeCache: true,
      buffer: cached.buffer,
      contentType: cached.contentType,
      proveedor: cached.proveedor,
      esRespaldo: false
    };
  }

  const longitud = texto.length;
  let intentos = 0;

  for (const prov of proveedoresVoz) {
    if (!prov.activo) continue;

    if (prov.id === "speech_synthesis_local") {
      // Piso garantizado: retornar indicador para que el cliente use window.speechSynthesis
      registrarLlamada({
        proveedorId: prov.id,
        tipoOperacion: "voz",
        duracionMs: Date.now() - tiempoInicio,
        exito: true,
        esRespaldo: intentos > 0
      });
      return {
        fallbackLocal: true,
        proveedor: "speech_synthesis_local",
        esRespaldo: intentos > 0
      };
    }

    // Si el texto excede el límite seguro del proveedor, saltar al siguiente (ej. ElevenLabs <= 500)
    if (prov.max_caracteres && longitud > prov.max_caracteres) {
      continue;
    }

    // Comprobar Circuit Breaker
    const estadoCircuito = obtenerEstadoCircuitoVoz(prov.id);
    if (estadoCircuito.estado === "ABIERTO") {
      continue;
    }

    intentos++;
    const esRespaldo = intentos > 1;
    const inicioIntento = Date.now();

    try {
      const textoRecortado = recortarEnLimiteOracion(texto, prov.max_caracteres || 1000);
      let resAudio = null;

      if (prov.id === "elevenlabs") {
        const apiKey = env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY;
        resAudio = await sintetizarElevenLabs({
          texto: textoRecortado,
          apiKey,
          voiceId: prov.voice_id,
          modelo: prov.modelo,
          timeoutMs: prov.timeout_ms || 6000
        });
      } else if (prov.id === "gemini_tts") {
        const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        resAudio = await sintetizarGeminiTTS({
          texto: textoRecortado,
          apiKey,
          modelo: prov.modelo,
          timeoutMs: prov.timeout_ms || 8000
        });
      }

      if (resAudio && resAudio.buffer) {
        registrarExitoVoz(prov.id);
        registrarLlamada({
          proveedorId: prov.id,
          tipoOperacion: "voz",
          duracionMs: Date.now() - inicioIntento,
          exito: true,
          esRespaldo
        });

        // Guardar en caché con control de tamaño y TTL (LRU)
        limpiarCacheExpirada(
          config.configuracion_general?.limite_cache_audio_items || 50,
          config.configuracion_general?.cache_audio_ttl_ms || 86400000
        );
        cacheAudio.set(hash, {
          buffer: resAudio.buffer,
          contentType: resAudio.contentType,
          proveedor: prov.nombre,
          timestamp: Date.now(),
          lastAccess: Date.now()
        });

        return {
          desdeCache: false,
          buffer: resAudio.buffer,
          contentType: resAudio.contentType,
          proveedor: prov.nombre,
          esRespaldo
        };
      }
    } catch (err) {
      const duracionFallo = Date.now() - inicioIntento;

      if (err.esConfiguracion) {
        console.warn(`🚨 [Voz Config Error] ${prov.nombre}: ${err.message}`);
        registrarLlamada({
          proveedorId: prov.id,
          tipoOperacion: "voz",
          duracionMs: duracionFallo,
          exito: false,
          codigoError: err.status || 401,
          esRespaldo
        });
        continue;
      }

      // Si es error 404 / modelo no disponible en TTS
      const es404 = err.status === 404 || (err.message && (err.message.includes("404") || err.message.toLowerCase().includes("not found")));
      if (es404) {
        console.warn(`⚠️ [Voz Modelo No Disponible] ${prov.nombre}: modelo no disponible (${err.message})`);
        const est = obtenerEstadoCircuitoVoz(prov.id);
        est.ultimoError = "modelo_no_disponible";
      }

      registrarFalloVoz(prov.id, err);
      registrarLlamada({
        proveedorId: prov.id,
        tipoOperacion: "voz",
        duracionMs: duracionFallo,
        exito: false,
        codigoError: err.status || 500,
        esRespaldo
      });
      console.warn(`⚠️ [Enrutador Voz] Falló ${prov.nombre} (${err.message}). Conmutando al siguiente proveedor...`);
    }
  }

  // Si fallaron los servicios de red, retornar fallback local sin error 500
  return {
    fallbackLocal: true,
    proveedor: "speech_synthesis_local",
    esRespaldo: true
  };
}

function obtenerEstadoProveedoresVoz() {
  const config = cargarConfiguracion();
  const ahora = Date.now();

  return (config.proveedores_voz || []).map((prov) => {
    const circuito = obtenerEstadoCircuitoVoz(prov.id);
    const enPausa = circuito.estado === "ABIERTO";
    const segundosPausa = enPausa ? Math.max(0, Math.ceil((circuito.pausaHastaMs - ahora) / 1000)) : 0;

    let conClave = true;
    if (prov.id === "elevenlabs") conClave = !!process.env.ELEVENLABS_API_KEY;
    else if (prov.id === "gemini_tts") conClave = !!process.env.GEMINI_API_KEY;

    let estado = "disponible";
    if (!prov.activo) {
      estado = "desactivado";
    } else if (!conClave) {
      estado = "sin clave configurada";
    } else if (circuito.ultimoError === "modelo_no_disponible" || (circuito.ultimoError && circuito.ultimoError.toLowerCase().includes("not found"))) {
      estado = "modelo no disponible";
    } else if (enPausa) {
      estado = "en pausa por circuito abierto";
    } else if (circuito.estado === "SEMI_ABIERTO") {
      estado = "reintento gradual";
    }

    return {
      id: prov.id,
      nombre: prov.nombre,
      prioridad: prov.prioridad,
      maxCaracteres: prov.max_caracteres,
      activo: prov.activo,
      estado,
      estadoCircuito: circuito.estado,
      enPausa,
      segundosPausaRestantes: segundosPausa,
      conClave
    };
  });
}

function limpiarCacheAudioParaPruebas() {
  cacheAudio.clear();
}

module.exports = {
  enrutarVoz,
  recortarEnLimiteOracion,
  calcularHashTexto,
  obtenerEstadoCircuitoVoz,
  registrarFalloVoz,
  registrarExitoVoz,
  obtenerEstadoProveedoresVoz,
  limpiarCacheAudioParaPruebas
};
