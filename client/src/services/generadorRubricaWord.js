/**
 * client/src/services/generadorRubricaWord.js
 * Generador canónico de Instrumentos de Evaluación Formativa y Rúbricas Analíticas
 * en formato Microsoft Word (.docx).
 * Basado en la Ordenanza 04-2023 y la Adecuación Curricular 2023 del MINERD.
 *
 * Características técnicas:
 * - Orientación A4 Horizontal (Landscape) para máxima legibilidad de los 4 niveles de dominio.
 * - Tabla estructurada con bordes nítidos, márgenes internos y encabezados contrastados.
 * - Soporte para Rúbrica Analítica de 4 niveles y Lista de Cotejo con pautas DUA.
 * - Cuadro balanceado de firmas institucionales.
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
import {
  buscarEnObjeto,
  extraerCriteriosEvaluacion,
  estructurarMatrizRubrica,
  estructurarListaCotejo
} from "./evaluacionUtils.js";

const COLOR_AZUL_FONDO = "CDEEF6";
const COLOR_AZUL_OSCURO = "0F4C81";
const COLOR_VERDE_FONDO = "DCFCE7";
const COLOR_VERDE_TEXTO = "166534";
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

function crearCelda({
  children = [],
  columnSpan = 1,
  shadingColor = null,
  widthPct = null,
  alignment = AlignmentType.LEFT
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
  }

  return new TableCell(props);
}

function crearParrafoTexto(texto, { bold = false, size = 19, color = COLOR_TEXTO_NORMAL, alignment = AlignmentType.LEFT, before = 30, after = 30 } = {}) {
  return new Paragraph({
    alignment,
    spacing: { before, after, line: 240 },
    children: [
      new TextRun({
        text: String(texto || "\u00A0"),
        bold,
        size,
        color,
        font: "Calibri"
      })
    ]
  });
}

function crearParrafoCampo(etiqueta, valor, { size = 20 } = {}) {
  const children = [];
  if (etiqueta) {
    children.push(
      new TextRun({
        text: `${etiqueta}: `,
        bold: true,
        size,
        color: COLOR_TEXTO_TITULO,
        font: "Calibri"
      })
    );
  }
  children.push(
    new TextRun({
      text: String(valor || "\u00A0"),
      bold: false,
      size,
      color: COLOR_TEXTO_NORMAL,
      font: "Calibri"
    })
  );

  return new Paragraph({
    spacing: { before: 40, after: 40, line: 240 },
    children
  });
}

/**
 * Construye el documento canónico DOCX de la Rúbrica o Instrumento de Evaluación
 */
