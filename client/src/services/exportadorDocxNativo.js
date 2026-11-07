/**
 * client/src/services/exportadorDocxNativo.js
 * Exportador nativo de planificación curricular a formato Microsoft Word (.docx).
 * 100% ejecutado en el cliente (navegador web) sin consumir recursos de servidor.
 * Genera la plantilla oficial del MINERD bajo el esquema del programa "CON BASE".
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

const COLOR_AZUL_ENCABEZADO = "CDEEF6";
const COLOR_BORDE = "94A3B8";
const COLOR_TEXTO_TITULO = "0F172A";
const COLOR_TEXTO_NORMAL = "1E293B";
const COLOR_GRIS_CLARO = "F8FAFC";

const BORDE_CELDA = {
  top: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDE },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDE },
  left: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDE },
  right: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDE }
};

const MARGEN_CELDA = {
  top: 120,
  bottom: 120,
  left: 150,
  right: 150
};

/**
 * Genera y descarga directamente en el navegador el archivo .docx de la planificación
 * @param {Object} params
 * @param {Object} params.matriz - Estructura parseada por parsearMatrizPlanificacion
 * @param {string} [params.titulo] - Título o nombre base del archivo
 * @param {Object} [params.perfil] - Datos del perfil docente
 * @returns {Promise<boolean>} true si se descargó exitosamente
 */
export async function exportarDocxNativo({
  matriz,
  titulo = "Planificacion_MINERD_CON_BASE",
  perfil = null
}) {
  if (!matriz) {
    throw new Error("No hay datos de matriz de planificación para exportar.");
  }

  const metadatos = matriz.metadatos || {};
  const nombreDocente = perfil?.nombre || metadatos.docente || "Docente Titular";
  const centroEducativo = perfil?.centro || metadatos.centro || "Escuela Básica MINERD";
  const areaCurricular = metadatos.area || "Lengua Española";
  const temaClase = metadatos.tema || "Clase Curricular";
  const gradoClase = metadatos.grado || "1.° y 2.° Primaria";
  const tiempoTotal = metadatos.tiempo || "45 minutos";

  // 1. Crear documento Word
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE,
              width: 16838, // A4 Horizontal
              height: 11906
            },
            margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 }
          }
        },
        children: [
          // Título principal
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: "MINISTERIO DE EDUCACIÓN DE LA REPÚBLICA DOMINICANA (MINERD)",
                bold: true,
                size: 26,
                font: "Calibri",
                color: COLOR_TEXTO_TITULO
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [
              new TextRun({
                text: "MATRIZ DE PLANIFICACIÓN DIDÁCTICA — MODELO CON BASE",
                bold: true,
                size: 22,
                font: "Calibri",
                color: "2563EB"
              })
            ]
          }),

          // Tabla 1: Metadatos Administrativos y Curriculares
          crearTablaMetadatos({
            nombreDocente,
            centroEducativo,
            areaCurricular,
            temaClase,
            gradoClase,
            tiempoTotal
          }),

          new Paragraph({ spacing: { after: 200 } }),

          // Tabla 2: Matriz de los 3 Momentos Didácticos
          crearTablaMomentosDidacticos(matriz),

          new Paragraph({ spacing: { after: 200 } }),

          // Pie institucional
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 200 },
            children: [
              new TextRun({
                text: "Validado bajo los lineamientos curriculares oficiales del MINERD y el programa CON BASE. ",
                size: 18,
                italics: true,
                color: "64748B"
              }),
              new TextRun({
                text: "Planifica Maestro — Sistema de Gestión y Planificación Docente.",
                size: 18,
                bold: true,
                color: "2563EB"
              })
            ]
          })
        ]
      }
    ]
  });

  // 2. Empaquetar a Blob y disparar descarga nativa
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const nombreLimpio = (titulo || `Planificacion_${temaClase}`)
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

function crearTablaMetadatos({
  nombreDocente,
  centroEducativo,
  areaCurricular,
  temaClase,
  gradoClase,
  tiempoTotal
}) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          celdaHeader("Centro Educativo:", 20),
          celdaValor(centroEducativo, 30),
          celdaHeader("Docente:", 20),
          celdaValor(nombreDocente, 30)
        ]
      }),
      new TableRow({
        children: [
          celdaHeader("Área Curricular:", 20),
          celdaValor(areaCurricular, 30),
          celdaHeader("Grado / Nivel:", 20),
          celdaValor(gradoClase, 30)
        ]
      }),
      new TableRow({
        children: [
          celdaHeader("Tema de la Clase:", 20),
          celdaValor(temaClase, 30),
          celdaHeader("Tiempo Estimado:", 20),
          celdaValor(tiempoTotal, 30)
        ]
      })
    ]
  });
}

