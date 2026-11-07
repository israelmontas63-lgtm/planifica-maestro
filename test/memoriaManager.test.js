import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoriaManager } from '../worker/services/memoriaManager.js';

describe('MemoriaManager - Persistencia Multimodal en Supabase', () => {
  const urlMock = 'https://test.supabase.co';
  const keyMock = 'service-role-test-key';

  it('debe guardar un mensaje multimodal truncando imágenes excesivamente largas', async () => {
    let capturedRequest = null;
    const originalFetch = global.fetch;

    global.fetch = async (url, opts) => {
      capturedRequest = { url, opts, body: JSON.parse(opts.body) };
      return { ok: true, status: 201 };
    };

    const manager = new MemoriaManager(urlMock, keyMock);
    const imagenLarga = 'data:image/jpeg;base64,' + 'A'.repeat(600);

    await manager.guardarMensaje({
      sesionId: 'sesion-123',
      rol: 'user',
      contenido: 'Observa esta lámina de ciencias',
      imagenBase64: imagenLarga,
      metadatos: { origen: 'pwa' }
    });

    assert.equal(capturedRequest.url, 'https://test.supabase.co/rest/v1/conversaciones_mensajes');
    assert.equal(capturedRequest.opts.headers.apikey, keyMock);
    assert.equal(capturedRequest.opts.headers.Authorization, `Bearer ${keyMock}`);
    assert.equal(capturedRequest.opts.headers.Prefer, 'return=minimal');

    assert.equal(capturedRequest.body.sesion_id, 'sesion-123');
    assert.equal(capturedRequest.body.rol, 'user');
    assert.equal(capturedRequest.body.contenido, 'Observa esta lámina de ciencias');
    assert.ok(capturedRequest.body.imagen_url.endsWith('...[truncated]'));
    assert.equal(capturedRequest.body.metadatos.origen, 'pwa');

    global.fetch = originalFetch;
  });

  it('debe guardar y procesar mensajes con metadatos_adjunto de almacenamiento frío', async () => {
    let capturedRequest = null;
    const originalFetch = global.fetch;

    global.fetch = async (url, opts) => {
      capturedRequest = { url, opts, body: JSON.parse(opts.body) };
      return { ok: true, status: 201 };
    };

    const manager = new MemoriaManager(urlMock, keyMock);
    const metadatosAdjunto = {
      tipo: 'imagen',
      id_archivo: 'captura_token_01.jpg',
      resumen_visual: 'El usuario mostró la pantalla de creación de tokens con Full Access seleccionado.',
      url_descarga: 'https://obcjdxearmmvtihfmtaa.supabase.co/storage/v1/object/public/capturas/captura_token_01.jpg'
    };

    await manager.guardarMensaje({
      sesionId: 'sesion-cold-1',
      rol: 'user',
      contenido: '¿Cómo procedo desde aquí?',
      metadatos: { metadatos_adjunto: metadatosAdjunto }
    });

    assert.equal(capturedRequest.body.tiene_imagen, true);
    assert.equal(capturedRequest.body.imagen_url, metadatosAdjunto.url_descarga);
    assert.equal(capturedRequest.body.metadatos.metadatos_adjunto.resumen_visual, metadatosAdjunto.resumen_visual);

    global.fetch = originalFetch;
  });

  it('debe obtener y formatear el historial inyectando el resumen_visual denso para optimizar tokens', async () => {
    const originalFetch = global.fetch;

    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => [
        {
          rol: 'user',
          contenido: 'Pregunta del usuario',
          tiene_imagen: true,
          metadatos: {
            metadatos_adjunto: {
              tipo: 'imagen',
              id_archivo: 'captura_token_01.jpg',
              resumen_visual: 'El usuario mostró la pantalla de creación de tokens con Full Access seleccionado.',
              url_descarga: 'https://obcjdxearmmvtihfmtaa.supabase.co/storage/v1/object/public/capturas/...'
            }
          }
        },
        {
          rol: 'model',
          contenido: 'Debes pulsar en Generar Token y copiar el secreto.'
        }
      ]
    });

    const manager = new MemoriaManager(urlMock, keyMock);
    const historial = await manager.obtenerHistorial('sesion-cold-1', 5);

    assert.equal(historial.length, 2);
    assert.equal(historial[0].role, 'user');
    assert.ok(historial[0].parts[0].text.includes('Contexto visual previo: El usuario mostró la pantalla'));
    assert.ok(historial[0].parts[0].text.includes('Pregunta del usuario'));

    global.fetch = originalFetch;
  });

  it('debe obtener y formatear el historial al estándar Gemini con partes inlineData', async () => {
    const originalFetch = global.fetch;

    global.fetch = async (url, opts) => {
      assert.ok(url.includes('sesion_id=eq.sesion-456'));
      assert.ok(url.includes('order=creado_en.asc'));
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            rol: 'user',
            contenido: '¿Qué animal es este?',
            imagen_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
          },
          {
            rol: 'model',
            contenido: 'Es un mamífero vertebrado de la fauna dominicana.'
          }
        ]
      };
    };

    const manager = new MemoriaManager(urlMock, keyMock);
    const historial = await manager.obtenerHistorial('sesion-456', 5);

    assert.equal(historial.length, 2);

    // Turno 1 (User con imagen)
    assert.equal(historial[0].role, 'user');
    assert.equal(historial[0].parts.length, 2);
    assert.equal(historial[0].parts[0].inlineData.mimeType, 'image/png');
    assert.equal(historial[0].parts[0].inlineData.data, 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    assert.equal(historial[0].parts[1].text, '¿Qué animal es este?');

    // Turno 2 (Model)
    assert.equal(historial[1].role, 'model');
    assert.equal(historial[1].parts.length, 1);
    assert.equal(historial[1].parts[0].text, 'Es un mamífero vertebrado de la fauna dominicana.');

    global.fetch = originalFetch;
  });

  it('debe retornar un arreglo vacío ante fallos HTTP', async () => {
    const originalFetch = global.fetch;

    global.fetch = async () => ({
      ok: false,
      status: 500
    });

    const manager = new MemoriaManager(urlMock, keyMock);
    const historial = await manager.obtenerHistorial('sesion-fail');
    assert.deepEqual(historial, []);

    global.fetch = originalFetch;
  });
});
