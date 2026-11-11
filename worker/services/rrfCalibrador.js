// worker/services/rrfCalibrador.js
/**
 * Reciprocal Rank Fusion (RRF) Nativo Calibrado ($k=60$) con Balance por Área Pedagógica
 * Basado en: Cormack, Clarke & Büttcher (Univ. of Waterloo, ACM SIGIR 2009)
 *
 * Ponderación adaptativa:
 * - Matemática y Ciencias Naturales: mayor peso léxico (FTS: 1.2, Vector: 1.0) por terminología formal estricta.
 * - Lengua Española y Ciencias Sociales: mayor peso semántico (FTS: 0.9, Vector: 1.3) por sinonimia y riqueza discursiva.
 * - Default: FTS: 1.0, Vector: 1.0 con constante k=60.
 */

export const CONSTANTE_K_RRF = 60;

export function obtenerPesosArea(area = null) {
  if (!area || typeof area !== "string") {
    return { wFts: 1.0, wVector: 1.0 };
  }

  const a = area.toLowerCase().trim();
  if (a.includes("matem") || a.includes("natur") || a.includes("biol") || a.includes("físic") || a.includes("quím")) {
    return { wFts: 1.2, wVector: 1.0 };
  }
  if (a.includes("lengua") || a.includes("español") || a.includes("social") || a.includes("historia") || a.includes("geogr")) {
    return { wFts: 0.9, wVector: 1.3 };
  }

  return { wFts: 1.0, wVector: 1.0 };
}

/**
 * Fusiona dos listas ordenadas de resultados (FTS y Vectorial) usando RRF calibrado con k=60
 * @param {Array} resultadosFts - Lista ordenada por ranking FTS
 * @param {Array} resultadosVector - Lista ordenada por ranking Vectorial
 * @param {Object} [opciones] - k, area, limite
 * @returns {Array} Lista fusionada y ordenada por score RRF descendente
 */
export function calibrarYFusionarRRF(resultadosFts = [], resultadosVector = [], opciones = {}) {
  const k = opciones.k || CONSTANTE_K_RRF;
  const area = opciones.area || null;
  const limite = opciones.limite || 8;
  const { wFts, wVector } = obtenerPesosArea(area);

  const mapa = new Map();

  // 1. Acumular aportes de ranking FTS
  (resultadosFts || []).forEach((item, idx) => {
    const id = String(item.secuencia_id || item.id || idx);
    const rankFts = idx + 1;
    const scoreFts = wFts * (1.0 / (k + rankFts));

    mapa.set(id, {
      id,
      item,
      scoreRRF: scoreFts,
      rankFts,
      rankVector: null
    });
  });

  // 2. Acumular aportes de ranking Vectorial
  (resultadosVector || []).forEach((item, idx) => {
    const id = String(item.secuencia_id || item.id || idx);
    const rankVector = idx + 1;
    const scoreVector = wVector * (1.0 / (k + rankVector));

    if (mapa.has(id)) {
      const entry = mapa.get(id);
      entry.scoreRRF += scoreVector;
      entry.rankVector = rankVector;
      // Combinar metadatos enriquecidos si faltaban
      entry.item = { ...entry.item, ...item };
    } else {
      mapa.set(id, {
        id,
        item,
        scoreRRF: scoreVector,
        rankFts: null,
        rankVector
      });
    }
  });

  // 3. Ordenar por score RRF descendente y limitar
  const fusionados = Array.from(mapa.values())
    .sort((a, b) => b.scoreRRF - a.scoreRRF)
    .slice(0, limite)
    .map((entry) => ({
      ...entry.item,
      score: Number(entry.scoreRRF.toFixed(6)),
      rrf_detalles: {
        rank_fts: entry.rankFts,
        rank_vector: entry.rankVector,
        w_fts: wFts,
        w_vector: wVector,
        k
      }
    }));

  return fusionados;
}
