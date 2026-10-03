const fs = require("fs");
const path = require("path");
const { llamarGemini } = require("./adaptadores/geminiAdapter.js");
const { llamarGroq } = require("./adaptadores/groqAdapter.js");
const { llamarOpenRouter } = require("./adaptadores/openrouterAdapter.js");
const { generarDesdeBibliotecaOficial } = require("./modoBibliotecaOficial.js");
const { registrarLlamada } = require("./registroUso.js");
const { puedeRealizarConsulta, registrarConsultaRealizada } = require("./gestorGasto.js");
const { cargarEstadoCircuitos, guardarEstadoCircuitos } = require("./persistenciaEstado.js");

/**
 * server/ia/enrutadorIA.js
 * Enrutador Inteligente de IA con Respaldo Automático, Circuit Breaker y Biblioteca Oficial.
 */

// Estados del Circuit Breaker por proveedor: cargados desde disco o inicializados en memoria
const estadosCircuito = cargarEstadoCircuitos();

let cacheConfiguracion = null;

function cargarConfiguracion(forzarRecarga = false) {
  if (cacheConfiguracion && !forzarRecarga) {
    return cacheConfiguracion;
  }
  const rutaConfig = path.join(__dirname, "proveedores.json");
  if (fs.existsSync(rutaConfig)) {
    try {
      cacheConfiguracion = JSON.parse(fs.readFileSync(rutaConfig, "utf-8"));
      return cacheConfiguracion;
    } catch (e) {
      console.warn("⚠️ Error leyendo proveedores.json:", e.message);
    }
  }
  cacheConfiguracion = {
    configuracion_general: {
      presupuesto_total_ms: 20000,
      limite_consultas_diario: 500,
      circuito_fallos_maximos: 3,
      circuito_cooldown_error_ms: 60000,
      circuito_cooldown_429_rpm_ms: 60000,
      circuito_cooldown_429_rpd_ms: 86400000,
      circuito_cooldown_429_default_ms: 60000,
      circuito_cooldown_429_max_ms: 900000,
      zona_horaria_cuota: "America/Los_Angeles"
    },
    proveedores_texto: []
  };
  return cacheConfiguracion;
}

function calcularMsHastaMedianocheZona(zonaHoraria = "America/Los_Angeles") {
  try {
    const ahora = new Date();
    const partes = new Intl.DateTimeFormat("en-US", {
      timeZone: zonaHoraria,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false
    }).formatToParts(ahora);

    const v = {};
    partes.forEach(p => { v[p.type] = parseInt(p.value, 10); });

    const horasRestantes = 23 - (v.hour || 0);
    const minutosRestantes = 59 - (v.minute || 0);
    const segundosRestantes = 60 - (v.second || 0);

    const msRestantes = (horasRestantes * 3600 + minutosRestantes * 60 + segundosRestantes) * 1000;
    if (msRestantes > 0 && msRestantes <= 86400000) {
      return msRestantes;
    }
  } catch (e) {
    console.warn(`Aviso: Error calculando hora en '${zonaHoraria}':`, e.message);
  }
  return 86400000;
}