function crearTablaMomentosDidacticos(matriz) {
  const filas = [];

  // Encabezado de la Matriz
  filas.push(
    new TableRow({
      children: [
        celdaHeader("Momento Didáctico", 25, true),
        celdaHeader("Tiempo", 15, true),
        celdaHeader("Estrategias, Actividades y Tramos CON BASE", 60, true)
      ]
    })
  );

  // Fila Momento: INICIO
  filas.push(
    new TableRow({
      children: [
        celdaValorBold("Inicio (Activación & Saberes Previos)", 25, COLOR_GRIS_CLARO),
        celdaValor(matriz.inicio?.tiempo || "10 min", 15),
        celdaParrafos(matriz.inicio?.puntos || [matriz.inicio?.contenido || ""], 60)
      ]
    })
  );

  // Fila Momento: DESARROLLO con Tramos CON BASE
  const parrafosDesarrollo = [];
  if (matriz.desarrollo?.tramos && matriz.desarrollo.tramos.length > 0) {
    for (const tramo of matriz.desarrollo.tramos) {
      parrafosDesarrollo.push(`【${tramo.badgeEtiqueta}】`);
      parrafosDesarrollo.push(...tramo.puntos);
    }
  } else {
    parrafosDesarrollo.push(...(matriz.desarrollo?.puntos || [matriz.desarrollo?.contenido || ""]));
  }

  filas.push(
    new TableRow({
      children: [
        celdaValorBold("Desarrollo (Secuencia CON BASE)", 25, COLOR_GRIS_CLARO),
        celdaValor(matriz.desarrollo?.tiempo || "25 min", 15),
        celdaParrafos(parrafosDesarrollo, 60)
      ]
    })
  );

  // Fila Momento: CIERRE
  filas.push(
    new TableRow({
      children: [
        celdaValorBold("Cierre (Evaluación & Metacognición)", 25, COLOR_GRIS_CLARO),
        celdaValor(matriz.cierre?.tiempo || "10 min", 15),
        celdaParrafos(matriz.cierre?.puntos || [matriz.cierre?.contenido || ""], 60)
      ]
    })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: filas
  });
}

function celdaHeader(texto, porcentajeAncho, sombreado = false) {
  return new TableCell({
    width: { size: porcentajeAncho, type: WidthType.PERCENTAGE },
    borders: BORDE_CELDA,
    margins: MARGEN_CELDA,
    shading: sombreado ? { fill: COLOR_AZUL_ENCABEZADO, type: ShadingType.CLEAR } : undefined,
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            bold: true,
            size: 20,
            font: "Calibri",
            color: COLOR_TEXTO_TITULO
          })
        ]
      })
    ]
  });
}

function celdaValor(texto, porcentajeAncho) {
  return new TableCell({
    width: { size: porcentajeAncho, type: WidthType.PERCENTAGE },
    borders: BORDE_CELDA,
    margins: MARGEN_CELDA,
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: String(texto || ""),
            size: 20,
            font: "Calibri",
            color: COLOR_TEXTO_NORMAL
          })
        ]
      })
    ]
  });
}

function celdaValorBold(texto, porcentajeAncho, fondo = null) {
  return new TableCell({
    width: { size: porcentajeAncho, type: WidthType.PERCENTAGE },
    borders: BORDE_CELDA,
    margins: MARGEN_CELDA,
    shading: fondo ? { fill: fondo, type: ShadingType.CLEAR } : undefined,
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: String(texto || ""),
            bold: true,
            size: 20,
            font: "Calibri",
            color: COLOR_TEXTO_TITULO
          })
        ]
      })
    ]
  });
}

function celdaParrafos(lineas = [], porcentajeAncho) {
  const parrafos = lineas.map((linea) => {
    const esTituloTramo = linea.startsWith("【") && linea.endsWith("】");
    return new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: esTituloTramo ? linea : `• ${linea}`,
          bold: esTituloTramo,
          color: esTituloTramo ? "1D4ED8" : COLOR_TEXTO_NORMAL,
          size: 19,
          font: "Calibri"
        })
      ]
    });
  });

  return new TableCell({
    width: { size: porcentajeAncho, type: WidthType.PERCENTAGE },
    borders: BORDE_CELDA,
    margins: MARGEN_CELDA,
    children: parrafos.length > 0 ? parrafos : [new Paragraph({ text: "" })]
  });
}
