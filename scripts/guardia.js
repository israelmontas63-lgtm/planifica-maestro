import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync, execFileSync } from 'node:child_process';

/**
 * scripts/guardia.js
 * Sistema Automatizado de Guardia y Protección de Integridad Inmutable.
 * - Compara los hashes criptográficos SHA-256 de cada archivo protegido contra PROTEGIDO.hashes.json.
 * - Validación por ruta relativa normalizada completa (SIN coincidencia por nombre base).
 * - Soporte para hashes autorizados explícitos en AUTORIZACIONES.md.
 * - Auto-vigilancia de scripts/guardia.js, PROTEGIDO.hashes.json y AUTORIZACIONES.md contra git HEAD.
 * - Comando sellar (node scripts/guardia.js --sellar) para actualizar hashes protegidos con resumen y fecha.
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
    const todos = new Set([...currentComponentes.map(normalizarRuta), ...currentHashes.keys()]);
    for (const norm of todos) {
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

    const matchComp = l.match(/\*\*Componentes?(?:\s+y\s+Hashes)?:\*\*\s*(.+)$/i);
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
    execSync('git rev-parse --is-inside-work-tree', { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) {
    fallos.push(`[Guardia] FALLA CERRADA: '${cwd}' no es un repositorio Git válido o Git no está disponible.`);
    return fallos;
  }

  try {
    execSync('git rev-parse --verify HEAD', { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) {
    // Si el repositorio no tiene commits aún (HEAD no resuelto)
    return fallos;
  }

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
            const tocoHistorico = lineasEliminadas.some(l => /Autorización\s+00[1-9]|Autorización\s+01[0-3]/i.test(l));
            if (tocoHistorico) {
              fallos.push(`AUTORIZACIONES.md fue alterado en autorizaciones históricas protegidas (001 a 013).`);
            }
          } catch (e) {
            fallos.push(`[Guardia] Error al inspeccionar historial de AUTORIZACIONES.md con git: ${e.message}`);
          }
          continue;
        }

        if (mod === 'PROTEGIDO.hashes.json') {
          try {
            const headShort = execSync('git rev-parse --short HEAD', { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
            const configDisk = JSON.parse(fs.readFileSync(path.resolve(cwd, 'PROTEGIDO.hashes.json'), 'utf8'));
            if (configDisk && configDisk.commit && (configDisk.commit === headShort || headShort.startsWith(configDisk.commit))) {
              // El sello acaba de ser generado para HEAD pero aún no se commitea
              continue;
            }
          } catch (e) {}
          fallos.push(`PROTEGIDO.hashes.json fue alterado respecto a git HEAD. El sellado es acto exclusivo del Dueño.`);
          continue;
        }

        if (mod === 'scripts/guardia.js') {
          fallos.push(`scripts/guardia.js fue modificado respecto a git HEAD. Requiere revisión y sellado exclusivo por el Dueño.`);
          continue;
        }

        if (!autorizados.has(mod)) {
          fallos.push(`${mod} fue modificado respecto a git HEAD sin estar registrado formalmente en AUTORIZACIONES.md`);
        }
      }
    }
  } catch (e) {
    fallos.push(`[Guardia] Error al ejecutar git diff de auto-vigilancia: ${e.message}`);
  }

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

  let anclaCommit = process.env.GUARDIA_COMMIT_SELLADO ? process.env.GUARDIA_COMMIT_SELLADO.trim() : null;
  if (anclaCommit) {
    if (config.commit && anclaCommit !== config.commit && !anclaCommit.startsWith(config.commit) && !config.commit.startsWith(anclaCommit)) {
      if (verbose) {
        console.error(`🚨 [Guardia] DESALINEACIÓN DE ANCLA: GUARDIA_COMMIT_SELLADO (${anclaCommit}) no coincide con el commit de PROTEGIDO.hashes.json (${config.commit}).`);
      }
      return false;
    }
  } else {
    if (!config.commit) {
      if (verbose) {
        console.warn('⚠️ [Guardia] SIN ANCLA: Ni GUARDIA_COMMIT_SELLADO ni config.commit están definidos.');
      }
      return false;
    }
    anclaCommit = config.commit.trim();
    try {
      execFileSync('git', ['cat-file', '-e', `${anclaCommit}^{commit}`], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
      if (verbose) console.error(`❌ [Guardia] ERROR FATAL: El commit ancla [${anclaCommit}] no existe en la base de objetos de git.`);
      return false;
    }
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', anclaCommit, 'HEAD'], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
      if (verbose) console.error(`❌ [Guardia] ERROR FATAL: El commit ancla [${anclaCommit}] no es ancestro de HEAD.`);
      return false;
    }
  }

  // Validación del resumen criptográfico del archivo de hashes
  const resumenEsperado = config.resumen || config.firma;
  if (resumenEsperado) {
    const jsonCadena = JSON.stringify(config.hashes);
    const resumenCalculado = crypto.createHash('sha256').update(jsonCadena).digest('hex');
    if (resumenCalculado !== resumenEsperado) {
      if (verbose) {
        console.error(`🚨 [Guardia] VIOLACIÓN: El resumen criptográfico de PROTEGIDO.hashes.json no coincide.`);
        console.error(`   Esperado: ${resumenEsperado}`);
        console.error(`   Calculado: ${resumenCalculado}`);
      }
      return false;
    }
  }

  const autorizados = cargarAutorizaciones(cwd);
  const hashes = config.hashes || {};
  let fallos = 0;
  let correctos = 0;

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
      if (verbose) console.error(`❌ [Guardia] VIOLACIÓN: Archivo protegido eliminado o no encontrado: ${rutaNorm}`);
      fallos++;
      continue;
    }

    const contenido = fs.readFileSync(rutaAbs);
    const hashActual = crypto.createHash('sha256').update(contenido).digest('hex');

    if (hashActual === hashEsperado) {
      correctos++;
    } else {
      // P2: PROTEGIDO.hashes.json es la única fuente de verdad.
      // Toda discrepancia es violación. AUTORIZACIONES.md es solo bitácora.
      if (verbose) {
        console.error(`🚨 [Guardia] VIOLACIÓN CRÍTICA DE INTEGRIDAD:`);
        console.error(`   Archivo:      ${rutaNorm}`);
        console.error(`   Hash Sellado: ${hashEsperado}`);
        console.error(`   Hash Actual:  ${hashActual}`);
        console.error(`   Motivo:       PROTEGIDO.hashes.json es la única fuente de verdad.`);
      }
      fallos++;
    }
  }

  if (fallos > 0) {
    if (verbose) {
      console.error(`\n❌ [Guardia] BLOQUEO: Se detectaron ${fallos} violaciones.`);
      console.error(`   Regla P2: PROTEGIDO.hashes.json es la única fuente de verdad.`);
      console.error(`   El sellado es acto exclusivo del Dueño.\n`);
    }
    return false;
  }

  if (verbose) console.log(`✅ [Guardia] Integridad verificada al 100%: ${correctos} intactos, ancla [${anclaCommit}] confirmada, 0 violaciones.\n`);
  return true;
}

export function mostrarDiffGuardia({ cwd = process.cwd() } = {}) {
  const rutaHashes = path.resolve(cwd, 'PROTEGIDO.hashes.json');
  if (!fs.existsSync(rutaHashes)) {
    console.error('❌ [Guardia:Diff] No se encontró PROTEGIDO.hashes.json.');
    return false;
  }
  const config = JSON.parse(fs.readFileSync(rutaHashes, 'utf8'));
  const hashes = config.hashes || {};
  const autorizados = cargarAutorizaciones(cwd);

  const anclaCommit = process.env.GUARDIA_COMMIT_SELLADO ? process.env.GUARDIA_COMMIT_SELLADO.trim() : null;
  console.log(`\n🔍 [Guardia:Diff] Inspección comparativa contra PROTEGIDO.hashes.json [Ancla: ${anclaCommit || 'SIN ANCLA'}]:`);
  let totalModificados = 0;

  for (const [archivoRel, hashEsperado] of Object.entries(hashes)) {
    const rutaNorm = normalizarRuta(archivoRel);
    const rutaAbs = path.resolve(cwd, rutaNorm);

    if (!fs.existsSync(rutaAbs)) {
      console.log(`   - [ELIMINADO / AUSENTE] ${rutaNorm}`);
      totalModificados++;
      continue;
    }

    const cont = fs.readFileSync(rutaAbs);
    const hashActual = crypto.createHash('sha256').update(cont).digest('hex');

    if (hashActual !== hashEsperado) {
      totalModificados++;
      const authInfo = autorizados.get(rutaNorm);
      const bitacora = authInfo ? ` (Bitácora: Autorización ${authInfo.autorizaciones.join(', ') || 'Registrada'})` : ' (No registrado en bitácora)';
      console.log(`   ! [MODIFICADO RESPECTO A SELLO] ${rutaNorm}${bitacora}`);
      console.log(`     Sellado:     ${hashEsperado}`);
      console.log(`     Actual:      ${hashActual}`);
    }
  }

  const autoFallos = verificarAutoVigilancia(cwd, autorizados);
  if (autoFallos.length > 0) {
    console.log(`\n🚨 [Guardia:Diff] Alertas de Auto-Vigilancia (scripts/guardia.js, PROTEGIDO.hashes.json, AUTORIZACIONES.md):`);
    for (const f of autoFallos) {
      console.log(`   ! ${f}`);
    }
  }

  console.log(`\n📊 [Guardia:Diff] Resumen: ${totalModificados} archivos protegidos modificados respecto al sello oficial.\n`);
  return totalModificados === 0 && autoFallos.length === 0;
}

export function sellarGuardia(cwd = process.cwd(), { confirmar = false, verbose = true } = {}) {
  const rutaHashes = path.resolve(cwd, 'PROTEGIDO.hashes.json');
  if (!fs.existsSync(rutaHashes)) {
    throw new Error('No se encontró PROTEGIDO.hashes.json para sellar.');
  }

  const config = JSON.parse(fs.readFileSync(rutaHashes, 'utf8'));
  const hashes = config.hashes || {};

  let statusTree = '';
  try {
    statusTree = execSync('git status --porcelain', { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    throw new Error(`[Guardia:Sellar] Error comprobando estado del repositorio git: ${e.message}`);
  }

  if (statusTree && confirmar) {
    throw new Error(`[Guardia:Sellar] Árbol de trabajo sucio. El sellado requiere un working tree limpio (git status limpio).\nArchivos pendientes:\n${statusTree}`);
  }

  const adicionales = [
    'client/vite.config.js',
    'client/src/utils/parseadorJsonSeguro.js',
    'scripts/prueba_real_gemini.mjs',
    'shared/ciclo.js',
    'shared/curriculoService.mjs',
    'shared/herramientas.mjs',
    'shared/promptSistemaV2.js',
    'shared/catalogoCurricular.mjs',
    'scripts/guardia.js'
  ];
  for (const ad of adicionales) {
    if (fs.existsSync(path.resolve(cwd, ad)) && !hashes[ad]) {
      hashes[ad] = '';
    }
  }

  let commit = 'HEAD';
  try {
    commit = execSync('git rev-parse --short HEAD', { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    throw new Error(`[Guardia:Sellar] Error al obtener commit actual desde git: ${e.message}`);
  }

  const nuevosHashes = {};
  const ordenados = Object.keys(hashes).sort();

  for (const rel of ordenados) {
    const rutaNorm = normalizarRuta(rel);
    const rutaAbs = path.resolve(cwd, rutaNorm);
    if (!fs.existsSync(rutaAbs)) {
      if (verbose) console.warn(`⚠️ [Sellar] Archivo protegido no encontrado en disco, conservando hash previo: ${rutaNorm}`);
      nuevosHashes[rutaNorm] = hashes[rel];
      continue;
    }
    const cont = fs.readFileSync(rutaAbs);
    nuevosHashes[rutaNorm] = crypto.createHash('sha256').update(cont).digest('hex');
  }

  // Calcular diff de hashes
  const diff = {
    modificados: [],
    nuevos: [],
    eliminados: []
  };

  for (const [k, nuevoHash] of Object.entries(nuevosHashes)) {
    const viejoHash = hashes[k];
    if (!viejoHash) {
      diff.nuevos.push({ archivo: k, hashNuevo: nuevoHash });
    } else if (viejoHash !== nuevoHash) {
      diff.modificados.push({ archivo: k, hashViejo: viejoHash, hashNuevo: nuevoHash });
    }
  }

  for (const k of Object.keys(hashes)) {
    if (!nuevosHashes[k]) {
      diff.eliminados.push({ archivo: k, hashViejo: hashes[k] });
    }
  }

  if (verbose) {
    console.log('🔍 [Guardia:Sellar] Inspección previa de cambios en PROTEGIDO.hashes.json:');
    const totalCambios = diff.modificados.length + diff.nuevos.length + diff.eliminados.length;
    if (totalCambios === 0) {
      console.log('   (Sin cambios detectados en los hashes de archivos protegidos)');
    } else {
      for (const m of diff.modificados) {
        console.log(`   ~ [MODIFICADO] ${m.archivo}: ${m.hashViejo} -> ${m.hashNuevo}`);
      }
      for (const n of diff.nuevos) {
        console.log(`   + [NUEVO]      ${n.archivo}: ${n.hashNuevo}`);
      }
      for (const el of diff.eliminados) {
        console.log(`   - [ELIMINADO]  ${el.archivo} (${el.hashViejo})`);
      }
    }
  }

  if (!confirmar) {
    if (verbose) {
      console.warn('\n⚠️ [Guardia:Sellar] Modo de inspección/vista previa. PROTEGIDO.hashes.json NO fue modificado.');
      console.warn('   El sellado es acto exclusivo del Dueño.');
      console.warn('   Para confirmar y escribir el nuevo sello criptográfico, ejecute:');
      console.warn('   npm run guardia:sellar -- --confirmar\n');
    }
    return { diff, aplicado: false };
  }

  const jsonCadena = JSON.stringify(nuevosHashes);
  const resumen = crypto.createHash('sha256').update(jsonCadena).digest('hex');

  const nuevoContenido = {
    version: "2.0.0",
    fecha_generacion: new Date().toISOString(),
    commit,
    algoritmo: "sha256",
    total_archivos: Object.keys(nuevosHashes).length,
    resumen,
    hashes: nuevosHashes
  };

  fs.writeFileSync(rutaHashes, JSON.stringify(nuevoContenido, null, 2) + '\n', 'utf8');
  if (verbose) {
    console.log(`✅ [Guardia:Sellar] PROTEGIDO.hashes.json actualizado y sellado exitosamente.`);
    console.log(`   Archivos sellados: ${nuevoContenido.total_archivos}`);
    console.log(`   Commit base:       ${commit}`);
    console.log(`   Resumen del sello: ${resumen}\n`);
  }
  return { diff, aplicado: true, nuevoContenido };
}

if (process.argv[1] && process.argv[1].endsWith('guardia.js')) {
  if (process.argv.includes('--diff')) {
    const ok = mostrarDiffGuardia();
    if (!ok) process.exit(1);
  } else if (process.argv.includes('--sellar')) {
    const confirmar = process.argv.includes('--confirmar');
    sellarGuardia(process.cwd(), { confirmar });
  } else {
    const ok = verificarGuardia();
    if (!ok) process.exit(1);
  }
}

