import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';

test('Capa 11: Cliente PWA - Consumo de stream SSE, decodificación y renderizado de plan', async (t) => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, opts) => {
      const urlStr = String(url);
      if (urlStr.includes('streamGenerateContent')) {
        const sseData = 'data: ' + JSON.stringify({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  mensaje_chat: 'Plan generado exitosamente',
                  plan_completado: true,
                  datos_planificacion: { tema: 'La Suma', fecha: '2026-10-17' }
                })
              }]
            }
          }]
        }) + '\n\n';
        return new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(sseData));
            controller.close();
          }
        }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const env = {
      APP_ACCESS_KEY: 'test-app-key',
      GEMINI_API_KEY: 'test-gemini-key',
      RATE_LIMIT_DISPOSITIVO_DIARIO: '25',
      HABILITAR_TRAZA_CAPAS: 'true'
    };

    const t0 = performance.now();
    const req = new Request('http://localhost/api/plan/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'x-app-key': 'test-app-key'
      },
      body: JSON.stringify({
        confirmado: true,
        stream: true,
        messages: [{ role: 'user', text: 'Plan de clase para 2do de primaria sobre la suma en matemática' }]
      })
    });

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 200, 'El servidor debe responder HTTP 200 para stream');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let chunksRecibidos = 0;
    let finalPayload = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunksRecibidos++;
      const text = decoder.decode(value);
      const splitLines = text.split('\n');
      for (const linea of splitLines) {
        if (linea.startsWith('data: ') && linea.includes('"final":')) {
          try {
            const json = JSON.parse(linea.slice(6));
            if (json.final) finalPayload = json.final;
          } catch (e) {}
        }
      }
    }

    const msConsumoCliente = performance.now() - t0;
    assert.ok(chunksRecibidos > 0, 'El cliente PWA debe recibir chunks del stream SSE');
    assert.ok(finalPayload, 'El cliente PWA debe decodificar el finalPayload');
    assert.equal(finalPayload.plan_completado, true, 'El plan debe estar marcado como completado en el cliente');
    assert.ok(msConsumoCliente > 0, 'La latencia del cliente PWA debe ser medible');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Capa 11: Cliente PWA - Presentación diagnóstica de error de lista cerrada sin sobreescritura', async (t) => {
  const env = {
    APP_ACCESS_KEY: 'test-app-key',
    RATE_LIMIT_DISPOSITIVO_DIARIO: '25'
  };

  const req = new Request('http://localhost/api/plan/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-app-key': 'test-app-key' },
    body: JSON.stringify({
      messages: [
        { role: 'assistant', isError: true, codigoError: 'PROVEEDOR_IA_SATURADO' },
        { role: 'user', text: '¿por qué no se pudo?' }
      ]
    })
  });

  const res = await worker.fetch(req, env);
  const data = await res.json();

  assert.equal(res.status, 200);
  assert.equal(data.isError, true);
  assert.equal(data.codigoError, 'PROVEEDOR_IA_SATURADO');
  assert.ok(data.mensaje_chat.includes('saturado') || data.mensaje_chat.includes('alta demanda'));
});
