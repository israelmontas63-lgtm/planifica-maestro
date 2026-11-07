import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GestorArchivos } from '../worker/services/gestorArchivos.js';

describe('GestorArchivos - Almacenamiento Frío en Supabase Storage', () => {
  const envMock = {
    SUPABASE_URL: 'https://test-project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key'
  };

  it('debe subir exitosamente una imagen base64 y retornar archivoId y archivoUrl pública', async () => {
    let peticionCapturada = null;
    const fetchOriginal = global.fetch;

    global.fetch = async (url, opts) => {
      peticionCapturada = { url, opts };
      return {
        ok: true,
        status: 200,
        json: async () => ({ Key: 'capturas_asistente/img_test.jpg' })
      };
    };

    const gestor = new GestorArchivos(envMock);
    const base64Data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    const res = await gestor.subirImagenBase64(base64Data, 'image/png');

    assert.ok(res.archivoId.startsWith('img_'));
    assert.ok(res.archivoId.endsWith('.png'));
    assert.equal(res.archivoUrl, `https://test-project.supabase.co/storage/v1/object/public/capturas_asistente/${res.archivoId}`);

    assert.ok(peticionCapturada.url.includes('/storage/v1/object/capturas_asistente/img_'));
    assert.equal(peticionCapturada.opts.method, 'POST');
    assert.equal(peticionCapturada.opts.headers.apikey, 'test-service-key');
    assert.equal(peticionCapturada.opts.headers.Authorization, 'Bearer test-service-key');
    assert.equal(peticionCapturada.opts.headers['Content-Type'], 'image/png');

    global.fetch = fetchOriginal;
  });

  it('debe manejar con resiliencia fallos HTTP retornando archivoId pero archivoUrl nulo', async () => {
    const fetchOriginal = global.fetch;
    global.fetch = async () => ({
      ok: false,
      status: 500,
      text: async () => 'Error interno'
    });

    const gestor = new GestorArchivos(envMock);
    const res = await gestor.subirImagenBase64('data:image/jpeg;base64,123456');

    assert.ok(res.archivoId.startsWith('img_'));
    assert.equal(res.archivoUrl, null);

    global.fetch = fetchOriginal;
  });

  it('debe retornar nulos si la entrada base64Data es vacía o nula', async () => {
    const gestor = new GestorArchivos(envMock);
    const res = await gestor.subirImagenBase64(null);
    assert.deepEqual(res, { archivoId: null, archivoUrl: null });
  });
});
