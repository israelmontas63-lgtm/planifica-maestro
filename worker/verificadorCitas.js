/**
 * worker/verificadorCitas.js
 * 
 * Verificador y Saneador de Citas Curriculares para Cloudflare Worker (ES Module).
 */

export function extraerPaginasDeFragmentos(fragmentos = []) {
  const paginasValidas = new Set();
  const docsValidos = new Set();

  if (Array.isArray(fragmentos)) {
    for (const f of fragmentos) {
      if (f.pagina !== undefined && f.pagina !== null) {
        const pagStr = String(f.pagina).trim();
        if (pagStr.includes("-")) {
          const partes = pagStr.split("-").map(p => parseInt(p.trim(), 10)).filter(n => !isNaN(n));
          if (partes.length === 2 && partes[0] <= partes[1]) {
            for (let i = partes[0]; i <= partes[1]; i++) {
              paginasValidas.add(i);
            }
          } else {
            partes.forEach(p => paginasValidas.add(p));
          }
        } else {
          const n = parseInt(pagStr, 10);
          if (!isNaN(n)) paginasValidas.add(n);
        }
      }
      if (f.documento) {
        docsValidos.add(f.documento.toLowerCase().trim());
      }
    }
  }

  return { paginasValidas, docsValidos };
}

export function verificarYSanearCitas(texto, fragmentos = []) {
  if (!texto || typeof texto !== "string") return texto;

  const { paginasValidas } = extraerPaginasDeFragmentos(fragmentos);

  // 1. Detectar citas completas tipo "(Diseño Curricular..., pág. 162)"
  let saneado = texto.replace(
    /(\(?\s*(?:Diseño Curricular|Currículo|Guía|Fascículo|Adecuación Curricular)[^.\n\)]*?pág(?:ina)?s?\.?\s*(\d+(?:\s*-\s*\d+)?)[^.\n\)]*?\)?)/gi,
    (match, citaCompleta, numPagStr) => {
      const numPag = parseInt(numPagStr.split("-")[0].trim(), 10);
      if (paginasValidas.has(numPag)) {
        return match; // Cita válida y respaldada
      }
      return "(explicación de conocimiento general pedagógico, sin respaldo en los documentos oficiales indexados)";
    }
  );

  // 2. Detectar menciones aisladas a páginas inventadas: "(pág. 142, área de Matemática)"
  saneado = saneado.replace(
    /(\(?\s*pág(?:ina)?s?\.?\s*(\d+(?:\s*-\s*\d+)?)(?:\s*,\s*[^)\n]+)?\s*\)?)/gi,
    (match, citaCompleta, numPagStr) => {
      const numPag = parseInt(numPagStr.split("-")[0].trim(), 10);
      if (paginasValidas.has(numPag)) {
        return match;
      }
      return ""; // Elimina número de página ficticio
    }
  );

  saneado = saneado.replace(/\s{2,}/g, " ").replace(/\(\s*\)/g, "").trim();

  return saneado;
}