export async function construirDocumentoRubricaOficial({
  plan = "",
  datos = null,
  perfil = null,
  tipoInstrumento = "rubrica_analitica",
  titulo = "Rúbrica de Evaluación Curricular"
} = {}) {
  let perfilActivo = perfil;
  if (!perfilActivo) {
    try {
      perfilActivo = cargarPerfil() || {};
    } catch {
      perfilActivo = {};
    }
  }

  const datosObj = (datos && typeof datos === "object") ? datos : {};

  // 1. Identificación curricular
  const docente =
    buscarEnObjeto(datosObj, ["docente", "profesor", "maestro"]) ||
    perfilActivo?.nombre ||
    "Docente";

  const centroEducativo =
    buscarEnObjeto(datosObj, ["centro educativo", "escuela", "institucion"]) ||
    perfilActivo?.escuela ||
    "Centro Educativo";

  const area =
    buscarEnObjeto(datosObj, ["area", "área", "asignatura", "materia"]) ||
    "Área Curricular";

  const grado =
    buscarEnObjeto(datosObj, ["grado", "curso"]) ||
    (Array.isArray(perfilActivo?.grados) ? perfilActivo.grados.join(", ") : perfilActivo?.grado) ||
    "Grado MINERD";

  const seccion =
    buscarEnObjeto(datosObj, ["seccion", "sección"]) ||
    perfilActivo?.seccion ||
    "A";

  const fecha =
    buscarEnObjeto(datosObj, ["fecha", "dia"]) ||
    new Date().toLocaleDateString("es-DO", { year: "numeric", month: "long", day: "numeric" });

  const tema =
    buscarEnObjeto(datosObj, ["secuencia", "tema", "actividad", "titulo"]) ||
    titulo ||
    "Secuencia Didáctica";

  // 2. Extraer criterios y estructurar instrumento
  const infoExtraida = extraerCriteriosEvaluacion(datosObj, plan);
  const criterios = infoExtraida.criterios;
  const adaptacionesDua = infoExtraida.adaptacionesDua;

  const filasTabla = [];

  // Fila 1: Encabezado Institucional MINERD (Colspan 5)
  filasTabla.push(
    new TableRow({
      children: [
        crearCelda({
          columnSpan: 5,
          shadingColor: COLOR_AZUL_FONDO,
          children: [
            crearParrafoTexto("MINISTERIO DE EDUCACIÓN DE LA REPÚBLICA DOMINICANA (MINERD)", {
              bold: true,
              size: 21,
              color: COLOR_AZUL_OSCURO,
              alignment: AlignmentType.CENTER,
              before: 60,
              after: 20
            }),
            crearParrafoTexto("DIRECCIÓN GENERAL DE CURRÍCULO — SISTEMA DE EVALUACIÓN DE LOS APRENDIZAJES", {
              bold: true,
              size: 19,
              color: COLOR_AZUL_OSCURO,
              alignment: AlignmentType.CENTER,
              before: 0,
              after: 20
            }),
            crearParrafoTexto(
              tipoInstrumento === "lista_cotejo"
                ? "LISTA DE COTEJO FORMATIVA — ADECUACIÓN CURRICULAR (ORDENANZA 04-2023)"
                : "RÚBRICA ANALÍTICA DE EVALUACIÓN POR COMPETENCIAS (ORDENANZA 04-2023)",
              {
                bold: true,
                size: 22,
                color: COLOR_TEXTO_TITULO,
                alignment: AlignmentType.CENTER,
                before: 0,
                after: 60
              }
            )
          ]
        })
      ]
    })
  );

  // Fila 2: Datos de Identificación (5 columnas)
  filasTabla.push(
    new TableRow({
      children: [
        crearCelda({ columnSpan: 2, widthPct: 40, children: [crearParrafoCampo("Centro Educativo", centroEducativo)] }),
        crearCelda({ columnSpan: 1, widthPct: 25, children: [crearParrafoCampo("Docente", docente)] }),
        crearCelda({ columnSpan: 1, widthPct: 20, children: [crearParrafoCampo("Grado y Sección", `${grado} "${seccion}"`)] }),
        crearCelda({ columnSpan: 1, widthPct: 15, children: [crearParrafoCampo("Fecha", fecha)] })
      ]
    })
  );

  // Fila 3: Área Curricular y Secuencia Temática
  filasTabla.push(
    new TableRow({
      children: [
        crearCelda({ columnSpan: 2, widthPct: 40, children: [crearParrafoCampo("Área Curricular", area)] }),
        crearCelda({ columnSpan: 3, widthPct: 60, children: [crearParrafoCampo("Unidad / Secuencia", tema)] })
      ]
    })
  );

  if (tipoInstrumento === "lista_cotejo") {
    // FORMATO LISTA DE COTEJO
    const itemsCotejo = estructurarListaCotejo(criterios, { adaptacionesDua });

    // Cabecera de la lista de cotejo
    filasTabla.push(
      new TableRow({
        children: [
          crearCelda({ columnSpan: 1, widthPct: 8, shadingColor: COLOR_AZUL_FONDO, children: [crearParrafoTexto("N.º", { bold: true, size: 20, alignment: AlignmentType.CENTER })] }),
          crearCelda({ columnSpan: 2, widthPct: 52, shadingColor: COLOR_AZUL_FONDO, children: [crearParrafoTexto("Indicador de Logro / Criterio Formativo", { bold: true, size: 20 })] }),
          crearCelda({ columnSpan: 1, widthPct: 20, shadingColor: COLOR_AZUL_FONDO, children: [crearParrafoTexto("Escala Valorativa", { bold: true, size: 20, alignment: AlignmentType.CENTER })] }),
          crearCelda({ columnSpan: 1, widthPct: 20, shadingColor: COLOR_AZUL_FONDO, children: [crearParrafoTexto("Pauta Inclusiva DUA / NEAE", { bold: true, size: 20 })] })
        ]
      })
    );

    // Filas de la lista de cotejo
    itemsCotejo.forEach((item) => {
      filasTabla.push(
        new TableRow({
          children: [
            crearCelda({ columnSpan: 1, widthPct: 8, children: [crearParrafoTexto(String(item.numero), { bold: true, alignment: AlignmentType.CENTER })] }),
            crearCelda({ columnSpan: 2, widthPct: 52, children: [crearParrafoTexto(item.indicador, { size: 19 })] }),
            crearCelda({
              columnSpan: 1,
              widthPct: 20,
              children: [
                crearParrafoTexto("[  ] Logrado (L)\n[  ] En Proceso (P)\n[  ] Iniciado (I)", { size: 18 })
              ]
            }),
            crearCelda({ columnSpan: 1, widthPct: 20, children: [crearParrafoTexto(item.ajusteDua, { size: 17, color: COLOR_VERDE_TEXTO })] })
          ]
        })
      );
    });
  } else {
    // FORMATO RÚBRICA ANALÍTICA (4 NIVELES ORDENANZA 04-2023)
    const matrizRubrica = estructurarMatrizRubrica(criterios, { area, adaptacionesDua });

    // Cabecera de 5 columnas: Criterio + 4 Niveles
    filasTabla.push(
      new TableRow({
        children: [
          crearCelda({ columnSpan: 1, widthPct: 24, shadingColor: COLOR_AZUL_FONDO, children: [crearParrafoTexto("Criterio e Indicador de Logro", { bold: true, size: 20 })] }),
          crearCelda({ columnSpan: 1, widthPct: 19, shadingColor: COLOR_VERDE_FONDO, children: [crearParrafoTexto("Destacado (D)\n[4 pts]", { bold: true, size: 19, color: COLOR_VERDE_TEXTO, alignment: AlignmentType.CENTER })] }),
          crearCelda({ columnSpan: 1, widthPct: 19, shadingColor: COLOR_AZUL_FONDO, children: [crearParrafoTexto("Logrado (L)\n[3 pts]", { bold: true, size: 19, color: COLOR_AZUL_OSCURO, alignment: AlignmentType.CENTER })] }),
          crearCelda({ columnSpan: 1, widthPct: 19, shadingColor: "FEF3C7", children: [crearParrafoTexto("En Proceso (P)\n[2 pts]", { bold: true, size: 19, color: "92400E", alignment: AlignmentType.CENTER })] }),
          crearCelda({ columnSpan: 1, widthPct: 19, shadingColor: "FEE2E2", children: [crearParrafoTexto("Incipiente (I)\n[1 pt]", { bold: true, size: 19, color: "991B1B", alignment: AlignmentType.CENTER })] })
        ]
      })
    );

    // Filas de criterios y descriptores
    matrizRubrica.forEach((item) => {
      filasTabla.push(
        new TableRow({
          children: [
            crearCelda({
              columnSpan: 1,
              widthPct: 24,
              children: [
                crearParrafoTexto(item.criterio, { bold: true, size: 19 }),
                crearParrafoTexto(item.indicador, { size: 18, color: COLOR_TEXTO_NORMAL }),
                crearParrafoTexto(item.observacionDua, { size: 16, color: COLOR_VERDE_TEXTO })
              ]
            }),
            crearCelda({ columnSpan: 1, widthPct: 19, children: [crearParrafoTexto(item.niveles.destacado.descriptor, { size: 18 })] }),
            crearCelda({ columnSpan: 1, widthPct: 19, children: [crearParrafoTexto(item.niveles.logrado.descriptor, { size: 18 })] }),
            crearCelda({ columnSpan: 1, widthPct: 19, children: [crearParrafoTexto(item.niveles.en_proceso.descriptor, { size: 18 })] }),
            crearCelda({ columnSpan: 1, widthPct: 19, children: [crearParrafoTexto(item.niveles.incipiente.descriptor, { size: 18 })] })
          ]
        })
      );
    });
  }

  // Fila de Cuadro de Firmas y Sello Institucional
  filasTabla.push(
    new TableRow({
      children: [
        crearCelda({
          columnSpan: 2,
          widthPct: 50,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 280, after: 20 },
              children: [new TextRun({ text: "________________________________________________", color: COLOR_BORDE, font: "Calibri" })]
            }),
            crearParrafoTexto(docente, { bold: true, size: 20, alignment: AlignmentType.CENTER }),
            crearParrafoTexto("Docente de Aula — Elaboración y Evaluación", { size: 18, alignment: AlignmentType.CENTER, after: 50 })
          ]
        }),
        crearCelda({
          columnSpan: 3,
          widthPct: 50,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 280, after: 20 },
              children: [new TextRun({ text: "________________________________________________", color: COLOR_BORDE, font: "Calibri" })]
            }),
            crearParrafoTexto("Coordinación Pedagógica / Dirección", { bold: true, size: 20, alignment: AlignmentType.CENTER }),
            crearParrafoTexto("Supervisión Curricular y Sello MINERD", { size: 18, alignment: AlignmentType.CENTER, after: 50 })
          ]
        })
      ]
    })
  );

  // Documento Word Landscape oficial con márgenes balanceados
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906,
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
            spacing: { before: 120 },
            children: [
              new TextRun({
                text: "Instrumento generado por Planifica Maestro — Currículo Dominicano MINERD (Ordenanza 04-2023)",
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
 * Función de descarga en navegador del instrumento de evaluación en Word
 */
export async function descargarRubricaWord({
  plan = "",
  datos = null,
  perfil = null,
  tipoInstrumento = "rubrica_analitica",
  titulo = "Rubrica_Evaluacion_MINERD"
} = {}) {
  const doc = await construirDocumentoRubricaOficial({
    plan,
    datos,
    perfil,
    tipoInstrumento,
    titulo
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const nombreLimpio = (titulo || "Rubrica_Evaluacion_MINERD")
    .replace(/[^\w\d\sáéíóúÁÉÍÓÚñÑ_-]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  const sufijo = tipoInstrumento === "lista_cotejo" ? "Lista_Cotejo" : "Rubrica";
  a.download = `${nombreLimpio}_${sufijo}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}
