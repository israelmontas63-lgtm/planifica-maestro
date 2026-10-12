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
