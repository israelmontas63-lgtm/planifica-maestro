/**
 * tests/test_cableado_cerebro.mjs
 * 
 * Test de Regresión Formal de Cableado y Contratos RPC (ORDEN 55)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Test de Regresión de Cableado y Ensamblaje del Cerebro (ORDEN 55)', async (t) => {
  const rutaWorker = path.join(rootDir, 'worker', 'index.js');
  const contenidoWorker = fs.readFileSync(rutaWorker, 'utf8');

  await t.test('1. worker/index.js contiene comprobación estricta de plan_completado booleano', () => {
    assert.ok(
      contenidoWorker.includes('typeof reparado.plan_completado === "boolean"'),
      'worker/index.js debe validar estrictamente typeof reparado.plan_completado === "boolean"'
    );
  });

  await t.test('2. Rutas de reintento y fallback en worker/index.js invocan construirMaxSalida y construirThinkingConfig', () => {
    assert.ok(
      contenidoWorker.includes('maxOutputTokens: construirMaxSalida(env)'),
      'worker/index.js debe invocar construirMaxSalida(env)'
    );
    assert.ok(
      contenidoWorker.includes('...construirThinkingConfig(env)'),
      'worker/index.js debe invocar construirThinkingConfig(env)'
    );
    // Verificar que no queden rutas de generación principal con tope rígido de 8192
    assert.ok(
      !contenidoWorker.includes('maxOutputTokens: 8192'),
      'worker/index.js no debe contener maxOutputTokens fijo en 8192'
    );
  });

  await t.test('3. cerebroExperto.js y cerebroRobot.js contienen p_consulta y p_grado_num en llamadas RPC', () => {
    const rutaCerebroExperto = path.join(rootDir, 'worker', 'services', 'cerebroExperto.js');
    const contenidoCerebroExperto = fs.readFileSync(rutaCerebroExperto, 'utf8');

    const rutaCerebroRobot = path.join(rootDir, 'worker', 'services', 'cerebroRobot.js');
    const contenidoCerebroRobot = fs.readFileSync(rutaCerebroRobot, 'utf8');

    assert.ok(
      contenidoCerebroExperto.includes('p_consulta:') && contenidoCerebroExperto.includes('p_grado_num:'),
      'cerebroExperto.js debe utilizar las claves canónicas p_consulta y p_grado_num'
    );

    assert.ok(
      contenidoCerebroRobot.includes('p_consulta:') && contenidoCerebroRobot.includes('p_grado_num:'),
      'cerebroRobot.js debe utilizar las claves canónicas p_consulta y p_grado_num'
    );
  });
});
