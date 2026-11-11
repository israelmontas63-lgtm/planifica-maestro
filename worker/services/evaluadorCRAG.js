// worker/services/evaluadorCRAG.js
/**
 * Corrective RAG (CRAG) con Clasificador de Confianza
 * Basado en: Yan et al., Meta AI & Univ. of Science and Technology of China (arXiv:2401.15884)
 *
 * Evalúa la calidad de la recuperación documental contra el currículo oficial en 3 bandas:
 * 1. CORRECT: Confianza alta (Score >= umbralAlto). Grounding normativo garantizado.
 * 2. AMBIGUOUS: Confianza intermedia (umbralBajo <= Score < umbralAlto). Requiere grounding referencial.
 * 3. INCORRECT: Confianza baja (Score < umbralBajo) o recuperación vacía. Bloquea alucinaciones y dispara contingencia.
 */

export function evaluarCalidadRecuperacion(fragmentos, umbralAlto = 0.75, umbralBajo = 0.35) {
  if (!Array.isArray(fragmentos) || fragmentos.length === 0) {
    return {
      estado: "INCORRECT",
      scoreMaximo: 0.0,
      scorePromedio: 0.0,
      umbralAlto,
      umbralBajo,
      totalFragmentos: 0,
      fragmentosDepurados: [],
      accionRecomendada: "busqueda_contingencia",
      motivo: "Lista de fragmentos vacía o inválida."
    };
  }

  // Extraer o inferir el score de relevancia/similitud de cada fragmento
  const depurados = fragmentos.map((f, idx) => {
    let score = 0.0;
    if (typeof f.score === "number") {
      score = f.score;
    } else if (typeof f.similitud === "number") {
      score = f.similitud;
    } else if (typeof f.relevancia === "number") {
      score = f.relevancia;
    } else if (f.coincide_exacto || f.coincide_tema) {
      score = 0.85;
    } else {
      // Score posicional decrescente si no viene explicitado
      score = Math.max(0.1, 0.70 - idx * 0.15);
    }
    return {
      ...f,
      score: Number(score.toFixed(4))
    };
  });

  const scores = depurados.map((d) => d.score);
  const scoreMaximo = Math.max(...scores);
  const scorePromedio = Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(4));

  // Clasificación en 3 bandas según CRAG
  let estado = "INCORRECT";
  let accionRecomendada = "busqueda_contingencia";

  if (scoreMaximo >= umbralAlto) {
    estado = "CORRECT";
    accionRecomendada = "grounding_oficial_garantizado";
  } else if (scoreMaximo >= umbralBajo) {
    estado = "AMBIGUOUS";
    accionRecomendada = "advertencia_referencial";
  } else {
    estado = "INCORRECT";
    accionRecomendada = "busqueda_contingencia";
  }

  // Filtrar fragmentos de ruido si estamos en estado CORRECT o AMBIGUOUS
  const fragmentosRelevantes = depurados.filter((f) => f.score >= umbralBajo);

  return {
    estado,
    scoreMaximo,
    scorePromedio,
    umbralAlto,
    umbralBajo,
    totalFragmentos: depurados.length,
    fragmentosDepurados: fragmentosRelevantes.length > 0 ? fragmentosRelevantes : depurados,
    accionRecomendada,
    motivo: `Score máximo evaluado: ${scoreMaximo} (Umbrales: [Bajo: ${umbralBajo}, Alto: ${umbralAlto}])`
  };
}

/**
 * Helper para verificar rápidamente si una recuperación es apta para citación oficial
 */
export function esRecuperacionConfiable(resultadoCRAG) {
  if (!resultadoCRAG || typeof resultadoCRAG !== "object") return false;
  return resultadoCRAG.estado === "CORRECT";
}
