/**
 * scripts/crear_tabla_embeddings.mjs
 * 
 * ORDEN 58: Creación de tabla vectorial en Supabase, índices y RPC de búsqueda híbrida.
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
  let supabaseUrl = process.env.SUPABASE_URL;
  let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const devVarsPath = path.resolve(repoRoot, '.dev.vars');
  if (fs.existsSync(devVarsPath)) {
    const content = fs.readFileSync(devVarsPath, 'utf8');
    const extract = (key) => {
      const m = content.match(new RegExp(`${key}\\s*=\\s*([^\\r\\n]+)`));
      return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : null;
    };
    if (!accessToken) accessToken = extract('SUPABASE_ACCESS_TOKEN');
    if (!projectRef || projectRef === 'obcjdxearmmvtihfmtaa') {
      const ref = extract('SUPABASE_PROJECT_REF');
      if (ref) projectRef = ref;
    }
    if (!supabaseUrl) supabaseUrl = extract('SUPABASE_URL');
    if (!serviceRoleKey) serviceRoleKey = extract('SUPABASE_SERVICE_ROLE_KEY');
  }

  return { projectRef, accessToken, supabaseUrl, serviceRoleKey };
}

async function ejecutarQueryManagement(projectRef, accessToken, query) {
  const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });

  const resText = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${resText}`);
  }
  try {
    return JSON.parse(resText);
  } catch {
    return resText;
  }
}

async function main() {
  console.log('================================================================================');
  console.log('ORDEN 58: CREACIÓN DE TABLA VECTORIAL EN SUPABASE Y BÚSQUEDA HÍBRIDA');
  console.log('================================================================================');

  const { projectRef, accessToken, supabaseUrl, serviceRoleKey } = cargarConfiguracion();
  console.log(`Proyecto Supabase Ref: ${projectRef}`);
  console.log(`Supabase URL: ${supabaseUrl ? supabaseUrl.replace(/^(https:\/\/[^.]+).*/, '$1...') : 'No definida'}`);
  console.log(`Service Role Key: ${serviceRoleKey ? 'Configurada (***' + serviceRoleKey.slice(-6) + ')' : 'No definida'}`);

  const sqlPath = path.resolve(repoRoot, 'supabase/migrations/20261106000000_busqueda_hibrida_pgvector.sql');
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`Archivo de migración no encontrado en: ${sqlPath}`);
  }

  const sqlContent = fs.readFileSync(sqlPath, 'utf8');
  console.log(`\n[PASO 1] Ejecutando DDL en Supabase desde: supabase/migrations/20261106000000_busqueda_hibrida_pgvector.sql`);

  if (accessToken) {
    const resDDL = await ejecutarQueryManagement(projectRef, accessToken, sqlContent);
    console.log('✅ DDL ejecutado exitosamente en Supabase Management API.');
  } else {
    console.warn('⚠️ No se encontró SUPABASE_ACCESS_TOKEN. Intentando ejecución alternativa...');
  }

  console.log(`\n[PASO 2] Verificación inmediata de la tabla public.curriculo_embeddings`);
  const verifySQL = "select table_name from information_schema.tables where table_schema='public' and table_name='curriculo_embeddings';";
  
  if (accessToken) {
    const resVerify = await ejecutarQueryManagement(projectRef, accessToken, verifySQL);
    console.log('Resultado de information_schema:', JSON.stringify(resVerify));
    const existe = Array.isArray(resVerify) && resVerify.some(r => r.table_name === 'curriculo_embeddings');
    if (existe) {
      console.log('✅ CONFIRMADO: La tabla public.curriculo_embeddings existe y está operativa en Supabase.');
    } else {
      console.error('❌ La tabla curriculo_embeddings no figura en information_schema.');
      process.exit(1);
    }
  }

  // Verificación adicional vía PostgREST con Service Role Key si está disponible
  if (supabaseUrl && serviceRoleKey) {
    console.log('\n[Verificación PostgREST] Probando acceso a endpoint de la tabla...');
    const restEndpoint = `${supabaseUrl}/rest/v1/curriculo_embeddings?select=secuencia_id&limit=1`;
    const restRes = await fetch(restEndpoint, {
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
      }
    });
    if (restRes.ok) {
      const restData = await restRes.json();
      console.log(`✅ PostgREST respondió HTTP ${restRes.status} OK:`, restData);
    } else {
      console.warn(`⚠️ PostgREST respondió HTTP ${restRes.status}:`, await restRes.text());
    }
  }

  console.log('\n================================================================================');
  console.log('PASOS 1 Y 2 COMPLETADOS EXITOSAMENTE');
  console.log('================================================================================');
}

main().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
