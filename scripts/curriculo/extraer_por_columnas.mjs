/**
 * scripts/curriculo/extraer_por_columnas.mjs
 * 
 * Extractor de secuencias curriculares oficiales por coordenadas de columnas con pdfjs:
 * Columna 1: Competencia(s) específica(s)
 * Columna 2: Contenidos (Conceptos, Procedimientos, Actitudes y valores)
 * Columna 3: Indicadores de logro
 * 
 * Cumple con Autorización 017: cero relleno, cero texto inventado.
 */

import fs from 'node:fs';
import path from 'node:path';
import { PDFParse } from 'file:///C:/Users/Win10/Desktop/planifica maestro/planifica-maestro/node_modules/pdf-parse/dist/pdf-parse/esm/index.js';

const repoRoot = path.resolve('c:/Users/Win10/Desktop/planifica maestro/planifica-maestro');
const jsonV1Path = path.resolve(repoRoot, 'scripts/curriculo/salida/nuevas_secuencias.json');
const jsonV2Path = path.resolve(repoRoot, 'scripts/curriculo/salida/nuevas_secuencias_v2.json');

const pdfSegundoPath = path.resolve(repoRoot, 'fuentes_curriculo/diseno_curricular_primaria_segundo_ciclo_4_a_6.pdf');
const pdfPrimerPath = path.resolve(repoRoot, 'server/conocimiento/minerd/diseno_curricular_primaria_primer_ciclo_1_a_3.pdf');

function deshiphenate(txt) {
  if (!txt || typeof txt !== 'string') return '';
  return txt.replace(/(\w+)-\s*\n\s*(\w+)/g, '$1$2').replace(/-\s*\n\s*/g, '');
}

async function cargarPdf(pdfPath) {
  const buf = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: buf });
  await parser.load();
  return parser;
}

