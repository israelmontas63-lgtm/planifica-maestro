import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HANDLERS, recuperarPorHibrida, UMBRAL_HIBRIDO } from '../shared/herramientas.mjs';

describe('FIX 4 — Búsqueda Híbrida y Compuerta de Score', () => {
  it('UMBRAL_HIBRIDO está fijado en 0.015 (RRF calibrado)', () => {
    assert.equal(UMBRAL_HIBRIDO, 0.015);
  });

  it('Score 0.014 (por debajo de umbral calibrado 0.015) se descarta', async () => {
    const mockEnv = {
      AI: {
        run: async () => ({ data: [new Array(1024).fill(0.1)] })
      },
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-key'
    };

    const originalFetch = globalThis.fetch;
    let rpcCalled = false;
    let secuenciasCalled = false;

    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes('/rpc/buscar_curriculo_hibrido')) {
        rpcCalled = true;
        return new Response(JSON.stringify([
          { secuencia_id: 'sec-1', contenido: 'Prueba', score: 0.014 }
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (u.includes('/rest/v1/curriculo_secuencias')) {
        secuenciasCalled = true;
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response('Not found', { status: 404 });
    };

    try {
      const res = await recuperarPorHibrida({
        grado: '1er Grado',
        area: 'Lengua Española',
        tema_o_concepto: 'La noticia'
      }, mockEnv);

      assert.equal(rpcCalled, true);
      assert.equal(secuenciasCalled, false, 'No debió consultar secuencias porque score 0.014 < 0.015');
      assert.deepEqual(res, []);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('Score 0.0182 (coincidencia en ambas listas) pasa el umbral', async () => {
    const mockEnv = {
      AI: {
        run: async () => ({ data: [new Array(1024).fill(0.1)] })
      },
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-key'
    };

    const originalFetch = globalThis.fetch;
    let secuenciasCalled = false;

    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes('/rpc/buscar_curriculo_hibrido')) {
        return new Response(JSON.stringify([
          { secuencia_id: 'sec-2', contenido: 'Prueba válida', score: 0.0182 }
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (u.includes('/rest/v1/curriculo_secuencias?id=in.(sec-2)')) {
        secuenciasCalled = true;
        return new Response(JSON.stringify([
          { id: 'sec-2', tema: 'La noticia', area: 'Lengua Española', grado_num: 1 }
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('Not found', { status: 404 });
    };

    try {
      const res = await recuperarPorHibrida({
        grado: '1er Grado',
        area: 'Lengua Española',
        tema_o_concepto: 'La noticia'
      }, mockEnv);

      assert.equal(secuenciasCalled, true);
      assert.equal(res.length, 1);
      assert.equal(res[0].id, 'sec-2');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('Sin env.AI no se invoca búsqueda semántica y devuelve base', async () => {
    const mockEnv = {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key'
      // env.AI ausente
    };

    const originalFetch = globalThis.fetch;
    let hibridaIntentada = false;

    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes('buscar_curriculo')) {
        // Simula búsqueda exacta sin resultados
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (u.includes('hibrido') || u.includes('curriculo_embeddings')) {
        hibridaIntentada = true;
      }
      return new Response('Not found', { status: 404 });
    };

    try {
      const res = await HANDLERS.consultar_base_datos({
        nivel: 'Primario',
        grado: '1er Grado',
        area: 'Lengua Española',
        tema_o_concepto: 'Inexistente'
      }, mockEnv);

      assert.equal(hibridaIntentada, false);
      assert.deepEqual(res.resultado, []);
      assert.ok(res.aviso);
      assert.equal(res.aviso_semantico, undefined);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('HANDLERS.consultar_base_datos anota aviso_semantico cuando hay match semántico', async () => {
    const mockEnv = {
      AI: {
        run: async () => ({ data: [new Array(1024).fill(0.1)] })
      },
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-key'
    };

    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes('/rpc/buscar_curriculo_hibrido')) {
        return new Response(JSON.stringify([
          { secuencia_id: 'sec-99', contenido: 'Noticia comunitaria', score: 0.021 }
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (u.includes('/rpc/buscar_curriculo_secuencias') || u.includes('/rpc/buscar_curriculo')) {
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (u.includes('/rest/v1/curriculo_secuencias?id=in.(sec-99)')) {
        return new Response(JSON.stringify([
          { id: 'sec-99', tema: 'La noticia comunitaria', area: 'Lengua Española', grado_num: 1 }
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('Not found', { status: 404 });
    };

    try {
      const res = await HANDLERS.consultar_base_datos({
        nivel: 'Primario',
        grado: '1er Grado',
        area: 'Lengua Española',
        tema_o_concepto: 'Noticia del barrio'
      }, mockEnv);

      assert.equal(res.resultado.length, 1);
      assert.match(res.aviso_semantico, /similitud semántica/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
