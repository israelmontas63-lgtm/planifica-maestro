import test from 'node:test';
import assert from 'node:assert/strict';
import { numeroALetras, formatearEntero } from '../shared/numeroLetras.mjs';
import {
  descomponer, pasosSumaDescomposicion, pasosRestaConteo, pasosMultiplicacionPosicional,
  pasosMultiplicacionAreas, pasosDivisionLarga, pasosDivisionRestasSucesivas, respuestaEspecialMatematica,
} from '../shared/metodosMatematicos.mjs';
import { esConsultaMatematicaPura } from '../shared/intencionMatematica.mjs';
import { coincideConTema, listarTemasUnicos, formatearListaTemas, consultarTemasREST } from '../shared/coincidenciaTema.mjs';

const unf = (s) => BigInt(String(s).replace(/\./g, ''));
let semilla = 20261022;
const azar = (max) => { semilla = (semilla * 48271) % 2147483647; return semilla % max; };

test('numeroALetras: tabla con tildes y apócopes', () => {
  const tabla = [[0, 'cero'], [7, 'siete'], [16, 'dieciséis'], [21, 'veintiuno'], [22, 'veintidós'], [31, 'treinta y uno'], [100, 'cien'], [101, 'ciento uno'], [999, 'novecientos noventa y nueve'], [1000, 'mil'], [1001, 'mil uno'], [1524, 'mil quinientos veinticuatro'], [2341, 'dos mil trescientos cuarenta y uno'], [4835, 'cuatro mil ochocientos treinta y cinco'], [7802, 'siete mil ochocientos dos'], [9022, 'nueve mil veintidós'], [21000, 'veintiún mil'], [100000, 'cien mil'], [101000, 'ciento un mil'], [999999, 'novecientos noventa y nueve mil novecientos noventa y nueve'], [1000000, 'un millón'], [2000000, 'dos millones'], [21000000, 'veintiún millones'], [1000000000, 'mil millones'], [-5, 'menos cinco']];
  for (const [n, esperado] of tabla) assert.equal(numeroALetras(n), esperado, String(n));
});

test('numeroALetras: fuera de rango y entradas inválidas', () => {
  assert.equal(numeroALetras(10n ** 12n), null);
  assert.equal(numeroALetras('abc'), null);
  assert.equal(numeroALetras(''), null);
  assert.equal(numeroALetras(1.5), null);
});

test('formatearEntero: punto para miles', () => {
  assert.equal(formatearEntero(1234567n), '1.234.567');
  assert.equal(formatearEntero(0), '0');
  assert.equal(formatearEntero(-1500), '-1.500');
  assert.equal(formatearEntero(999), '999');
});

test('descomponer: valor posicional', () => {
  assert.equal(descomponer(4835n), '4.000 + 800 + 30 + 5');
  assert.equal(descomponer(0n), '0');
  assert.equal(descomponer(1000n), '1.000');
});

test('suma por descomposición con los números reales', () => {
  const p = pasosSumaDescomposicion(4835n, 2967n);
  assert.ok(p.includes('4.000 + 2.000 = 6.000'));
  assert.ok(p.includes('800 + 900 = 1.700'));
  assert.ok(p.includes('30 + 60 = 90'));
  assert.ok(p.includes('5 + 7 = 12'));
  assert.equal(p.at(-1), 'Juntamos: 6.000 + 1.700 + 90 + 12 = 7.802');
});

test('resta por conteo hacia arriba: caso exacto', () => {
  assert.deepEqual(pasosRestaConteo(5002n, 3478n), [
    'Contamos hacia arriba desde 3.478 hasta 5.002.',
    '3.478 + 2 = 3.480',
    '3.480 + 20 = 3.500',
    '3.500 + 500 = 4.000',
    '4.000 + 1.000 = 5.000',
    '5.000 + 2 = 5.002',
    'Sumamos los saltos: 2 + 20 + 500 + 1.000 + 2 = 1.524',
  ]);
  assert.equal(pasosRestaConteo(3n, 5n), null);
});

test('resta por conteo: propiedad con 300 casos', () => {
  for (let i = 0; i < 300; i++) {
    const a = BigInt(2 + azar(1000000));
    const b = BigInt(1 + azar(Number(a) - 1));
    const p = pasosRestaConteo(a, b);
    for (const linea of p) {
      const m = /^([\d.]+) \+ ([\d.]+) = ([\d.]+)$/.exec(linea);
      if (m) assert.equal(unf(m[1]) + unf(m[2]), unf(m[3]), linea);
    }
    const u = /^Sumamos los saltos: (.+) = ([\d.]+)$/.exec(p.at(-1));
    assert.ok(u, p.at(-1));
    assert.equal(unf(u[2]), a - b);
    assert.equal(u[1].split(' + ').map(unf).reduce((x, y) => x + y, 0n), a - b);
  }
});