export async function extraerPorColumnas() {
  console.log('📖 Cargando PDFs oficiales...');
  const parserSegundo = await cargarPdf(pdfSegundoPath);
  const parserPrimer = await cargarPdf(pdfPrimerPath);

  const rawRows = JSON.parse(fs.readFileSync(jsonV1Path, 'utf8'));
  console.log(`Filas a procesar: ${rawRows.length}`);

  const v2Rows = [];
  const reporteFilas = [];

  for (const r of rawRows) {
    const isPrimer = r.ciclo === 'Primer Ciclo' || r.grado_num <= 3;
    const parser = isPrimer ? parserPrimer : parserSegundo;

    const paginasRango = r.pagina.split('-').map(s => parseInt(s.trim(), 10));
    const pagInicio = paginasRango[0];
    const pagFin = paginasRango[1] || pagInicio;

    // Cubrir el rango impreso y el offset de páginas del PDF
    const pdfMin = pagInicio;
    const pdfMax = Math.min(pagFin + 2, parser.doc.numPages);

    let col1ItemsAll = [];
    let col2ItemsAll = [];
    let col3ItemsAll = [];
    let encabezadoValido = false;
    let motivoFallo = null;

    // Buscar páginas con contenido de tabla en el rango
    for (let pNum = pdfMin; pNum <= pdfMax; pNum++) {
      const page = await parser.doc.getPage(pNum);
      const textContent = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1 });

      const items = textContent.items
        .filter(it => it.str && it.str.trim().length > 0)
        .map(it => {
          const pt = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
          return { str: it.str.trim(), x: Math.round(pt[0]), y: Math.round(pt[1]), w: Math.round(it.width) };
        });

      // Si es página en blanco o separador de sección (muy poco texto), saltar
      if (items.length < 15) continue;

      // Detectar encabezado de grado
      const pageText = items.map(i => i.str).join(' ');
      const gradoRegex = new RegExp(`${r.grado_num}(?:ro|do|to|mo|ero|\\.°|\\.o|\\s*grado)`, 'i');
      if (gradoRegex.test(pageText)) {
        encabezadoValido = true;
      }

      // Evitar páginas que pertenezcan a otra área curricular
      const areaMatch = pageText.match(/Área:\s*([^Nivel\n\r]+)/i);
      if (areaMatch) {
        const foundArea = areaMatch[1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        const targetArea = r.area.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        if (!targetArea.includes(foundArea) && !foundArea.includes(targetArea.slice(0, 8))) {
          continue;
        }
      }

      // Límites de columna calibrados por ciclo para el diseño MINERD:
      const split1 = isPrimer ? 138 : 145;
      const split2 = isPrimer ? 428 : 388;

      const hCont = items.find(i => /^Contenidos$/i.test(i.str));
      const minY = hCont ? hCont.y + 12 : 110;

      // Filtrar encabezados y metadatos
      const bodyItems = items.filter(it => {
        if (it.y < minY) return false;
        if (/^(?:Competencia\(s\)|espec[ií]fica\(s\)|Contenidos|Indicadores(?:\s+de(?:\s+logro)?)?)$/i.test(it.str)) return false;
        if (/^\d{1,3}$/.test(it.str) && (it.x < 100 || it.x > 500)) return false;
        if (/^Área:|^Nivel Primario/i.test(it.str)) return false;
        return true;
      });

      for (const it of bodyItems) {
        if (it.x < split1) {
          col1ItemsAll.push(it.str);
        } else if (it.x >= split1 && it.x < split2) {
          col2ItemsAll.push(it.str);
        } else {
          col3ItemsAll.push(it.str);
        }
      }
    }

    // Procesar texto de columna 1 (Competencias específicas)
    let compExt = col1ItemsAll.join(' ').replace(/\s+/g, ' ').trim();
    compExt = deshiphenate(compExt);
    compExt = compExt.replace(/\b(?:Competencia\(s\)\s*)?espec[ií]fica\(s\)\s*/gi, ' ').trim();

    // Procesar texto de columna 2 (Contenidos)
    let contExt = col2ItemsAll.join(' ').replace(/\s+/g, ' ').trim();
    contExt = deshiphenate(contExt);
    contExt = contExt.replace(/^Contenidos\s*/i, '').trim();

    // Procesar texto de columna 3 (Indicadores de logro)
    let rawIndStr = col3ItemsAll.join(' ').replace(/\s+/g, ' ').trim();
    rawIndStr = deshiphenate(rawIndStr);
    rawIndStr = rawIndStr.replace(/^Indicadores\s*de\s*logro\s*/i, '').trim();

    // Separar indicadores por viñeta "-" o "." seguido de mayúscula
    const indArr = rawIndStr
      .split(/(?:^|\s)[-•]\s*|(?<=\.)\s+(?=[A-ZÁÉÍÓÚ])/)
      .map(s => s.trim())
      .filter(s => s.length > 15 && !/^Continúa|^Indicadores/i.test(s));

    // Determinar si la extracción es válida y no vacía
    const compValida = compExt.length >= 25 && !compExt.includes('Desarrolla el pensamiento crítico, resolución de problemas');
    const contValida = contExt.length >= 20 && !contExt.includes('Contenidos conceptuales, procedimentales y actitudinales de');
    const indValidos = indArr.length > 0;

    let regla = 'b';
    if (compValida && contValida && indValidos) {
      regla = 'a';
    } else {
      if (!compValida) motivoFallo = 'Competencias específicas no detectadas o vacías';
      else if (!contValida) motivoFallo = 'Contenidos no detectados o vacíos';
      else if (!indValidos) motivoFallo = 'Sin indicadores de logro válidos';
    }

    const nuevaFila = {
      ...r,
      competencias_especificas: regla === 'a' ? compExt : r.competencias_especificas,
      contenidos_texto_original: regla === 'a' ? contExt : null,
      indicadores_logro: regla === 'a' ? indArr : r.indicadores_logro,
      estado_validacion: regla === 'a' ? 'pendiente_validacion' : 'requiere_revision_fuente',
      _regla: regla,
      _motivoFallo: motivoFallo,
      _encabezadoValido: encabezadoValido
    };

    v2Rows.push(nuevaFila);
    reporteFilas.push({
      source_id: r.source_id,
      grado: r.grado_num,
      area: r.area,
      pagina: r.pagina,
      regla,
      motivoFallo,
      encabezadoValido,
      compLen: compExt.length,
      contLen: contExt.length,
      indCount: indArr.length
    });
  }

  // Ensure directory exists
  fs.mkdirSync(path.dirname(jsonV2Path), { recursive: true });
  fs.writeFileSync(jsonV2Path, JSON.stringify(v2Rows, null, 2), 'utf8');
  console.log(`\n✅ Extracción completada. Guardada en: ${jsonV2Path}`);

  const reglaA = reporteFilas.filter(x => x.regla === 'a');
  const reglaB = reporteFilas.filter(x => x.regla === 'b');
  console.log(`Filas Regla (a) [Aprobadas para actualización]: ${reglaA.length}`);
  console.log(`Filas Regla (b) [requiere_revision_fuente]: ${reglaB.length}`);

  if (reglaB.length > 0) {
    console.log('\nLista de filas Regla (b):');
    reglaB.forEach(b => console.log(`  - [${b.source_id}] Grado ${b.grado} ${b.area} (pág ${b.pagina}): ${b.motivoFallo}`));
  }

  return { v2Rows, reporteFilas, reglaA, reglaB };
}

if (process.argv[1] && process.argv[1].includes('extraer_por_columnas.mjs')) {
  extraerPorColumnas().catch(console.error);
}
