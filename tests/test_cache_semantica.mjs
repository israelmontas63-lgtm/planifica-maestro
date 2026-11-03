import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generarClaveCache,
  consultarCache,
  guardarEnCache
} from '../worker/services/cacheSemanticaService.js';

describe('Caché Semántica Canónica - Planifica Maestro', () => {
  it('generarClaveCache normaliza tildes, signos y palabras vacías con formato grado:area:tema', () => {
    const clave = generarClaveCache(3, 'Lengua Española', '¿Qué es el cuento y sus partes?');
    assert.strictEqual(clave, '3:lengua española:que es cuento y sus partes');
  });

  it('generarClaveCache retorna null si falta algún parámetro obligatorio', () => {
    assert.strictEqual(generarClaveCache(null, 'Matemática', 'Fracciones'), null);
    assert.strictEqual(generarClaveCache(4, '', 'Ecosistemas'), null);
    assert.strictEqual(generarClaveCache(4, 'Ciencias', ''), null);
  });

  it('consultarCache retorna null de forma segura si no hay credenciales de Supabase', async () => {
    const res = await consultarCache({}, '3:lengua:cuento');
    assert.strictEqual(res, null);
  });

  it('consultarCache y guardarEnCache procesan peticiones correctamente con fetch mockeado', async () => {
    let urlConsultada = '';
    let cuerpoGuardado = null;

    const mockEnv = {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-key'
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      urlConsultada = url;
      if (options.method === 'POST' && url.includes('consultar_cache_planificacion')) {
        return {
          ok: true,
          json: async () => [{ plan_json: { tema: 'El Cuento' }, fuentes_utilizadas: [] }]
        };
      }
      if (options.method === 'POST' && url.includes('curriculo_cache_semantica')) {
        cuerpoGuardado = JSON.parse(options.body);
        return { ok: true };
      }
      return { ok: true, json: async () => [] };
    };

    try {
      const hit = await consultarCache(mockEnv, '3:lengua:cuento');
      assert.ok(hit !== null);
      assert.strictEqual(hit.plan_json.tema, 'El Cuento');

      await guardarEnCache(mockEnv, {
        claveHash: '3:lengua:cuento',
        grado: 3,
        area: 'Lengua Española',
        tema: 'El Cuento',
        planJson: { tema: 'El Cuento' }
      });
      assert.strictEqual(cuerpoGuardado.clave_hash, '3:lengua:cuento');
      assert.strictEqual(cuerpoGuardado.grado, 3);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
