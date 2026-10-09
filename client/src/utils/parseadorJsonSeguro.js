/**
 * parseadorJsonSeguro.js
 * Módulo seguro de extracción y validación de JSON generado por IA.
 */

function objetoDesde(texto, inicio) {
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
      try { return JSON.parse(texto.slice(inicio, i + 1)); } catch { return null; }
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
    if (obj && typeof obj === "object" && !Array.isArray(obj) && campoRequerido in obj) return obj;
    pos = limpio.indexOf("{", pos + 1);
  }
  return null;
}

export function mensajeParaChat(obj) {
  const m = obj && typeof obj.mensaje_chat === "string" ? obj.mensaje_chat.trim() : "";
  return m && !m.startsWith("{") ? m : null;
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
