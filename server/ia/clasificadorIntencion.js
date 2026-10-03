/**
 * server/ia/clasificadorIntencion.js
 * 
 * Clasificador de intención pedagógica previo a cualquier búsqueda.
 * Distingue entre:
 * - "curricular": Debe resolverse estrictamente con la biblioteca oficial del MINERD.
 * - "web": Consulta informativa general que requiere búsqueda web.
 * - "mixta": Estructura curricular oficial complementada con datos web actuales.
 * - "ambigua": Fuera de lo educativo o ambigua; requiere aclaración con el maestro.
 */

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

function contienePalabraOFrase(textoNorm, patron) {
  const patNorm = normalizarTexto(patron);
  if (!patNorm) return false;
  const escaped = patNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(?:^|\\s)${escaped}(?:$|\\s)`, "i");
  return regex.test(` ${textoNorm} `);
}

// Palabras y expresiones clave para la Capa 1 (determinista y costo $0)
const PATRONES_CURRICULARES = [
  "planificacion", "planificar", "planifica", "plan de clase", "plan diario", "plan semanal",
  "plan mensual", "plan anual", "secuencia didactica", "unidad de aprendizaje",
  "competencia", "competencias", "indicador de logro", "indicadores de logro",
  "grado", "1er grado", "2do grado", "3er grado", "4to grado", "5to grado", "6to grado",
  "1ro", "2do", "3ro", "4to", "5to", "6to", "primer grado", "segundo grado", "tercer grado",
  "cuarto grado", "quinto grado", "sexto grado", "primaria", "secundaria", "nivel inicial",
  "area curricular", "lengua espanola", "matematica", "ciencias de la naturaleza", "ciencias sociales",
  "minerd", "conbase", "con base", "adecuacion curricular", "diseno curricular",
  "situacion de aprendizaje", "actividad de inicio", "desarrollo", "cierre", "momentos de la clase",
  "rubrica", "instrumento de evaluacion", "evaluacion formativa", "criterios de evaluacion",
  "fracciones", "suma", "resta", "multiplicacion", "division", "geometria",
  "la tarjeta de identidad", "la receta", "la noticia", "el cuento", "el informe de lectura",
  "el articulo expositivo", "texto instructivo", "letrero", "conteo", "recta numerica",
  "ciencias naturales", "sociales", "naturales", "educacion fisica", "educacion artistica",
  "formacion integral humana y religiosa", "fihr", "dua", "neae"
];

const PATRONES_WEB = [
  "quien fue", "quien era", "quien es", "cuando nacio", "cuando murio", "cuando ocurrio",
  "que paso en", "que es", "definicion de", "concepto de", "noticias", "noticia de hoy",
  "datos actuales", "datos recientes", "actualidad", "hoy en dia", "clima actual",
  "poblacion actual", "busca en internet", "buscar en la web", "buscar en internet",
  "busca en la web", "googlea", "biografia de", "presidente de", "capital de",
  "estadisticas de", "precio de", "ultimas noticias", "historia de"
];

const PATRONES_NO_EDUCATIVOS = [
  "receta de cocina", "receta de sancocho", "sancocho", "mangu", "cocinar",
  "chiste", "adivinanza graciosa", "reparar carro", "comprar", "precio de venta",
  "pelicula", "netflix", "cancion de moda", "horoscopo", "futbol en vivo",
  "juego de pelota", "loteria", "chismes"
];

/**
 * Capa 1: Clasificación determinista basada en reglas lingüísticas normalizadas
 */
function clasificarPorReglas(texto) {
  const norm = normalizarTexto(texto);
  if (!norm) {
    return {
      tipo: "ambigua",
      confianza: 0.9,
      motivo: "Texto vacío o sin caracteres válidos."
    };
  }

  // 1. Detectar patrones no educativos o fuera de contexto
  const esNoEducativo = PATRONES_NO_EDUCATIVOS.some(p => contienePalabraOFrase(norm, p));
  // Excepción si explícitamente pide planificar la receta como género textual curricular del MINERD
  const pidePlanReceta = contienePalabraOFrase(norm, "plan") && (contienePalabraOFrase(norm, "grado") || contienePalabraOFrase(norm, "lengua") || contienePalabraOFrase(norm, "texto instructivo"));
  if (esNoEducativo && !pidePlanReceta) {
    return {
      tipo: "ambigua",
      confianza: 0.9,
      motivo: "Consulta identificada como tema general/doméstico fuera del ámbito curricular directo."
    };
  }

  // 2. Conteo de coincidencias
  let puntosCurriculares = 0;
  let puntosWeb = 0;

  for (const pat of PATRONES_CURRICULARES) {
    if (contienePalabraOFrase(norm, pat)) {
      puntosCurriculares += 1;
    }
  }

  for (const pat of PATRONES_WEB) {
    if (contienePalabraOFrase(norm, pat)) {
      puntosWeb += 1;
    }
  }

  // Si tiene señales claras de ambos -> Mixta
  // Ej: "Planificación del ciclo del agua con datos actuales"
  if (puntosCurriculares >= 1 && puntosWeb >= 1) {
    return {
      tipo: "mixta",
      confianza: 0.85,
      motivo: "Contiene tanto solicitud de planificación pedagógica como requerimiento de datos informativos o actuales."
    };
  }

  // Si tiene fuerte señal curricular
  if (puntosCurriculares >= 1 && puntosWeb === 0) {
    return {
      tipo: "curricular",
      confianza: puntosCurriculares >= 2 ? 0.95 : 0.85,
      motivo: "Contiene términos técnicos y de diseño curricular específicos del MINERD."
    };
  }

  // Si tiene fuerte señal web/informativa general
  if (puntosWeb >= 1 && puntosCurriculares === 0) {
    return {
      tipo: "web",
      confianza: 0.9,
      motivo: "Consulta de información general, histórica o de datos factuales para búsqueda abierta."
    };
  }

  // Si no coincide con ninguna regla fuerte
  if (norm.startsWith("que ") || norm.startsWith("quien ") || norm.startsWith("donde ") || norm.startsWith("por que ")) {
    return {
      tipo: "web",
      confianza: 0.75,
      motivo: "Pregunta informativa general."
    };
  }

  return {
    tipo: "ambigua",
    confianza: 0.4,
    motivo: "Baja certeza con reglas deterministas, requiere verificación."
  };
}

/**
 * Capa 2: Fallback con modelo rápido (Gemini Flash-Lite) si la confianza de las reglas es baja (< 0.70)
 */
async function clasificarConIA({ texto, apiKey, timeoutMs = 2500 }) {
  if (!apiKey) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
  const prompt = `Analiza la siguiente consulta de un docente de escuela y clasifícala estrictamente en una de estas 4 categorías:
1. "curricular": Si pide diseñar una planificación, clase, actividad o contenido propio del currículo escolar (MINERD).
2. "web": Si es una pregunta de conocimiento general, hechos históricos, personas, definiciones o datos actuales.
3. "mixta": Si pide una clase curricular pero solicita datos actuales, noticias o fuentes de la web.
4. "ambigua": Si es algo no educativo, confuso, o no se entiende qué solicita.

Consulta: "${texto}"

Responde ÚNICAMENTE un objeto JSON válido con esta interfaz:
{
  "tipo": "curricular" | "web" | "mixta" | "ambigua",
  "confianza": 0.85,
  "motivo": "explicación breve de 1 frase"
}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.0,
          responseMimeType: "application/json"
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timer);
    if (!res.ok) return null;

    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return null;

    const parsed = JSON.parse(raw.replace(/```json/gi, "").replace(/```/g, "").trim());
    if (parsed && ["curricular", "web", "mixta", "ambigua"].includes(parsed.tipo)) {
      return {
        tipo: parsed.tipo,
        confianza: typeof parsed.confianza === "number" ? parsed.confianza : 0.8,
        motivo: parsed.motivo || "Clasificado por Capa 2 IA."
      };
    }
    return null;
  } catch (err) {
    clearTimeout(timer);
    return null; // Nunca bloquear al docente si Capa 2 falla o expira
  }
}

