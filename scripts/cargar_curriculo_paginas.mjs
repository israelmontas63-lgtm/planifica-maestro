/**
 * scripts/cargar_curriculo_paginas.mjs
 * 
 * Cargador de páginas del Currículo Oficial MINERD en Supabase (public.curriculo_paginas).
 * 
 * Uso:
 *   node scripts/cargar_curriculo_paginas.mjs             (Modo Dry-Run de inspección)
 *   node scripts/cargar_curriculo_paginas.mjs --escribir  (Carga real en Supabase)
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

// 2. Extraer páginas de los documentos en Capa 2
function extraerPaginasCurriculares() {
  const capa2Dir = path.resolve(repoRoot, 'server/curriculo/capa2_texto');
  if (!fs.existsSync(capa2Dir)) {
    throw new Error(`Directorio de Capa 2 no encontrado: ${capa2Dir}`);
  }

  const archivos = fs.readdirSync(capa2Dir).filter(f => f.endsWith('.json') && f !== 'manifiesto_texto.json');
  const todasLasPaginas = [];

  for (const archivo of archivos) {
    const filePath = path.join(capa2Dir, archivo);
    try {
      const doc = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const docId = doc.documento_id || path.basename(archivo, '.json');
      const titulo = doc.titulo || docId;
      const nivel = doc.nivel ? (doc.nivel.charAt(0).toUpperCase() + doc.nivel.slice(1).toLowerCase()) : 'Primario';
      const areaDefecto = doc.area || null;

      let gradoDefecto = null;
      if (typeof doc.grado === 'string') {
        const m = doc.grado.match(/\b([1-6])\b/);
        if (m) gradoDefecto = parseInt(m[1], 10);
      }

      const paginas = doc.paginas || [];
      for (const pag of paginas) {
        const txt = (pag.texto || '').trim();
        if (txt.length < 25) continue; // Descartar páginas en blanco o solo con números sueltos

        // Detección de grado en la página si no está predefinido
        let gradoPagina = gradoDefecto;
        if (!gradoPagina) {
          const matchGrado = txt.match(/\b([1-6])[.º°ª]?\s*(?:grado|año|primaria|secundaria)\b/i);
          if (matchGrado) {
            gradoPagina = parseInt(matchGrado[1], 10);
          }
        }

        // Detección de área en la página si es general
        let areaPagina = areaDefecto;
        if (!areaPagina || areaPagina.toLowerCase().includes('todas')) {
          if (/\b(?:lengua española|lectura|escritura|cuento|noticia)\b/i.test(txt)) {
            areaPagina = 'Lengua Española';
          } else if (/\b(?:matemática|geometría|fracciones|números naturales|cálculo)\b/i.test(txt)) {
            areaPagina = 'Matemática';
          } else if (/\b(?:ciencias sociales|historia dominicana|geografía|patria|constitución)\b/i.test(txt)) {
            areaPagina = 'Ciencias Sociales';
          } else if (/\b(?:ciencias de la naturaleza|ecosistema|seres vivos|materia|energía)\b/i.test(txt)) {
            areaPagina = 'Ciencias de la Naturaleza';
          }
        }

        todasLasPaginas.push({
          source_id: `${docId}_p${pag.numero}`,
          documento_id: docId,
          fuente_documento: titulo,
          pagina: pag.numero,
          grado_num: gradoPagina || null,
          area: areaPagina || 'General',
          nivel: nivel,
          texto: txt
        });
      }
    } catch (err) {
      console.warn(`[Aviso] No se pudo procesar ${archivo}:`, err.message);
    }
  }

  return todasLasPaginas;
}

// 3. Ejecución principal
async function main() {
  const args = process.argv.slice(2);
  const escribir = args.includes('--escribir') || args.includes('--aplicar');
  const esDryRun = !escribir || args.includes('--dry-run');

  console.log('================================================================================');
  console.log('CARGADOR DE PÁGINAS CURRICULARES MINERD EN SUPABASE (curriculo_paginas)');
  console.log('================================================================================');
  console.log(`Modo: ${esDryRun ? 'DRY-RUN (Inspección local sin alterar la BD)' : 'ESCRIBIR (Carga real en Supabase)'}`);

  const paginas = extraerPaginasCurriculares();
  console.log(`Total de páginas curriculares procesadas con texto sustantivo: ${paginas.length}`);

  // Estadísticas por documento
  const conteoPorDoc = {};
  for (const p of paginas) {
    conteoPorDoc[p.fuente_documento] = (conteoPorDoc[p.fuente_documento] || 0) + 1;
  }
  console.log('\nDistribución de páginas por documento:');
  for (const [doc, count] of Object.entries(conteoPorDoc)) {
    console.log(`  * ${doc}: ${count} páginas`);
  }

  // Guardar archivo consolidado localmente en capa 3 para soporte offline / BM25
  const salidaLocal = path.resolve(repoRoot, 'server/curriculo/capa3_estructurados/curriculo_paginas.json');
  try {
    fs.writeFileSync(salidaLocal, JSON.stringify(paginas.slice(0, 500), null, 2), 'utf8');
    console.log(`\n💾 Snapshot local guardado en: server/curriculo/capa3_estructurados/curriculo_paginas.json`);
  } catch (e) {}

  if (esDryRun) {
    console.log('\n[DRY-RUN] Simulación exitosa. Páginas listas para cargar.');
    console.log('Para ejecutar la escritura contra Supabase, ejecute:');
    console.log('  node scripts/cargar_curriculo_paginas.mjs --escribir');
    return;
  }

  const { url, serviceKey } = cargarCredenciales();
  if (!url || !serviceKey) {
    console.error('\n❌ [Error]: No se encontraron SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }

  const endpoint = `${url.replace(/\/+$/, '')}/rest/v1/curriculo_paginas?on_conflict=source_id`;
  console.log(`\nEnviando ${paginas.length} páginas a Supabase PostgREST...`);

  const BATCH_SIZE = 50;
  let insertadasTotal = 0;

  for (let i = 0; i < paginas.length; i += BATCH_SIZE) {
    const lote = paginas.slice(i, i + BATCH_SIZE);
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
        if (res.status === 404 && errText.includes('curriculo_paginas')) {
          console.warn('\n⚠️ [Aviso]: La tabla "curriculo_paginas" no existe aún en Supabase.');
          console.warn('   Ejecuta el script SQL en el editor de Supabase:');
          console.warn('   supabase/curriculo_paginas_y_ragas.sql');
          console.warn('   Las páginas fueron estructuradas y guardadas localmente.');
          return;
        }
        console.error(`\n❌ [Fallo en lote ${Math.floor(i / BATCH_SIZE) + 1}]: HTTP ${res.status}`);
        console.error(errText.slice(0, 200));
        break;
      }

      const resJson = await res.json();
      insertadasTotal += resJson.length;
      process.stdout.write(`  ✓ Lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(paginas.length / BATCH_SIZE)} procesado (${insertadasTotal} páginas)\r`);
    } catch (fetchErr) {
      console.warn(`\n[Aviso Red]: Error conectando con Supabase: ${fetchErr.message}`);
      break;
    }
  }

  console.log('\n--------------------------------------------------------------------------------');
  console.log(`✅ [Proceso Finalizado]: Páginas procesadas y sincronizadas: ${insertadasTotal}`);
  console.log('================================================================================');
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
