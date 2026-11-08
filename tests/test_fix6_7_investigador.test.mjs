import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { guardarEnCacheInvestigacion, ejecutarBusquedaWeb } from '../worker/services/investigadorService.js';

describe('FIX 6 & 7 / CORRECCIONES B & C — Investigador Service', () => {
  it('CORRECCIÓN B: guardarEnCacheInvestigacion usa ?on_conflict=hash_consulta y maneja respuesta HTTP', async () => {
    let called = false;
    let urlCalled = null;
    let payload = null;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      called = true;
      urlCalled = url;
      payload = JSON.parse(options.body);
      return new Response(JSON.stringify({ ok: true }), { status: 201 });
    };

    try {
      const mockEnv = {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-key',
      };
      await guardarEnCacheInvestigacion(mockEnv, 'hash123', { datos: 'resultado' }, ['https://minerd.gob.do'], 'alta', 24);

      assert.equal(called, true);
      assert.equal(urlCalled, 'https://test.supabase.co/rest/v1/cache_investigacion?on_conflict=hash_consulta');
      assert.equal(payload.hash_consulta, 'hash123');
      assert.deepEqual(payload.fuentes, ['https://minerd.gob.do']);
      assert.equal(payload.nivel_confianza, 'alta');
      assert.ok(payload.expira_at);
      const expira = new Date(payload.expira_at).getTime();
      const now = Date.now();
      assert.ok(expira - now > 23 * 3600 * 1000 && expira - now < 25 * 3600 * 1000);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('CORRECCIÓN B: un 409 o 500 en guardarEnCacheInvestigacion produce warn, no excepción', async () => {
    const originalFetch = globalThis.fetch;
    let warnLogs = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warnLogs.push(args.join(' '));

    globalThis.fetch = async () => {
      return new Response('Conflict', { status: 409 });
    };

    try {
      const mockEnv = {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-key',
      };
      // No debe lanzar excepción
      await assert.doesNotReject(async () => {
        await guardarEnCacheInvestigacion(mockEnv, 'hash_conflicto', { dato: 1 });
      });

      assert.ok(warnLogs.some(log => log.includes('[CacheInvestigacion] HTTP 409')));
    } finally {
      globalThis.fetch = originalFetch;
      console.warn = originalWarn;
    }
  });

  it('CORRECCIÓN C: lanzar excepción en ejecutarInvestigacionWeb produce error: true', async () => {
    const envConError = {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'anon'
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error('Fallo crítico de conexión');
    };

    try {
      const res = await ejecutarBusquedaWeb('consulta con error técnico', envConError);
      assert.equal(res.error, true);
      assert.equal(res.sin_resultados, true);
      assert.deepEqual(res.fuentes, []);
      assert.match(res.resumen, /falló por un error técnico/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('CORRECCIÓN C: búsqueda normal sin fuentes devuelve sin_resultados: true sin error: true', async () => {
    const res = await ejecutarBusquedaWeb('consulta sin fuentes', {});
    assert.equal(res.error, undefined);
    assert.equal(res.sin_resultados, true);
    assert.deepEqual(res.fuentes, []);
    assert.match(res.resumen, /No se encontraron fuentes oficiales en los dominios autorizados/);
  });
});