test('multiplicación posicional: 347 × 26 y ceros intermedios', () => {
  assert.deepEqual(pasosMultiplicacionPosicional(347n, 26n), [
    '347 × 6 = 2.082',
    '347 × 20 = 6.940 (es 694 corrido 1 lugar a la izquierda)',
    'Sumamos los productos parciales: 2.082 + 6.940 = 9.022',
  ]);
  assert.deepEqual(pasosMultiplicacionPosicional(123n, 105n), [
    '123 × 5 = 615',
    'Dígito 0 en esa posición: el producto parcial vale 0.',
    '123 × 100 = 12.300 (es 123 corrido 2 lugares a la izquierda)',
    'Sumamos los productos parciales: 615 + 12.300 = 12.915',
  ]);
  assert.deepEqual(pasosMultiplicacionPosicional(5n, 0n), ['Cualquier número multiplicado por 0 es 0.']);
});

test('multiplicación por áreas', () => {
  const p = pasosMultiplicacionAreas(347n, 26n);
  assert.equal(p[0], 'Descomponemos: 347 = 300 + 40 + 7 y 26 = 20 + 6.');
  assert.ok(p.includes('300 × 20 = 6.000'));
  assert.ok(p.includes('7 × 6 = 42'));
  assert.equal(p.at(-1), 'Sumamos todas las áreas: 6.000 + 1.800 + 800 + 240 + 140 + 42 = 9.022');
  assert.equal(pasosMultiplicacionAreas(123456n, 12345n), null);
  assert.equal(pasosMultiplicacionAreas(0n, 5n), null);
});

test('división larga: casos y división entre cero', () => {
  let p = pasosDivisionLarga(1248n, 12n);
  assert.equal(p.at(-2), 'Cociente: 104, resto: 0.');
  assert.equal(p.at(-1), 'Comprobación: 104 × 12 + 0 = 1.248.');
  p = pasosDivisionLarga(1250n, 12n);
  assert.ok(p.includes('Tomamos 50: 12 × 4 = 48; 50 − 48 = 2.'));
  assert.equal(p.at(-2), 'Cociente: 104, resto: 2.');
  assert.equal(p.at(-1), 'Comprobación: 104 × 12 + 2 = 1.250.');
  assert.equal(pasosDivisionLarga(5n, 12n).at(-2), 'Cociente: 0, resto: 5.');
  assert.equal(pasosDivisionLarga(0n, 7n).at(-2), 'Cociente: 0, resto: 0.');
  assert.equal(pasosDivisionLarga(5n, 0n), null);
});

test('división larga: propiedad con 300 casos', () => {
  for (let i = 0; i < 300; i++) {
    const a = BigInt(azar(1000000000));
    const b = BigInt(1 + azar(9999));
    const m = /^Cociente: ([\d.]+), resto: ([\d.]+)\.$/.exec(pasosDivisionLarga(a, b).at(-2));
    assert.ok(m);
    assert.equal(unf(m[1]) * b + unf(m[2]), a);
    assert.ok(unf(m[2]) < b);
  }
});

test('división por restas sucesivas', () => {
  assert.equal(pasosDivisionRestasSucesivas(147n, 4n), null);
  const p = pasosDivisionRestasSucesivas(45n, 4n);
  assert.equal(p.length, 13);
  assert.equal(p.at(-1), 'Restamos 11 veces, así que el cociente es 11 y sobra 1.');
  assert.equal(pasosDivisionRestasSucesivas(4n, 4n).at(-1), 'Restamos 1 vez, así que el cociente es 1 y sobra 0.');
});

test('respuestaEspecialMatematica: afirmaciones', () => {
  let r = respuestaEspecialMatematica('2 + 2 = 5, ¿verdad?');
  assert.equal(r.correcta, false);
  assert.equal(r.resultado, '4');
  assert.ok(r.mensaje.includes('No es correcto: 2 + 2 = 4, no 5.'));
  assert.ok(r.mensaje.includes('se pasa por 1'));
  r = respuestaEspecialMatematica('2 + 2 = 4');
  assert.equal(r.correcta, true);
  assert.ok(r.mensaje.startsWith('✅ Sí, es correcto: 2 + 2 = 4.'));
  assert.ok(r.mensaje.includes('En palabras: cuatro.'));
  r = respuestaEspecialMatematica('5 − 3 = 3');
  assert.ok(r.mensaje.includes('No es correcto: 5 − 3 = 2, no 3.'));
  r = respuestaEspecialMatematica('12 x 3 = 35');
  assert.ok(r.mensaje.includes('No es correcto: 12 × 3 = 36, no 35.'));
  assert.ok(r.mensaje.includes('se queda corto por 1'));
  r = respuestaEspecialMatematica('1.000 + 1.000 = 2.000');
  assert.equal(r.correcta, true);
  assert.ok(r.mensaje.startsWith('✅ Sí, es correcto: 1.000 + 1.000 = 2.000.'));
  r = respuestaEspecialMatematica('7 ÷ 2 = 3');
  assert.ok(r.mensaje.startsWith('Casi:'));
});

