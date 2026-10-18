import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { verificarGuardia } from '../scripts/guardia.js';

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function crearEntornoPrueba() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardia-test-'));
  const workerDir = path.join(tmpDir, 'worker');
  const sharedWorkerDir = path.join(tmpDir, 'shared', 'worker');
  fs.mkdirSync(workerDir, { recursive: true });
  fs.mkdirSync(sharedWorkerDir, { recursive: true });

  const workerIndex = path.join(workerDir, 'index.js');
  const sharedWorkerIndex = path.join(sharedWorkerDir, 'index.js');

  const cWorker = 'export default { fetch() { return new Response("worker original"); } };';
  const cShared = 'export default { fetch() { return new Response("shared worker"); } };';

  fs.writeFileSync(workerIndex, cWorker, 'utf8');
  fs.writeFileSync(sharedWorkerIndex, cShared, 'utf8');

  const hashesConfig = {
    version: '2.0.0',
    commit: 'testcommit123',
    hashes: {
      'worker/index.js': sha256(cWorker),
      'shared/worker/index.js': sha256(cShared)
    }
  };
  hashesConfig.resumen = sha256(JSON.stringify(hashesConfig.hashes));

  fs.writeFileSync(path.join(tmpDir, 'PROTEGIDO.hashes.json'), JSON.stringify(hashesConfig, null, 2), 'utf8');

  try {
    execSync('git init', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'ignore' });
  } catch (e) {}

  return { tmpDir, workerIndex, sharedWorkerIndex, cWorker, cShared };
}

test('1. Sin la variable de entorno GUARDIA_COMMIT_SELLADO -> advierte "SIN ANCLA" y no da verde (retorna false)', (t) => {
  const env = crearEntornoPrueba();
  const prevEnv = process.env.GUARDIA_COMMIT_SELLADO;
  delete process.env.GUARDIA_COMMIT_SELLADO;
  try {
    const ok = verificarGuardia({ cwd: env.tmpDir, verbose: false });
    assert.equal(ok, false, 'La guardia debe fallar si falta GUARDIA_COMMIT_SELLADO');
  } finally {
    if (prevEnv !== undefined) process.env.GUARDIA_COMMIT_SELLADO = prevEnv;
    fs.rmSync(env.tmpDir, { recursive: true, force: true });
  }
});

test('2. Con ancla coincidente y archivos intactos -> PASA', (t) => {
  const env = crearEntornoPrueba();
  const prevEnv = process.env.GUARDIA_COMMIT_SELLADO;
  process.env.GUARDIA_COMMIT_SELLADO = 'testcommit123';
  try {
    const ok = verificarGuardia({ cwd: env.tmpDir, verbose: false });
    assert.equal(ok, true, 'La guardia debe pasar cuando el ancla coincide y los archivos son idénticos al sello');
  } finally {
    if (prevEnv !== undefined) process.env.GUARDIA_COMMIT_SELLADO = prevEnv;
    else delete process.env.GUARDIA_COMMIT_SELLADO;
    fs.rmSync(env.tmpDir, { recursive: true, force: true });
  }
});

test('3. Con ancla desalineada -> FALLA', (t) => {
  const env = crearEntornoPrueba();
  const prevEnv = process.env.GUARDIA_COMMIT_SELLADO;
  process.env.GUARDIA_COMMIT_SELLADO = 'otrocommit999';
  try {
    const ok = verificarGuardia({ cwd: env.tmpDir, verbose: false });
    assert.equal(ok, false, 'La guardia debe fallar cuando GUARDIA_COMMIT_SELLADO no coincide con el commit del sello');
  } finally {
    if (prevEnv !== undefined) process.env.GUARDIA_COMMIT_SELLADO = prevEnv;
    else delete process.env.GUARDIA_COMMIT_SELLADO;
    fs.rmSync(env.tmpDir, { recursive: true, force: true });
  }
});

test('4. PROTEGIDO.hashes.json es la única fuente de verdad: archivo modificado aunque figure en AUTORIZACIONES.md -> FALLA', (t) => {
  const env = crearEntornoPrueba();
  const prevEnv = process.env.GUARDIA_COMMIT_SELLADO;
  process.env.GUARDIA_COMMIT_SELLADO = 'testcommit123';
  try {
    const modContent = 'export default { fetch() { return new Response("worker modificado"); } };';
    fs.writeFileSync(env.workerIndex, modContent, 'utf8');

    // Se intenta autorizar en AUTORIZACIONES.md
    const authContent = `# AUTORIZACIONES\n### Autorización 099\n- **Fecha:** 2026-10-17\n- **Componentes:** \`worker/index.js\`\n- **Motivo:** Prueba de bitácora sin sello\n- **Frase Textual del Dueño:** "Autorizo worker/index.js"\n`;
    fs.writeFileSync(path.join(env.tmpDir, 'AUTORIZACIONES.md'), authContent, 'utf8');

    const ok = verificarGuardia({ cwd: env.tmpDir, verbose: false });
    assert.equal(ok, false, 'La guardia debe fallar porque PROTEGIDO.hashes.json es la única fuente de verdad');
  } finally {
    if (prevEnv !== undefined) process.env.GUARDIA_COMMIT_SELLADO = prevEnv;
    else delete process.env.GUARDIA_COMMIT_SELLADO;
    fs.rmSync(env.tmpDir, { recursive: true, force: true });
  }
});

