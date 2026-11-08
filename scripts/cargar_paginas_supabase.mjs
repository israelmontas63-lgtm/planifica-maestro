/**
 * scripts/cargar_paginas_supabase.mjs
 * 
 * Script de carga de páginas curriculares en modo DRY-RUN.
 * Lee server/curriculo/capa3_estructurados/curriculo_paginas.json,
 * valida los campos obligatorios y muestra cuántas filas insertaría sin escribir nada.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const jsonPath = path.resolve(repoRoot, 'server/curriculo/capa3_estructurados/curriculo_paginas.json');

console.log('================================================================================');
console.log('DRY-RUN: CARGA DE PÁGINAS CURRICULARES EN SUPABASE');
console.log('================================================================================');

if (!fs.existsSync(jsonPath)) {
  console.error(`❌ Archivo no encontrado: ${jsonPath}`);
  process.exit(1);
}

const rawData = fs.readFileSync(jsonPath, 'utf8');
let paginas;
try {
  paginas = JSON.parse(rawData);
} catch (err) {
  console.error(`❌ Error al parsear JSON: ${err.message}`);
  process.exit(1);
}

console.log(`📂 Archivo leído: ${path.relative(repoRoot, jsonPath)}`);
console.log(`📊 Total de registros leídos: ${paginas.length}`);

const camposRequeridos = ['source_id', 'documento_id', 'fuente_documento', 'pagina', 'nivel', 'texto'];
let validas = 0;
let invalidas = 0;
const conteoPorFuente = {};
const conteoPorGrado = {};
const errores = [];

for (let i = 0; i < paginas.length; i++) {
  const p = paginas[i];
  const faltantes = camposRequeridos.filter(c => p[c] === undefined || p[c] === null || p[c] === '');
  
  if (faltantes.length > 0) {
    invalidas++;
    errores.push(`Fila ${i} (source_id: ${p.source_id || 'N/A'}): Faltan campos [${faltantes.join(', ')}]`);
  } else {
    validas++;
    conteoPorFuente[p.fuente_documento] = (conteoPorFuente[p.fuente_documento] || 0) + 1;
    const gradoKey = p.grado_num ? `Grado ${p.grado_num}` : 'Sin grado específico';
    conteoPorGrado[gradoKey] = (conteoPorGrado[gradoKey] || 0) + 1;
  }
}

console.log('\n--- RESULTADO DE VALIDACIÓN ---');
console.log(`✅ Filas válidas listas para insertar: ${validas}`);
console.log(`❌ Filas inválidas: ${invalidas}`);

if (errores.length > 0) {
  console.log('Muestra de errores:');
  errores.slice(0, 5).forEach(e => console.log(`  - ${e}`));
}

console.log('\nDistribución por Documento Fuente:');
for (const [doc, count] of Object.entries(conteoPorFuente)) {
  console.log(`  * ${doc}: ${count} páginas`);
}

console.log('\nDistribución por Grado:');
for (const [gr, count] of Object.entries(conteoPorGrado)) {
  console.log(`  * ${gr}: ${count} páginas`);
}

console.log('\n[DRY-RUN CONFIRMADO]: 0 escrituras realizadas en Supabase.');
console.log('================================================================================');
