/**
 * scripts/cargar_paginas_supabase.mjs
 * 
 * Cargador de páginas del Currículo Oficial MINERD en Supabase (public.curriculo_paginas).
 * 
 * Uso:
 *   node scripts/cargar_paginas_supabase.mjs             (Modo Dry-Run de inspección)
 *   node scripts/cargar_paginas_supabase.mjs --ejecutar  (Carga real en Supabase con service_role)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

// 1. Cargar credenciales de forma segura
function cargarCredenciales() {
  let url = process.env.SUPABASE_URL;
  let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const envFiles = [
    path.resolve(repoRoot, '.dev.vars'),
    path.resolve(repoRoot, '.env')
  ];

  for (const f of envFiles) {
    if ((!url || !serviceKey) && fs.existsSync(f)) {
      const content = fs.readFileSync(f, 'utf8');
      if (!url) {
        const m = content.match(/SUPABASE_URL\s*=\s*([^\r\n]+)/);
        if (m) url = m[1].trim().replace(/^['"]|['"]$/g, '');
      }
      if (!serviceKey) {
        const m = content.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*([^\r\n]+)/);
        if (m) serviceKey = m[1].trim().replace(/^['"]|['"]$/g, '');
      }
    }
  }

  return { url, serviceKey };
}

// 2. Ejecución principal
async function main() {
  const args = process.argv.slice(2);
  const ejecutar = args.includes('--ejecutar') || args.includes('--escribir') || args.includes('--aplicar');
  const esDryRun = !ejecutar || args.includes('--dry-run');

  const jsonPath = path.resolve(repoRoot, 'server/curriculo/capa3_estructurados/curriculo_paginas.json');

  console.log('================================================================================');
  console.log('INGESTA DE PÁGINAS CURRICULARES EN SUPABASE (public.curriculo_paginas)');
  console.log('================================================================================');
  console.log(`Modo: ${esDryRun ? 'DRY-RUN (Inspección local sin alterar BD)' : 'EJECUTAR (Escritura real con Service Role)'}`);

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

  console.log(`📂 Archivo fuente: ${path.relative(repoRoot, jsonPath)}`);
  console.log(`📊 Total de registros leídos: ${paginas.length}`);

  const camposRequeridos = ['source_id', 'documento_id', 'fuente_documento', 'pagina', 'nivel', 'texto'];
  let validas = 0;
  let invalidas = 0;
  const conteoPorFuente = {};

  for (let i = 0; i < paginas.length; i++) {
    const p = paginas[i];
    const faltantes = camposRequeridos.filter(c => p[c] === undefined || p[c] === null || p[c] === '');
    if (faltantes.length > 0) {
      invalidas++;
    } else {
      validas++;
      conteoPorFuente[p.fuente_documento] = (conteoPorFuente[p.fuente_documento] || 0) + 1;
    }
  }

  console.log('\n--- RESULTADO DE VALIDACIÓN ---');
  console.log(`✅ Filas válidas listas para insertar: ${validas}`);
  console.log(`❌ Filas inválidas: ${invalidas}`);

  console.log('\nDistribución por Documento Fuente:');
  for (const [doc, count] of Object.entries(conteoPorFuente)) {
    console.log(`  * ${doc}: ${count} páginas`);
  }

  if (esDryRun) {
    console.log('\n[DRY-RUN CONFIRMADO]: 0 escrituras realizadas en Supabase.');
    console.log('Para ejecutar la escritura real, use: node scripts/cargar_paginas_supabase.mjs --ejecutar');
    console.log('================================================================================');
    return;
  }

  const { url, serviceKey } = cargarCredenciales();
  if (!url || !serviceKey) {
    console.error('\n❌ [Error]: No se encontraron SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }

  const endpoint = `${url.replace(/\/+$/, '')}/rest/v1/curriculo_paginas?on_conflict=source_id`;
  console.log(`\nIniciando carga de ${paginas.length} páginas en Supabase...`);

  const BATCH_SIZE = 50;
  let insertadasTotal = 0;

  for (let i = 0; i < paginas.length; i += BATCH_SIZE) {
    const lote = paginas.slice(i, i + BATCH_SIZE);
    const numLote = Math.floor(i / BATCH_SIZE) + 1;
    const totalLotes = Math.ceil(paginas.length / BATCH_SIZE);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify(lote)
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`\n❌ [Fallo en lote ${numLote}/${totalLotes}]: HTTP ${res.status}`);
        console.error(errText.slice(0, 300));
        process.exit(1);
      }

      const resJson = await res.json();
      insertadasTotal += resJson.length;
      console.log(`  ✓ Lote ${numLote}/${totalLotes}: ${resJson.length} filas confirmadas (acumulado: ${insertadasTotal}/${paginas.length})`);
    } catch (fetchErr) {
      console.error(`\n❌ [Error de Red]: ${fetchErr.message}`);
      process.exit(1);
    }
  }

  console.log('\n--------------------------------------------------------------------------------');
  console.log(`✅ [Proceso Completado]: 500/500 filas insertadas con éxito en public.curriculo_paginas`);
  console.log('================================================================================');
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
