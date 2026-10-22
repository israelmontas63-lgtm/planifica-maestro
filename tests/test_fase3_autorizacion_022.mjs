/**
 * tests/test_fase3_autorizacion_022.mjs
 * Pruebas unitarias positivas y negativas para correcciones 3a-3d de Autorización 022.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import { gradosMultiples } from '../shared/catalogoCurricular.mjs';
import { clasificarPorReglas } from '../shared/clasificadorIntencion.js';

const envTest = {
  APP_ACCESS_KEY: 'clave-institucional-test',
  HERRAMIENTAS_V2: 'false'
};

// ============================================================================
// 3a. Mensaje de Secundaria y Fallo Anterior
// ============================================================================

test('3a.1: Mensaje de alcance responde con Secundaria solo si se menciona nivel no primario', async () => {
  const preguntasAlcance = [
    '¿por qué no puedes planificar para 1.º de Secundaria?',
    '¿por qué no puedes planificar para bachillerato?',
    '¿por qué no puedes para nivel medio?',
    '¿por qué no puedes para inicial?'
  ];

  for (const p of preguntasAlcance) {
    const req = new Request('http://localhost/api/plan/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-key': 'clave-institucional-test' },
      body: JSON.stringify({ messages: [{ role: 'user', text: p }] })
    });
    const res = await worker.fetch(req, envTest, { waitUntil: () => {} });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.mensaje_chat.includes('Secundario') || data.mensaje_chat.includes('Primario'), `Debe explicar el alcance escolar: ${data.mensaje_chat}`);
  }
});

test('3a.2: Fallo anterior sin error previo y sin mención de nivel responde neutral sin mencionar Secundaria', async () => {
  const preguntasNeutrales = [
    '¿por qué no puedes hacer un Word?',
    '¿por qué no puedes escucharme?',
    '¿por qué no puedes ayudarme con las fracciones?'
  ];

  for (const p of preguntasNeutrales) {
    const req = new Request('http://localhost/api/plan/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-key': 'clave-institucional-test' },
      body: JSON.stringify({ messages: [{ role: 'user', text: p }] })
    });
    const res = await worker.fetch(req, envTest, { waitUntil: () => {} });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.mensaje_chat.includes('No tengo registrado un error previo'), `Debe responder mensaje neutral: ${data.mensaje_chat}`);
    assert.ok(!data.mensaje_chat.includes('Secundaria') && !data.mensaje_chat.includes('secundaria'), `No debe mencionar Secundaria: ${data.mensaje_chat}`);
    assert.strictEqual(data.plan_completado, false);
    assert.strictEqual(data.datos_planificacion, null);
  }
});

test('3a.3: Con error previo registrado en historial, se conserva el diagnóstico del error', async () => {
  const req = new Request('http://localhost/api/plan/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-app-key': 'clave-institucional-test' },
    body: JSON.stringify({
      messages: [
        { role: 'user', text: 'planificar fracciones para 4to' },
        { role: 'assistant', text: 'Error', isError: true, codigoError: 'PROVEEDOR_IA_SATURADO' },
        { role: 'user', text: '¿por qué no puedes?' }
      ]
    })
  });
  const res = await worker.fetch(req, envTest, { waitUntil: () => {} });
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.codigo, 'PROVEEDOR_IA_SATURADO');
  assert.ok(data.mensaje.includes('saturado') || data.mensaje.includes('alta demanda'));
});

// ============================================================================
// 3b. Coincidencia de tema honesta
// ============================================================================

test('3b: Consulta sobre materia en 3.° de Ciencias de la Naturaleza no inventa y reporta no encontrado', async () => {
  const req = new Request('http://localhost/api/plan/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-app-key': 'clave-institucional-test' },
    body: JSON.stringify({
      messages: [{ role: 'user', text: 'currículo de 3.º de Ciencias de la Naturaleza sobre materia' }]
    })
  });
  const res = await worker.fetch(req, envTest, { waitUntil: () => {} });
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.modo, 'consulta_curricular');
  assert.ok(data.mensaje_chat.includes('No encontré en la base curricular cargada una secuencia verificada'));
  assert.ok(data.mensaje_chat.includes('No te voy a mostrar contenido de otro tema como si lo fuera'));
});

// ============================================================================
// 3c. Multigrado y validación de gradosMultiples
// ============================================================================

test('3c.1: gradosMultiples pruebas positivas y negativas', () => {
  // Negativas estrictas: números como cantidades, no grados
  assert.deepStrictEqual(gradosMultiples('5 estudiantes'), []);
  assert.deepStrictEqual(gradosMultiples('3 días'), []);
  assert.deepStrictEqual(gradosMultiples('tengo 5 estudiantes en aula'), []);
  assert.deepStrictEqual(gradosMultiples('en 3 días libres'), []);

  // Positivas
  assert.deepStrictEqual(gradosMultiples('primero y segundo de Lengua'), [1, 2]);
  assert.deepStrictEqual(gradosMultiples('1ro y 2do grado'), [1, 2]);
  assert.deepStrictEqual(gradosMultiples('grados 1, 2 y 3'), [1, 2, 3]);
  assert.deepStrictEqual(gradosMultiples('multigrado 4 y 5'), [4, 5]);
});

test('3c.2: clasificadorIntencion distingue multigrado curricular de planificación', () => {
  const qCurric = clasificarPorReglas('currículo de primero y segundo de Lengua Española');
  assert.strictEqual(qCurric.categoria, 'consulta_curricular');

  const qPlanif = clasificarPorReglas('Hazme una actividad de lectura para primero y segundo');
  assert.strictEqual(qPlanif.categoria, 'planificacion');
});

// ============================================================================
// 3d. Clasificador Matemático C19 vs Curricular vs Planificación
// ============================================================================

test('3d: Clasificador separa operaciones matemáticas, consultas curriculares y planificación', () => {
  // Tutor de matemática
  assert.strictEqual(clasificarPorReglas('cuánto es 345 + 278').categoria, 'matematica');
  assert.strictEqual(clasificarPorReglas('resuelve 12 × 8').categoria, 'matematica');
  assert.strictEqual(clasificarPorReglas('2 elevado a 5').categoria, 'matematica');
  assert.strictEqual(clasificarPorReglas('3/4 + 5/6').categoria, 'matematica');
  assert.strictEqual(clasificarPorReglas('escribe 4.835 en letras').categoria, 'matematica');

  // Consulta curricular
  assert.strictEqual(clasificarPorReglas('currículo de 6.º de Matemática sobre potencias').categoria, 'consulta_curricular');

  // Planificación
  assert.strictEqual(clasificarPorReglas('planifica fracciones para 3.º').categoria, 'planificacion');

  // No operaciones
  assert.strictEqual(clasificarPorReglas('5 estudiantes').categoria, 'ambigua');
  assert.strictEqual(clasificarPorReglas('grado 3').categoria, 'ambigua');
});
