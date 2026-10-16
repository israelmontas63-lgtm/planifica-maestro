import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { verificarGuardia, sellarGuardia } from '../scripts/guardia.js';

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function crearEntornoPrueba() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardia-test-'));
  const sharedDir = path.join(tmpDir, 'shared');
  const serverDir = path.join(tmpDir, 'server', 'ia');
  fs.mkdirSync(sharedDir, { recursive: true });
  fs.mkdirSync(serverDir, { recursive: true });

  const f1Path = path.join(sharedDir, 'parseadorJsonSeguro.js');
  const f2Path = path.join(sharedDir, 'modoConversacional.js');
  const f3Path = path.join(serverDir, 'modoConversacional.js');

  const c1 = 'export const a = 1;';
  const c2 = 'export const b = 2;';
  const c3 = 'export const c = 3;';

  fs.writeFileSync(f1Path, c1, 'utf8');
  fs.writeFileSync(f2Path, c2, 'utf8');
  fs.writeFileSync(f3Path, c3, 'utf8');

  const hashesConfig = {
    version: '1.0.0',
    hashes: {
      'shared/parseadorJsonSeguro.js': sha256(c1),
      'shared/modoConversacional.js': sha256(c2),
      'server/ia/modoConversacional.js': sha256(c3)
    }
  };

  fs.writeFileSync(path.join(tmpDir, 'PROTEGIDO.hashes.json'), JSON.stringify(hashesConfig, null, 2), 'utf8');
  return { tmpDir, f1Path, f2Path, f3Path, c1, c2, c3 };
}

test('1. Modificar un archivo protegido con nombre autorizado pero hash diferente -> guardia falla', (t) => {
  const env = crearEntornoPrueba();
  try {
    const modContent = 'export const a = 999;';
    fs.writeFileSync(env.f1Path, modContent, 'utf8');
    const hashDiferente = '0'.repeat(64);

    const authContent = `# AUTORIZACIONES\n### Autorización 099\n- **Fecha:** 2026-10-16\n- **Componente:** \`shared/parseadorJsonSeguro.js\`\n- **Motivo:** Prueba\n- **Hash:** ` + hashDiferente + `\n- **Frase Textual del Dueño:** "Autorizo prueba"\n`;
    fs.writeFileSync(path.join(env.tmpDir, 'AUTORIZACIONES.md'), authContent, 'utf8');

    const ok = verificarGuardia({ cwd: env.tmpDir, verbose: false });
    assert.equal(ok, false, 'La guardia debe fallar porque el hash en disco no coincide con el hash autorizado');
  } finally {
    fs.rmSync(env.tmpDir, { recursive: true, force: true });
  }
});

test('2. Modificar con hash autorizado o sellado -> guardia pasa', (t) => {
  const env = crearEntornoPrueba();
  try {
    const modContent = 'export const a = 999;';
    fs.writeFileSync(env.f1Path, modContent, 'utf8');
    const hashReal = sha256(modContent);

    const authContent = `# AUTORIZACIONES\n### Autorización 099\n- **Fecha:** 2026-10-16\n- **Componente:** \`shared/parseadorJsonSeguro.js\`\n- **Motivo:** Prueba\n- **Hash:** ` + hashReal + `\n- **Frase Textual del Dueño:** "Autorizo prueba con hash exacto"\n`;
    fs.writeFileSync(path.join(env.tmpDir, 'AUTORIZACIONES.md'), authContent, 'utf8');

    let ok = verificarGuardia({ cwd: env.tmpDir, verbose: false });
    assert.equal(ok, true, 'La guardia debe pasar con el hash explícitamente autorizado');

    sellarGuardia(env.tmpDir);
    ok = verificarGuardia({ cwd: env.tmpDir, verbose: false });
    assert.equal(ok, true, 'La guardia debe pasar tras sellar los hashes');
  } finally {
    fs.rmSync(env.tmpDir, { recursive: true, force: true });
  }
});

test('3. Modificar un archivo con el mismo nombre base en otra carpeta -> guardia falla', (t) => {
  const env = crearEntornoPrueba();
  try {
    const modContent = 'export const c = 888;';
    fs.writeFileSync(env.f3Path, modContent, 'utf8');

    const authContent = `# AUTORIZACIONES\n### Autorización 099\n- **Fecha:** 2026-10-16\n- **Componente:** \`shared/modoConversacional.js\`\n- **Motivo:** Prueba\n- **Frase Textual del Dueño:** "Autorizo shared/modoConversacional.js"\n`;
    fs.writeFileSync(path.join(env.tmpDir, 'AUTORIZACIONES.md'), authContent, 'utf8');

    const ok = verificarGuardia({ cwd: env.tmpDir, verbose: false });
    assert.equal(ok, false, 'La guardia debe fallar porque server/ia/modoConversacional.js no está autorizado');
  } finally {
    fs.rmSync(env.tmpDir, { recursive: true, force: true });
  }
});