function calcularCooldown429(err, configGeneral) {
  const cfg = configGeneral || {};
  const cooldownRpm = cfg.circuito_cooldown_429_rpm_ms || 60000;
  const cooldownRpd = cfg.circuito_cooldown_429_rpd_ms || 86400000;
  const cooldownDefault = cfg.circuito_cooldown_429_default_ms || 60000;
  const cooldownMax = cfg.circuito_cooldown_429_max_ms || 900000;
  const zonaHoraria = cfg.zona_horaria_cuota || "America/Los_Angeles";

  const msg = String(err?.message || "").toLowerCase();
  const detail = typeof err?.detail === "string" ? err.detail.toLowerCase() : "";
  const fullText = `${msg} ${detail} ${JSON.stringify(err?.rawError || "")}`.toLowerCase();

  // 1. Cuota diaria (RPD / per day / daily limit)
  // REGLA CRÍTICA: NO debe ser recortada por circuito_cooldown_429_max_ms
  const esRpd = fullText.includes("per day") ||
                fullText.includes("daily") ||
                fullText.includes("rpd") ||
                fullText.includes("dia") ||
                fullText.includes("quota exceeded for quota metric 'queries' and limit 'queries per day'");

  if (esRpd) {
    const msCalculados = calcularMsHastaMedianocheZona(zonaHoraria);
    const ms = Math.max(msCalculados, 60000);
    return {
      cooldownMs: ms,
      ms,
      tipo: "rpd",
      motivo: `Cuota diaria agotada (esperando medianoche en ${zonaHoraria})`
    };
  }

  // 2. Retry-After explícito en headers, err.retryAfter o en el texto
  let segsRetry = null;
  if (err?.retryAfter) {
    const parsed = parseInt(err.retryAfter, 10);
    if (!isNaN(parsed) && parsed > 0) segsRetry = parsed;
  } else if (err?.headers && (err.headers["retry-after"] || (typeof err.headers.get === "function" && err.headers.get("retry-after")))) {
    const rawH = err.headers["retry-after"] || err.headers.get("retry-after");
    const parsed = parseInt(rawH, 10);
    if (!isNaN(parsed) && parsed > 0) segsRetry = parsed;
  } else {
    const matchRetry = fullText.match(/retry(?: after| in)? (\d+)\s*(?:s|sec|seconds|segundos)?/i);
    if (matchRetry && matchRetry[1]) {
      const parsed = parseInt(matchRetry[1], 10);
      if (!isNaN(parsed) && parsed > 0) segsRetry = parsed;
    }
  }

  if (segsRetry !== null) {
    const ms = Math.min(segsRetry * 1000, cooldownMax);
    return {
      cooldownMs: ms,
      ms,
      tipo: "retry_after",
      motivo: `Retry-After especificado por proveedor (${segsRetry}s)`
    };
  }

  // 3. Límite por minuto (RPM / per minute / rate limit)
  const esRpm = fullText.includes("per minute") ||
                fullText.includes("rpm") ||
                fullText.includes("minuto") ||
                fullText.includes("requests per minute") ||
                fullText.includes("queries per minute");

  if (esRpm) {
    const ms = Math.min(cooldownRpm, cooldownMax);
    return {
      cooldownMs: ms,
      ms,
      tipo: "rpm",
      motivo: "Límite por minuto alcanzado (pausa de 60s)"
    };
  }

  // 4. No distinguible / sin datos específicos -> pausa corta (60s) con cooldownMax
  const ms = Math.min(cooldownDefault, cooldownMax);
  return {
    cooldownMs: ms,
    ms,
    tipo: "default",
    motivo: "Error 429 sin especificación (pausa gradual)"
  };
}

function obtenerEstadoCircuito(proveedorId) {
  const ahora = Date.now();
  let est = estadosCircuito.get(proveedorId);
  if (!est) {
    est = {
      estado: "CERRADO",
      fallosConsecutivos: 0,
      pausaHastaMs: 0,
      ultimoError: null,
      ultimaLlamada: 0,
      motivoPausa: null
    };
    estadosCircuito.set(proveedorId, est);
  }

  // Si estaba abierto pero ya venció el tiempo de enfriamiento, pasa a SEMI_ABIERTO (prueba controlada)
  if (est.estado === "ABIERTO" && ahora >= est.pausaHastaMs) {
    est.estado = "SEMI_ABIERTO";
  }

  return est;
}

function registrarExitoCircuito(proveedorId) {
  const est = obtenerEstadoCircuito(proveedorId);
  est.estado = "CERRADO";
  est.fallosConsecutivos = 0;
  est.pausaHastaMs = 0;
  est.ultimoError = null;
  est.ultimaLlamada = Date.now();
  est.motivoPausa = null;
  guardarEstadoCircuitos(estadosCircuito);
}

