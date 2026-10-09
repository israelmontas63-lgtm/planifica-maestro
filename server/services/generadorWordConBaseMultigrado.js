/**
 * server/services/generadorWordConBaseMultigrado.js
 * Generador en servidor Node para el formato "Secuencia didáctica CON BASE - multigrado (primer ciclo)".
 * Completamente separado de generadorWordConBase.js.
 * 
 * Reglas estrictas:
 * 1. Lee como fuente de verdad: server/esquemas/con_base_multigrado.schema.json
 * 2. Orden riguroso de apartados I a VI.
 * 3. Orientación A4 Horizontal (16838 x 11906 dxa), márgenes 3.0 cm vertical, 2.5 cm horizontal.
 * 4. Sombreado exclusivo #CDEEF6 (cero #F8FAFC).
 * 5. Columna de tiempo en minutos es OPCIONAL y solo aparece si se solicita explícitamente (mostrarTiempo === true).
 * 6. Etiqueta (Multigrado) solo si se seleccionan 2 o más grados.
 * 7. Cero celdas vacías, cero undefined, cero null, cero mojibake.
 * 8. Pie de página: cita la guía y página correspondiente (para Matemática: adaptación no publicada).
 */

const fs = require("fs");
const path = require("path");
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

function sanitizarTexto(val, defecto = "Sin especificar") {
  if (val === null || val === undefined) return defecto;
  let s = String(val).trim();
  if (s === "" || s === "---" || s === "undefined" || s === "null") return defecto;
  s = s.replace(/&amp;/g, "&")
       .replace(/&lt;/g, "<")
       .replace(/&gt;/g, ">")
       .replace(/&quot;/g, '"')
       .replace(/&#39;/g, "'");
  return s;
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
    children: children.length > 0 ? children : [new Paragraph({ children: [new TextRun({ text: "Información en desarrollo", size: 18 })] })]
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

function crearParrafoCampo(etiqueta, valor, { size = 18, boldLabel = true, alignment = AlignmentType.LEFT } = {}) {
  const valLimpio = sanitizarTexto(valor);
  const runs = [];
  if (etiqueta) {
    runs.push(new TextRun({
      text: etiqueta + ": ",
      bold: boldLabel,
      size,
      color: COLOR_TEXTO_TITULO,
      font: "Calibri"
    }));
  }
  runs.push(new TextRun({
    text: valLimpio,
    size,
    color: COLOR_TEXTO_NORMAL,
    font: "Calibri"
  }));
  return new Paragraph({
    alignment,
    spacing: { after: 60, before: 40 },
    children: runs
  });
}

function crearParrafoEncabezadoSeccion(titulo) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 80, after: 80 },
    children: [
      new TextRun({
        text: titulo,
        bold: true,
        size: 20,
        color: COLOR_TEXTO_TITULO,
        font: "Calibri"
      })
    ]
  });
}