/**
 * Clasificador principal de intención
 * 
 * @param {Object} options
 * @param {string} options.texto - Texto de la consulta del docente o transcripción de voz
 * @param {string} [options.temaVision] - Tema previamente identificado por visión si hubo foto
 * @param {string} [options.apiKey] - Clave para Gemini si se necesita Capa 2
 * @param {number} [options.timeoutMs] - Tiempo máximo para Capa 2
 * @returns {Promise<{ tipo: "curricular"|"web"|"mixta"|"ambigua", confianza: number, motivo: string }>}
 */
async function clasificarIntencion({ texto = "", temaVision = null, apiKey = null, timeoutMs = 2500 }) {
  const textoParaEvaluar = temaVision ? `${temaVision}. ${texto}` : texto;

  // 1. Capa 1: Reglas deterministas inmediatas (0 ms, $0.00)
  const resultadoReglas = clasificarPorReglas(textoParaEvaluar);

  // Si la confianza es alta o suficiente (>= 0.70), retornar de inmediato
  if (resultadoReglas.confianza >= 0.70) {
    return resultadoReglas;
  }

  // 2. Capa 2: Si la confianza es baja y hay apiKey disponible, intentar Gemini Flash-Lite
  if (apiKey) {
    try {
      const resultadoIA = await clasificarConIA({ texto: textoParaEvaluar, apiKey, timeoutMs });
      if (resultadoIA) {
        return resultadoIA;
      }
    } catch (e) {
      // Ignorar fallo de IA y caer al resultado de reglas
    }
  }

  // 3. Fallback garantizado: siempre devolver el resultado de las reglas
  return resultadoReglas;
}

module.exports = {
  clasificarIntencion,
  clasificarPorReglas,
  normalizarTexto
};