function registrarFalloCircuito(proveedorId, err, configGeneral) {
  const ahora = Date.now();
  const est = obtenerEstadoCircuito(proveedorId);
  est.fallosConsecutivos++;
  est.ultimoError = err.message;
  est.ultimaLlamada = ahora;

  const es404 = err.status === 404 || (err.message && (err.message.includes("404") || err.message.toLowerCase().includes("not found")));
  if (es404) {
    est.ultimoError = "modelo_no_disponible";
  }

  const es429 = err.status === 429 || (err.message && err.message.includes("429"));
  const maxFallos = (configGeneral && configGeneral.circuito_fallos_maximos) || 3;

  if (es429) {
    const { cooldownMs, tipo } = calcularCooldown429(err, configGeneral);
    est.estado = "ABIERTO";
    est.pausaHastaMs = ahora + cooldownMs;
    est.motivoPausa = `429_${tipo}`;
    guardarEstadoCircuitos(estadosCircuito);
  } else if (est.fallosConsecutivos >= maxFallos || est.estado === "SEMI_ABIERTO") {
    // 5xx o timeout tras maxFallos abre el circuito por tiempo corto
    const cooldownMs = (configGeneral && configGeneral.circuito_cooldown_error_ms) || 60000;
    est.estado = "ABIERTO";
    est.pausaHastaMs = ahora + cooldownMs;
    est.motivoPausa = "error_repetido";
    guardarEstadoCircuitos(estadosCircuito);
  } else {
    guardarEstadoCircuitos(estadosCircuito);
  }
}

/**
 * Limpia bloques <think>...</think> de modelos de razonamiento (como DeepSeek R1)
 * y extrae JSON válido.
 */
function limpiarYExtraerJson(texto) {
  if (!texto || typeof texto !== "string") return null;

  // 1. Quitar etiquetas <think>...</think>
  let limpio = texto.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // 2. Quitar bloques markdown ```json ... ```
  limpio = limpio.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();

  // 3. Buscar primer '{' y último '}'
  const start = limpio.indexOf("{");
  const end = limpio.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  const jsonStr = limpio.substring(start, end + 1);
  try {
    const obj = JSON.parse(jsonStr);
    return obj;
  } catch (e) {
    return null;
  }
}

// Lista de próceres dominicanos, lugares geográficos e instituciones curriculares protegidas
const ENTIDADES_HISTORICAS_PROTEGIDAS = [
  "juan pablo duarte",
  "matias ramon mella",
  "francisco del rosario sanchez",
  "gregorio luperon",
  "salome urena",
  "cristobal colon",
  "eugenio maria de hostos",
  "pedro henriquez urena",
  "maximo gomez",
  "concepcion bona",
  "maria trinidad sanchez",
  "santo domingo",
  "santiago",
  "santiago de los caballeros",
  "la vega",
  "puerto plata",
  "samana",
  "barahona",
  "san cristobal",
  "rio yaque",
  "pico duarte",
  "constitucion",
  "republica dominicana",
  "minerd",
  "conbase"
];

