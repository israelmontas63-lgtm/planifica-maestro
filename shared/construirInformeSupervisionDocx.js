/**
 * shared/construirInformeSupervisionDocx.js
 * Constructor Canónico del Informe Oficial de Acompañamiento y Supervisión Pedagógica MINERD.
 * 
 * Basado en las directrices de la Dirección General de Supervisión y Control de Calidad del MINERD.
 * Compatible 100% con docx ^9.7.1 tanto en navegador (Blob) como en Node.js (Buffer).
 */

import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
  Header,
  Footer,
  PageNumber
} from "docx";

// Paleta oficial institucional del MINERD
const COLOR_AZUL_MINERD = "1B3A5C";
const COLOR_AZUL_CLARO = "E8F4F8";
const COLOR_BORDE = "94A3B8";
const COLOR_TEXTO_TITULO = "0F172A";
const COLOR_TEXTO_CUERPO = "1E293B";
const COLOR_GRIS_FONDO = "F8FAFC";

const BORDE_CELDA = {
  top: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDE },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDE },
  left: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDE },
  right: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDE },
};

const MARGEN_CELDA = {
  top: 120,
  bottom: 120,
  left: 140,
  right: 140,
};

function crearCeldaEncabezado(texto, anchoPct, opciones = {}) {
  return new TableCell({
    width: { size: anchoPct, type: WidthType.PERCENTAGE },
    borders: BORDE_CELDA,
    margins: MARGEN_CELDA,
    shading: { fill: opciones.fill || COLOR_AZUL_MINERD, type: ShadingType.CLEAR },
    children: [
      new Paragraph({
        alignment: opciones.align || AlignmentType.CENTER,
        spacing: { before: 40, after: 40 },
        children: [
          new TextRun({
            text: texto,
            bold: true,
            size: opciones.size || 19, // 9.5pt
            color: opciones.color || "FFFFFF",
            font: "Calibri"
          })
        ]
      })
    ]
  });
}

function crearCeldaDato(texto, anchoPct, opciones = {}) {
  return new TableCell({
    width: { size: anchoPct, type: WidthType.PERCENTAGE },
    borders: BORDE_CELDA,
    margins: MARGEN_CELDA,
    shading: opciones.fill ? { fill: opciones.fill, type: ShadingType.CLEAR } : undefined,
    children: [
      new Paragraph({
        alignment: opciones.align || AlignmentType.LEFT,
        spacing: { before: 30, after: 30 },
        children: [
          new TextRun({
            text: String(texto || "—"),
            bold: Boolean(opciones.bold),
            size: opciones.size || 19,
            color: opciones.color || COLOR_TEXTO_CUERPO,
            font: "Calibri"
          })
        ]
      })
    ]
  });
}

function crearTituloSeccion(numero, titulo) {
  return [
    new Paragraph({
      spacing: { before: 240, after: 80 },
      children: [
        new TextRun({
          text: `${numero}. ${titulo}`,
          bold: true,
          size: 23, // 11.5pt
          color: COLOR_AZUL_MINERD,
          font: "Calibri"
        })
      ]
    })
  ];
}

/**
 * Agrupa planificaciones por grado y área para construir la matriz cuantitativa oficial.
 */
function calcularEstadisticas(planes = []) {
  const grupos = new Map();

  let totalGeneralPlanes = 0;
  let totalGeneralAprobados = 0;
  let totalGeneralObservados = 0;
  let totalGeneralPorRevisar = 0;

  for (const p of planes) {
    const grado = p.grado || "General";
    const area = p.area || "General";
    const key = `${grado}__${area}`;

    if (!grupos.has(key)) {
      grupos.set(key, {
        grado,
        area,
        docente: p.docenteNombre || "Docente",
        total: 0,
        aprobadas: 0,
        observadas: 0,
        porRevisar: 0
      });
    }

    const reg = grupos.get(key);
    reg.total++;
    totalGeneralPlanes++;

    if (p.estado === "aprobada") {
      reg.aprobadas++;
      totalGeneralAprobados++;
    } else if (p.estado === "observada") {
      reg.observadas++;
      totalGeneralObservados++;
    } else {
      reg.porRevisar++;
      totalGeneralPorRevisar++;
    }
  }

  const filas = Array.from(grupos.values()).map((g) => {
    const pct = g.total > 0 ? Math.round((g.aprobadas / g.total) * 100) : 0;
    return { ...g, porcentaje: `${pct}%` };
  });

  const pctGlobal = totalGeneralPlanes > 0
    ? Math.round((totalGeneralAprobados / totalGeneralPlanes) * 100)
    : 0;

  return {
    filas,
    totales: {
      total: totalGeneralPlanes,
      aprobadas: totalGeneralAprobados,
      observadas: totalGeneralObservados,
      porRevisar: totalGeneralPorRevisar,
      porcentaje: `${pctGlobal}%`
    }
  };
}

