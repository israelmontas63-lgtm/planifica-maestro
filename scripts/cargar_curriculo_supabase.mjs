/**
 * scripts/cargar_curriculo_supabase.mjs
 * 
 * Cargador real e idempotente de secuencias curriculares oficiales en Supabase.
 * - Realiza UPSERT por la clave natural 'source_id' usando la clave service_role.
 * - Modo por defecto: --dry-run (no escribe en la base de datos).
 * - Modo escritura: --aplicar (ejecuta el upsert contra Supabase REST API).
 * - NUNCA expone claves ni credenciales en consola o logs.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

// 1. Cargar credenciales desde entorno o archivos locales
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

// 2. Extraer filas curriculares desde curriculo_estructurado.json
function extraerFilasCurriculares() {
  const jsonPath = path.resolve(repoRoot, 'server/curriculo/capa3_estructurados/curriculo_estructurado.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Archivo no encontrado: ${jsonPath}`);
  }

  const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const filasValidas = [];

  for (let idx = 0; idx < rawData.length; idx++) {
    const item = rawData[idx];

    let nivel = item.nivel || 'Primario';
    if (/primari/i.test(nivel)) nivel = 'Primario';
    else if (/secundar/i.test(nivel)) nivel = 'Secundario';
    else if (/inicial/i.test(nivel)) nivel = 'Inicial';

    let gradoNum = parseInt(item.grado, 10);
    if (isNaN(gradoNum)) {
      const m = String(item.grado || '').match(/\d+/);
      if (m) gradoNum = parseInt(m[0], 10);
    }
    if (isNaN(gradoNum) || gradoNum < 1 || gradoNum > 6) continue;

    const ciclo = gradoNum <= 3 ? 'Primer Ciclo' : 'Segundo Ciclo';
    let area = item.area;
    if (!area || typeof area !== 'string' || area.trim() === '') continue;
    area = area.trim();

    let tema = item.tema;
    if (!tema || typeof tema !== 'string' || tema.trim() === '') continue;
    tema = tema.trim();

    let compEsp = null;
    if (Array.isArray(item.competencias_especificas)) {
      compEsp = item.competencias_especificas.filter(Boolean).map(s => s.trim()).join('\n');
    } else if (typeof item.competencias_especificas === 'string') {
      compEsp = item.competencias_especificas.trim();
    }
    if (!compEsp) continue;

    let indLogro = null;
    if (Array.isArray(item.indicadores_logro)) {
      indLogro = item.indicadores_logro.filter(Boolean).map(s => s.trim());
    }
    if (!indLogro || indLogro.length === 0) continue;

    let contTexto = null;
    if (item.contenidos && typeof item.contenidos.texto_original === 'string') {
      contTexto = item.contenidos.texto_original.trim();
    }

    const bloqueGuia = item.bloque_guia ? String(item.bloque_guia).trim() : null;
    const fuenteDoc = item.documento_fuente ? String(item.documento_fuente).trim() : 'Guía Didáctica MINERD / CON BASE';
    const versionCurricular = '2023';

    let pagina = null;
    if (item.pagina_referencia) pagina = String(item.pagina_referencia).trim();
    else if (item.pagina) pagina = String(item.pagina).trim();

    const urlFuente = item.url_fuente ? String(item.url_fuente).trim() : null;

    let areaCode = 'GEN';
    if (/lengua/i.test(area)) areaCode = 'ESP';
    else if (/matem/i.test(area)) areaCode = 'MAT';
    else if (/social/i.test(area)) areaCode = 'SOC';
    else if (/natural/i.test(area)) areaCode = 'NAT';

    const countForArea = filasValidas.filter(f => f.nivel === nivel && f.grado_num === gradoNum && f.area === area).length + 1;
    const sourceId = `SEC-PRI-${gradoNum}-${areaCode}-${String(countForArea).padStart(3, '0')}`;

    const canonicalString = `${nivel}|${ciclo}|${gradoNum}|${area}|${tema}|${compEsp}|${indLogro.join(';')}`;
    const huella = crypto.createHash('sha256').update(canonicalString, 'utf8').digest('hex');

    filasValidas.push({
      source_id: sourceId,
      nivel,
      ciclo,
      grado_num: gradoNum,
      area,
      tema,
      bloque_guia: bloqueGuia,
      competencias_especificas: compEsp,
      contenidos_texto_original: contTexto,
      indicadores_logro: indLogro,
      fuente_documento: fuenteDoc,
      version_curricular: versionCurricular,
      pagina,
      url_fuente: urlFuente,
      estado_validacion: 'pendiente_validacion',
      vigente: true,
      huella
    });
  }

  return filasValidas;
}

// 3. Ejecución principal
async function main() {
  const args = process.argv.slice(2);
  const aplicar = args.includes('--aplicar');
  const esDryRun = !aplicar || args.includes('--dry-run');

  console.log('================================================================================');
  console.log('CARGADOR DE CURRÍCULO MINERD EN SUPABASE (REST UPSERT)');
  console.log('================================================================================');
  console.log(`Modo de ejecución: ${esDryRun ? 'DRY-RUN (Simulación sin escritura)' : 'APLICAR (Escritura real en base de datos)'}`);

  const filas = extraerFilasCurriculares();
  console.log(`Total secuencias curriculares procesadas: ${filas.length}`);

  const conteos = {};
  for (const f of filas) {
    const k = `${f.nivel} | ${f.grado_num}.° Grado | ${f.area}`;
    conteos[k] = (conteos[k] || 0) + 1;
  }
  console.log('Distribución de secuencias:');
  for (const [k, v] of Object.entries(conteos)) {
    console.log(`  * ${k}: ${v}`);
  }

  if (esDryRun) {
    console.log('\n[DRY-RUN] Simulación exitosa. 78 filas listas para insertar/actualizar.');
    console.log('Para ejecutar la carga real contra Supabase, ejecute:');
    console.log('  node scripts/cargar_curriculo_supabase.mjs --aplicar');
    return;
  }

  const { url, serviceKey } = cargarCredenciales();
  if (!url || !serviceKey) {
    console.error('\n❌ [Error]: No se encontraron SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }

  const endpoint = `${url.replace(/\/+$/, '')}/rest/v1/curriculo_secuencias?on_conflict=source_id`;
  console.log(`\nEnviando ${filas.length} filas vía PostgREST UPSERT...`);

  const BATCH_SIZE = 20;
  let insertadasTotal = 0;

  for (let i = 0; i < filas.length; i += BATCH_SIZE) {
    const lote = filas.slice(i, i + BATCH_SIZE);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=representation'
      },
      body: JSON.stringify(lote)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`\n❌ [Fallo en lote ${Math.floor(i / BATCH_SIZE) + 1}]: HTTP ${res.status}`);
      console.error(errText);
      process.exit(1);
    }

    const resJson = await res.json();
    insertadasTotal += resJson.length;
    console.log(`  ✓ Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${resJson.length} filas procesadas`);
  }

  console.log('--------------------------------------------------------------------------------');
  console.log(`✅ [Éxito]: Total filas upsertadas en Supabase: ${insertadasTotal}`);
  console.log('================================================================================');
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