function normalizarParaComparacion(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function crearRegexInsensibleAcentos(str) {
  if (!str || typeof str !== "string") return null;
  const mapa = {
    a: "[aáàäAÁÀÄ]",
    á: "[aáàäAÁÀÄ]",
    à: "[aáàäAÁÀÄ]",
    ä: "[aáàäAÁÀÄ]",
    e: "[eéèëEÉÈË]",
    é: "[eéèëEÉÈË]",
    è: "[eéèëEÉÈË]",
    ë: "[eéèëEÉÈË]",
    i: "[iíìïIÍÌÏ]",
    í: "[iíìïIÍÌÏ]",
    ì: "[iíìïIÍÌÏ]",
    ï: "[iíìïIÍÌÏ]",
    o: "[oóòöOÓÒÖ]",
    ó: "[oóòöOÓÒÖ]",
    ò: "[oóòöOÓÒÖ]",
    ö: "[oóòöOÓÒÖ]",
    u: "[uúùüUÚÙÜ]",
    ú: "[uúùüUÚÙÜ]",
    ù: "[uúùüUÚÙÜ]",
    ü: "[uúùüUÚÙÜ]",
    n: "[nñNÑ]",
    ñ: "[nñNÑ]",
    c: "[cçCÇ]",
    ç: "[cçCÇ]"
  };
  const escaped = str.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let patron = "";
  for (const char of escaped) {
    const min = char.toLowerCase();
    patron += mapa[min] || char;
  }
  return new RegExp(`(?<![\\p{L}\\p{N}])${patron}(?![\\p{L}\\p{N}])`, "giu");
}

/**
 * Filtro de privacidad inteligente:
 * - Anonimiza nombres de estudiantes, docentes y escuelas dados en el perfil docente.
 * - Enmascara datos personales objetivos (cédulas, teléfonos, correos).
 * - Preserva próceres patrios, lugares geográficos e instituciones que son temas de clase.
 */
function filtrarPrivacidad(texto, datosPerfil = {}) {
  if (!texto || typeof texto !== "string") return "";
  let resultado = texto;

  // 1. Patrones explícitos marcados en consultas: "estudiante: X", "escuela: X"
  resultado = resultado.replace(/(?:estudiante|alumno|alumna|niño|niña):\s*([A-Za-zÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-Za-zÁÉÍÓÚÑáéíóúñ]+)?)/gi, () => {
    return "Estudiante [Reservado]";
  });

  resultado = resultado.replace(/(?:escuela|colegio|liceo|centro\s+educativo):\s*([A-Za-zÁÉÍÓÚÑáéíóúñ\s]+?)(?=[.,;\n]|$)/gi, () => {
    return "Centro Educativo [Reservado]";
  });

  // 2. Enmascarar Cédula Dominicana: 001-1234567-8 o 00112345678
  resultado = resultado.replace(/\b\d{3}-?\d{7}-?\d\b/g, "[Cédula]");

  // 3. Enmascarar Teléfonos dominicanos e internacionales
  resultado = resultado.replace(/\b(?:\+?1[-. ]?)?\(?8[024]9\)?[-. ]?\d{3}[-. ]?\d{4}\b/g, "[Teléfono]");

  // 4. Enmascarar Correos Electrónicos
  resultado = resultado.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[Correo]");

  // 5. Anonimizar nombres del perfil docente si fueron provistos
  const docentes = [
    datosPerfil.docente,
    datosPerfil.nombreDocente,
    datosPerfil.profesor,
    datosPerfil.nombreProfesor
  ].filter(d => typeof d === "string" && d.trim().length >= 3);

  for (const doc of docentes) {
    const normDoc = normalizarParaComparacion(doc);
    const esProtegido = ENTIDADES_HISTORICAS_PROTEGIDAS.some(p => normDoc.includes(p) || p.includes(normDoc));
    if (!esProtegido) {
      const rx = crearRegexInsensibleAcentos(doc);
      if (rx) resultado = resultado.replace(rx, "Docente [Reservado]");
    }
  }

  const centros = [
    datosPerfil.escuela,
    datosPerfil.centroEducativo,
    datosPerfil.colegio,
    datosPerfil.liceo,
    datosPerfil.centro
  ].filter(c => typeof c === "string" && c.trim().length >= 4);

  for (const esc of centros) {
    const rx = crearRegexInsensibleAcentos(esc);
    if (rx) resultado = resultado.replace(rx, "Centro Educativo [Reservado]");
  }

  const estudiantes = [];
  if (Array.isArray(datosPerfil.estudiantes)) estudiantes.push(...datosPerfil.estudiantes);
  if (Array.isArray(datosPerfil.alumnos)) estudiantes.push(...datosPerfil.alumnos);
  if (typeof datosPerfil.estudiante === "string") estudiantes.push(datosPerfil.estudiante);
  if (typeof datosPerfil.alumno === "string") estudiantes.push(datosPerfil.alumno);

  for (const est of estudiantes) {
    if (typeof est === "string" && est.trim().length >= 3) {
      const normEst = normalizarParaComparacion(est);
      const esProtegido = ENTIDADES_HISTORICAS_PROTEGIDAS.some(p => normEst.includes(p) || p.includes(normEst));
      if (!esProtegido) {
        const rx = crearRegexInsensibleAcentos(est);
        if (rx) resultado = resultado.replace(rx, "Estudiante [Reservado]");
      }
    }
  }

  return resultado;
}

