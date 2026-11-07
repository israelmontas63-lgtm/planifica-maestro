import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MotorEdicionVisual } from '../worker/services/motorEdicionVisual.js';

describe('MotorEdicionVisual - Pipeline de Edición y Renderizado Visual', () => {
  const envMock = {
    GEMINI_API_KEY: 'test-api-key',
    SUPABASE_URL: 'https://test-project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key'
  };

  it('debe formular el prompt técnico exacto de edición visual mediante Gemini 2.5 Flash', async () => {
    let promptEnviado = null;
    const mockAI = {
      models: {
        generateContent: async ({ contents }) => {
          promptEnviado = contents[0].parts[1].text;
          return {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: 'A high quality 3D clay-render style illustration of the educational character, vibrant solid cerulean blue studio backdrop, soft ambient lighting, octane render, clean edges, educational poster aesthetics.'
                    }
                  ]
                }
              }
            ]
          };
        }
      }
    };

    const motor = new MotorEdicionVisual({ ...envMock, ai: mockAI });
    const promptTecnico = await motor.formularPromptEdicion({
      imagenBase64: 'data:image/png;base64,abcdef123',
      mimeType: 'image/png',
      instruccionUsuario: 'Cambia el fondo a color azul y estilo 3D'
    });

    assert.ok(promptEnviado.includes('Cambia el fondo a color azul y estilo 3D'));
    assert.ok(promptTecnico.includes('3D clay-render'));
    assert.ok(promptTecnico.includes('cerulean blue'));
  });

  it('debe renderizar la imagen con Imagen 3 vía API predict', async () => {
    const fetchOriginal = global.fetch;
    let urlCapturada = null;
    let payloadCapturado = null;

    global.fetch = async (url, opts) => {
      urlCapturada = url;
      payloadCapturado = JSON.parse(opts.body);
      return {
        ok: true,
        json: async () => ({
          predictions: [
            { bytesBase64Encoded: 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' }
          ]
        })
      };
    };

    const motor = new MotorEdicionVisual(envMock);
    const res = await motor.renderizarImagen({
      promptTecnico: '3D character on vibrant blue background'
    });

    assert.ok(urlCapturada.includes('imagen-3.0-generate-002:predict'));
    assert.equal(payloadCapturado.instances[0].prompt, '3D character on vibrant blue background');
    assert.ok(res.imagenBase64.startsWith('data:image/jpeg;base64,'));
    assert.equal(res.modeloUsado, 'imagen-3.0-generate-002');

    global.fetch = fetchOriginal;
  });

  it('debe orquestar el pipeline completo: análisis, renderizado y subida a Supabase Storage', async () => {
    let storageLlamado = false;
    const mockGestorArchivos = {
      subirImagenBase64: async () => {
        storageLlamado = true;
        return {
          archivoId: 'img_editada_123.jpg',
          archivoUrl: 'https://test-project.supabase.co/capturas_asistente/img_editada_123.jpg'
        };
      }
    };

    const mockAI = {
      models: {
        generateContent: async () => ({
          candidates: [
            { content: { parts: [{ text: 'Technical prompt: 3D render with blue background' }] } }
          ]
        }),
        generateImages: async () => ({
          generatedImages: [
            { image: { imageBytes: 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' } }
          ]
        })
      }
    };

    const motor = new MotorEdicionVisual({
      ...envMock,
      ai: mockAI,
      gestorArchivos: mockGestorArchivos
    });

    const resultado = await motor.procesarEdicionCompleta({
      imagenBase64: 'data:image/png;base64,orig123',
      mimeType: 'image/png',
      instruccionUsuario: 'Cambia el fondo a color azul y estilo 3D'
    });

    assert.equal(resultado.exito, true);
    assert.equal(resultado.instruccionOriginal, 'Cambia el fondo a color azul y estilo 3D');
    assert.equal(resultado.promptTecnico, 'Technical prompt: 3D render with blue background');
    assert.ok(resultado.imagenEditadaBase64.startsWith('data:image/jpeg;base64,'));
    assert.equal(resultado.archivoId, 'img_editada_123.jpg');
    assert.equal(resultado.archivoUrl, 'https://test-project.supabase.co/capturas_asistente/img_editada_123.jpg');
    assert.equal(storageLlamado, true);
  });
});
