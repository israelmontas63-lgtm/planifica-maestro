/**
 * server/services/generadorWordConBaseServer.js
 * Generador en servidor Node de plantillas oficiales de planificación docente en formato Word (.docx).
 * Basado en las plantillas oficiales MINERD y el modelo del programa "CON BASE".
 */

const {
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
} = require("docx");

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

function normalizarClave(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

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

function extraerMomentosPedagogicos(datosObj, textoCompleto) {
  const momentos = [];

  const camposMomento = [
    { claves: ["inicio", "momento 1", "apertura"], nombre: "Momento 1: Inicio / Recuperación de saberes", tiempo: "10 min" },
    { claves: ["desarrollo", "momento 2", "actividad guiada"], nombre: "Momento 2: Desarrollo / Construcción del aprendizaje", tiempo: "25 min" },
    { claves: ["momento 3", "practica independiente", "profundizacion"], nombre: "Momento 3: Práctica / Aplicación de conocimientos", tiempo: "25 min" },
    { claves: ["cierre", "momento 4", "metacognicion", "evaluacion formativa"], nombre: "Momento 4: Cierre / Sistematización y evaluación", tiempo: "10 min" }
  ];

  let encontrado = false;
  for (const cm of camposMomento) {
    const val = buscarEnDatos(datosObj, cm.claves);
    if (val) {
      encontrado = true;
      const matchTiempo = val.match(/(\d+\s*(?:min(?:utos)?|horas?))/i);
      const tiempoFinal = matchTiempo ? matchTiempo[1] : cm.tiempo;
      momentos.push({
        nombre: cm.nombre,
        descripcion: val,
        tiempo: tiempoFinal,
        recursos: buscarRecursosParaMomento(val) || "Fascículo, pizarra, cuadernos"
      });
    }
  }

  if (!encontrado) {
    const fuente = buscarEnDatos(datosObj, ["actividades", "momentos", "secuencia didactica"]) || textoCompleto || "";
    const lineas = fuente.split("\n").map(l => l.trim()).filter(Boolean);

    let momActual = null;
    for (const linea of lineas) {
      const matchMom = linea.match(/^(?:#{1,4}\s*|[📌•*\-]\s*)?(momento\s*\d+|inicio|desarrollo|cierre)[^:]*:\s*(.*)/i);
      if (matchMom) {
        if (momActual) momentos.push(momActual);
        const tit = matchMom[1].toUpperCase();
        const desc = matchMom[2] || "";
        const matchTiempo = desc.match(/(\d+\s*(?:min(?:utos)?|horas?))/i);
        momActual = {
          nombre: `Momento: ${tit}`,
          descripcion: desc,
          tiempo: matchTiempo ? matchTiempo[1] : "15 min",
          recursos: buscarRecursosParaMomento(desc) || "Guía didáctica, cuaderno"
        };
      } else if (momActual) {
        momActual.descripcion += "\n" + linea;
      }
    }
    if (momActual) momentos.push(momActual);
  }

  if (momentos.length === 0) {
    momentos.push(
      {
        nombre: "Momento 1: Inicio",
        descripcion: "Presentación del propósito pedagógico, recuperación de conocimientos previos y motivación.",
        tiempo: "10 min",
        recursos: "Pizarra, cartel de propósitos"
      },
      {
        nombre: "Momento 2: Desarrollo",
        descripcion: "Actividades de aprendizaje guiadas, interacción con los textos/fascículos y trabajo colaborativo.",
        tiempo: "25 min",
        recursos: "Fascículo CON BASE, cuadernos de trabajo, material manipulativo"
      },
      {
        nombre: "Momento 3: Cierre",
        descripcion: "Socialización de producciones, síntesis de lo aprendido y preguntas metacognitivas.",
        tiempo: "10 min",
        recursos: "Cuaderno del estudiante, instrumentos de cotejo"
      }
    );
  }

  return momentos;
}

function buscarRecursosParaMomento(texto) {
  const match = (texto || "").match(/recursos?:\s*([^\n.]+)/i);
  return match ? match[1].trim() : "";
}

function crearCelda({
  children = [],
  columnSpan = 1,
  shadingColor = null,
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

async function construirDocumentoWordOficial({
  plan = "",
  datos = null,
  perfil = null,
  titulo = "Planificación Docente"
} = {}) {
  const perfilActivo = perfil || {};

  const datosObj = (datos && typeof datos === "object" && Object.keys(datos).length > 0)
    ? datos
    : parsearTextoPlan(plan);

  const centroEducativo =
    buscarEnDatos(datosObj, ["centro educativo", "escuela", "institucion", "colegio"]) ||
    perfilActivo.escuela ||
    "Centro Educativo del Nivel Primario";

  const docente =
    buscarEnDatos(datosObj, ["docente", "profesor", "maestro", "facilitador"]) ||
    perfilActivo.nombre ||
    "Docente";

  const grado =
    buscarEnDatos(datosObj, ["grado", "curso", "nivel educativo"]) ||
    perfilActivo.grado ||
    "3ro de Primaria";

  const seccion =
    buscarEnDatos(datosObj, ["seccion", "sección"]) ||
    perfilActivo.seccion ||
    "A";

  const area =
    buscarEnDatos(datosObj, ["area", "área", "asignatura", "materia"]) ||
    "Matemática";

  const secuencia =
    buscarEnDatos(datosObj, ["secuencia", "fasciculo", "unidad de aprendizaje", "tema"]) ||
    "Secuencia Didáctica 1";

  const fecha =
    buscarEnDatos(datosObj, ["fecha", "dia"]) ||
    perfilActivo.fecha ||
    new Date().toLocaleDateString("es-DO", { year: "numeric", month: "long", day: "numeric" });

  const tanda =
    buscarEnDatos(datosObj, ["tanda", "jornada"]) ||
    perfilActivo.tanda ||
    "Jornada Escolar Extendida (JEE)";

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

  const momentosList = extraerMomentosPedagogicos(datosObj, plan);

  const evaluacion =
    buscarEnDatos(datosObj, ["evaluacion", "evaluación", "instrumentos", "criterios de evaluacion"]) ||
    "Observación de aprendizajes, preguntas orales de metacognición, resolución de actividades en el cuaderno y lista de cotejo formativa.";

  const actividadesDiferenciadas =
    buscarEnDatos(datosObj, ["actividades diferenciadas", "diferenciadas", "adaptaciones", "atencion a la diversidad"]) ||
    "Apoyo individualizado con material concreto y tarjetas didácticas para estudiantes que requieren refuerzo. Desafíos de ampliación y extensión pedagógica para estudiantes con ritmo avanzado de aprendizaje.";

  const filasTabla = [];

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

  filasTabla.push(
    new TableRow({
      children: [
        crearCelda({
          columnSpan: 4,
          children: [crearParrafoCampo("Competencias Fundamentales", competenciasFund)]
        })
      ]
    })
  );

  filasTabla.push(
    new TableRow({
      children: [
        crearCelda({
          columnSpan: 4,
          children: [crearParrafoCampo("Competencias Específicas", competenciasEspec)]
        })
      ]
    })
  );

  filasTabla.push(
    new TableRow({
      children: [
        crearCelda({
          columnSpan: 4,
          children: [crearParrafoCampo("Intención pedagógica del día", intencionPedagogica)]
        })
      ]
    })
  );

  filasTabla.push(
    new TableRow({
      children: [
        crearCelda({
          columnSpan: 4,
          children: [crearParrafoCampo("Estrategias de enseñanza", estrategias)]
        })
      ]
    })
  );

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
          crearCelda({ columnSpan: 2, widthPct: 70, children: contenidoMomento }),
          crearCelda({
            columnSpan: 1,
            widthPct: 15,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 40 },
                children: [new TextRun({ text: m.tiempo || "15 min", size: 19, color: COLOR_TEXTO_NORMAL, font: "Calibri" })]
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
                children: [new TextRun({ text: m.recursos || "Cuaderno, lápiz, pizarra", size: 18, color: COLOR_TEXTO_NORMAL, font: "Calibri" })]
              })
            ]
          })
        ]
      })
    );
  });

  const faltantes = Math.max(0, 6 - momentosList.length);
  for (let f = 0; f < faltantes && (filasTabla.length < 15); f++) {
    filasTabla.push(
      new TableRow({
        children: [
          crearCelda({
            columnSpan: 2,
            widthPct: 70,
            children: [
              new Paragraph({
                spacing: { before: 40, after: 40 },
                children: [new TextRun({ text: "Momento complementario / Retroalimentación:", bold: true, size: 19, color: "64748B", font: "Calibri" })]
              })
            ]
          }),
          crearCelda({
            columnSpan: 1,
            widthPct: 15,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "---", size: 18, color: "94A3B8" })] })]
          }),
          crearCelda({
            columnSpan: 1,
            widthPct: 15,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "---", size: 18, color: "94A3B8" })] })]
          })
        ]
      })
    );
  }

  filasTabla.push(
    new TableRow({
      children: [
        crearCelda({
          columnSpan: 2,
          widthPct: 70,
          children: [crearParrafoCampo("Evaluación de la actividad", evaluacion)]
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

  filasTabla.push(
    new TableRow({
      children: [
        crearCelda({
          columnSpan: 4,
          shadingColor: "F8FAFC",
          children: [crearParrafoCampo("Actividades Diferenciadas (Atención a la Diversidad)", actividadesDiferenciadas)]
        })
      ]
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 16838,
              height: 11906,
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

module.exports = {
  construirDocumentoWordOficial
};