/**
 * Enruta peticiones de planificación curricular
 */
async function enrutarPeticion({
  tema,
  grado,
  area,
  nivel = "primario",
  esquemaActivo = "conbase",
  periodoActivo = "diaria",
  prompt,
  contents = null,
  imageBase64 = null,
  mediaType = null,
  env = {},
  onChunk = null
}) {
  const config = cargarConfiguracion();
  const configGeneral = config.configuracion_general || {};
  const presupuestoTotalMs = configGeneral.presupuesto_total_ms || 20000;
  const tiempoInicio = Date.now();

  // 1. Control de gasto diario
  if (!puedeRealizarConsulta(configGeneral.limite_consultas_diario)) {
    console.warn("⚠️ [Enrutador IA] Límite diario de consultas alcanzado. Redirigiendo a Biblioteca Oficial.");
    return generarDesdeBibliotecaOficial({ tema, grado, area, nivel, esquemaActivo, periodoActivo });
  }

  // 2. Pre-consulta a Biblioteca Oficial (si es un tema cubierto de CON BASE y no hay imagen)
  if (!imageBase64 && tema) {
    const temaNorm = tema.toLowerCase();
    const esTemaCubierto = ["identidad", "tarjeta", "letrero", "receta", "noticia", "cuento", "expositivo", "cancion", "conteo", "suma", "resta", "geometria", "recta numerica"].some(t => temaNorm.includes(t));
    if (esTemaCubierto && (grado === "1ro" || grado === "2do" || grado === "3ro" || grado?.includes("primero") || grado?.includes("segundo") || grado?.includes("tercero"))) {
      console.log(`⚡ [Enrutador IA] Pre-consulta a Biblioteca Oficial activada para tema curricular: "${tema}"`);
      registrarLlamada({
        proveedorId: "biblioteca_oficial",
        modelo: "minerd-conbase-local",
        duracionMs: Date.now() - tiempoInicio,
        exito: true,
        esRespaldo: false,
        origen: "biblioteca_oficial"
      });
      return generarDesdeBibliotecaOficial({ tema, grado, area, nivel, esquemaActivo, periodoActivo });
    }
  }

  // 3. Cadena de proveedores ordenados por prioridad
  const proveedores = [...(config.proveedores_texto || [])].sort((a, b) => a.prioridad - b.prioridad);

  let intentosRealizados = 0;
  let ultimoError = null;

  for (const prov of proveedores) {
    if (!prov.activo) continue;

    // Protección de gasto: no activar proveedores de pago sin autorización
    if (prov.es_de_pago && prov.requiere_autorizacion) {
      continue;
    }

    // Validación de imagen: solo proveedores con vision_aprobada reciben fotos
    if (imageBase64 && !prov.vision_aprobada) {
      continue;
    }

    // Comprobar Circuit Breaker
    const estadoCircuito = obtenerEstadoCircuito(prov.id);
    if (estadoCircuito.estado === "ABIERTO") {
      const segundosRestantes = Math.ceil((estadoCircuito.pausaHastaMs - Date.now()) / 1000);
      console.warn(`🛑 [Circuit Breaker] Proveedor ${prov.nombre} en pausa (${segundosRestantes}s restantes). Saltando.`);
      continue;
    }

    // Comprobar presupuesto de tiempo restante
    const tiempoTranscurrido = Date.now() - tiempoInicio;
    const tiempoRestante = presupuestoTotalMs - tiempoTranscurrido;
    if (tiempoRestante <= 1000) {
      console.warn("⏱️ [Enrutador IA] Presupuesto de tiempo agotado. Conmutando a Modo Biblioteca Oficial.");
      break;
    }

    const timeoutIntento = Math.min(prov.timeout_ms || 8000, tiempoRestante);
    const inicioIntento = Date.now();
    intentosRealizados++;
    const esRespaldo = intentosRealizados > 1;

    try {
      let resultadoTexto = "";
      const promptFiltrado = filtrarPrivacidad(prompt || `Planifica el tema: ${tema} (${grado} - ${area})`);

      if (prov.id === "gemini_flash" || prov.id === "gemini_flash_lite") {
        const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        const resGemini = await llamarGemini({
          modelo: prov.modelo,
          apiKey,
          prompt: promptFiltrado,
          contents,
          timeoutMs: timeoutIntento,
          imageBase64,
          mediaType,
          onChunk
        });
        resultadoTexto = resGemini.texto;
      } else if (prov.id === "groq_llama") {
        const apiKey = env.GROQ_API_KEY || process.env.GROQ_API_KEY;
        const resGroq = await llamarGroq({
          modelo: prov.modelo,
          apiKey,
          prompt: promptFiltrado,
          timeoutMs: timeoutIntento
        });
        resultadoTexto = resGroq.texto;
      } else if (prov.id === "openrouter_free") {
        const apiKey = env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
        const resOpen = await llamarOpenRouter({
          modelo: prov.modelo,
          apiKey,
          prompt: promptFiltrado,
          timeoutMs: timeoutIntento
        });
        resultadoTexto = resOpen.texto;
      } else if (prov.id === "biblioteca_oficial") {
        registrarConsultaRealizada();
        registrarExitoCircuito(prov.id);
        registrarLlamada({
          proveedorId: prov.id,
          modelo: prov.modelo,
          duracionMs: Date.now() - inicioIntento,
          exito: true,
          esRespaldo,
          origen: "biblioteca_oficial"
        });
        return generarDesdeBibliotecaOficial({ tema, grado, area, nivel, esquemaActivo, periodoActivo });
      }

      // Validar y sanitizar respuesta del proveedor
      const jsonParsed = limpiarYExtraerJson(resultadoTexto);
      if (!jsonParsed || (typeof jsonParsed === "object" && Object.keys(jsonParsed).length === 0)) {
        throw new Error(`El proveedor ${prov.nombre} devolvió una respuesta vacía o no estructurada.`);
      }

      // Éxito comprobado
      registrarExitoCircuito(prov.id);
      registrarConsultaRealizada();
      registrarLlamada({
        proveedorId: prov.id,
        modelo: prov.modelo,
        duracionMs: Date.now() - inicioIntento,
        exito: true,
        esRespaldo,
        origen: "ia_generativa"
      });

      return {
        ...jsonParsed,
        proveedor_utilizado: prov.nombre,
        es_respaldo: esRespaldo,
        distintivo: esRespaldo ? "Generado con motor de respaldo" : null
      };

    } catch (err) {
      const duracionFallo = Date.now() - inicioIntento;
      ultimoError = err;

      // REGLA: Si es error de configuración (400, 401, 403), NO activa el respaldo ni cicla otros proveedores
      const esConfiguracion = err.esConfiguracion || err.status === 400 || err.status === 401 || err.status === 403 || (err.message && (err.message.includes("API key not valid") || err.message.includes("API_KEY_INVALID")));
      if (esConfiguracion) {
        console.error(`🚨 [Config Error] Proveedor ${prov.nombre}: ${err.message}`);
        registrarLlamada({
          proveedorId: prov.id,
          modelo: prov.modelo,
          duracionMs: duracionFallo,
          exito: false,
          codigoError: err.status || 401,
          tipoFallo: "configuracion",
          esRespaldo
        });
        break; // Cortocircuito directo al Modo Biblioteca Oficial sin ciclar respaldos
      }

      // Si es error 404 / modelo no encontrado
      const es404 = err.status === 404 || (err.message && (err.message.includes("404") || err.message.toLowerCase().includes("not found")));
      if (es404) {
        console.warn(`⚠️ [Modelo No Disponible] Proveedor ${prov.nombre}: modelo no disponible (${err.message})`);
        const est = obtenerEstadoCircuito(prov.id);
        est.ultimoError = "modelo_no_disponible";
      }

      // Registrar fallo en Circuit Breaker (distingue 429 vs 5xx/timeout)
      registrarFalloCircuito(prov.id, err, configGeneral);
      registrarLlamada({
        proveedorId: prov.id,
        modelo: prov.modelo,
        duracionMs: duracionFallo,
        exito: false,
        codigoError: err.status || 500,
        esRespaldo
      });

      console.warn(`⚠️ [Enrutador IA] Falló ${prov.nombre} (${err.message}). Conmutando al siguiente proveedor...`);
    }
  }

  // 4. Si hay imagen y ningún proveedor con visión aprobada pudo responder:
  if (imageBase64) {
    return {
      error: "En este momento el servicio de análisis visual no está disponible con proveedores aprobados.",
      mensaje_chat: "No pude analizar la imagen en este momento porque el servicio visual de alta seguridad está en mantenimiento. Por favor ingresa el tema por texto o dictado.",
      plan_completado: false
    };
  }

  // 5. Último nivel garantizado: Modo Biblioteca Oficial (Sin IA generativa)
  console.log("🛡️ [Enrutador IA] Activando Modo Biblioteca Oficial (Último respaldo seguro)...");
  registrarLlamada({
    proveedorId: "biblioteca_oficial",
    modelo: "minerd-conbase-local",
    duracionMs: Date.now() - tiempoInicio,
    exito: true,
    esRespaldo: true,
    origen: "biblioteca_oficial"
  });

  return generarDesdeBibliotecaOficial({ tema, grado, area, nivel, esquemaActivo, periodoActivo });
}

