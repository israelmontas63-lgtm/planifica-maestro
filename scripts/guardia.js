import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

/**
 * scripts/guardia.js
 * Sistema Automatizado de Guardia y Protección de Integridad Inmutable.
 * - Compara los hashes criptográficos SHA-256 de cada archivo protegido contra PROTEGIDO.hashes.json.
 * - Validación por ruta relativa normalizada completa (SIN coincidencia por nombre base).
 * - Soporte para hashes autorizados explícitos en AUTORIZACIONES.md.
 * - Auto-vigilancia de scripts/guardia.js, PROTEGIDO.hashes.json y AUTORIZACIONES.md contra git HEAD.
 * - Comando sellar (node scripts/guardia.js --sellar) para actualizar hashes protegidos con firma y fecha.
 */

export function normalizarRuta(p) {
  if (!p) return '';
  return p.replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

export function cargarAutorizaciones(cwd = process.cwd()) {
  const rutaAuth = path.resolve(cwd, 'AUTORIZACIONES.md');
  const autorizados = new Map(); // rutaNorm -> { hashes: Set<string>, autorizaciones: string[] }
  if (!fs.existsSync(rutaAuth)) return autorizados;

  const contenido = fs.readFileSync(rutaAuth, 'utf8');
  const lineas = contenido.split('\n');

  let currentAuthId = null;
  let currentComponentes = [];
  let currentHashes = new Map(); // ruta -> hash

  function flush() {
    if (currentComponentes.length > 0) {
      for (const comp of currentComponentes) {
        const norm = normalizarRuta(comp);
        if (!norm) continue;
        if (!autorizados.has(norm)) {
          autorizados.set(norm, { hashes: new Set(), autorizaciones: [] });
        }
        const entry = autorizados.get(norm);
        if (currentAuthId && !entry.autorizaciones.includes(currentAuthId)) {
          entry.autorizaciones.push(currentAuthId);
        }
        if (currentHashes.has(norm)) {
          entry.hashes.add(currentHashes.get(norm));
        }
      }
    }
    currentComponentes = [];
    currentHashes = new Map();
  }

  for (const l of lineas) {
    const authHeader = l.match(/^###\s+Autorización\s+(\w+)/i);
    if (authHeader) {
      flush();
      currentAuthId = authHeader[1];
      continue;
    }

    const matchComp = l.match(/\*\*Componentes?:\*\*\s*(.+)$/i);
    if (matchComp) {
      const raw = matchComp[1].replace(/`/g, '');
      const items = raw.split(/,|\by\b|\be\b/).map(s => s.trim()).filter(Boolean);
      currentComponentes.push(...items);
      continue;
    }

    const matchSingleHash = l.match(/\*\*Hash:\*\*\s*`?([a-f0-9]{64})`?/i);
    if (matchSingleHash && currentComponentes.length === 1) {
      const norm = normalizarRuta(currentComponentes[0]);
      currentHashes.set(norm, matchSingleHash[1].toLowerCase());
      continue;
    }

    const matchPathHash = l.match(/[-*]?\s*`?([^:`\s]+)`?:\s*`?([a-f0-9]{64})`?/i);
    if (matchPathHash) {
      const norm = normalizarRuta(matchPathHash[1]);
      currentHashes.set(norm, matchPathHash[2].toLowerCase());
    }
  }
  flush();

  return autorizados;
}

export function verificarAutoVigilancia(cwd = process.cwd(), autorizados = null) {
  if (!autorizados) autorizados = cargarAutorizaciones(cwd);
  const fallos = [];

  try {
    const out = execSync('git diff --name-only HEAD -- scripts/guardia.js PROTEGIDO.hashes.json AUTORIZACIONES.md', {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();

    if (out) {
      const modificados = out.split('\n').map(s => normalizarRuta(s)).filter(Boolean);
      for (const mod of modificados) {
        if (mod === 'AUTORIZACIONES.md') {
          try {
            const diffAuth = execSync('git diff -U0 HEAD -- AUTORIZACIONES.md', {
              cwd,
              encoding: 'utf8',
              stdio: ['pipe', 'pipe', 'pipe']
            });
            const lineasEliminadas = diffAuth.split('\n').filter(l => l.startsWith('-') && !l.startsWith('---'));
            const tocoHistorico = lineasEliminadas.some(l => /Autorización\s+00[1-9]|Autorización\s+010/i.test(l));
            if (tocoHistorico) {
              fallos.push(`AUTORIZACIONES.md fue alterado en autorizaciones históricas protegidas.`);
            }
          } catch (e) {}
          continue;
        }

        if (!autorizados.has(mod)) {
          fallos.push(`${mod} fue modificado respecto a git HEAD sin estar registrado formalmente en AUTORIZACIONES.md`);
        }
      }
    }
  } catch (e) {}

  return fallos;
}

export function verificarGuardia({ cwd = process.cwd(), verbose = true } = {}) {
  const rutaHashes = path.resolve(cwd, 'PROTEGIDO.hashes.json');
  if (!fs.existsSync(rutaHashes)) {
    if (verbose) console.error('❌ [Guardia] ERROR FATAL: No se encontró PROTEGIDO.hashes.json.');
    return false;
  }

  let config;
  try {
    config = JSON.parse(fs.readFileSync(rutaHashes, 'utf8'));
  } catch (e) {
    if (verbose) console.error('❌ [Guardia] ERROR FATAL: PROTEGIDO.hashes.json corrupto o inválido:', e.message);
    return false;
  }

  const autorizados = cargarAutorizaciones(cwd);
  const hashes = config.hashes || {};
  let fallos = 0;
  let correctos = 0;
  let autorizadosModificados = 0;

  const autoFallos = verificarAutoVigilancia(cwd, autorizados);
  if (autoFallos.length > 0) {
    for (const f of autoFallos) {
      if (verbose) console.error(`🚨 [Guardia] VIOLACIÓN DE AUTO-VIGILANCIA: ${f}`);
      fallos++;
    }
  }

  if (verbose) console.log(`🛡️ [Guardia] Verificando integridad de ${Object.keys(hashes).length} archivos protegidos...`);

  for (const [archivoRel, hashEsperado] of Object.entries(hashes)) {
    const rutaNorm = normalizarRuta(archivoRel);
    const rutaAbs = path.resolve(cwd, rutaNorm);

    if (!fs.existsSync(rutaAbs)) {
      if (autorizados.has(rutaNorm)) {
        if (verbose) console.warn(`⚠️ [Guardia] Archivo ausente pero autorizado en AUTORIZACIONES.md: ${rutaNorm}`);
        autorizadosModificados++;
        continue;
      }
      if (verbose) console.error(`❌ [Guardia] VIOLACIÓN: Archivo protegido eliminado o no encontrado: ${rutaNorm}`);
      fallos++;
      continue;
    }

    const contenido = fs.readFileSync(rutaAbs);
    const hashActual = crypto.createHash('sha256').update(contenido).digest('hex');

    if (hashActual === hashEsperado) {
      correctos++;
    } else {
      if (autorizados.has(rutaNorm)) {
        const authInfo = autorizados.get(rutaNorm);
        if (authInfo.hashes && authInfo.hashes.size > 0) {
          if (authInfo.hashes.has(hashActual)) {
            if (verbose) console.log(`ℹ️ [Guardia] Archivo modificado bajo autorización formal con hash verificado: ${rutaNorm}`);
            autorizadosModificados++;
          } else {
            if (verbose) {
              console.error(`🚨 [Guardia] VIOLACIÓN CRÍTICA DE HASH AUTORIZADO:`);
              console.error(`   Archivo: ${rutaNorm}`);
              console.error(`   Hash Actual:     ${hashActual}`);
              console.error(`   Hash Autorizado: ${[...authInfo.hashes].join(', ')}`);
              console.error(`   Motivo: El hash del archivo no coincide con el SHA-256 registrado en AUTORIZACIONES.md.`);
            }
            fallos++;
          }
        } else {
          if (verbose) console.log(`ℹ️ [Guardia] Archivo modificado bajo autorización formal: ${rutaNorm}`);
          autorizadosModificados++;
        }
      } else {
        if (verbose) {
          console.error(`🚨 [Guardia] VIOLACIÓN CRÍTICA DE INTEGRIDAD:`);
          console.error(`   Archivo: ${rutaNorm}`);
          console.error(`   Hash Esperado: ${hashEsperado.substring(0, 16)}...`);
          console.error(`   Hash Actual:   ${hashActual.substring(0, 16)}...`);
          console.error(`   Motivo de Bloqueo: Ruta no registrada en AUTORIZACIONES.md.`);
        }
        fallos++;
      }
    }
  }

  if (fallos > 0) {
    if (verbose) {
      console.error(`\n❌ [Guardia] BLOQUEO: Se detectaron ${fallos} violaciones.`);
      console.error(`   Regla Única: Lo que ya funciona no se toca ni se altera.`);
      console.error(`   Para autorizar un cambio, debe registrarse formalmente en AUTORIZACIONES.md.\n`);
    }
    return false;
  }

  if (verbose) console.log(`✅ [Guardia] Integridad verificada al 100%: ${correctos} intactos, ${autorizadosModificados} autorizados, 0 violaciones.\n`);
  return true;
}

export function sellarGuardia(cwd = process.cwd()) {
  const rutaHashes = path.resolve(cwd, 'PROTEGIDO.hashes.json');
  if (!fs.existsSync(rutaHashes)) {
    throw new Error('No se encontró PROTEGIDO.hashes.json para sellar.');
  }

  const config = JSON.parse(fs.readFileSync(rutaHashes, 'utf8'));
  const hashes = config.hashes || {};

  const adicionales = [
    'client/vite.config.js',
    'client/src/utils/parseadorJsonSeguro.js',
    'scripts/prueba_real_gemini.mjs'
  ];
  for (const ad of adicionales) {
    if (fs.existsSync(path.resolve(cwd, ad)) && !hashes[ad]) {
      hashes[ad] = '';
    }
  }

  let commit = 'HEAD';
  try {
    commit = execSync('git rev-parse --short HEAD', { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch (e) {}

  const nuevosHashes = {};
  const ordenados = Object.keys(hashes).sort();

  for (const rel of ordenados) {
    const rutaNorm = normalizarRuta(rel);
    const rutaAbs = path.resolve(cwd, rutaNorm);
    if (!fs.existsSync(rutaAbs)) {
      console.warn(`⚠️ [Sellar] Archivo protegido no encontrado en disco, conservando hash previo: ${rutaNorm}`);
      nuevosHashes[rutaNorm] = hashes[rel];
      continue;
    }
    const cont = fs.readFileSync(rutaAbs);
    nuevosHashes[rutaNorm] = crypto.createHash('sha256').update(cont).digest('hex');
  }

  const jsonCadena = JSON.stringify(nuevosHashes);
  const firma = crypto.createHash('sha256').update(jsonCadena).digest('hex');

  const nuevoContenido = {
    version: "2.0.0",
    fecha_generacion: new Date().toISOString(),
    commit,
    algoritmo: "sha256",
    total_archivos: Object.keys(nuevosHashes).length,
    firma,
    hashes: nuevosHashes
  };

  fs.writeFileSync(rutaHashes, JSON.stringify(nuevoContenido, null, 2) + '\n', 'utf8');
  console.log(`✅ [Guardia:Sellar] PROTEGIDO.hashes.json actualizado y sellado exitosamente.`);
  console.log(`   Archivos sellados: ${nuevoContenido.total_archivos}`);
  console.log(`   Commit base:       ${commit}`);
  console.log(`   Firma del sello:   ${firma.substring(0, 16)}...`);
  return nuevoContenido;
}

if (process.argv[1] && process.argv[1].endsWith('guardia.js')) {
  if (process.argv.includes('--sellar')) {
    sellarGuardia();
  } else {
    const ok = verificarGuardia();
    if (!ok) process.exit(1);
  }
}
