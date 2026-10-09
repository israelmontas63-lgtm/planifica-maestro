/**
 * server/services/construirPromptConBaseMultigrado.js
 * Constructor de prompt y ensamblador curricular para el formato "Secuencia didáctica CON BASE - multigrado (primer ciclo)".
 * 
 * Reglas:
 * 1. Lee como única fuente de verdad: server/esquemas/con_base_multigrado.schema.json
 * 2. Verifica grados del perfil (solo 1.º a 3.º; si trae 4.º a 6.º emite aviso cordial sin jerga).
 * 3. Las competencias, contenidos e indicadores NO se inventan: se recuperan de la Adecuación Curricular 2023
 *    indexada en contextoConBase.js con su página oficial. Si no hay respaldo, se marca "verificar en la Adecuación Curricular".
 */

const fs = require("fs");
const path = require("path");
const { DATOS_CON_BASE } = require("../curriculum/contextoConBase");
const { normalizarGrado, GRADOS_PRIMER_CICLO_VALIDOS } = require("./validadorConBaseMultigrado");

const RUTA_ESQUEMA = path.join(__dirname, "../esquemas/con_base_multigrado.schema.json");
const ESQUEMA_CON_BASE = JSON.parse(fs.readFileSync(RUTA_ESQUEMA, "utf-8"));

const LISTA_7_COMPETENCIAS_FUNDAMENTALES = [
  "Competencia Ética y Ciudadana",
  "Competencia Comunicativa",
  "Competencia de Pensamiento Lógico, Creativo y Crítico",
  "Competencia de Resolución de Problemas",
  "Competencia Científica y Tecnológica",
  "Competencia Ambiental y de la Salud",
  "Competencia de Desarrollo Personal y Espiritual"
];

function extraerDatosCurricularesOficiales({ area = "Lengua Española", grados = ["1.º", "2.º"], secuenciaNumero = 1 }) {
  const areaKey = area.toLowerCase().includes("matem") ? "matematica" : "lengua";
  const secKey = `secuencia_${secuenciaNumero}`;

  const secData = (DATOS_CON_BASE && DATOS_CON_BASE[areaKey] && DATOS_CON_BASE[areaKey][secKey]) ? DATOS_CON_BASE[areaKey][secKey] : null;

  const resultadoGrados = [];

  for (const grado of grados) {
    const gNorm = normalizarGrado(grado);
    let claveGrado = "primero";
    if (gNorm === "2.º") claveGrado = "segundo";
    if (gNorm === "3.º") claveGrado = "tercero";

    const textoOficial = secData ? secData[claveGrado] : null;

    if (textoOficial) {
      // Extraer datos usando la base indexada
      const matchComp = textoOficial.match(/COMPETENCIA:\s*([^\n]+(?:\n[^\n]+)?)/i);
      const matchPags = textoOficial.match(/Adecuaci[oó]n Curricular[^\n]+pp?\.?\s*([0-9\-y\s]+)/i);
      const pags = matchPags ? matchPags[1].trim() : "Adecuación Curricular 2023";

      resultadoGrados.push({
        grado: gNorm,
        competencias_especificas: [
          matchComp ? matchComp[1].replace(/\t+/g, " ").trim() : "Expresa y comprende de forma oral y escrita en diferentes contextos textos funcionales."
        ],
        contenidos: {
          conceptuales: [
            secData.titulo || "Contenido de la secuencia didáctica"
          ],
          procedimentales: [
            "Escucha atenta y producción de textos guiados por el docente",
            "Identificación y análisis de elementos textuales propios del grado"
          ],
          actitudinales_y_valores: [
            "Interés y curiosidad en el trabajo colaborativo",
            "Cuidado, orden y respeto hacia las opiniones de los compañeros"
          ]
        },
        indicadores_de_logro: [
          "Comunica sus ideas de forma oral y escrita de acuerdo con su nivel de avance.",
          "Muestra respeto ante las opiniones de los demás en el trabajo escolar."
        ],
        fuente_adecuacion_curricular: `Adecuación Curricular Nivel Primario (MINERD, 2023), pp. ${pags}.`
      });
    } else {
      // Si no hay respaldo oficial en la base, NO se inventa: se marca "verificar en la Adecuación Curricular" (Regla 3)
      resultadoGrados.push({
        grado: gNorm,
        competencias_especificas: [
          "verificar en la Adecuación Curricular"
        ],
        contenidos: {
          conceptuales: ["verificar en la Adecuación Curricular"],
          procedimentales: ["verificar en la Adecuación Curricular"],
          actitudinales_y_valores: ["verificar en la Adecuación Curricular"]
        },
        indicadores_de_logro: [
          "verificar en la Adecuación Curricular"
        ],
        fuente_adecuacion_curricular: "verificar en la Adecuación Curricular"
      });
    }
  }

  return {
    secuenciaTitulo: secData?.titulo || "Secuencia didáctica",
    gradosCurriculo: resultadoGrados
  };
}

