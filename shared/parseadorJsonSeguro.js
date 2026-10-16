/**
 * shared/parseadorJsonSeguro.js
 * Módulo canónico y seguro de extracción y validación de JSON generado por IA.
 * Compartido entre Cloudflare Worker, Node.js y cliente Vite PWA.
 */

export function objetoDesde(texto, inicio) {
  let prof = 0, enCadena = false, escape = false;
  for (let i = inicio; i < texto.length; i++) {
    const c = texto[i];
    if (enCadena) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') enCadena = false;
      continue;
    }
    if (c === '"') enCadena = true;
    else if (c === "{") prof++;
    else if (c === "}" && --prof === 0) {
      const candidate = texto.slice(inicio, i + 1);
      try { return JSON.parse(candidate); } catch {
        try {
          const saneado = candidate.replace(/(?<=:\s*"[^"]*)\r?\n(?=[^"]*")/g, "\\n");
          return JSON.parse(saneado);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export function extraerJson(texto, campoRequerido = "mensaje_chat") {
  if (typeof texto !== "string") return null;
  const limpio = texto.replace(/```(?:json)?/gi, "").trim();
  let pos = limpio.indexOf("{");
  while (pos !== -1) {
    const obj = objetoDesde(limpio, pos);
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      if (campoRequerido in obj || "datos_planificacion" in obj || "plan_completado" in obj || "mensaje" in obj) {
        if (!obj.mensaje_chat && (obj.datos_planificacion || obj.mensaje)) {
          obj.mensaje_chat = obj.mensaje || "Aquí tienes la planificación curricular elaborada para tu clase.";
        }
        return obj;
      }
    }
    pos = limpio.indexOf("{", pos + 1);
  }
  return null;
}

export function mensajeParaChat(obj) {
  if (!obj) return null;
  const m = typeof obj.mensaje_chat === "string" ? obj.mensaje_chat.trim()
    : typeof obj.mensaje === "string" ? obj.mensaje.trim()
    : "";
  return m && !m.startsWith("{") ? m : (obj.datos_planificacion ? "Aquí tienes la planificación curricular elaborada para tu clase." : null);
}

export function validarCamposPlanificacion(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  if (!mensajeParaChat(obj)) return false;
  if (obj.plan_completado) {
    if (!obj.datos_planificacion || typeof obj.datos_planificacion !== "object" || Array.isArray(obj.datos_planificacion)) {
      return false;
    }
  }
  return true;
}

export function repararJsonTruncado(texto) {
  if (typeof texto !== "string") return null;
  const limpio = texto.replace(/```(?:json)?/gi, "").trim();
  const inicio = limpio.indexOf("{");
  if (inicio === -1) return null;

  // Intentar parseo estándar primero
  const parsedDirecto = extraerJson(limpio);
  if (parsedDirecto && typeof parsedDirecto === "object") return parsedDirecto;

  // Analizar tokens para cerrar comillas y estructuras
  let inString = false;
  let escape = false;
  const stack = [];

  for (let i = inicio; i < limpio.length; i++) {
    const c = limpio[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (c === "\\") {
        escape = true;
      } else if (c === '"') {
        inString = false;
      }
      continue;
    }

    if (c === '"') {
      inString = true;
    } else if (c === "{" || c === "[") {
      stack.push(c);
    } else if (c === "}" || c === "]") {
      if (stack.length > 0) {
        const top = stack[stack.length - 1];
        if ((c === "}" && top === "{") || (c === "]" && top === "[")) {
          stack.pop();
        }
      }
    }
  }

  let complement = "";
  if (inString) {
    complement += '"';
  }

  for (let s = stack.length - 1; s >= 0; s--) {
    const op = stack[s];
    if (op === "{") complement += "}";
    else if (op === "[") complement += "]";
  }

  const candidato = limpio + complement;
  try {
    const res = JSON.parse(candidato);
    return res;
  } catch (err) {
    try {
      const saneado = candidato.replace(/(?<=:\s*"[^"]*)\r?\n(?=[^"]*")/g, "\\n");
      return JSON.parse(saneado);
    } catch {
      return null;
    }
  }
}

export function mapearNombreBloque(claveOriginal) {
  if (typeof claveOriginal !== "string") return "bloque_generico";
  const c = claveOriginal.toLowerCase();
  if (c.includes("dato") || c.includes("general")) return "datos_generales";
  if (c.includes("competencia") || c.includes("intenci") || c.includes("proposito")) return "intencion_pedagogica";
  if (c.includes("contenido")) return "contenidos";
  if (c.includes("estrategia")) return "estrategias";
  if (c.includes("momento") || c.includes("secuencia") || (c.includes("inicio") && c.includes("desarrollo"))) return "momentos";
  if (c.includes("actividad")) return "actividades";
  if (c.includes("recurso") || c.includes("medio")) return "recursos";
  if (c.includes("evalua") || c.includes("indicador") || c.includes("criterio") || c.includes("instrumento")) return "evaluacion";
  if (c.includes("adaptacion") || c.includes("nee") || c.includes("ajuste")) return "adaptaciones";
  return claveOriginal;
}

export function extraerBloquesCompletados(texto, bloquesEmitidos = new Set()) {
  if (typeof texto !== "string") return [];
  const encontrados = [];

  // 1. Detectar mensaje_chat si está completado y no emitido
  if (!bloquesEmitidos.has("mensaje_chat")) {
    const matchChat = texto.match(/"mensaje_chat"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (matchChat) {
      try {
        const parsedMsg = JSON.parse(`"${matchChat[1]}"`);
        if (parsedMsg && parsedMsg.trim().length > 0) {
          bloquesEmitidos.add("mensaje_chat");
          encontrados.push({
            tipo: "bloque",
            bloque: "mensaje_chat",
            claveOriginal: "mensaje_chat",
            contenido: parsedMsg
          });
        }
      } catch (e) {
        console.warn("[ParseadorJsonSeguro] Intento de parseo de mensaje_chat no JSON:", e?.message || e);
      }
    }
  }

  // 2. Buscar bloques dentro de datos_planificacion o en la raíz
  const posPlan = texto.indexOf('"datos_planificacion"');
  const inicioBusqueda = posPlan !== -1 ? posPlan : 0;

  let i = inicioBusqueda;
  while (i < texto.length) {
    const posComilla = texto.indexOf('"', i);
    if (posComilla === -1) break;

    let finComilla = -1;
    let escape = false;
    for (let k = posComilla + 1; k < texto.length; k++) {
      if (escape) { escape = false; continue; }
      if (texto[k] === "\\") { escape = true; continue; }
      if (texto[k] === '"') { finComilla = k; break; }
    }
    if (finComilla === -1) break;

    const clave = texto.slice(posComilla + 1, finComilla);
    i = finComilla + 1;

    if (clave === "datos_planificacion" || clave === "confianza_curricular" || clave === "plan_completado" || clave === "mensaje_chat") {
      continue;
    }

    while (i < texto.length && /\s/.test(texto[i])) i++;
    if (texto[i] !== ':') continue;
    i++;
    while (i < texto.length && /\s/.test(texto[i])) i++;

    const charInicio = texto[i];
    if (charInicio !== '{' && charInicio !== '[' && charInicio !== '"') continue;

    let valCompletado = null;
    let posFinVal = -1;

    if (charInicio === '{' || charInicio === '[') {
      let depth = 0;
      let inStr = false;
      let esc = false;
      const targetOpen = charInicio;
      const targetClose = charInicio === '{' ? '}' : ']';

      for (let m = i; m < texto.length; m++) {
        const cm = texto[m];
        if (inStr) {
          if (esc) esc = false;
          else if (cm === "\\") esc = true;
          else if (cm === '"') inStr = false;
          continue;
        }
        if (cm === '"') inStr = true;
        else if (cm === targetOpen) depth++;
        else if (cm === targetClose) {
          depth--;
          if (depth === 0) {
            posFinVal = m;
            break;
          }
        }
      }

      if (posFinVal !== -1) {
        const rawCandidate = texto.slice(i, posFinVal + 1);
        try {
          valCompletado = JSON.parse(rawCandidate);
        } catch {
          try {
            const saneado = rawCandidate.replace(/(?<=:\s*"[^"]*)\r?\n(?=[^"]*")/g, "\\n");
            valCompletado = JSON.parse(saneado);
          } catch (e) {
            // Candidato intermedio aún no es JSON balanceado; continuar escaneo incremental
            if (typeof process !== "undefined" && process?.env?.DEBUG_PARSER) {
              console.warn("[ParseadorJsonSeguro] Candidato intermedio no parseable:", e?.message || e);
            }
          }
        }
      }
    } else if (charInicio === '"') {
      let finStrVal = -1;
      let esc = false;
      for (let m = i + 1; m < texto.length; m++) {
        if (esc) { esc = false; continue; }
        if (texto[m] === "\\") { esc = true; continue; }
        if (texto[m] === '"') { finStrVal = m; break; }
      }
      if (finStrVal !== -1) {
        posFinVal = finStrVal;
        try {
          valCompletado = JSON.parse(texto.slice(i, finStrVal + 1));
        } catch (e) {
          // Cadena intermedia no parseable como JSON literal; continuar escaneo
          if (typeof process !== "undefined" && process?.env?.DEBUG_PARSER) {
            console.warn("[ParseadorJsonSeguro] Cadena intermedia no parseable:", e?.message || e);
          }
        }
      }
    }

    if (valCompletado !== null && posFinVal !== -1) {
      const nombreBloque = mapearNombreBloque(clave);
      if (!bloquesEmitidos.has(nombreBloque)) {
        bloquesEmitidos.add(nombreBloque);
        encontrados.push({
          tipo: "bloque",
          bloque: nombreBloque,
          claveOriginal: clave,
          contenido: valCompletado
        });
      }
      i = posFinVal + 1;
    } else {
      // Si el bloque actual aún no se ha cerrado completamente en el stream, detener el escaneo
      // para no parsear propiedades internas como si fueran bloques independientes
      break;
    }
  }

  return encontrados;
}

export function planEsRecuperable(obj) {
  if (!obj || typeof obj !== "object") return false;
  const dp = obj.datos_planificacion || obj;
  if (!dp || typeof dp !== "object") return false;

  const claves = Object.keys(dp).map(k => k.toLowerCase());
  const tieneDatosGenerales = claves.some(k => k.includes("dato") || k.includes("general") || k.includes("grado"));
  const tieneSecuencia = claves.some(k => k.includes("momento") || k.includes("actividad") || k.includes("secuencia") || k.includes("inicio") || k.includes("desarrollo"));

  return tieneDatosGenerales && tieneSecuencia;
}
