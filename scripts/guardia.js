import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * scripts/guardia.js
 * Sistema Automatizado de Guardia y Protección de Integridad Inmutable.
 * Compara los hashes criptográficos SHA-256 de cada archivo protegido contra PROTEGIDO.hashes.json.
 * Aborta la ejecución si algún archivo protegido cambió sin estar en AUTORIZACIONES.md.
 */

function normalizarRuta(p) {
  return p.replace(/\\/g, '/').trim();
}

function cargarAutorizaciones() {
  const rutaAuth = path.resolve(process.cwd(), 'AUTORIZACIONES.md');
  const autorizados = new Set();
  if (!fs.existsSync(rutaAuth)) return autorizados;

  const contenido = fs.readFileSync(rutaAuth, 'utf8');
  const lineas = contenido.split('\n');

  for (const l of lineas) {
    const match = l.match(/\*\*Componente:\*\*\s*`?([^`\r\n]+)`?/i);
    if (match) {
      const items = match[1].split(/,| y /);
      for (const item of items) {
        const limpia = normalizarRuta(item.trim());
        if (limpia) autorizados.add(limpia);
      }
    }
  }
  return autorizados;
}

export function verificarGuardia() {
  const rutaHashes = path.resolve(process.cwd(), 'PROTEGIDO.hashes.json');
  if (!fs.existsSync(rutaHashes)) {
    console.error('❌ [Guardia] ERROR FATAL: No se encontró PROTEGIDO.hashes.json.');
    return false;
  }

  let config;
  try {
    config = JSON.parse(fs.readFileSync(rutaHashes, 'utf8'));
  } catch (e) {
    console.error('❌ [Guardia] ERROR FATAL: PROTEGIDO.hashes.json corrupto o inválido:', e.message);
    return false;
  }

  const autorizados = cargarAutorizaciones();
  const hashes = config.hashes || {};
  let fallos = 0;
  let correctos = 0;
  let autorizadosModificados = 0;

  console.log(`🛡️ [Guardia] Verificando integridad de ${Object.keys(hashes).length} archivos protegidos...`);

  for (const [archivoRel, hashEsperado] of Object.entries(hashes)) {
    const rutaNorm = normalizarRuta(archivoRel);
    const rutaAbs = path.resolve(process.cwd(), rutaNorm);

    if (!fs.existsSync(rutaAbs)) {
      if (autorizados.has(rutaNorm)) {
        console.warn(`⚠️ [Guardia] Archivo ausente pero autorizado en AUTORIZACIONES.md: ${rutaNorm}`);
        autorizadosModificados++;
        continue;
      }
      console.error(`❌ [Guardia] VIOLACIÓN: Archivo protegido eliminado o no encontrado: ${rutaNorm}`);
      fallos++;
      continue;
    }

    const contenido = fs.readFileSync(rutaAbs);
    const hashActual = crypto.createHash('sha256').update(contenido).digest('hex');

    if (hashActual === hashEsperado) {
      correctos++;
    } else {
      // El archivo cambió. ¿Está en AUTORIZACIONES.md?
      if (autorizados.has(rutaNorm) || autorizados.has(path.basename(rutaNorm))) {
        console.log(`ℹ️ [Guardia] Archivo modificado bajo autorización formal: ${rutaNorm}`);
        autorizadosModificados++;
      } else {
        console.error(`🚨 [Guardia] VIOLACIÓN CRÍTICA DE INTEGRIDAD:`);
        console.error(`   Archivo: ${rutaNorm}`);
        console.error(`   Hash Esperado: ${hashEsperado.substring(0, 16)}...`);
        console.error(`   Hash Actual:   ${hashActual.substring(0, 16)}...`);
        console.error(`   Motivo de Bloqueo: No está registrado en AUTORIZACIONES.md.`);
        fallos++;
      }
    }
  }

  if (fallos > 0) {
    console.error(`\n❌ [Guardia] BLOQUEO: Se detectaron ${fallos} violaciones no autorizadas.`);
    console.error(`   Regla Única: Lo que ya funciona no se toca ni se altera.`);
    console.error(`   Para autorizar un cambio, debe registrarse formalmente en AUTORIZACIONES.md.\n`);
    return false;
  }

  console.log(`✅ [Guardia] Integridad verificada al 100%: ${correctos} intactos, ${autorizadosModificados} autorizados, 0 violaciones.\n`);
  return true;
}

if (process.argv[1] && process.argv[1].endsWith('guardia.js')) {
  const ok = verificarGuardia();
  if (!ok) process.exit(1);
}
