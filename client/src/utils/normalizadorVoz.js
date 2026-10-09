/**
 * client/src/utils/normalizadorVoz.js
 * Utilidades para normalización de dictado por voz, sugerencias fonéticas,
 * y comparación dinámica con el perfil docente sin nombres fijos en el código.
 */

// Mapa de palabras numéricas a dígitos para minutos (ordenado de mayor a menor longitud)
const PALABRAS_NUMEROS_ENTRADAS = [
  ["cuarenta y cinco", 45],
  ["treinta y cinco", 35],
  ["cincuenta y cinco", 55],
  ["ciento veinte", 120],
  ["veinticinco", 25],
  ["cuarenta", 40],
  ["cincuenta", 50],
  ["sesenta", 60],
  ["noventa", 90],
  ["treinta", 30],
  ["veinte", 20],
  ["quince", 15],
  ["diez", 10],
  ["nueve", 9],
  ["ocho", 8],
  ["siete", 7],
  ["seis", 6],
  ["cinco", 5],
  ["cuatro", 4],
  ["tres", 3],
  ["dos", 2],
  ["uno", 1]
];

export function normalizarSinTildes(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Normaliza ordinales ("segundo" -> "2.º") y números escritos con palabras ("cuarenta y cinco minutos" -> "45 minutos")
 */
export function normalizarOrdinalesYNumeros(texto) {
  if (!texto || typeof texto !== "string") return "";
  let res = texto;

  // Ordinales a formato dominicano oficial 1.º, 2.º, etc.
  res = res.replace(/\bprimer(?:o)?(?:\s+grado)?\b/gi, "1.º");
  res = res.replace(/\bsegundo(?:\s+grado)?\b/gi, "2.º");
  res = res.replace(/\btercer(?:o)?(?:\s+grado)?\b/gi, "3.º");
  res = res.replace(/\bcuarto(?:\s+grado)?\b/gi, "4.º");
  res = res.replace(/\bquinto(?:\s+grado)?\b/gi, "5.º");
  res = res.replace(/\bsexto(?:\s+grado)?\b/gi, "6.º");

  // Reemplazar números con palabras seguidos de minutos (de mayor longitud a menor)
  for (const [palabra, num] of PALABRAS_NUMEROS_ENTRADAS) {
    const reg = new RegExp(`\\b${palabra}\\s+minutos\\b`, "gi");
    res = res.replace(reg, `${num} minutos`);
  }

  return res;
}

/**
 * Detecta si el dictado contiene "bibliografía" cuando el contexto sugiere "biografía".
 * NUNCA se cambia sola: solo devuelve la sugerencia para que el maestro decida.
 */
export function detectarSugerenciaBibliografia(texto) {
  if (!texto || typeof texto !== "string") return { tieneSugerencia: false };
  const lower = texto.toLowerCase();
  if (lower.includes("bibliografía") || lower.includes("bibliografia")) {
    return {
      tieneSugerencia: true,
      textoOriginal: texto,
      palabraDetectada: "bibliografía",
      sugerencia: "biografía",
      mensaje: '¿Quisiste decir "biografía"?'
    };
  }
  return { tieneSugerencia: false };
}

/**
 * Compara un valor dictado contra el perfil guardado sin importar tildes ni mayúsculas.
 * Ningún nombre va fijo en el código: todo se extrae de perfil.
 */
export function compararConPerfil(valorDictado, valorPerfil) {
  if (!valorDictado || !valorPerfil) {
    return { coincide: false, difiere: false, valorSugerido: valorDictado };
  }

  const normDictado = normalizarSinTildes(valorDictado);
  const normPerfil = normalizarSinTildes(valorPerfil);

  if (normDictado === normPerfil) {
    // Coincidencia fonética (mismo texto sin tildes): adoptamos el perfil bien escrito
    return { coincide: true, difiere: false, valorSugerido: valorPerfil };
  }

  // Si contiene partes sustanciales
  if (normDictado.length > 3 && (normPerfil.includes(normDictado) || normDictado.includes(normPerfil))) {
    return { coincide: true, difiere: false, valorSugerido: valorPerfil };
  }

  return { coincide: false, difiere: true, valorSugerido: valorDictado, valorPerfil };
}

/**
 * Estructura lo entendido en partes legibles ("2.º grado · Tema · Escuela · Maestro · 45 minutos")
 * extrayendo dinámicamente según patrones y comparando con el perfil.
 */
export function analizarEntidadesDictado(texto, perfil = {}) {
  const norm = normalizarOrdinalesYNumeros(texto);
  
  // Extraer Grado
  const gradoMatch = norm.match(/\b([1-6]\.º(?:\s+grado)?)\b/i);
  let grado = gradoMatch ? gradoMatch[1] : (perfil.grado || "");
  if (grado && !grado.toLowerCase().includes("grado")) {
    grado = `${grado} grado`;
  }

  // Extraer Tema (prioriza la palabra 'tema' explícita)
  let tema = "";
  const temaExplicitMatch = norm.match(/\btema\s*[:\s]\s*([^,]+?)(?=\s*,|\s+escuela|\s+maestro|\s+docente|\s+profesor|\s+tiempo|\s*$)/i);
  if (temaExplicitMatch) {
    tema = temaExplicitMatch[1].trim();
  } else {
    const temaSobreMatch = norm.match(/(?:sobre(?:\s+el|\s+la)?)\s+([^,]+?)(?=\s*,|\s+escuela|\s+maestro|\s+docente|\s+profesor|\s+tiempo|\s*$)/i);
    if (temaSobreMatch) {
      tema = temaSobreMatch[1].trim();
    }
  }

  // Extraer Escuela
  let escuela = "";
  const escuelaMatch = norm.match(/(?:escuela|colegio|liceo|centro(?:\s+educativo)?)\s*[:\s]\s*([^,]+?)(?=\s*,|\s+maestro|\s+docente|\s+profesor|\s+tiempo|\s+tema|\s*$)/i);
  if (escuelaMatch) {
    escuela = escuelaMatch[1].trim();
  }

  // Extraer Maestro
  let maestro = "";
  const maestroMatch = norm.match(/(?:maestro|maestra|profesor|profesora|docente)\s*[:\s]\s*([^,]+?)(?=\s*,|\s+escuela|\s+tiempo|\s+tema|\s*$)/i);
  if (maestroMatch) {
    maestro = maestroMatch[1].trim();
  }

  // Extraer Tiempo / Minutos
  let tiempo = "";
  let minutosNum = null;
  const tiempoMatch = norm.match(/(\d+)\s*(?:minutos|min)\b/i);
  if (tiempoMatch) {
    tiempo = `${tiempoMatch[1]} minutos`;
    minutosNum = parseInt(tiempoMatch[1], 10);
  }

  // Comparación dinámica con el perfil
  const compDocente = maestro && perfil.nombre ? compararConPerfil(maestro, perfil.nombre) : { valorSugerido: maestro || perfil.nombre || "" };
  const compEscuela = escuela && perfil.escuela ? compararConPerfil(escuela, perfil.escuela) : { valorSugerido: escuela || perfil.escuela || "" };

  const maestroFinal = compDocente.valorSugerido;
  const escuelaFinal = compEscuela.valorSugerido;

  // Construir síntesis en formato con viñetas medias
  const partes = [];
  if (grado) partes.push(grado);
  if (tema) partes.push(`Tema: ${tema}`);
  if (escuelaFinal) partes.push(`Escuela: ${escuelaFinal}`);
  if (maestroFinal) partes.push(`Maestro: ${maestroFinal}`);
  if (tiempo) partes.push(tiempo);

  const resumenEstructurado = partes.length >= 2 ? partes.join(" · ") : norm;

  return {
    textoOriginal: texto,
    textoNormalizado: norm,
    resumenEstructurado,
    grado,
    tema,
    escuela: escuelaFinal,
    maestro: maestroFinal,
    tiempo,
    minutosNum,
    difiereDocente: Boolean(compDocente.difiere),
    difiereEscuela: Boolean(compEscuela.difiere),
    perfilDocente: perfil.nombre || "",
    perfilEscuela: perfil.escuela || "",
    sugerencia: detectarSugerenciaBibliografia(norm)
  };
}
