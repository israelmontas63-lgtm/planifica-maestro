export const AVISO_SIN_RESPALDO =
  "ℹ️ Nota: esta es orientación pedagógica general generada por IA. No está respaldada por un documento curricular oficial indexado (sin página citable). Contrástala con tu currículo antes de usarla.";

const MARCA_SIN_RESPALDO = "sin respaldo en los documentos oficiales indexados";
const NOMBRES_DOC = "Dise[ñn]o Curricular|Adecuaci[oó]n Curricular|Curr[ií]culo(?: Dominicano| Oficial)?|Gu[ií]a Did[aá]ctica|Gu[ií]a|Fasc[ií]culo|MINERD";

export function marcarSinRespaldo(texto) {
  if (typeof texto !== "string" || !texto.trim()) return texto;
  let t = texto;
  // 1) "Según el Diseño Curricular ..." -> "Como orientación general ..."
  t = t.replace(new RegExp(`Seg[uú]n (?:el|la|los|las) (?:${NOMBRES_DOC})`, "gi"), "Como orientación general");
  // 2) Paréntesis que nombran un documento oficial, con o sin página
  t = t.replace(new RegExp(`\\((?:[^()]*?)(?:${NOMBRES_DOC})(?:[^()]*?)\\)`, "gi"), `(${MARCA_SIN_RESPALDO})`);
  // 3) Aviso final, una sola vez
  if (!t.includes(AVISO_SIN_RESPALDO)) t = `${t.trimEnd()}\n\n${AVISO_SIN_RESPALDO}`;
  return t;
}
