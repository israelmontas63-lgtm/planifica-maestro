/**
 * client/src/services/generadorWordConBase.js
 * Generador de plantillas oficiales de planificación docente en formato Word (.docx).
 * Basado en las plantillas oficiales MINERD y el modelo del programa "CON BASE".
 *
 * Características técnicas:
 * - Orientación A4 Horizontal (Landscape: 16,838 x 11,906 dxa).
 * - Matriz de 17 filas estructuradas con bordes nítidos y acolchado profesional.
 * - Encabezados con sombreado azul claro oficial (#CDEEF6).
 * - Encabezado de 4 columnas: Centro Educativo | Docente | Grado | Sección.
 * - Fila 3: Área | Secuencia / Fascículo | Fecha | Tanda.
 * - Tabla de momentos pedagógicos de 3 columnas: Momentos | Tiempo | Recursos.
 * - Sección de Actividades Diferenciadas (adecuación curricular inclusiva).
 * - Autocompletado con el perfil docente del usuario.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  PageOrientation,
  ShadingType
} from "docx";
import { cargarPerfil } from "./perfilStorage.js";

// Competencias Fundamentales oficiales del currículo dominicano (Ordenanza 04-2023)
const COMPETENCIAS_FUNDAMENTALES_DEFECTO =
  "Competencia Ética y Ciudadana, Competencia Comunicativa, Competencia de Pensamiento Lógico, Creativo y Crítico, " +
  "Competencia de Resolución de Problemas, Competencia Científica y Tecnológica, Competencia Ambiental y de la Salud, " +
  "Competencia de Desarrollo Personal y Espiritual.";

const COLOR_AZUL_ENCABEZADO = "CDEEF6";
const COLOR_BORDE = "94A3B8";
const COLOR_TEXTO_TITULO = "0F172A";
const COLOR_TEXTO_NORMAL = "1E293B";

const BORDE_CELDA = {
  top: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDE },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDE },
  left: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDE },
  right: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDE },
};

const MARGEN_CELDA = {
  top: 130,
  bottom: 130,
  left: 170,
  right: 170,
};

/**
 * Normaliza claves de un objeto para búsquedas tolerantes a acentos y mayúsculas
 */
