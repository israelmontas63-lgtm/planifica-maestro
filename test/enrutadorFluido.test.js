import test from 'node:test';
import assert from 'node:assert/strict';
import {
  determinarContextoOperativo,
  EnrutadorFluido,
  DOCENTE_PRODUCCION,
  EJEMPLOS_VEROSIMILES_RD
} from '../worker/services/enrutadorFluido.js';

test('EnrutadorFluido - Modo Producción canónico por defecto', () => {
  const ctx = determinarContextoOperativo('planifícame una clase de lengua española');
  assert.equal(ctx.modo, 'produccion');
  assert.equal(ctx.esEjemplo, false);
  assert.equal(ctx.docente, DOCENTE_PRODUCCION.nombre);
  assert.equal(ctx.escuela, DOCENTE_PRODUCCION.escuela);
  assert.equal(ctx.modalidad, DOCENTE_PRODUCCION.modalidad);
  assert.equal(ctx.duracion, '45 minutos');
});

test('EnrutadorFluido - Detección de palabras clave de muestra (ejemplo, muéstrame, prueba)', () => {
  const promptsMuestra = [
    'dame un ejemplo de planificación de ciencias',
    'muéstrame una clase para 3er grado',
    'haz una prueba de planificación didáctica',
    'ensayo pedagógico libre'
  ];

  for (const prompt of promptsMuestra) {
    const ctx = determinarContextoOperativo(prompt);
    assert.equal(ctx.modo, 'demostrativo', `Falló detección en: ${prompt}`);
    assert.equal(ctx.esEjemplo, true);
    assert.ok(ctx.docente);
    assert.ok(ctx.escuela);
    assert.ok(ctx.modalidad);
    assert.notEqual(ctx.docente, DOCENTE_PRODUCCION.nombre);
  }
});

test('EnrutadorFluido - Soporte para opciones explícitas', () => {
  const ctx = determinarContextoOperativo('planifica una clase', {
    modo: 'demostrativo',
    docente: 'Prof. Juan Bosch',
    escuela: 'Liceo Experimental'
  });

  assert.equal(ctx.modo, 'demostrativo');
  assert.equal(ctx.docente, 'Prof. Juan Bosch');
  assert.equal(ctx.escuela, 'Liceo Experimental');
});

test('EnrutadorFluido - Clase EnrutadorFluido y formateo de memoria de contexto', () => {
  const router = new EnrutadorFluido();
  const ctxProd = router.determinarContextoOperativo('clase normal');
  const memoriaProd = router.formatearMemoriaContexto(ctxProd);
  assert.ok(memoriaProd.includes('MEMORIA PERMANENTE DEL DOCENTE'));
  assert.ok(memoriaProd.includes('Israel Montás'));

  const ctxDemo = router.determinarContextoOperativo('dame un ejemplo');
  const memoriaDemo = router.formatearMemoriaContexto(ctxDemo);
  assert.ok(memoriaDemo.includes('CONTEXTO DOCENTE (MODO DEMOSTRATIVO)'));
  assert.ok(memoriaDemo.includes(ctxDemo.docente));
});