function tieneClaveConfigurada(provId) {
  if (provId === "biblioteca_oficial" || provId === "biblioteca_minerd_search" || provId === "speech_synthesis_local") {
    return true; // No requieren clave externa
  }
  if (provId === "gemini_flash" || provId === "gemini_flash_lite" || provId === "gemini_flash_vision" || provId === "gemini_tts" || provId === "gemini_search_grounding") {
    return !!process.env.GEMINI_API_KEY;
  }
  if (provId === "groq_llama") {
    return !!process.env.GROQ_API_KEY;
  }
  if (provId === "openrouter_free") {
    return !!process.env.OPENROUTER_API_KEY;
  }
  if (provId === "tavily_search") {
    return !!process.env.TAVILY_API_KEY;
  }
  if (provId === "elevenlabs") {
    return !!process.env.ELEVENLABS_API_KEY;
  }
  return false;
}

function obtenerEstadoProveedores() {
  const config = cargarConfiguracion();
  const ahora = Date.now();

  return (config.proveedores_texto || []).map((prov) => {
    const circuito = obtenerEstadoCircuito(prov.id);
    const enPausa = circuito.estado === "ABIERTO";
    const segundosPausa = enPausa ? Math.max(0, Math.ceil((circuito.pausaHastaMs - ahora) / 1000)) : 0;
    const conClave = tieneClaveConfigurada(prov.id);

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
      modelo: prov.modelo,
      prioridad: prov.prioridad,
      activo: prov.activo,
      estado,
      estadoCircuito: circuito.estado,
      enPausa,
      segundosPausaRestantes: segundosPausa,
      fallosConsecutivos: circuito.fallosConsecutivos,
      esDePago: prov.es_de_pago,
      visionAprobada: prov.vision_aprobada,
      conClave
    };
  });
}

module.exports = {
  obtenerEstadoCircuito,
  registrarExitoCircuito,
  registrarFalloCircuito,
  limpiarYExtraerJson,
  filtrarPrivacidad,
  enrutarPeticion,
  obtenerEstadoProveedores,
  calcularCooldown429,
  calcularMsHastaMedianocheZona,
  tieneClaveConfigurada
};
