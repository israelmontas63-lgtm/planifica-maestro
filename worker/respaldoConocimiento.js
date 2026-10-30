export const AVISO_SIN_RESPALDO =
  "ℹ️ Nota: esta es orientación pedagógica general generada por IA. No está respaldada por un documento curricular oficial indexado (sin página citable). Contrástala con tu currículo antes de usarla.";
const MARCA_SIN_RESPALDO = "sin respaldo en los documentos oficiales indexados";
// Solo nombres propios de documentos oficiales (con mayúscula). NO palabras sueltas como "guía" o "adecuación".
const DOC = "(?:Dise[ñn]o Curricular|Adecuaci[oó]n Curricular|Adecuaci[oó]n\\s+\\d{4}|Curr[ií]culo (?:Dominicano|Oficial|Nacional)|Gu[ií]a Did[aá]ctica|Fasc[ií]culo|MINERD)";
const ANIO = "(?:\\s+\\d{4})?";
export function marcarSinRespaldo(texto) {
  if (typeof texto !== "string" || !texto.trim()) return texto;
  let t = texto;
  // 1) "Según el/la/los/las <Documento> [año]" -> "Como orientación general"
  t = t.replace(new RegExp(`[Ss]eg[uú]n (?:el|la|los|las) ${DOC}${ANIO}`, "g"), "Como orientación general");
  // 2) Paréntesis que nombran un documento oficial, con o sin página
  t = t.replace(new RegExp(`\\([^()]*?${DOC}[^()]*?\\)`, "g"), `(${MARCA_SIN_RESPALDO})`);
  // 3) Aviso final, una sola vez
  if (!t.includes(AVISO_SIN_RESPALDO)) t = `${t.trimEnd()}\n\n${AVISO_SIN_RESPALDO}`;
  return t;
}