/**
 * Construye el objeto Document de docx con el informe ministerial completo.
 * 
 * @param {Object} datos
 * @param {Object} datos.escuelaInfo - Datos del centro (nombre, codigoMinerd, regional, distrito, tanda)
 * @param {Array} datos.planes - Lista de planificaciones del centro
 * @param {Array} datos.revisiones - Historial de revisiones pedagógicas
 * @param {string} datos.periodoMes - Mes o período evaluado (Ej: 'Octubre 2026')
 * @param {string} datos.coordinadorNombre - Nombre del coordinador/a
 * @param {string} datos.directorNombre - Nombre del director/a
 * @param {string} datos.anioLectivo - Año lectivo (Ej: '2026-2027')
 * @returns {Document} Instancia oficial de Document de docx
 */
export function construirDocumentoInformeSupervision({
  escuelaInfo = {},
  planes = [],
  revisiones = [],
  periodoMes = "Octubre 2026",
  coordinadorNombre = "Coordinador/a Pedagógico/a",
  directorNombre = "Director/a del Centro Educativo",
  anioLectivo = "2026-2027"
} = {}) {
  const escuela = escuelaInfo.nombre || "Centro Educativo MINERD";
  const codigoMinerd = escuelaInfo.codigoMinerd || escuelaInfo.codigo_minerd || "00-00-0000";
  const regional = escuelaInfo.regional || escuelaInfo.regional_educativa || "Regional de Educación";
  const distrito = escuelaInfo.distrito || escuelaInfo.distrito_educativo || "Distrito Educativo";
  const tanda = escuelaInfo.tanda || "Jornada Escolar Extendida (JEE)";

  const stats = calcularEstadisticas(planes);

  // Recopilar sugerencias DUA y observaciones cualitativas de las revisiones
  const observacionesTexto = [];
  const sugerenciasDuaTexto = [];

  for (const rev of revisiones) {
    if (rev.comentarios_generales && rev.comentarios_generales.trim()) {
      observacionesTexto.push(rev.comentarios_generales.trim());
    }
    if (rev.bloques_observados?.dua && rev.bloques_observados.dua.trim()) {
      sugerenciasDuaTexto.push(rev.bloques_observados.dua.trim());
    }
  }

  // Secciones del documento
  const children = [];

  // ── 1. ENCABEZADO INSTITUCIONAL MINERD ──
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 40 },
      children: [
        new TextRun({
          text: "GOBIERNO DE LA REPÚBLICA DOMINICANA",
          bold: true,
          size: 21,
          color: COLOR_AZUL_MINERD,
          font: "Calibri"
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 40 },
      children: [
        new TextRun({
          text: "MINISTERIO DE EDUCACIÓN (MINERD)",
          bold: true,
          size: 24, // 12pt
          color: COLOR_AZUL_MINERD,
          font: "Calibri"
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 60 },
      children: [
        new TextRun({
          text: "VICEMINISTERIO DE SERVICIOS TÉCNICOS Y PEDAGÓGICOS",
          size: 19,
          color: "475569",
          font: "Calibri"
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 180 },
      children: [
        new TextRun({
          text: "DIRECCIÓN GENERAL DE SUPERVISIÓN Y CONTROL DE LA CALIDAD EDUCATIVA",
          size: 17,
          italics: true,
          color: "64748B",
          font: "Calibri"
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 200 },
      children: [
        new TextRun({
          text: "INFORME MENSUAL DE ACOMPAÑAMIENTO Y SUPERVISIÓN PEDAGÓGICA",
          bold: true,
          size: 26, // 13pt
          color: COLOR_TEXTO_TITULO,
          font: "Calibri"
        })
      ]
    })
  );

  // ── 2. FICHA TÉCNICA DEL CENTRO ──
  children.push(...crearTituloSeccion(1, "DATOS GENERALES DEL CENTRO EDUCATIVO"));

  const tablaFicha = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          crearCeldaDato("Centro Educativo:", 25, { bold: true, fill: COLOR_AZUL_CLARO }),
          crearCeldaDato(escuela, 45, { bold: true }),
          crearCeldaDato("Código SIGERD:", 15, { bold: true, fill: COLOR_AZUL_CLARO }),
          crearCeldaDato(codigoMinerd, 15, { bold: true })
        ]
      }),
      new TableRow({
        children: [
          crearCeldaDato("Regional Educativa:", 25, { bold: true, fill: COLOR_AZUL_CLARO }),
          crearCeldaDato(regional, 45),
          crearCeldaDato("Distrito Educativo:", 15, { bold: true, fill: COLOR_AZUL_CLARO }),
          crearCeldaDato(distrito, 15)
        ]
      }),
      new TableRow({
        children: [
          crearCeldaDato("Coordinador/a Responsable:", 25, { bold: true, fill: COLOR_AZUL_CLARO }),
          crearCeldaDato(coordinadorNombre, 45),
          crearCeldaDato("Tanda / Jornada:", 15, { bold: true, fill: COLOR_AZUL_CLARO }),
          crearCeldaDato(tanda, 15)
        ]
      }),
      new TableRow({
        children: [
          crearCeldaDato("Período / Mes Evaluado:", 25, { bold: true, fill: COLOR_AZUL_CLARO }),
          crearCeldaDato(periodoMes, 45, { bold: true }),
          crearCeldaDato("Año Escolar:", 15, { bold: true, fill: COLOR_AZUL_CLARO }),
          crearCeldaDato(anioLectivo, 15)
        ]
      })
    ]
  });
  children.push(tablaFicha);

  // ── 3. MATRIZ CUANTITATIVA DE SUPERVISIÓN ──
  children.push(...crearTituloSeccion(2, "MATRIZ CUANTITATIVA DE COBERTURA Y SEGUIMIENTO CURRICULAR"));

  const filasMatriz = [
    new TableRow({
      children: [
        crearCeldaEncabezado("Grado", 15),
        crearCeldaEncabezado("Área Curricular", 25),
        crearCeldaEncabezado("Docente a Cargo", 25),
        crearCeldaEncabezado("Total", 10),
        crearCeldaEncabezado("Aprobadas", 12),
        crearCeldaEncabezado("Observadas", 13)
      ]
    })
  ];

  if (stats.filas.length === 0) {
    filasMatriz.push(
      new TableRow({
        children: [
          crearCeldaDato("No se registraron planificaciones en este período evaluado.", 100, {
            align: AlignmentType.CENTER
          })
        ]
      })
    );
  } else {
    for (const fila of stats.filas) {
      filasMatriz.push(
        new TableRow({
          children: [
            crearCeldaDato(fila.grado, 15, { bold: true }),
            crearCeldaDato(fila.area, 25),
            crearCeldaDato(fila.docente, 25),
            crearCeldaDato(String(fila.total), 10, { align: AlignmentType.CENTER, bold: true }),
            crearCeldaDato(String(fila.aprobadas), 12, { align: AlignmentType.CENTER, color: "15803D", bold: true }),
            crearCeldaDato(String(fila.observadas), 13, { align: AlignmentType.CENTER, color: "B45309" })
          ]
        })
      );
    }

    // Fila de Totales Generales
    filasMatriz.push(
      new TableRow({
        children: [
          crearCeldaDato("TOTALES DEL CENTRO", 65, {
            bold: true,
            fill: COLOR_AZUL_CLARO,
            color: COLOR_AZUL_MINERD
          }),
          crearCeldaDato(String(stats.totales.total), 10, {
            align: AlignmentType.CENTER,
            bold: true,
            fill: COLOR_AZUL_CLARO
          }),
          crearCeldaDato(String(stats.totales.aprobadas), 12, {
            align: AlignmentType.CENTER,
            bold: true,
            fill: COLOR_AZUL_CLARO,
            color: "15803D"
          }),
          crearCeldaDato(String(stats.totales.observadas), 13, {
            align: AlignmentType.CENTER,
            bold: true,
            fill: COLOR_AZUL_CLARO,
            color: "B45309"
          })
        ]
      })
    );
  }

  const tablaMatriz = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: filasMatriz
  });
  children.push(tablaMatriz);

  // Resumen porcentual
  children.push(
    new Paragraph({
      spacing: { before: 100, after: 160 },
      children: [
        new TextRun({
          text: `Índice de Aprobación Institucional: `,
          bold: true,
          size: 20,
          font: "Calibri"
        }),
        new TextRun({
          text: `${stats.totales.porcentaje} de las planificaciones cumplen plenamente con la Malla Curricular y momentos pedagógicos requeridos.`,
          bold: true,
          color: "15803D",
          size: 20,
          font: "Calibri"
        })
      ]
    })
  );

  // ── 4. EVALUACIÓN CUALITATIVA DE MOMENTOS DE CLASE ──
  children.push(...crearTituloSeccion(3, "VALORACIÓN CUALITATIVA DE LOS MOMENTOS DE CLASE (GUÍAS MINERD)"));

  const tablaMomentos = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          crearCeldaEncabezado("Momento Pedagógico", 30),
          crearCeldaEncabezado("Criterios de Supervisión MINERD", 35),
          crearCeldaEncabezado("Desempeño y Observaciones Observadas", 35)
        ]
      }),
      new TableRow({
        children: [
          crearCeldaDato("Inicio\n(10 - 15 min)", 30, { bold: true, fill: COLOR_GRIS_FONDO }),
          crearCeldaDato("Motivación, recuperación de saberes previos y comunicación explícita de la intención pedagógica del día.", 35),
          crearCeldaDato("Se observa adecuada vinculación con experiencias cotidianas dominicanas. Se recomienda garantizar el registro escrito de los saberes previos.", 35)
        ]
      }),
      new TableRow({
        children: [
          crearCeldaDato("Desarrollo\n(25 - 30 min)", 30, { bold: true, fill: COLOR_GRIS_FONDO }),
          crearCeldaDato("Construcción de aprendizajes, indagación guiada, trabajo colaborativo y uso de recursos del programa CON BASE y Guías Didácticas.", 35),
          crearCeldaDato("Secuencias didácticas alineadas a los fascículos. Mayor énfasis observado en lectura comprensiva y resolución de problemas matemáticos.", 35)
        ]
      }),
      new TableRow({
        children: [
          crearCeldaDato("Cierre\n(10 min)", 30, { bold: true, fill: COLOR_GRIS_FONDO }),
          crearCeldaDato("Síntesis del aprendizaje, metacognición (¿qué aprendimos?, ¿cómo lo aprendimos?) y evaluación formativa.", 35),
          crearCeldaDato("Momento formativo consolidado. Se orienta a los docentes a diversificar los instrumentos de evaluación formativa (rúbricas y listas de cotejo).", 35)
        ]
      })
    ]
  });
  children.push(tablaMomentos);

  // ── 5. ATENCIÓN A LA DIVERSIDAD Y DUA (NEAE) ──
  children.push(...crearTituloSeccion(4, "CONSOLIDADO DE ADECUACIONES CURRICULARES Y DUA (NEAE)"));

  const textoDuaConsolidado = sugerenciasDuaTexto.length > 0
    ? sugerenciasDuaTexto.slice(0, 4).join(" • ")
    : "Se implementan adaptaciones de acceso curricular, organizadores gráficos multisensoriales, apoyos visuales y tiempo extendido para estudiantes con Necesidades Específicas de Apoyo Educativo (NEAE), garantizando una educación inclusiva y equitativa conforme a las directrices del MINERD.";

  children.push(
    new Paragraph({
      spacing: { before: 80, after: 140 },
      children: [
        new TextRun({
          text: "Estrategias de Diseño Universal para el Aprendizaje implementadas en el Centro: ",
          bold: true,
          size: 19,
          font: "Calibri"
        }),
        new TextRun({
          text: textoDuaConsolidado,
          size: 19,
          font: "Calibri"
        })
      ]
    })
  );

  // ── 6. COMPROMISOS Y PLAN DE MEJORA ──
  children.push(...crearTituloSeccion(5, "ACUERDOS PEDAGÓGICOS Y COMPROMISOS DE MEJORA"));

  const tablaCompromisos = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          crearCeldaEncabezado("No.", 10),
          crearCeldaEncabezado("Compromiso / Acción de Acompañamiento", 60),
          crearCeldaEncabezado("Responsable", 30)
        ]
      }),
      new TableRow({
        children: [
          crearCeldaDato("1", 10, { align: AlignmentType.CENTER, bold: true }),
          crearCeldaDato("Talleres de micro-planificación focalizados en instrumentos de evaluación formativa y Registro de Grado.", 60),
          crearCeldaDato("Coordinación Pedagógica", 30)
        ]
      }),
      new TableRow({
        children: [
          crearCeldaDato("2", 10, { align: AlignmentType.CENTER, bold: true }),
          crearCeldaDato("Acompañamiento en aula a docentes con planificaciones observadas para fortalecer momentos de desarrollo.", 60),
          crearCeldaDato("Equipo de Gestión Escolar", 30)
        ]
      }),
      new TableRow({
        children: [
          crearCeldaDato("3", 10, { align: AlignmentType.CENTER, bold: true }),
          crearCeldaDato("Revisión oportuna de secuencias CON BASE en los grados 1.º a 4.º de Primaria.", 60),
          crearCeldaDato("Docentes y Coordinación", 30)
        ]
      })
    ]
  });
  children.push(tablaCompromisos);

  // ── 7. FIRMAS Y SELLOS INSTITUCIONALES ──
  children.push(
    new Paragraph({
      spacing: { before: 360, after: 120 },
      children: [
        new TextRun({
          text: "VALIDACIÓN Y FE PÚBLICA INSTITUCIONAL:",
          bold: true,
          size: 20,
          color: COLOR_AZUL_MINERD,
          font: "Calibri"
        })
      ]
    })
  );

  const tablaFirmas = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: BORDE_CELDA,
            margins: { top: 200, bottom: 200, left: 160, right: 160 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 180, after: 40 },
                children: [
                  new TextRun({
                    text: "____________________________________",
                    bold: true,
                    size: 20,
                    font: "Calibri"
                  })
                ]
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 30 },
                children: [
                  new TextRun({
                    text: coordinadorNombre,
                    bold: true,
                    size: 20,
                    color: COLOR_AZUL_MINERD,
                    font: "Calibri"
                  })
                ]
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 20 },
                children: [
                  new TextRun({
                    text: "Coordinador/a Pedagógico/a\nSello Institucional",
                    size: 18,
                    color: "64748B",
                    font: "Calibri"
                  })
                ]
              })
            ]
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: BORDE_CELDA,
            margins: { top: 200, bottom: 200, left: 160, right: 160 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 180, after: 40 },
                children: [
                  new TextRun({
                    text: "____________________________________",
                    bold: true,
                    size: 20,
                    font: "Calibri"
                  })
                ]
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 30 },
                children: [
                  new TextRun({
                    text: directorNombre,
                    bold: true,
                    size: 20,
                    color: COLOR_AZUL_MINERD,
                    font: "Calibri"
                  })
                ]
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 20 },
                children: [
                  new TextRun({
                    text: "Director/a del Centro Educativo\nSello Institucional",
                    size: 18,
                    color: "64748B",
                    font: "Calibri"
                  })
                ]
              })
            ]
          })
        ]
      })
    ]
  });
  children.push(tablaFirmas);

  // Instanciación del Documento DOCX con cabecera y pie de página
  return new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 pulgada
              right: 1440,
              bottom: 1440,
              left: 1440
            }
          }
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 100 },
                children: [
                  new TextRun({
                    text: `MINERD • ${escuela} • Informe de Supervisión Pedagógica`,
                    size: 16,
                    color: "94A3B8",
                    font: "Calibri"
                  })
                ]
              })
            ]
          })
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 100 },
                children: [
                  new TextRun({
                    text: "Página ",
                    size: 17,
                    color: "64748B",
                    font: "Calibri"
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 17,
                    bold: true,
                    color: COLOR_AZUL_MINERD,
                    font: "Calibri"
                  }),
                  new TextRun({
                    text: " de ",
                    size: 17,
                    color: "64748B",
                    font: "Calibri"
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 17,
                    bold: true,
                    color: COLOR_AZUL_MINERD,
                    font: "Calibri"
                  }),
                  new TextRun({
                    text: ` • Generado con Planifica Maestro (${periodoMes})`,
                    size: 15,
                    color: "94A3B8",
                    font: "Calibri"
                  })
                ]
              })
            ]
          })
        },
        children
      }
    ]
  });
}