test('respuestaEspecialMatematica: división entre cero y casos que debe ignorar', () => {
  for (const t of ['12 ÷ 0', '12 entre cero', '12 dividido entre cero']) {
    const r = respuestaEspecialMatematica(t);
    assert.equal(r.tipo, 'division_por_cero', t);
    assert.ok(r.mensaje.includes('no está definida'), t);
  }
  for (const t of ['3/4 + 1/2 = 5/4', '2,5 + 1 = 3,5', '-3 + 5 = 2', '10 - 5 - 3 = 2', 'cuánto es 4.835 + 2.967', 'hola', '12 ÷ 0,5']) {
    assert.equal(respuestaEspecialMatematica(t), null, t);
  }
});

test('esConsultaMatematicaPura: positivos', () => {
  for (const t of ['cuánto es 345 + 278', 'resuelve 12 × 8', '2 elevado a 5', '347 * 26', '347 × 26', '5.002 − 3.478', '2 + 2 = 5, ¿verdad?', 'calcula el 15% de 800', '3/4 + 1/2', '12 ÷ 0', '12 entre cero', 'raíz cuadrada de 144', 'multiplica 347 por 26', '345 más 278', 'suma 45 + 38 para primero']) {
    assert.equal(esConsultaMatematicaPura(t), true, t);
  }
});

test('esConsultaMatematicaPura: negativos (currículo, planificación, ruido)', () => {
  for (const t of ['currículo de 6.º de Matemática sobre potencias', '¿Qué dice el currículo de 5.º de Matemática sobre las fracciones?', 'planifica fracciones para 3.º', '5 estudiantes', 'grado 3', 'hola', 'ayúdame con las fracciones de 4.º', 'contenidos de 3.º sobre suma y resta', '¿Qué dice el currículo de 4.º de Lengua sobre la conversación?', '5 estudiantes más 3 profesores', 'primero y segundo de Lengua: la noticia']) {
    assert.equal(esConsultaMatematicaPura(t), false, t);
  }
});

test('coincideConTema: exige el tema, no los indicadores', () => {
  const t3nat = 'Ciclos de vida, sistemas del cuerpo humano, nutrición balanceada, suelo y estados del agua';
  assert.equal(coincideConTema('materia', t3nat), false);
  assert.equal(coincideConTema('conversacion', 'Textos funcionales: La conversación'), true);
  assert.equal(coincideConTema('plan ecosistemas seres vivos', 'Ciencias de la Tierra y el Universo: Capas terrestres, minerales, recursos hídricos y conservación'), false);
  assert.equal(coincideConTema('plan ecosistemas seres vivos', 'Ciencias de la Vida: Ecosistemas, cadenas y redes tróficas, nutrición y sistemas del cuerpo humano'), true);
  assert.equal(coincideConTema('potencias', 'Numeración: Números enteros, potencias, raíces, razones, proporciones y porcentajes'), true);
  assert.equal(coincideConTema('', 'cualquier tema'), true);
  assert.equal(coincideConTema('sumas', 'La suma y la resta'), true);
  assert.equal(coincideConTema('celula', 'Ciencias de la Vida: Biodiversidad de los seres vivos, organización celular, plantas y animales'), true);
  assert.equal(coincideConTema('fracciones', 'Geometría: Punto, recta, segmento'), false);
});

test('listarTemasUnicos y formatearListaTemas: tope 10 y "y N más"', () => {
  const filas = Array.from({ length: 11 }, (_, i) => ({ tema: `Tema número ${i + 1}` }));
  filas.push({ tema: 'TEMA NUMERO 3' });
  const temas = listarTemasUnicos(filas);
  assert.equal(temas.length, 11);
  const texto = formatearListaTemas(temas, 10);
  assert.ok(texto.endsWith(' y 1 más.'));
  assert.ok(texto.includes('Tema número 10'));
  assert.ok(!texto.includes('Tema número 11'));
  assert.equal(formatearListaTemas(temas.slice(0, 10), 10).includes('más'), false);
  assert.equal(formatearListaTemas([], 10), '');
});

test('consultarTemasREST: URL, cabeceras y fallos', async () => {
  const llamadas = [];
  const ok = async (u, o) => { llamadas.push({ u, o }); return { ok: true, json: async () => [{ source_id: 'a', tema: 'x' }] }; };
  const filas = await consultarTemasREST({ url: 'https://ejemplo.supabase.co/', clave: 'CLAVE_FALSA', grado: 4, area: 'Lengua Española', fetchImpl: ok });
  assert.equal(filas.length, 1);
  assert.match(llamadas[0].u, /^https:\/\/ejemplo\.supabase\.co\/rest\/v1\/curriculo_secuencias\?/);
  assert.match(llamadas[0].u, /grado_num=eq\.4/);
  assert.match(llamadas[0].u, /area=eq\.Lengua%20Espa%C3%B1ola/);
  assert.equal(llamadas[0].o.headers.apikey, 'CLAVE_FALSA');
  assert.deepEqual(await consultarTemasREST({ url: 'https://e.co', clave: 'k', grado: 4, area: 'x', fetchImpl: async () => ({ ok: false }) }), []);
  assert.deepEqual(await consultarTemasREST({ url: 'https://e.co', clave: 'k', grado: 4, area: 'x', fetchImpl: async () => { throw new Error('red'); } }), []);
  assert.deepEqual(await consultarTemasREST({ url: '', clave: 'k', grado: 4, area: 'x' }), []);
});
