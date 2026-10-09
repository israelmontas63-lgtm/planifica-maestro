import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import AdmZip from 'adm-zip';

const rootDir = 'c:/Users/Win10/Desktop/planifica maestro/planifica-maestro';
const clientModuleUrl = pathToFileURL(path.join(rootDir, 'client/src/services/generadorWordConBase.js')).href;
const docxModuleUrl = pathToFileURL(path.join(rootDir, 'client/node_modules/docx/dist/index.cjs')).href;
const { construirDocumentoWordOficial } = await import(clientModuleUrl);
const { Packer } = await import(docxModuleUrl);

async function testMalformed() {
  console.log('=== INICIANDO PRUEBA DE GENERADOR CON ENTRADAS MALFORMADAS / INCOMPLETAS ===\n');

  // Caso extremo: valores nulos, vacíos, caracteres especiales, acentos, textos largos
  const planExtremo = {
    titulo: 'Plan con caracteres <especiales> & acentos: áéíóú ñ ¿¡ "comillas" ; y símbolos',
    area: null, // nulo
    grado: undefined, // indefinido
    grados: [], // vacío
    seccion: '', // vacío
    secuencia: 'Secuencia <Prueba> & Test; con tildes áéíóú',
    bloque: null,
    actividad: '',
    intencionPedagogica: 'Texto extremadamente largo '.repeat(30) + ' con caracteres & < > ; " y tildes á, é, í, ó, ú, ñ.',
    estrategias: null,
    competenciasFundamentales: 'Comunicativa',
    competenciasEspecificas: '',
    momentos: [
      {
        nombre: 'Momento 1: Inicio',
        descripcion: 'Descripción sin tiempo ni recursos con tildes y símbolos: < & > ;',
        tiempo: null, // falta tiempo
        recursos: '' // falta recursos
      },
      {
        nombre: 'Momento 2: Desarrollo',
        descripcion: 'Momento con texto muy largo. '.repeat(20),
        tiempo: '',
        recursos: null
      }
      // Solo 2 momentos proporcionados (el generador debe completar hasta 6 momentos)
    ],
    evaluacion: null, // sin eval
    actividadesDiferenciadas: undefined // sin diferenciada
  };

  const perfilExtremo = {
    nombre: null,
    escuela: '',
    regional: undefined,
    distrito: null,
    tanda: '',
    seccion: null
  };

  const doc = await construirDocumentoWordOficial({ datos: planExtremo, perfil: perfilExtremo, titulo: planExtremo.titulo });
  const buf = await Packer.toBuffer(doc);
  const testFile = path.join(rootDir, 'muestras_word', 'test_malformed_output.docx');
  fs.writeFileSync(testFile, buf);

  // Analizar el XML generado
  const zip = new AdmZip(testFile);
  const xml = zip.readAsText('word/document.xml');

  // Verificaciones requeridas:
  // 1. Cero "undefined"
  const countUndefined = (xml.match(/undefined/gi) || []).length;
  // 2. Cero "---"
  const countDashes = (xml.match(/---/g) || []).length;
  // 3. Cero mojibake (Ã, etc.)
  const countMojibake = (xml.match(/Ã[\x80-\xBF]/g) || []).length;
  // 4. Cero celdas vacías en w:tc (cada w:tc debe tener al menos un w:p con texto o w:r)
  // Comprobación de celdas vacías mediante regex de w:tc sin contenido w:t
  const tcRegex = /<w:tc>(?:(?!<\/w:tc>)[\s\S])*?<\/w:tc>/g;
  let matches = xml.match(tcRegex) || [];
  let emptyTcCount = 0;
  for (const tc of matches) {
    if (!/<w:t[^>]*>[^<]+<\/w:t>/.test(tc)) {
      emptyTcCount++;
    }
  }

  console.log(`- Recuento de "undefined": ${countUndefined}`);
  console.log(`- Recuento de "---": ${countDashes}`);
  console.log(`- Recuento de mojibake (Ã): ${countMojibake}`);
  console.log(`- Recuento de celdas vacías sin texto: ${emptyTcCount}`);

  // Verificar presencia de 6 momentos en el documento
  const momentosEncontrados = (xml.match(/Momento \d/g) || []).length;
  console.log(`- Referencias a momentos encontradas en XML: ${momentosEncontrados} (debe cubrir los 6 momentos)`);

  const passed = countUndefined === 0 && countDashes === 0 && countMojibake === 0 && emptyTcCount === 0;
  console.log('\nRESULTADO DE PRUEBA MALFORMADA:', passed ? 'VERIFICADO' : 'FALLIDO');

  if (!passed) {
    process.exit(1);
  }
}

testMalformed().catch(err => {
  console.error('Error en test malformed:', err);
  process.exit(1);
});