test('5. La guardia sin banderas deja idénticos los archivos de control antes y después', (t) => {
  const env = crearEntornoPrueba();
  const prevEnv = process.env.GUARDIA_COMMIT_SELLADO;
  process.env.GUARDIA_COMMIT_SELLADO = 'testcommit123';
  try {
    const authContent = `# AUTORIZACIONES\n### Autorización 099\n- **Fecha:** 2026-10-17\n- **Componentes:** \`worker/index.js\`\n- **Motivo:** Inmutabilidad\n- **Frase Textual del Dueño:** "Autorizo inmutabilidad"\n`;
    const rutaHashes = path.join(env.tmpDir, 'PROTEGIDO.hashes.json');
    const rutaAuth = path.join(env.tmpDir, 'AUTORIZACIONES.md');
    fs.writeFileSync(rutaAuth, authContent, 'utf8');

    const hashJsonAntes = sha256(fs.readFileSync(rutaHashes));
    const hashAuthAntes = sha256(fs.readFileSync(rutaAuth));

    verificarGuardia({ cwd: env.tmpDir, verbose: false });

    const hashJsonDespues = sha256(fs.readFileSync(rutaHashes));
    const hashAuthDespues = sha256(fs.readFileSync(rutaAuth));

    assert.equal(hashJsonDespues, hashJsonAntes, 'PROTEGIDO.hashes.json debe ser byte por byte idéntico');
    assert.equal(hashAuthDespues, hashAuthAntes, 'AUTORIZACIONES.md debe ser byte por byte idéntico');
  } finally {
    if (prevEnv !== undefined) process.env.GUARDIA_COMMIT_SELLADO = prevEnv;
    else delete process.env.GUARDIA_COMMIT_SELLADO;
    fs.rmSync(env.tmpDir, { recursive: true, force: true });
  }
});

test('6. Mismo nombre de archivo en otra carpeta falla (aislamiento estricto por ruta completa)', (t) => {
  const env = crearEntornoPrueba();
  const prevEnv = process.env.GUARDIA_COMMIT_SELLADO;
  process.env.GUARDIA_COMMIT_SELLADO = 'testcommit123';
  try {
    // Se modifica shared/worker/index.js (mismo basename 'index.js' pero ruta distinta)
    const modContent = 'export default { fetch() { return new Response("shared worker alterado"); } };';
    fs.writeFileSync(env.sharedWorkerIndex, modContent, 'utf8');

    const ok = verificarGuardia({ cwd: env.tmpDir, verbose: false });
    assert.equal(ok, false, 'La guardia debe fallar porque shared/worker/index.js fue alterado');
  } finally {
    if (prevEnv !== undefined) process.env.GUARDIA_COMMIT_SELLADO = prevEnv;
    else delete process.env.GUARDIA_COMMIT_SELLADO;
    fs.rmSync(env.tmpDir, { recursive: true, force: true });
  }
});

test('7. Garantía de restauración: worker/index.js se restaura exactamente en bloque finally aunque la prueba falle', (t) => {
  const env = crearEntornoPrueba();
  const prevEnv = process.env.GUARDIA_COMMIT_SELLADO;
  process.env.GUARDIA_COMMIT_SELLADO = 'testcommit123';

  const hashOriginal = sha256(fs.readFileSync(env.workerIndex));
  let falloSimuladoAtrapado = false;

  try {
    try {
      // Modificación temporal durante la prueba
      fs.writeFileSync(env.workerIndex, 'export default { fetch() { return new Response("contenido temporal corrupto"); } };', 'utf8');
      const hashDuranteMod = sha256(fs.readFileSync(env.workerIndex));
      assert.notEqual(hashDuranteMod, hashOriginal);

      // Simulación de fallo en una aserción dentro del test
      assert.fail("Fallo simulado dentro del bloque de prueba");
    } finally {
      // Restauración garantizada en bloque finally
      fs.writeFileSync(env.workerIndex, env.cWorker, 'utf8');
    }
  } catch (err) {
    if (err.message === "Fallo simulado dentro del bloque de prueba") {
      falloSimuladoAtrapado = true;
    } else {
      throw err;
    }
  }

  assert.equal(falloSimuladoAtrapado, true, 'El fallo simulado debió ser atrapado');
  const hashDespues = sha256(fs.readFileSync(env.workerIndex));
  assert.equal(hashDespues, hashOriginal, 'worker/index.js debe quedar 100% restaurado con su hash original a pesar del fallo');

  if (prevEnv !== undefined) process.env.GUARDIA_COMMIT_SELLADO = prevEnv;
  else delete process.env.GUARDIA_COMMIT_SELLADO;
  fs.rmSync(env.tmpDir, { recursive: true, force: true });
});