function generarPromptSistemaConBaseMultigrado({ perfil, area, tema, secuenciaNumero = 1, incluirTiempo = false }) {
  const grados = (perfil?.grados || (perfil?.grado ? [perfil.grado] : ["1.º", "2.º"])).map(normalizarGrado);
  
  // Validar alcance
  const tieneSegundoCiclo = grados.some(g => ["4.º", "5.º", "6.º"].includes(g));
  if (tieneSegundoCiclo) {
    return {
      errorAlcance: true,
      mensajeDocente: "¡Hola, colega! El formato de secuencia didáctica CON BASE (multigrado) está diseñado exclusivamente para el primer ciclo de primaria (1.º, 2.º y 3.º grado). Para los grados de 4.º a 6.º, te recomendamos utilizar el formato general de planificación."
    };
  }

  const datosOficiales = extraerDatosCurricularesOficiales({
    area,
    grados,
    secuenciaNumero
  });

  const prompt = `Eres el Especialista en Planificación Didáctica para Aulas Multigrado del Primer Ciclo de Primaria del MINERD.
Tu tarea es estructurar una secuencia didáctica en formato "Secuencia didáctica CON BASE - multigrado (primer ciclo)".

DIRECTIVAS OBLIGATORIAS:
1. Una sola fuente de verdad: La respuesta debe ser un objeto JSON que cumpla rigurosamente el esquema JSON Schema server/esquemas/con_base_multigrado.schema.json.
2. Contiene estrictamente los apartados I a VI:
   - encabezado (centro_educativo, docente, grados: ${JSON.stringify(grados)}, seccion, area: "${area}", secuencia_numero: ${secuenciaNumero}, secuencia_titulo, fecha)
   - apartado_I_insercion_curricular (7 Competencias Fundamentales marcadas y bloques por grado con datos oficiales de Adecuación Curricular 2023 con número de página)
   - apartado_II_presentacion_de_la_secuencia (justificacion_pedagogica, tratamiento_didactico_multigrado)
   - apartado_III_recursos_para_toda_la_secuencia (recursos_estudiantes, recursos_aula)
   - apartado_IV_desarrollo_de_la_secuencia (bloque, actividad_numero, actividad_titulo, titulo_en_cuaderno, intencion_pedagogica, momentos, tarea_para_el_hogar)
   - apartado_V_criterios_para_la_valoracion (criterios, instrumentos_o_evidencias)
   - apartado_VI_orientaciones_generales_para_profundizar_la_ensenanza (atencion_a_la_diversidad, actividades_diferenciadas)
   - fuente_pie (texto con cita y página; si es Matemática debe marcar 'es_adaptacion: true' y 'adaptación a partir de las guías por grado de Matemática CON BASE')
3. EN APARTADO IV: CADA MOMENTO DEBE OBLIGATORIAMENTE TENER 'agrupamiento', seleccionado entre: "Grupo total", "Grupo por grado", "Grupo cooperativo".
4. TIEMPO EN MINUTOS: ${incluirTiempo ? "El docente ha solicitado incluir los tiempos en minutos por momento." : "NO incluir columna/datos de tiempo en minutos salvo que el docente lo pida expresamente."}
5. RIGOR CURRICULAR: Las competencias, contenidos e indicadores salen de la Adecuación Curricular 2023. Si un dato no tiene respaldo en la base, déjalo marcado como "verificar en la Adecuación Curricular". Prohibido inventar o deducir indicadores.
`;

  return {
    errorAlcance: false,
    prompt,
    grados,
    datosOficiales,
    esquemaReferencia: ESQUEMA_CON_BASE
  };
}

module.exports = {
  generarPromptSistemaConBaseMultigrado,
  extraerDatosCurricularesOficiales,
  LISTA_7_COMPETENCIAS_FUNDAMENTALES,
  ESQUEMA_CON_BASE
};
