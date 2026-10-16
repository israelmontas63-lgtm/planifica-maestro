import test from 'node:test';
import assert from 'node:assert/strict';
import { extraerBloquesCompletados } from '../shared/parseadorJsonSeguro.js';

test('1. parseadorJsonSeguro maneja fragmento invalido sin reventar y registra warn si DEBUG_PARSER=true', () => {
  const originalDebug = process.env.DEBUG_PARSER;
  const originalWarn = console.warn;
  let warnRegistrado = false;

  try {
    process.env.DEBUG_PARSER = 'true';
    console.warn = (...args) => {
      if (args.some(a => typeof a === 'string' && a.includes('[ParseadorJsonSeguro]'))) {
        warnRegistrado = true;
      }
    };

    // Texto con bloque incompleto / roto intencionalmente
    const textoIncompleto = '{"situacion_aprendizaje": { "tema": "ciencias"';
    const bloques = extraerBloquesCompletados(textoIncompleto);

    assert.ok(Array.isArray(bloques), 'Debe retornar un arreglo sin reventar');
  } finally {
    process.env.DEBUG_PARSER = originalDebug;
    console.warn = originalWarn;
  }
});

test('2. client/src/api.js no revienta ante JSON malformado y deja rastro si DEBUG=true', async () => {
  const originalDebug = process.env.DEBUG;
  const originalWarn = console.warn;
  const originalFetch = globalThis.fetch;
  let logDetectado = false;

  try {
    process.env.DEBUG = 'true';
    console.warn = (...args) => {
      if (args.some(a => typeof a === 'string' && a.includes('[api:'))) {
        logDetectado = true;
      }
    };

    // Simular un endpoint que devuelve 500 con HTML plano (no JSON)
    globalThis.fetch = async () => ({
      ok: false,
      status: 500,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON at position 0');
      }
    });

    const { obtenerEsquemasCurriculares } = await import('../client/src/api.js');
    const res = await obtenerEsquemasCurriculares();

    assert.equal(res, null, 'Debe degradar a null con elegancia');
    assert.ok(logDetectado, 'Debe haber emitido rastro en consola con DEBUG=true');
  } finally {
    process.env.DEBUG = originalDebug;
    console.warn = originalWarn;
    globalThis.fetch = originalFetch;
  }
});
