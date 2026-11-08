import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import { UMBRAL_HIBRIDO } from '../shared/herramientas.mjs';

describe('FIX 11 — Ruta /api/owner/probar-hibrido', () => {
  const env = {
    OWNER_MASTER_KEY: 'clave-secreta-dueno-999',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key'
  };

  it('Petición sin x-owner-key retorna 401 No autorizado', async () => {
    const req = new Request('https://worker.dev/api/owner/probar-hibrido?q=noticia', {
      method: 'GET',
      headers: {}
    });

    const res = await worker.fetch(req, env, {});
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error, 'No autorizado');
  });

  it('Petición con x-owner-key inválida retorna 401 No autorizado', async () => {
    const req = new Request('https://worker.dev/api/owner/probar-hibrido?q=noticia', {
      method: 'GET',
      headers: {
        'x-owner-key': 'clave-falsa'
      }
    });

    const res = await worker.fetch(req, env, {});
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error, 'No autorizado');
  });

  it('Petición con x-owner-key correcta invoca búsqueda híbrida y mapea resultados con pasa: true/false', async () => {
    const originalFetch = globalThis.fetch;
    const mockEnv = {
      ...env,
      AI: {
        run: async () => ({ data: [new Array(1024).fill(0.05)] })
      }
    };

    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes('/rpc/buscar_curriculo_hibrido')) {
        return new Response(JSON.stringify([
          { secuencia_id: 'sec-dual', contenido: 'Contenido oficial verificado en ambas listas', score: 0.0195 },
          { secuencia_id: 'sec-single', contenido: 'Contenido en una sola lista léxica', score: 0.0163 }
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('Not found', { status: 404 });
    };

    try {
      const req = new Request('https://worker.dev/api/owner/probar-hibrido?q=La%20noticia&grado=2&area=Lengua%20Española', {
        method: 'GET',
        headers: {
          'x-owner-key': 'clave-secreta-dueno-999'
        }
      });

      const res = await worker.fetch(req, mockEnv, {});
      assert.equal(res.status, 200);
      const data = await res.json();

      assert.equal(data.q, 'La noticia');
      assert.equal(data.grado, 2);
      assert.equal(data.area, 'Lengua Española');
      assert.equal(data.umbral, UMBRAL_HIBRIDO);
      assert.equal(Array.isArray(data.hits), true);
      assert.equal(data.hits.length, 2);

      // Primer hit supera el umbral (0.0195 >= 0.017)
      assert.equal(data.hits[0].secuencia_id, 'sec-dual');
      assert.equal(data.hits[0].score, 0.0195);
      assert.equal(data.hits[0].pasa, true);
      assert.ok(data.hits[0].inicio.includes('Contenido oficial'));

      // Segundo hit no supera el umbral (0.0163 < 0.017)
      assert.equal(data.hits[1].secuencia_id, 'sec-single');
      assert.equal(data.hits[1].score, 0.0163);
      assert.equal(data.hits[1].pasa, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('Retorna hits: null de forma transparente cuando el híbrido no está disponible (sin fallar)', async () => {
    // Sin mockEnv.AI, buscarCurriculoHibrido retorna null
    const req = new Request('https://worker.dev/api/owner/probar-hibrido?q=consulta', {
      method: 'GET',
      headers: {
        'x-owner-key': 'clave-secreta-dueno-999'
      }
    });

    const res = await worker.fetch(req, env, {});
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.hits, null);
    assert.equal(data.umbral, UMBRAL_HIBRIDO);
  });
});