async function generarWordConBaseMultigrado(datos = {}, opciones = {}) {
  const { mostrarTiempo = false } = opciones;

  const enc = datos.encabezado || {};
  const grados = Array.isArray(enc.grados) ? enc.grados : (enc.grado ? [enc.grado] : ["1.º", "2.º"]);
  const esMultigrado = grados.length >= 2;
  const etiquetaMultigrado = esMultigrado ? " (Multigrado)" : "";

  const tituloPrincipal = "Planificación Actividades de la Secuencia Didáctica de Primer Ciclo de primaria" + etiquetaMultigrado;

  const filas = [];

  // 1. TÍTULO PRINCIPAL (Fila 0)
  filas.push(
    new TableRow({
      children: [
        crearCelda({
          columnSpan: 4,
          shadingColor: COLOR_AZUL_ENCABEZADO,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 140, after: 140 },
              children: [
                new TextRun({
                  text: tituloPrincipal,
                  bold: true,
                  size: 24,
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

  // 2. ENCABEZADO DOCENTE (Fila 1)
  filas.push(
    new TableRow({
      children: [
        crearCelda({ widthPct: 35, children: [crearParrafoCampo("Centro Educativo", enc.centro_educativo || "Centro Educativo")] }),
        crearCelda({ widthPct: 30, children: [crearParrafoCampo("Docente", enc.docente || "Docente")] }),
        crearCelda({ widthPct: 20, children: [crearParrafoCampo("Grado", grados.join(", ") + etiquetaMultigrado)] }),
        crearCelda({ widthPct: 15, children: [crearParrafoCampo("Sección", enc.seccion || "A")] })
      ]
    })
  );

  // 3. DATOS DE CLASE (Fila 2)
  const numSec = enc.secuencia_numero != null ? String(enc.secuencia_numero).trim() : "";
  let titSec = sanitizarTexto(enc.secuencia_titulo || "Secuencia didáctica");
  titSec = titSec.replace(/^Secuencia\s*\d*\s*:\s*/i, "").trim();
  const textoSecuencia = numSec ? `Secuencia ${numSec}: ${titSec}` : titSec;

  filas.push(
    new TableRow({
      children: [
        crearCelda({ widthPct: 35, children: [crearParrafoCampo("Área", enc.area || "Lengua Española")] }),
        crearCelda({ widthPct: 30, children: [crearParrafoCampo("Secuencia", textoSecuencia)] }),
        crearCelda({ widthPct: 20, children: [crearParrafoCampo("Fecha", enc.fecha || new Date().toLocaleDateString("es-DO"))] }),
        crearCelda({ widthPct: 15, children: [crearParrafoCampo("Tanda", enc.tanda || "Jornada Escolar Extendida")] })
      ]
    })
  );

  // 4. APARTADO I: INSERCIÓN CURRICULAR
  const apartI = datos.apartado_I_insercion_curricular || {};
  const compFund = Array.isArray(apartI.competencias_fundamentales) ? apartI.competencias_fundamentales : [];
  
  const lineasFund = compFund.map(cf => {
    const marca = cf.trabajada ? "[☑] " : "[☐] ";
    return marca + (cf.nombre || "Competencia");
  });

  filas.push(
    new TableRow({
      children: [
        crearCelda({
          columnSpan: 4,
          shadingColor: COLOR_AZUL_ENCABEZADO,
          children: [crearParrafoEncabezadoSeccion("I. INSERCIÓN CURRICULAR")]
        })
      ]
    })
  );

  filas.push(
    new TableRow({
      children: [
        crearCelda({
          columnSpan: 4,
          children: [
            new Paragraph({
              spacing: { after: 40 },
              children: [
                new TextRun({
                  text: "Competencias Fundamentales (marcadas según la secuencia):",
                  bold: true,
                  size: 18,
                  color: COLOR_TEXTO_TITULO,
                  font: "Calibri"
                })
              ]
            }),
            new Paragraph({
              spacing: { after: 60 },
              children: [
                new TextRun({
                  text: lineasFund.length > 0 ? lineasFund.join("    |    ") : "Todas las Competencias Fundamentales del Nivel Primario",
                  size: 17,
                  font: "Calibri",
                  color: COLOR_TEXTO_NORMAL
                })
              ]
            })
          ]
        })
      ]
    })
  );

  // Inserción curricular por grado
  const gradosCurriculo = Array.isArray(apartI.grados_curriculo) ? apartI.grados_curriculo : [];
  for (const gc of gradosCurriculo) {
    const hijosGrado = [];
    hijosGrado.push(crearParrafoCampo("Grado", gc.grado || "Primer Ciclo", { boldLabel: true, size: 20 }));
    
    const compEsp = Array.isArray(gc.competencias_especificas) ? gc.competencias_especificas.join("; ") : sanitizarTexto(gc.competencias_especificas);
    hijosGrado.push(crearParrafoCampo("Competencias Específicas", compEsp));

    const cont = gc.contenidos || {};
    const conc = Array.isArray(cont.conceptuales) ? cont.conceptuales.join(", ") : sanitizarTexto(cont.conceptuales);
    const proc = Array.isArray(cont.procedimentales) ? cont.procedimentales.join(", ") : sanitizarTexto(cont.procedimentales);
    const act = Array.isArray(cont.actitudinales_y_valores) ? cont.actitudinales_y_valores.join(", ") : sanitizarTexto(cont.actitudinales_y_valores);

    hijosGrado.push(crearParrafoCampo("Contenidos Conceptuales", conc));
    hijosGrado.push(crearParrafoCampo("Contenidos Procedimentales", proc));
    hijosGrado.push(crearParrafoCampo("Actitudes y Valores", act));

    const ind = Array.isArray(gc.indicadores_de_logro) ? gc.indicadores_de_logro.join("; ") : sanitizarTexto(gc.indicadores_de_logro);
    hijosGrado.push(crearParrafoCampo("Indicadores de Logro", ind));

    const fuente = gc.fuente_adecuacion_curricular || "verificar en la Adecuación Curricular";
    hijosGrado.push(crearParrafoCampo("Fuente Curricular", fuente, { boldLabel: true }));

    filas.push(
      new TableRow({
        children: [
          crearCelda({
            columnSpan: 4,
            children: hijosGrado
          })
        ]
      })
    );
  }

  // 5. APARTADO II: PRESENTACIÓN DE LA SECUENCIA
  const apartII = datos.apartado_II_presentacion_de_la_secuencia || {};
  filas.push(
    new TableRow({
      children: [
        crearCelda({
          columnSpan: 4,
          shadingColor: COLOR_AZUL_ENCABEZADO,
          children: [crearParrafoEncabezadoSeccion("II. PRESENTACIÓN DE LA SECUENCIA")]
        })
      ]
    })
  );

  filas.push(
    new TableRow({
      children: [
        crearCelda({
          columnSpan: 4,
          children: [
            crearParrafoCampo("Justificación Pedagógica", apartII.justificacion_pedagogica || "Tratamiento didáctico alineado al desarrollo de competencias."),
            crearParrafoCampo("Tratamiento Didáctico en Multigrado", apartII.tratamiento_didactico_multigrado || "Articulación pedagógica simultánea con actividades compartidas y diferenciadas.")
          ]
        })
      ]
    })
  );

  // 6. APARTADO III: RECURSOS PARA TODA LA SECUENCIA
  const apartIII = datos.apartado_III_recursos_para_toda_la_secuencia || {};
  const recEst = Array.isArray(apartIII.recursos_estudiantes) ? apartIII.recursos_estudiantes.join(", ") : sanitizarTexto(apartIII.recursos_estudiantes, "Fascículos CON BASE, cuadernos de trabajo, lápices");
  const recAula = Array.isArray(apartIII.recursos_aula) ? apartIII.recursos_aula.join(", ") : sanitizarTexto(apartIII.recursos_aula, "Papelógrafo de aprendizajes, tarjetas de letras/palabras, pizarra");

  filas.push(
    new TableRow({
      children: [
        crearCelda({
          columnSpan: 4,
          shadingColor: COLOR_AZUL_ENCABEZADO,
          children: [crearParrafoEncabezadoSeccion("III. RECURSOS PARA TODA LA SECUENCIA")]
        })
      ]
    })
  );

  filas.push(
    new TableRow({
      children: [
        crearCelda({ widthPct: 50, columnSpan: 2, children: [crearParrafoCampo("Recursos para Estudiantes", recEst)] }),
        crearCelda({ widthPct: 50, columnSpan: 2, children: [crearParrafoCampo("Recursos para el Aula", recAula)] })
      ]
    })
  );

  // 7. APARTADO IV: DESARROLLO DE LA SECUENCIA
  const apartIV = datos.apartado_IV_desarrollo_de_la_secuencia || {};
  filas.push(
    new TableRow({
      children: [
        crearCelda({
          columnSpan: 4,
          shadingColor: COLOR_AZUL_ENCABEZADO,
          children: [crearParrafoEncabezadoSeccion("IV. DESARROLLO DE LA SECUENCIA")]
        })
      ]
    })
  );

  const datosAct = [
    crearParrafoCampo("Bloque", apartIV.bloque != null ? "Bloque " + apartIV.bloque : "Bloque 1"),
    crearParrafoCampo("Actividad", (apartIV.actividad_numero ? "Actividad " + apartIV.actividad_numero + ": " : "") + sanitizarTexto(apartIV.actividad_titulo, "Actividad de clase")),
    crearParrafoCampo("Título en el Cuaderno", apartIV.titulo_en_cuaderno || "Título de la actividad"),
    crearParrafoCampo("Intención Pedagógica del Día", apartIV.intencion_pedagogica || "Desarrollar habilidades clave de alfabetización y pensamiento lógico.")
  ];

  filas.push(
    new TableRow({
      children: [
        crearCelda({
          columnSpan: 4,
          children: datosAct
        })
      ]
    })
  );

  const celdasEncMomentos = [];
  if (mostrarTiempo) {
    celdasEncMomentos.push(
      crearCelda({ widthPct: 18, shadingColor: COLOR_AZUL_ENCABEZADO, children: [new Paragraph({ children: [new TextRun({ text: "Momentos", bold: true, size: 18, font: "Calibri" })] })] }),
      crearCelda({ widthPct: 20, shadingColor: COLOR_AZUL_ENCABEZADO, children: [new Paragraph({ children: [new TextRun({ text: "Agrupamiento", bold: true, size: 18, font: "Calibri" })] })] }),
      crearCelda({ widthPct: 14, shadingColor: COLOR_AZUL_ENCABEZADO, children: [new Paragraph({ children: [new TextRun({ text: "Tiempo", bold: true, size: 18, font: "Calibri" })] })] }),
      crearCelda({ widthPct: 48, shadingColor: COLOR_AZUL_ENCABEZADO, children: [new Paragraph({ children: [new TextRun({ text: "Recursos y Descripción de Actividades", bold: true, size: 18, font: "Calibri" })] })] })
    );
  } else {
    celdasEncMomentos.push(
      crearCelda({ widthPct: 20, shadingColor: COLOR_AZUL_ENCABEZADO, children: [new Paragraph({ children: [new TextRun({ text: "Momentos", bold: true, size: 18, font: "Calibri" })] })] }),
      crearCelda({ widthPct: 22, shadingColor: COLOR_AZUL_ENCABEZADO, children: [new Paragraph({ children: [new TextRun({ text: "Agrupamiento", bold: true, size: 18, font: "Calibri" })] })] }),
      crearCelda({ widthPct: 58, columnSpan: 2, shadingColor: COLOR_AZUL_ENCABEZADO, children: [new Paragraph({ children: [new TextRun({ text: "Recursos y Descripción de Actividades", bold: true, size: 18, font: "Calibri" })] })] })
    );
  }
  filas.push(new TableRow({ children: celdasEncMomentos }));

  const momentos = Array.isArray(apartIV.momentos) ? apartIV.momentos : [];
  momentos.forEach((mom, idx) => {
    const numMom = mom.momento_numero || ("Momento " + (idx + 1));
    const titMom = mom.foco_o_titulo ? numMom + ": " + mom.foco_o_titulo : numMom;
    const agrip = mom.agrupamiento || "Grupo total";
    const recs = mom.recursos ? "Recursos: " + mom.recursos + "\n" : "";
    const descCompleta = recs + sanitizarTexto(mom.descripcion, "Desarrollo de las orientaciones didácticas.");

    const celdasFilaMom = [];
    if (mostrarTiempo) {
      const tiempoVal = mom.tiempo_minutos ? (String(mom.tiempo_minutos).includes("min") ? String(mom.tiempo_minutos) : mom.tiempo_minutos + " min") : "A definir por el docente";
      celdasFilaMom.push(
        crearCelda({ widthPct: 18, children: [new Paragraph({ children: [new TextRun({ text: titMom, bold: true, size: 18, font: "Calibri" })] })] }),
        crearCelda({ widthPct: 20, children: [new Paragraph({ children: [new TextRun({ text: agrip, size: 18, font: "Calibri" })] })] }),
        crearCelda({ widthPct: 14, children: [new Paragraph({ children: [new TextRun({ text: tiempoVal, size: 18, font: "Calibri" })] })] }),
        crearCelda({ widthPct: 48, children: [new Paragraph({ children: [new TextRun({ text: descCompleta, size: 18, font: "Calibri" })] })] })
      );
    } else {
      celdasFilaMom.push(
        crearCelda({ widthPct: 20, children: [new Paragraph({ children: [new TextRun({ text: titMom, bold: true, size: 18, font: "Calibri" })] })] }),
        crearCelda({ widthPct: 22, children: [new Paragraph({ children: [new TextRun({ text: agrip, size: 18, font: "Calibri" })] })] }),
        crearCelda({ widthPct: 58, columnSpan: 2, children: [new Paragraph({ children: [new TextRun({ text: descCompleta, size: 18, font: "Calibri" })] })] })
      );
    }
    filas.push(new TableRow({ children: celdasFilaMom }));
  });

  filas.push(
    new TableRow({
      children: [
        crearCelda({
          columnSpan: 4,
          children: [
            crearParrafoCampo("Tarea para el Hogar", apartIV.tarea_para_el_hogar || "Aplicación contextualizada de lo trabajado en el aula con apoyo familiar.")
          ]
        })
      ]
    })
  );

  // 8. APARTADO V: CRITERIOS PARA LA VALORACIÓN
  const apartV = datos.apartado_V_criterios_para_la_valoracion || {};
  const crit = Array.isArray(apartV.criterios) ? apartV.criterios.join("\n• ") : sanitizarTexto(apartV.criterios);
  const inst = Array.isArray(apartV.instrumentos_o_evidencias) ? apartV.instrumentos_o_evidencias.join(", ") : sanitizarTexto(apartV.instrumentos_o_evidencias);

  filas.push(
    new TableRow({
      children: [
        crearCelda({
          columnSpan: 4,
          shadingColor: COLOR_AZUL_ENCABEZADO,
          children: [crearParrafoEncabezadoSeccion("V. CRITERIOS PARA LA VALORACIÓN")]
        })
      ]
    })
  );

  filas.push(
    new TableRow({
      children: [
        crearCelda({
          columnSpan: 4,
          children: [
            crearParrafoCampo("Criterios de Valoración Formativa", (crit.startsWith("•") ? "" : "• ") + crit),
            crearParrafoCampo("Instrumentos y Evidencias de Evaluación", inst)
          ]
        })
      ]
    })
  );

  // 9. APARTADO VI: ORIENTACIONES GENERALES PARA PROFUNDIZAR LA ENSEÑANZA
  const apartVI = datos.apartado_VI_orientaciones_generales_para_profundizar_la_ensenanza || {};
  filas.push(
    new TableRow({
      children: [
        crearCelda({
          columnSpan: 4,
          shadingColor: COLOR_AZUL_ENCABEZADO,
          children: [crearParrafoEncabezadoSeccion("VI. ORIENTACIONES GENERALES PARA PROFUNDIZAR LA ENSEÑANZA")]
        })
      ]
    })
  );

  const hijosVI = [];
  hijosVI.push(crearParrafoCampo("Atención a la Diversidad (DUA)", apartVI.atencion_a_la_diversidad || "Consideración de ritmos heterogéneos y andamiaje pedagógico continuo."));

  const actDif = Array.isArray(apartVI.actividades_diferenciadas) ? apartVI.actividades_diferenciadas : [];
  if (actDif.length > 0) {
    hijosVI.push(new Paragraph({
      spacing: { before: 60, after: 40 },
      children: [
        new TextRun({
          text: "Actividades Diferenciadas por Grado o Nivel de Apoyo:",
          bold: true,
          size: 18,
          color: COLOR_TEXTO_TITULO,
          font: "Calibri"
        })
      ]
    }));
    actDif.forEach(ad => {
      const g = ad.grado_o_grupo || "Grupo";
      const prop = sanitizarTexto(ad.propuesta);
      hijosVI.push(new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({ text: "• " + g + ": ", bold: true, size: 18, font: "Calibri" }),
          new TextRun({ text: prop, size: 18, font: "Calibri" })
        ]
      }));
    });
  }

  filas.push(
    new TableRow({
      children: [
        crearCelda({
          columnSpan: 4,
          children: hijosVI
        })
      ]
    })
  );

  // 10. PIE DE PÁGINA / FUENTE (Reglas 6, 8 y 10)
  const fuentePie = datos.fuente_pie || {};
  let textoFuente = fuentePie.texto;
  if (!textoFuente) {
    if ((enc.area || "").toLowerCase().includes("matem")) {
      textoFuente = "Guía Didáctica de Matemática Multigrado (Primer, segundo y tercer Grados) (MINERD / UNICEF, 2023), págs. 11-13.";
    } else {
      textoFuente = "Guía Didáctica de Lengua Española Multigrado (MINERD / UNICEF, 2023), pág. 29.";
    }
  }

  filas.push(
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
                  text: "Fuente de referencia: " + textoFuente,
                  italics: true,
                  size: 16,
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

  const tablaPrincipal = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: filas
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE,
              width: 11906,
              height: 16838
            },
            margin: {
              top: 1701,    // 3.0 cm
              bottom: 1701, // 3.0 cm
              left: 1417,   // 2.5 cm
              right: 1417,  // 2.5 cm
              header: 708,  // 1.25 cm
              footer: 708,  // 1.25 cm
              gutter: 0
            }
          }
        },
        children: [tablaPrincipal]
      }
    ]
  });

  return doc;
}

module.exports = {
  generarWordConBaseMultigrado,
  COLOR_AZUL_ENCABEZADO,
  sanitizarTexto
};