function normalizarClave(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Busca un valor en el objeto de datos usando múltiples posibles nombres de campo
 */
function buscarEnDatos(datosObj, variantes) {
  if (!datosObj || typeof datosObj !== "object") return "";
  const entries = Object.entries(datosObj);
  for (const variante of variantes) {
    const vNorm = normalizarClave(variante);
    for (const [k, v] of entries) {
      if (normalizarClave(k).includes(vNorm)) {
        return typeof v === "string" ? v.trim() : String(v || "");
      }
    }
  }
  return "";
}

/**
 * Parsea el texto del plan cuando viene como string no estructurado
 */
function parsearTextoPlan(planText) {
  const lineas = (planText || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const secciones = {};
  let seccionActual = "general";
  secciones[seccionActual] = [];

  for (const l of lineas) {
    const matchEncabezado = l.match(/^(?:#{1,4}\s*|[📌•*\-]\s*)?([^:\n]{3,60}):\s*(.*)$/);
    if (matchEncabezado && matchEncabezado[1].length < 50) {
      seccionActual = normalizarClave(matchEncabezado[1]);
      secciones[seccionActual] = [];
      if (matchEncabezado[2]) secciones[seccionActual].push(matchEncabezado[2]);
    } else {
      if (!secciones[seccionActual]) secciones[seccionActual] = [];
      secciones[seccionActual].push(l);
    }
  }

  const resultado = {};
  for (const [k, arr] of Object.entries(secciones)) {
    resultado[k] = arr.join("\n").trim();
  }
  return resultado;
}

/**
 * Extrae o estructura los momentos pedagógicos (Inicio, Desarrollo, Cierre o Momentos 1 a 6)
 */
function inferirRecursosPorDefecto(area = "", momentoNum = 1) {
  const a = (area || "").toLowerCase();
  if (a.includes("lengua") || a.includes("español")) {
    const list = [
      "Fascículo de Lengua Española, papelógrafo de aprendizaje, pizarra y marcadores",
      "Guía didáctica, tarjetas de letras y palabras, cuaderno de trabajo y lápices",
      "Carteles ilustrados, fascículo de actividades, hojas en blanco",
      "Cuaderno del estudiante, instrumentos de cotejo, lápices de colores"
    ];
    return list[(momentoNum - 1) % list.length];
  }
  if (a.includes("mate")) {
    const list = [
      "Fascículo de Matemática, calendario escolar, pizarra y marcadores",
      "Material concreto manipulativo, regletas, tabla numérica y cuaderno",
      "Ficha de actividades prácticas, regla, lápices y borrador",
      "Cuaderno del estudiante, registro de logros, lista de cotejo"
    ];
    return list[(momentoNum - 1) % list.length];
  }
  if (a.includes("social")) {
    const list = [
      "Mapas temáticos, globo terráqueo, imágenes históricas y pizarra",
      "Textos informativos del fascículo, cartulinas, marcadores y cuaderno",
      "Láminas didácticas, cuaderno de trabajo, tijeras y pegamento",
      "Cuaderno de Ciencias Sociales, rúbrica de participación, preguntas orales"
    ];
    return list[(momentoNum - 1) % list.length];
  }
  if (a.includes("natur") || a.includes("cien")) {
    const list = [
      "Láminas ilustrativas de ciencias, muestras del entorno natural, pizarra",
      "Fascículo de Ciencias de la Naturaleza, lupas, cuaderno de campo",
      "Material de experimentación sencilla, fichas de observación",
      "Cuaderno de ciencias, lista de cotejo, preguntas de reflexión guiada"
    ];
    return list[(momentoNum - 1) % list.length];
  }
  return "Guía didáctica CON BASE, fascículo del estudiante, cuaderno de trabajo, pizarra y marcadores";
}

function extraerMomentosPedagogicos(datosObj, textoCompleto, area = "") {
  const momentos = [];

  // 1. Si datosObj.momentos viene como arreglo estructurado
  if (datosObj && Array.isArray(datosObj.momentos) && datosObj.momentos.length > 0) {
    datosObj.momentos.forEach((m, idx) => {
      if (typeof m === "object" && m !== null) {
        const nom = m.momento || m.nombre || `Momento ${idx + 1}`;
        const desc = m.descripcion || m.actividad || m.texto || "";
        const tiem = m.tiempo || (idx === 0 ? "15 min" : idx === 1 ? "25 min" : "15 min");
        const rec = m.recursos || buscarRecursosParaMomento(desc) || inferirRecursosPorDefecto(area, idx + 1);
        momentos.push({ nombre: nom, descripcion: desc, tiempo: tiem, recursos: rec });
      } else if (typeof m === "string") {
        const matchMom = m.match(/^(?:#{1,4}\s*|[📌•*\-]\s*)?(momento\s*\d+|inicio|desarrollo|cierre)[^:]*:\s*(.*)/i);
        const nom = matchMom ? matchMom[1] : `Momento ${idx + 1}`;
        const desc = matchMom ? matchMom[2] : m;
        const matchTiempo = desc.match(/(\d+\s*(?:min(?:utos)?|horas?))/i);
        const tiem = matchTiempo ? matchTiempo[1] : (idx === 0 ? "15 min" : idx === 1 ? "25 min" : "15 min");
        const rec = buscarRecursosParaMomento(desc) || inferirRecursosPorDefecto(area, idx + 1);
        momentos.push({ nombre: nom, descripcion: desc, tiempo: tiem, recursos: rec });
      }
    });
    if (momentos.length > 0) return momentos;
  }

  // 2. Intentar buscar campos específicos en datosObj
  const camposMomento = [
    { claves: ["inicio", "momento 1", "apertura"], nombre: "Momento 1: Inicio / Recuperación de saberes", tiempo: "15 min" },
    { claves: ["desarrollo", "momento 2", "actividad guiada"], nombre: "Momento 2: Desarrollo / Construcción del aprendizaje", tiempo: "25 min" },
    { claves: ["momento 3", "practica independiente", "profundizacion"], nombre: "Momento 3: Práctica / Aplicación de conocimientos", tiempo: "25 min" },
    { claves: ["cierre", "momento 4", "metacognicion", "evaluacion formativa"], nombre: "Momento 4: Cierre / Sistematización y evaluación", tiempo: "15 min" }
  ];

  let encontrado = false;
  for (let i = 0; i < camposMomento.length; i++) {
    const cm = camposMomento[i];
    const val = buscarEnDatos(datosObj, cm.claves);
    if (val) {
      encontrado = true;
      const matchTiempo = val.match(/(\d+\s*(?:min(?:utos)?|horas?))/i);
      const tiempoFinal = matchTiempo ? matchTiempo[1] : cm.tiempo;
      momentos.push({
        nombre: cm.nombre,
        descripcion: val,
        tiempo: tiempoFinal,
        recursos: buscarRecursosParaMomento(val) || inferirRecursosPorDefecto(area, i + 1)
      });
    }
  }

  // 3. Si no se encontraron por campos individuales, buscar dentro de "actividades" o texto completo
  if (!encontrado) {
    const fuente = buscarEnDatos(datosObj, ["actividades", "momentos", "secuencia didactica"]) || textoCompleto || "";
    const lineas = fuente.split("\n").map(l => l.trim()).filter(Boolean);

    let momActual = null;
    let momCount = 0;
    for (const linea of lineas) {
      const matchMom = linea.match(/^(?:#{1,4}\s*|[📌•*\-]\s*)?(momento\s*\d+|inicio|desarrollo|cierre)[^:]*:\s*(.*)/i);
      if (matchMom) {
        if (momActual) momentos.push(momActual);
        momCount++;
        const tit = matchMom[1].toUpperCase();
        const desc = matchMom[2] || "";
        const matchTiempo = desc.match(/(\d+\s*(?:min(?:utos)?|horas?))/i);
        momActual = {
          nombre: `Momento: ${tit}`,
          descripcion: desc,
          tiempo: matchTiempo ? matchTiempo[1] : (momCount === 1 ? "15 min" : momCount === 2 ? "25 min" : "15 min"),
          recursos: buscarRecursosParaMomento(desc) || inferirRecursosPorDefecto(area, momCount)
        };
      } else if (momActual) {
        momActual.descripcion += "\n" + linea;
      }
    }
    if (momActual) momentos.push(momActual);
  }

  // Fallback si aún no hay momentos detectados: estructurar los 3 momentos clásicos
  if (momentos.length === 0) {
    momentos.push(
      {
        nombre: "Momento 1: Inicio",
        descripcion: "Presentación del propósito pedagógico, recuperación de conocimientos previos y motivación activa.",
        tiempo: "15 min",
        recursos: inferirRecursosPorDefecto(area, 1)
      },
      {
        nombre: "Momento 2: Desarrollo",
        descripcion: "Actividades de aprendizaje guiadas, interacción con los textos y fascículos, y resolución en equipos.",
        tiempo: "25 min",
        recursos: inferirRecursosPorDefecto(area, 2)
      },
      {
        nombre: "Momento 3: Cierre",
        descripcion: "Socialización de producciones, síntesis de lo aprendido y preguntas de reflexión metacognitiva.",
        tiempo: "15 min",
        recursos: inferirRecursosPorDefecto(area, 3)
      }
    );
  }

  return momentos;
}

function buscarRecursosParaMomento(texto) {
  const match = (texto || "").match(/recursos?:\s*([^\n.]+)/i);
  return match ? match[1].trim() : "";
}

/**
 * Crea una celda de tabla con formato estándar
 */
function crearCelda({
  children = [],
  columnSpan = 1,
  shadingColor = null,
  alignment = AlignmentType.LEFT,
  widthPct = null,
  widthDxa = null
}) {
  const props = {
    borders: BORDE_CELDA,
    margins: MARGEN_CELDA,
    columnSpan,
    children
  };

  if (shadingColor) {
    props.shading = { fill: shadingColor, type: ShadingType.CLEAR };
  }

  if (widthPct) {
    props.width = { size: widthPct, type: WidthType.PERCENTAGE };
  } else if (widthDxa) {
    props.width = { size: widthDxa, type: WidthType.DXA };
  }

  return new TableCell(props);
}

/**
 * Párrafo con etiqueta en negrita y valor en texto normal
 */
function crearParrafoCampo(etiqueta, valor, { size = 20, alignment = AlignmentType.LEFT } = {}) {
  return new Paragraph({
    alignment,
    spacing: { before: 40, after: 40, line: 240 },
    children: [
      new TextRun({
        text: etiqueta ? `${etiqueta}: ` : "",
        bold: true,
        size,
        color: COLOR_TEXTO_TITULO,
        font: "Calibri"
      }),
      new TextRun({
        text: valor || "---",
        bold: false,
        size,
        color: COLOR_TEXTO_NORMAL,
        font: "Calibri"
      })
    ]
  });
}

/**
 * Párrafo de texto simple con saltos de línea preservados
 */
function crearParrafoMultiLinea(texto, { size = 19, bold = false, color = COLOR_TEXTO_NORMAL } = {}) {
  const lineas = String(texto || "").split("\n");
  const paragraphs = [];

  lineas.forEach((linea, index) => {
    paragraphs.push(
      new Paragraph({
        spacing: { before: index === 0 ? 40 : 20, after: 30, line: 240 },
        children: [
          new TextRun({
            text: linea || " ",
            bold,
            size,
            color,
            font: "Calibri"
          })
        ]
      })
    );
  });

  return paragraphs;
}

/**
 * Construye el objeto Document de docx con la matriz oficial de 17 filas
 */
export async function construirDocumentoWordOficial({
  plan = "",
  datos = null,
  perfil = null,
  titulo = "Planificación Docente"
} = {}) {
  // Cargar perfil docente si no fue proporcionado explícitamente
  let perfilActivo = perfil;
  if (!perfilActivo) {
    try {
      perfilActivo = cargarPerfil() || {};
    } catch (e) {
      perfilActivo = {};
    }
  }

  // Parsear si los datos no vienen estructurados
  const datosObj = (datos && typeof datos === "object" && Object.keys(datos).length > 0)
    ? datos
    : parsearTextoPlan(plan);

  // 1. Campos de identificación
  const area =
    buscarEnDatos(datosObj, ["area", "área", "asignatura", "materia"]) ||
    "Matemática";

  // Grado con soporte multigrado:
  let grado = buscarEnDatos(datosObj, ["grado", "curso", "nivel educativo"]);
  if (!grado) {
    if (Array.isArray(perfilActivo?.grados) && perfilActivo.grados.length > 0) {
      if (perfilActivo.grados.length > 1) {
        const ult = perfilActivo.grados[perfilActivo.grados.length - 1];
        const prev = perfilActivo.grados.slice(0, -1);
        grado = `${prev.join(", ")} y ${ult} (Multigrado)`;
      } else {
        grado = perfilActivo.grados[0];
      }
    } else if (perfilActivo?.grado) {
      grado = perfilActivo.grado;
    } else {
      grado = "3ro de Primaria";
    }
  }

  let centroEducativo =
    buscarEnDatos(datosObj, ["centro educativo", "escuela", "institucion", "colegio"]) ||
    perfilActivo?.escuela ||
    "Centro Educativo";

  const regDist = [];
  if (perfilActivo?.regional && !centroEducativo.toLowerCase().includes("reg")) {
    regDist.push(`Regional ${perfilActivo.regional}`);
  }
  if (perfilActivo?.distrito && !centroEducativo.toLowerCase().includes("dist")) {
    regDist.push(`Distrito ${perfilActivo.distrito}`);
  }
  if (regDist.length > 0) {
    centroEducativo = `${centroEducativo} (${regDist.join(", ")})`;
  }

  const docente =
    buscarEnDatos(datosObj, ["docente", "profesor", "maestro", "facilitador"]) ||
    perfilActivo?.nombre ||
    "Docente";

  const seccion =
    buscarEnDatos(datosObj, ["seccion", "sección"]) ||
    perfilActivo?.seccion ||
    "A";

  const secuencia =
    buscarEnDatos(datosObj, ["secuencia", "fasciculo", "unidad de aprendizaje", "tema"]) ||
    "Secuencia Didáctica 1";

  const fecha =
    buscarEnDatos(datosObj, ["fecha", "dia"]) ||
    perfilActivo?.fecha ||
    new Date().toLocaleDateString("es-DO", { year: "numeric", month: "long", day: "numeric" });

  const tanda =
    buscarEnDatos(datosObj, ["tanda", "jornada"]) ||
    perfilActivo?.tanda ||
    "Jornada Escolar Extendida (JEE)";

  // 2. Competencias
  const competenciasFund =
    buscarEnDatos(datosObj, ["competencias fundamentales", "fundamentales"]) ||
    COMPETENCIAS_FUNDAMENTALES_DEFECTO;

  const competenciasEspec =
    buscarEnDatos(datosObj, ["competencias especificas", "especificas", "específicas"]) ||
    "Desarrolla habilidades cognitivas y procedimentales articuladas a los indicadores de logro del grado.";

  const intencionPedagogica =
    buscarEnDatos(datosObj, ["intencion pedagogica", "intención pedagógica", "proposito", "meta"]) ||
    "Que los estudiantes comprendan, apliquen y comuniquen los aprendizajes esperados.";

  const estrategias =
    buscarEnDatos(datosObj, ["estrategias de ensenanza", "estrategias", "estrategia"]) ||
    "Recuperación de saberes previos, socialización centrada en actividades grupales, resolución de problemas e indagación dialógica.";

  const bloque =
    buscarEnDatos(datosObj, ["bloque"]) || "1";
  const actividad =
    buscarEnDatos(datosObj, ["actividad", "bloque y actividad"]) || "Actividad 1: Exploración y desarrollo";

  // 3. Momentos pedagógicos (pasando el área curricular para recursos específicos)
  const momentosList = extraerMomentosPedagogicos(datosObj, plan, area);

  // 4. Evaluación
  const evaluacion =
    buscarEnDatos(datosObj, ["evaluacion", "evaluación", "instrumentos", "criterios de evaluacion"]) ||
    "Observación de aprendizajes, preguntas orales de metacognición, resolución de actividades en el cuaderno y lista de cotejo formativa.";

  // 5. Actividades Diferenciadas (Adecuación Curricular / Atención a la Diversidad)
  const actividadesDiferenciadas =
    buscarEnDatos(datosObj, ["actividades diferenciadas", "diferenciadas", "adaptaciones", "atencion a la diversidad"]) ||
    "Apoyo individualizado con material concreto y tarjetas didácticas para estudiantes que requieren refuerzo. Desafíos de ampliación y extensión pedagógica para estudiantes con ritmo avanzado de aprendizaje.";

  // CONSTRUCCIÓN DE LA TABLA (MATRIZ OFICIAL DE 17 FILAS)
  const filasTabla = [];

  // Fila 1: Título de la Planificación (Centrado, Fondo Azul #CDEEF6, Colspan 4)
  filasTabla.push(
    new TableRow({
      children: [
        crearCelda({
          columnSpan: 4,
          shadingColor: COLOR_AZUL_ENCABEZADO,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 80, after: 80 },
              children: [
                new TextRun({
                  text: "Planificación de Actividades de la Secuencia Didáctica - Programa CON BASE",
                  bold: true,
                  size: 23,
                  color: COLOR_TEXTO_TITULO,
                  font: "Calibri"
                })
              ]
            })
          ]
        })
      ]
    })
  );

  // Fila 2: Centro Educativo | Docente | Grado | Sección (4 celdas)
  filasTabla.push(
    new TableRow({
      children: [
        crearCelda({ widthPct: 42, children: [crearParrafoCampo("Centro Educativo", centroEducativo)] }),
        crearCelda({ widthPct: 30, children: [crearParrafoCampo("Docente", docente)] }),
        crearCelda({ widthPct: 15, children: [crearParrafoCampo("Grado", grado)] }),
        crearCelda({ widthPct: 13, children: [crearParrafoCampo("Sección", seccion)] })
      ]
    })
  );

  // Fila 3: Área | Secuencia | Fecha | Tanda (4 celdas)
  filasTabla.push(
    new TableRow({
      children: [
        crearCelda({ widthPct: 42, children: [crearParrafoCampo("Área", area)] }),
        crearCelda({ widthPct: 30, children: [crearParrafoCampo("Secuencia", secuencia)] }),
        crearCelda({ widthPct: 15, children: [crearParrafoCampo("Fecha", fecha)] }),
        crearCelda({ widthPct: 13, children: [crearParrafoCampo("Tanda", tanda)] })
      ]
    })
  );

  // Fila 4: Competencias Fundamentales (Colspan 4)
  filasTabla.push(
    new TableRow({
      children: [
        crearCelda({
          columnSpan: 4,
          children: [
            crearParrafoCampo("Competencias Fundamentales", competenciasFund)
          ]
        })
      ]
    })
  );

  // Fila 5: Competencias Específicas (Colspan 4)
  filasTabla.push(
    new TableRow({
      children: [
        crearCelda({
          columnSpan: 4,
          children: [
            crearParrafoCampo("Competencias Específicas", competenciasEspec)
          ]
        })
      ]
    })
  );

  // Fila 6: Intención Pedagógica del día (Colspan 4)
  filasTabla.push(
    new TableRow({
      children: [
        crearCelda({
          columnSpan: 4,
          children: [
            crearParrafoCampo("Intención pedagógica del día", intencionPedagogica)
          ]
        })
      ]
    })
  );

  // Fila 7: Estrategias de enseñanza (Colspan 4)
  filasTabla.push(
    new TableRow({
      children: [
        crearCelda({
          columnSpan: 4,
          children: [
            crearParrafoCampo("Estrategias de enseñanza", estrategias)
          ]
        })
      ]
    })
  );

  // Fila 8: Bloque y Actividad (Colspan 4)
  filasTabla.push(
    new TableRow({
      children: [
        crearCelda({
          columnSpan: 4,
          children: [
            new Paragraph({
              spacing: { before: 40, after: 40, line: 240 },
              children: [
                new TextRun({ text: "Bloque: ", bold: true, size: 20, color: COLOR_TEXTO_TITULO, font: "Calibri" }),
                new TextRun({ text: `${bloque}      `, bold: false, size: 20, color: COLOR_TEXTO_NORMAL, font: "Calibri" }),
                new TextRun({ text: "Actividad: ", bold: true, size: 20, color: COLOR_TEXTO_TITULO, font: "Calibri" }),
                new TextRun({ text: actividad, bold: false, size: 20, color: COLOR_TEXTO_NORMAL, font: "Calibri" })
              ]
            })
          ]
        })
      ]
    })
  );

  // Fila 9: Encabezado de Momentos (3 Columnas: Momentos | Tiempo | Recursos, Fondo Azul #CDEEF6)
  filasTabla.push(
    new TableRow({
      children: [
        crearCelda({
          columnSpan: 2,
          widthPct: 70,
          shadingColor: COLOR_AZUL_ENCABEZADO,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 50, after: 50 },
              children: [new TextRun({ text: "Momentos de la Clase", bold: true, size: 20, color: COLOR_TEXTO_TITULO, font: "Calibri" })]
            })
          ]
        }),
        crearCelda({
          columnSpan: 1,
          widthPct: 15,
          shadingColor: COLOR_AZUL_ENCABEZADO,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 50, after: 50 },
              children: [new TextRun({ text: "Tiempo", bold: true, size: 20, color: COLOR_TEXTO_TITULO, font: "Calibri" })]
            })
          ]
        }),
        crearCelda({
          columnSpan: 1,
          widthPct: 15,
          shadingColor: COLOR_AZUL_ENCABEZADO,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 50, after: 50 },
              children: [new TextRun({ text: "Recursos", bold: true, size: 20, color: COLOR_TEXTO_TITULO, font: "Calibri" })]
            })
          ]
        })
      ]
    })
  );

  // Filas 10 a 15: Detalle de Momentos (Momentos en 3 columnas)
  momentosList.forEach((m, idx) => {
    const parsDescripcion = crearParrafoMultiLinea(m.descripcion, { size: 19 });
    const contenidoMomento = [
      new Paragraph({
        spacing: { before: 40, after: 30, line: 240 },
        children: [
          new TextRun({
            text: m.nombre ? `${m.nombre}: ` : `Momento ${idx + 1}: `,
            bold: true,
            size: 20,
            color: COLOR_TEXTO_TITULO,
            font: "Calibri"
          })
        ]
      }),
      ...parsDescripcion
    ];

    filasTabla.push(
      new TableRow({
        children: [
          crearCelda({
            columnSpan: 2,
            widthPct: 70,
            children: contenidoMomento
          }),
          crearCelda({
            columnSpan: 1,
            widthPct: 15,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 40 },
                children: [
                  new TextRun({
                    text: m.tiempo || "15 min",
                    bold: false,
                    size: 19,
                    color: COLOR_TEXTO_NORMAL,
                    font: "Calibri"
                  })
                ]
              })
            ]
          }),
          crearCelda({
            columnSpan: 1,
            widthPct: 15,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 40 },
                children: [
                  new TextRun({
                    text: m.recursos || "Cuaderno, lápiz, pizarra",
                    bold: false,
                    size: 18,
                    color: COLOR_TEXTO_NORMAL,
                    font: "Calibri"
                  })
                ]
              })
            ]
          })
        ]
      })
    );
  });



  // Fila 16: Evaluación de la actividad
  filasTabla.push(
    new TableRow({
      children: [
        crearCelda({
          columnSpan: 2,
          widthPct: 70,
          children: [
            crearParrafoCampo("Evaluación de la actividad", evaluacion)
          ]
        }),
        crearCelda({
          columnSpan: 1,
          widthPct: 15,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 40, after: 40 },
              children: [new TextRun({ text: "Formativa", size: 19, color: COLOR_TEXTO_NORMAL, font: "Calibri" })]
            })
          ]
        }),
        crearCelda({
          columnSpan: 1,
          widthPct: 15,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 40, after: 40 },
              children: [new TextRun({ text: "Registro docente", size: 18, color: COLOR_TEXTO_NORMAL, font: "Calibri" })]
            })
          ]
        })
      ]
    })
  );

  // Fila 17: Actividades Diferenciadas (Atención a la diversidad)
  filasTabla.push(
    new TableRow({
      children: [
        crearCelda({
          columnSpan: 4,
          shadingColor: "F8FAFC",
          children: [
            crearParrafoCampo("Actividades Diferenciadas (Atención a la Diversidad)", actividadesDiferenciadas)
          ]
        })
      ]
    })
  );

  // Si existen campos extra en datosObj que no entraron en las 17 filas (ej: fuentes curriculares, notas, situación de aprendizaje)
  const clavesCubiertas = [
    "centro educativo", "docente", "grado", "grados", "seccion", "area", "secuencia", "fecha", "tanda",
    "competencias fundamentales", "competencias especificas", "intencion pedagogica", "estrategias", "estrategias de ensenanza",
    "bloque", "actividad", "evaluacion", "actividades diferenciadas", "general", "momentos", "inicio", "desarrollo", "cierre",
    "titulo", "title"
  ].map(normalizarClave);

  const camposAdicionales = Object.entries(datosObj).filter(([k]) => {
    const kNorm = normalizarClave(k);
    return !clavesCubiertas.some(cc => kNorm.includes(cc) || cc.includes(kNorm));
  });

  if (camposAdicionales.length > 0) {
    camposAdicionales.forEach(([claveExtra, valorExtra]) => {
      filasTabla.push(
        new TableRow({
          children: [
            crearCelda({
              columnSpan: 4,
              children: [
                crearParrafoCampo(claveExtra, valorExtra)
              ]
            })
          ]
        })
      );
    });
  }

  // Creación del Documento A4 Horizontal (Landscape)
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906, // A4 portrait base invertido por PageOrientation.LANDSCAPE a w:16838 h:11906
              height: 16838,
              orientation: PageOrientation.LANDSCAPE
            },
            margin: {
              top: 1417,
              right: 1417,
              bottom: 1417,
              left: 1417
            }
          }
        },
        children: [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: filasTabla
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 140 },
            children: [
              new TextRun({
                text: "Documento generado por Planifica Maestro — Formato de secuencia didáctica (CON BASE)",
                size: 16,
                color: "94A3B8",
                italics: true,
                font: "Calibri"
              })
            ]
          })
        ]
      }
    ]
  });

  return doc;
}

/**
 * Función que genera y descarga el documento Word en el navegador
 */
export async function descargarWordConBase({
  titulo = "Planificacion_MINERD",
  plan = "",
  datos = null,
  perfil = null
} = {}) {
  const doc = await construirDocumentoWordOficial({
    plan,
    datos,
    perfil,
    titulo
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const nombreLimpio = (titulo || "Planificacion_MINERD")
    .replace(/[^\w\d\sáéíóúÁÉÍÓÚñÑ_-]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  a.download = `${nombreLimpio}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}
