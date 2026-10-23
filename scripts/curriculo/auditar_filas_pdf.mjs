// Uso: node scripts/curriculo/auditar_filas_pdf.mjs [salida.tsv]
// Mide cuánto del texto de cada fila nueva aparece en las páginas del PDF (ventanas de 4 palabras) y detecta el desfase de páginas.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFParse } from 'pdf-parse'; // si la importación falla, copia la de scripts/curriculo/extraer_por_columnas.mjs

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
for (const nombre of ['.dev.vars', '.env']) {
  const p = path.join(RAIZ, nombre);
  if (!fs.existsSync(p)) continue;
  for (const linea of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(linea);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const URL_SB = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const CLAVE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
if (!URL_SB || !CLAVE) { console.error('Faltan variables (solo nombres): SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY o SUPABASE_ANON_KEY'); process.exit(2); }

const PDFS = {
  ciclo1: path.join(RAIZ, 'server/conocimiento/minerd/diseno_curricular_primaria_primer_ciclo_1_a_3.pdf'),
  ciclo2: path.join(RAIZ, 'fuentes_curriculo/diseno_curricular_primaria_segundo_ciclo_4_a_6.pdf'),
};
const cache = {};
async function paginas(ciclo) {
  if (!cache[ciclo]) {
    const parser = new PDFParse({ data: fs.readFileSync(PDFS[ciclo]) });
    const res = await parser.getText();
    cache[ciclo] = res.pages.map((p) => p.text ?? ''); // se ASUME pages[i] = página i+1 del archivo; la tabla de muestra lo verifica
  }
  return cache[ciclo];
}

const norm = (t) => String(t ?? '').replace(/-\s*\n\s*/g, '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const ventanas = (t, n = 4) => { const w = norm(t).split(' ').filter(Boolean); const s = []; for (let i = 0; i + n <= w.length; i++) s.push(w.slice(i, i + n).join(' ')); return s; };
function cobertura(campo, texto) {
  const v = ventanas(campo);
  if (!v.length) return null;
  const set = new Set(ventanas(texto));
  let ok = 0;
  for (const x of v) if (set.has(x)) ok++;
  return ok / v.length;
}
const pct = (x) => (x == null ? '-' : (x * 100).toFixed(1));

const sel = 'source_id,grado_num,area,tema,pagina,competencias_especificas,contenidos_texto_original,indicadores_logro,estado_validacion';
const r = await fetch(`${URL_SB}/rest/v1/curriculo_secuencias?select=${sel}&order=source_id.asc&limit=1000`, { headers: { apikey: CLAVE, Authorization: `Bearer ${CLAVE}` } });
if (!r.ok) { console.error('REST falló: HTTP ' + r.status); process.exit(1); }
const filas = (await r.json()).filter((f) => /^SEC-PRI-(?:[456]-|[123]-(?:SOC|NAT)-)/.test(f.source_id));
console.log(`Filas nuevas leídas: ${filas.length}`);

// Muestra del mapa página-de-archivo -> número impreso
for (const [ciclo, desde, hasta] of [['ciclo1', 274, 279], ['ciclo2', 122, 127]]) {
  const pg = await paginas(ciclo);
  console.log(`\n[${ciclo}] total de páginas: ${pg.length}`);
  for (let p = desde; p <= hasta; p++) {
    const imp = /^\s*(\d{1,3})\s*\n/.exec(pg[p - 1] ?? '')?.[1] ?? '?';
    console.log(`  archivo ${p} → impreso ${imp} | ${JSON.stringify((pg[p - 1] ?? '').slice(0, 50))}`);
  }
}

const cab = ['source_id', 'pagina_db', 'impreso_1a_pag', 'shift_mejor', 'comp_s0', 'cont_s0', 'ind_s0', 'comp_best', 'cont_best', 'ind_best', 'plantilla'].join('\t');
const salida = [cab];
const histo = {};
let ok0 = 0, okBest = 0;
const PLANT = /Desarrolla el pensamiento cr[ií]tico, resoluci[oó]n de problemas|Contenidos conceptuales, procedimentales y actitudinales de/;
for (const f of filas) {
  const ciclo = f.grado_num <= 3 ? 'ciclo1' : 'ciclo2';
  const pg = await paginas(ciclo);
  const [i0, j0] = String(f.pagina ?? '').split('-').map((x) => parseInt(x, 10));
  if (!Number.isFinite(i0)) { salida.push(`${f.source_id}\t${f.pagina}\tSIN PÁGINA`); continue; }
  const ini = i0, fin = Number.isFinite(j0) ? j0 : i0;
  const campos = {
    comp: f.competencias_especificas ?? '',
    cont: f.contenidos_texto_original ?? '',
    ind: Array.isArray(f.indicadores_logro) ? f.indicadores_logro.join(' ') : String(f.indicadores_logro ?? ''),
  };
  const medir = (s) => {
    const a = Math.max(1, ini + s), b = Math.min(pg.length, fin + s);
    const texto = pg.slice(a - 1, b).join('\n');
    return { comp: cobertura(campos.comp, texto), cont: cobertura(campos.cont, texto), ind: cobertura(campos.ind, texto) };
  };
  const puntaje = (m) => (m.comp ?? 0) + (m.cont ?? 0) + (m.ind ?? 0);
  let mejor = { s: 0, m: medir(0) };
  const m0 = mejor.m;
  for (let s = -3; s <= 3; s++) {
    if (s === 0) continue;
    const m = medir(s);
    if (puntaje(m) > puntaje(mejor.m) + 1e-9) mejor = { s, m };
  }
  const ok = (m) => ['comp', 'cont', 'ind'].every((k) => m[k] == null || m[k] >= 0.95);
  if (ok(m0)) ok0++;
  if (ok(mejor.m)) okBest++;
  histo[mejor.s] = (histo[mejor.s] ?? 0) + 1;
  const impreso = /^\s*(\d{1,3})\s*\n/.exec(pg[ini - 1] ?? '')?.[1] ?? '?';
  const plantilla = PLANT.test(campos.comp + ' ' + campos.cont) ? 'SÍ' : 'NO';
  salida.push([f.source_id, f.pagina, impreso, mejor.s, pct(m0.comp), pct(m0.cont), pct(m0.ind), pct(mejor.m.comp), pct(mejor.m.cont), pct(mejor.m.ind), plantilla].join('\t'));
}
console.log('\n' + salida.join('\n'));
console.log(`\nFilas con los 3 campos ≥95 % en la página de la base (shift 0): ${ok0}`);
console.log(`Filas con los 3 campos ≥95 % en el mejor desfase: ${okBest}`);
console.log('Histograma del mejor desfase (shift: filas): ' + JSON.stringify(histo));
if (process.argv[2]) fs.writeFileSync(process.argv[2], salida.join('\n'), 'utf8');
