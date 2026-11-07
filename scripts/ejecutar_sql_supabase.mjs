/**
 * scripts/ejecutar_sql_supabase.mjs
 * 
 * Ejecutor administrativo de DDL / SQL en Supabase Management API.
 * Uso:
 *   node scripts/ejecutar_sql_supabase.mjs <ruta_archivo.sql>
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function cargarConfiguracion() {
  let projectRef = process.env.SUPABASE_PROJECT_REF || 'obcjdxearmmvtihfmtaa';
  let accessToken = process.env.SUPABASE_ACCESS_TOKEN;

  const devVarsPath = path.resolve(repoRoot, '.dev.vars');
  if (fs.existsSync(devVarsPath)) {
    const content = fs.readFileSync(devVarsPath, 'utf8');
    if (!accessToken) {
      const m = content.match(/SUPABASE_ACCESS_TOKEN\s*=\s*([^\r\n]+)/);
      if (m) accessToken = m[1].trim().replace(/^['"]|['"]$/g, '');
    }
    const mRef = content.match(/SUPABASE_PROJECT_REF\s*=\s*([^\r\n]+)/);
    if (mRef) projectRef = mRef[1].trim().replace(/^['"]|['"]$/g, '');
  }

  // Respaldo directo autorizado si no se encuentra en variables
  if (!accessToken) {
    accessToken = process.env.SUPABASE_ACCESS_TOKEN || '';
  }

  return { projectRef, accessToken };
}

async function main() {
  const args = process.argv.slice(2);
  const sqlFileArg = args.find(a => !a.startsWith('--'));

  if (!sqlFileArg) {
    console.error('❌ Uso: node scripts/ejecutar_sql_supabase.mjs <archivo.sql>');
    process.exit(1);
  }

  const sqlPath = path.isAbsolute(sqlFileArg) ? sqlFileArg : path.resolve(repoRoot, sqlFileArg);
  if (!fs.existsSync(sqlPath)) {
    console.error(`❌ Archivo SQL no encontrado: ${sqlPath}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(sqlPath, 'utf8');
  const { projectRef, accessToken } = cargarConfiguracion();

  console.log('================================================================================');
  console.log('EJECUTOR ADMINISTRATIVO DE DDL EN SUPABASE (Management API)');
  console.log('================================================================================');
  console.log(`Proyecto: ${projectRef}`);
  console.log(`Archivo SQL: ${path.relative(repoRoot, sqlPath)} (${sqlContent.length} caracteres)`);

  const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

  console.log('\nEnviando consulta SQL a Supabase Management API...');
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sqlContent })
  });

  const status = res.status;
  const resText = await res.text();

  if (res.ok) {
    console.log(`✅ [Éxito]: HTTP ${status} OK`);
    try {
      const json = JSON.parse(resText);
      console.log('Respuesta:', JSON.stringify(json, null, 2));
    } catch {
      console.log('Respuesta:', resText);
    }
    console.log('\n================================================================================');
    console.log('Esquema DDL aplicado satisfactoriamente en Supabase.');
    console.log('================================================================================');
  } else {
    console.error(`❌ [Error]: HTTP ${status}`);
    console.error(resText);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
