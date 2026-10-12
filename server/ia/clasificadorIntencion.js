/**
 * server/ia/clasificadorIntencion.js (CommonJS)
 * 
 * Fachada para Node.js delegando en shared/clasificadorIntencion.js
 * con soporte para Capa 2 (enrutadorIA).
 */

const shared = require("../../shared/clasificadorIntencion.js");

async function clasificarConIA({ texto, env = process.env, timeoutMs = 2500 }) {
  let enrutarPeticion = null;
  try {
    const routerMod = require("./enrutadorIA.js");
    enrutarPeticion = routerMod.enrutarPeticion;
  } catch (e) {
    return null;
  }
  if (!enrutarPeticion) return null;

  const promptClasificacion = `Analiza la siguiente consulta de un docente y clasifícala estrictamente en una de estas categorías:
1. "charla": Saludos, despedidas, fórmulas de cortesía, agradecimientos o conversación informal.
2. "busqueda_web": Si solicita explícitamente buscar en la web, en internet, noticias actuales o datos externos fuera del currículo.
3. "conocimiento_general": Conceptos, hechos históricos, definiciones o ciencia que no son una clase ni requieren el currículo oficial.
4. "planificacion": Si solicita estructurar, diseñar o elaborar una clase, actividad, momento didáctico o unidad escolar.
5. "consulta_curricular": Preguntas sobre normativas, indicadores de logro, competencias o contenidos del currículo oficial MINERD.
6. "accion_app": Comandos de control de la app (biblioteca, perfil, descargar word, cambiar esquema/periodo).
7. "ambigua": Si es algo no educativo, doméstico, confuso o fragmentario.

Consulta: "${texto}"

Responde ÚNICAMENTE un objeto JSON válido con esta interfaz:
{
  "categoria": "charla" | "busqueda_web" | "conocimiento_general" | "planificacion" | "consulta_curricular" | "accion_app" | "ambigua",
  "confianza": 0.85,
  "motivo": "explicación breve de 1 frase",
  "esMixtoConSaludo": false
}`;

  try {
    const res = await enrutarPeticion({
      tema: "Clasificación de intención pedagógica",
      prompt: promptClasificacion,
      env,
      timeoutMs: timeoutMs || 2500
    });

    if (res && res.categoria && ["charla", "busqueda_web", "conocimiento_general", "planificacion", "consulta_curricular", "accion_app", "ambigua"].includes(res.categoria)) {
      const cat = res.categoria;
      const mapaTipo = {
        charla: "charla",
        busqueda_web: "web",
        conocimiento_general: "web",
        planificacion: "curricular",
        consulta_curricular: "curricular",
        accion_app: "accion_app",
        ambigua: "ambigua"
      };

      return {
        categoria: cat,
        tipo: mapaTipo[cat] || "ambigua",
        confianza: typeof res.confianza === "number" ? res.confianza : 0.85,
        motivo: res.motivo || "Clasificado por Enrutador IA.",
        esMixtoConSaludo: Boolean(res.esMixtoConSaludo),
        opciones: cat === "ambigua" ? shared.OPCIONES_ACLARACION : undefined
      };
    }
  } catch (err) {
    // Si la cuota se agota o hay timeout, fallback transparente a reglas locales
  }

  return null;
}

async function clasificarIntencion({ texto = "", temaVision = null, env = process.env, apiKey = null, timeoutMs = 2500 }) {
  const envFinal = env || (apiKey ? { ...process.env, GEMINI_API_KEY: apiKey } : process.env);
  return shared.clasificarIntencion({
    texto,
    temaVision,
    env: envFinal,
    timeoutMs,
    fallbackIaFn: (params) => clasificarConIA(params)
  });
}

module.exports = {
  clasificarIntencion,
  clasificarPorReglas: shared.clasificarPorReglas,
  clasificarCategoria6: shared.clasificarCategoria6,
  normalizarTexto: shared.normalizarTexto,
  OPCIONES_ACLARACION: shared.OPCIONES_ACLARACION,
  CATEGORIAS_6: shared.CATEGORIAS_6,
  MAPEO_TERMINOS_AJENOS: shared.MAPEO_TERMINOS_AJENOS,
  PATRONES_NORMATIVA_ACTUALIDAD: shared.PATRONES_NORMATIVA_ACTUALIDAD,
  PATRONES_PEDAGOGIA_GENERAL: shared.PATRONES_PEDAGOGIA_GENERAL
};
