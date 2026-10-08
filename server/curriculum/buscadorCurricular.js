const fs = require("fs");
const path = require("path");

/**
 * MOTOR DE BÚSQUEDA CURRICULAR OFICIAL (MINERD / CON BASE)
 * 
 * Consulta el índice oficial segmentado de Capa 4 antes de generar cualquier respuesta.
 * - Normaliza texto (minúsculas, sin acentos, singular/plural).
 * - Pondera título, competencias, contenidos e indicadores.
 * - Filtra y prioriza por grado, área y nivel.
 * - Detecta ambigüedad si el tema existe en varios grados/áreas y ofrece opciones al docente.
 * - Todo resultado incluye documento oficial, grado, área, página real y puntaje de relevancia.
 * Estado: "pendiente de validación por experto".
 */

let cacheIndice = null;

function cargarIndice() {
  if (cacheIndice) return cacheIndice;
  const rutaIndice = path.join(__dirname, "..", "curriculo", "capa4_indice", "indice_curriculo.json");
  if (fs.existsSync(rutaIndice)) {
    cacheIndice = JSON.parse(fs.readFileSync(rutaIndice, "utf-8"));
  } else {
    cacheIndice = [];
  }
  return cacheIndice;
}

function normalizarTexto(txt) {
  if (!txt || typeof txt !== "string") return "";
  return txt
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // sin acentos
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Lematización básica para español (singular/plural)
 */
function lematizarPalabra(palabra) {
  if (!palabra || palabra.length <= 3) return palabra;
  // Fracciones -> fraccion, oraciones -> oracion
  if (palabra.endsWith("ciones")) return palabra.slice(0, -6) + "cion";
  if (palabra.endsWith("siones")) return palabra.slice(0, -6) + "sion";
  if (palabra.endsWith("ces")) return palabra.slice(0, -3) + "z";
  if (palabra.endsWith("es") && !["mes", "tres", "res"].includes(palabra)) {
    return palabra.slice(0, -2);
  }
  if (palabra.endsWith("s") && !palabra.endsWith("ss") && !["mas", "dos", "pais"].includes(palabra)) {
    return palabra.slice(0, -1);
  }
  return palabra;
}

const STOP_WORDS_GENERICAS = new Set([
  "los", "las", "del", "por", "para", "con", "una", "uno", "que", "como", "sobre",
  "general", "nacional", "diseno", "adecuacion", "nivel", "orientaciones", "educacion", "educativo", "dominicano"
]);

function normalizarTokens(txt) {
  const norm = normalizarTexto(txt);
  return norm
    .split(" ")
    .filter((t) => t.length > 2 && !STOP_WORDS_GENERICAS.has(t))
    .map(lematizarPalabra);
}

function normalizarGrado(grado) {
  if (!grado) return null;
  const g = normalizarTexto(grado);
  if (g.includes("1") || g.includes("primer") || g.includes("1ro")) return "1er grado";
  if (g.includes("2") || g.includes("segund") || g.includes("2do")) return "2do grado";
  if (g.includes("3") || g.includes("tercer") || g.includes("3ro")) return "3er grado";
  if (g.includes("4") || g.includes("cuart") || g.includes("4to")) return "4to grado";
  if (g.includes("5") || g.includes("quint") || g.includes("5to")) return "5to grado";
  if (g.includes("6") || g.includes("sext") || g.includes("6to")) return "6to grado";
  return null;
}

function normalizarArea(area) {
  if (!area) return null;
  const a = normalizarTexto(area);
  if (a.includes("lengua") || a.includes("espanol") || a.includes("lectura") || a.includes("escritura")) return "Lengua Española";
  if (a.includes("matem") || a.includes("calculo") || a.includes("aritmetica") || a.includes("geometria")) return "Matemática";
  if (a.includes("social") || a.includes("historia") || a.includes("geografia")) return "Ciencias Sociales";
  if (a.includes("natural") || a.includes("biolog") || a.includes("fisic") || a.includes("quimic")) return "Ciencias de la Naturaleza";
  return null;
}

function buscarEnCurriculo({ query, nivel = "primario", grado, area, limite = 3 }) {
  const indice = cargarIndice();
  if (!indice || indice.length === 0) {
    return {
      encontrado: false,
      motivo: "El índice curricular oficial no está generado o está vacío.",
      mensaje: "No encontré ese tema en la biblioteca oficial.",
      resultados: []
    };
  }

  const queryNorm = normalizarTexto(query);
  const tokensQuery = normalizarTokens(query);

  if (tokensQuery.length === 0) {
    return {
      encontrado: false,
      motivo: "Consulta vacía o sin términos de búsqueda válidos.",
      mensaje: "No encontré ese tema en la biblioteca oficial.",
      resultados: []
    };
  }

  const gradoFiltro = normalizarGrado(grado);
  const areaFiltro = normalizarArea(area);

  const candidatos = [];

  for (const chunk of indice) {
    // Filtro por nivel si aplica
    if (nivel && chunk.nivel && chunk.nivel !== nivel) continue;

    // Ponderación por grado
    let bonusGrado = 0;
    if (gradoFiltro && chunk.grado) {
      const gChunk = normalizarGrado(chunk.grado);
      if (gChunk === gradoFiltro) {
        bonusGrado = 25;
      } else if (!chunk.grado.toLowerCase().includes("multigrado")) {
        // Si el docente especificó un grado y no coincide, penalizar severamente
        bonusGrado = -40;
      }
    }

    // Ponderación por área
    let bonusArea = 0;
    if (areaFiltro && chunk.area) {
      const aChunk = normalizarArea(chunk.area);
      if (aChunk === areaFiltro) {
        bonusArea = 25;
      } else {
        bonusArea = -40;
      }
    }

    // Calcular puntuación por coincidencia semántica en campos curriculares
    let score = bonusGrado + bonusArea;
    const tokensTema = normalizarTokens(chunk.tema || "");
    const tokensCompetencias = normalizarTokens(chunk.competencias ? JSON.stringify(chunk.competencias) : "");
    const tokensContenidos = normalizarTokens(chunk.contenidos ? JSON.stringify(chunk.contenidos) : "");
    const tokensIndicadores = normalizarTokens(chunk.indicadores ? JSON.stringify(chunk.indicadores) : "");
    const tokensTexto = normalizarTokens(chunk.texto || chunk.texto_busqueda || "");

    // 1. Frase exacta en tema (60 pts) o en texto de página (45 pts)
    const fraseExactaTema = chunk.tema && normalizarTexto(chunk.tema).includes(queryNorm);
    const fraseExactaTexto = (chunk.texto || chunk.texto_busqueda) && normalizarTexto(chunk.texto || chunk.texto_busqueda).includes(queryNorm);
    if (fraseExactaTema) {
      score += 60;
    } else if (fraseExactaTexto) {
      score += 45;
    }

    // 2. Coincidencia token a token por campo
    let tokensCoincidentes = 0;
    for (const t of tokensQuery) {
      let matched = false;
      if (tokensTema.includes(t)) {
        score += 35;
        matched = true;
      }
      if (tokensCompetencias.includes(t)) {
        score += 20;
        matched = true;
      }
      if (tokensContenidos.includes(t)) {
        score += 20;
        matched = true;
      }
      if (tokensIndicadores.includes(t)) {
        score += 15;
        matched = true;
      }
      if (tokensTexto.includes(t)) {
        score += 15;
        matched = true;
      }
      if (matched) tokensCoincidentes++;
    }

    // 3. Bonus por matriz estructurada de Capa 3 (15 pts)
    if (chunk.prioridad === 1) {
      score += 15;
    }

    const ratioCoincidencia = tokensCoincidentes / tokensQuery.length;
    const esCoincidenciaValida =
      fraseExactaTema ||
      fraseExactaTexto ||
      (tokensQuery.length >= 2 && ratioCoincidencia >= 0.5 && score >= 25) ||
      (tokensQuery.length === 1 && tokensCoincidentes === 1 && score >= 20);

    // Requisito: coincidencia válida y superar el umbral
    if (esCoincidenciaValida && score >= 20) {
      candidatos.push({
        score,
        chunk: {
          id: chunk.id,
          tipo: chunk.tipo,
          documento: chunk.documento,
          nivel: chunk.nivel,
          grado: chunk.grado,
          area: chunk.area,
          pagina: chunk.pagina,
          tema: chunk.tema || null,
          competencias: chunk.competencias || null,
          contenidos: chunk.contenidos || null,
          indicadores: chunk.indicadores || null,
          texto: chunk.texto || null,
          fuente: `MINERD - ${chunk.documento}, pág. ${chunk.pagina}`,
          estado_validacion: "pendiente de validación por experto",
          puntaje_relevancia: score
        }
      });
    }
  }

  // Ordenar estrictamente por relevancia decreciente
  candidatos.sort((a, b) => b.score - a.score);

  if (candidatos.length === 0) {
    return {
      encontrado: false,
      motivo: "Sin coincidencias curriculares suficientes (puntaje bajo o tema inexistente).",
      mensaje: "No se encontró ese dato en el currículo oficial (No encontré ese tema en la biblioteca oficial). ¿Deseas que lo busque en internet o prefieres ajustar el tema?",
      resultados: []
    };
  }

  // Tomar los 3 mejores
  const topResultados = candidatos.slice(0, limite).map((c) => c.chunk);

  // Comprobar ambigüedad: si hay varios resultados con puntajes muy cercanos o grados distintos
  let requiereDesambiguacion = false;
  let mensajeDesambiguacion = null;

  if (topResultados.length >= 2) {
    const diff = topResultados[0].puntaje_relevancia - topResultados[1].puntaje_relevancia;
    const distintosGrados = topResultados[0].grado !== topResultados[1].grado;
    const distintasAreas = topResultados[0].area !== topResultados[1].area;

    if ((diff <= 8 && (distintosGrados || distintasAreas)) || (!grado && distintosGrados)) {
      requiereDesambiguacion = true;
      const opciones = topResultados.map((r, i) => `${i + 1}. ${r.tema || query} para ${r.grado} (${r.area})`).join("\n");
      mensajeDesambiguacion = `Encontré este tema en varios grados/áreas oficiales del MINERD:\n${opciones}\n¿Cuál deseas planificar?`;
    }
  }

  return {
    encontrado: true,
    total_coincidencias: candidatos.length,
    requiereDesambiguacion,
    mensaje: requiereDesambiguacion ? mensajeDesambiguacion : "Contenido localizado en la biblioteca oficial.",
    resultados: topResultados
  };
}

module.exports = {
  buscarEnCurriculo,
  cargarIndice,
  normalizarTexto,
  lematizarPalabra,
  normalizarGrado,
  normalizarArea
};
