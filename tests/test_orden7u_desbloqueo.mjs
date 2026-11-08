import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import { construirThinkingConfig, construirMaxSalida, textoDeCandidato } from '../worker/services/aiProvider.js';
import { corregirTextoPedagogicoLocal } from '../shared/correctorTexto.js';

test('3.5.1 Unit: construirThinkingConfig según especificación exacta', () => {
  assert.deepEqual(construirThinkingConfig({}), {});
  assert.deepEqual(construirThinkingConfig(undefined), {});
  assert.deepEqual(construirThinkingConfig({ GEMINI_THINKING_BUDGET: "2048" }), {
    thinkingConfig: { thinkingBudget: 2048 }
  });
  assert.deepEqual(construirThinkingConfig({ GEMINI_THINKING_BUDGET: "-1" }), {
    thinkingConfig: { thinkingBudget: -1 }
  });
  assert.deepEqual(construirThinkingConfig({ GEMINI_THINKING_BUDGET: "abc" }), {});
  assert.deepEqual(construirThinkingConfig({ GEMINI_THINKING_BUDGET: "" }), {});
  assert.deepEqual(
    construirThinkingConfig({ GEMINI_THINKING_LEVEL: " high ", GEMINI_THINKING_BUDGET: "0" }),
    { thinkingConfig: { thinkingLevel: "high" } }
  );
});

test('3.5.2 Unit: construirMaxSalida según especificación exacta', () => {
  assert.equal(construirMaxSalida({}), 16384);
  assert.equal(construirMaxSalida({ GEMINI_MAX_OUTPUT_TOKENS: "8192" }), 8192);
  assert.equal(construirMaxSalida({ GEMINI_MAX_OUTPUT_TOKENS: "10" }), 16384);
});

test('3.5.3 Unit: textoDeCandidato filtra thoughts y extrae texto', () => {
  const cand = {
    content: {
      parts: [
        { text: "pienso", thought: true },
        { text: '{"a":' },
        { text: "1}" }
      ]
    }
  };
  assert.equal(textoDeCandidato(cand), '{"a":1}');
  assert.equal(textoDeCandidato({}), "");
  const soloFc = {
    content: {
      parts: [
        { functionCall: { name: "consultar", args: {} } }
      ]
    }
  };
  assert.equal(textoDeCandidato(soloFc), "");
});

function crearMockEnv(extra = {}) {
  return {
    APP_ACCESS_KEY: 'clave-institucional-test',
    SUPABASE_URL: 'https://test-supabase.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon-key',
    GEMINI_API_KEY: 'mock-gemini-key',
    PROMPT_SISTEMA_V2: 'true',
    HERRAMIENTAS_V2: 'true',
    ...extra
  };
}

const mockSecuenciasSupabase = JSON.stringify([{
  source_id: 'SEC-TEST',
  tema: 'el cuento',
  competencias_especificas: 'Comprende el cuento',
  contenidos_texto_original: 'El cuento',
  indicadores_logro: ['Identifica elementos'],
  coincide_tema: true,
  estado_validacion: 'validado'
}]);

test('3.5.4 Body capturado a Gemini: thinkingBudget por defecto, maxOutputTokens, override y chunk con thought', async () => {
  let capturedBody = null;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, opts) => {
    const s = String(url?.url || url);
    if (s.includes('supabase')) {
      return new Response(mockSecuenciasSupabase, { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (s.includes('generativelanguage.googleapis.com')) {
      if (s.includes('streamGenerateContent')) {
        capturedBody = opts?.body ? JSON.parse(opts.body) : null;
        const payloadCandidate = {
          candidates: [{
            content: {
              parts: [
                { text: "pensando...", thought: true },
                {
                  text: JSON.stringify({
                    plan_completado: true,
                    mensaje_chat: "Plan generado exitosamente",
                    datos_planificacion: { "1. Aspectos Generales": { grado: "3.º" } }
                  })
                }
              ]
            },
            finishReason: 'STOP'
          }]
        };
        const streamText = `data: ${JSON.stringify(payloadCandidate)}\n\n`;
        return new Response(streamText, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' }
        });
      }
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "{}" }] } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return originalFetch(url, opts);
  };

  try {
    const req = new Request('https://worker.local/api/plan/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'x-app-key': 'clave-institucional-test',
        'x-docente-id': 'docente_test_sse_1'
      },
      body: JSON.stringify({
        messages: [{ role: 'user', text: 'Planifica Lengua Española 3.º tema el cuento' }],
        nivel: 'primario',
        confirmado: true
      })
    });

    const env = crearMockEnv();
    const res = await worker.fetch(req, env, {});
    assert.equal(res.status, 200);

    const text = await res.text();
    assert.ok(text.includes('Plan generado exitosamente'), 'Debe procesar la parte de texto e ignorar el thought');

    assert.ok(capturedBody, 'Debe haber capturado el body a Gemini');
    assert.equal(capturedBody.generationConfig?.thinkingConfig?.thinkingBudget, undefined, 'Por defecto NO debe contener thinkingBudget');
    assert.equal(capturedBody.generationConfig?.maxOutputTokens, 16384, 'maxOutputTokens debe ser 16384');

    // Con GEMINI_THINKING_BUDGET = 2048
    capturedBody = null;
    const req2 = new Request('https://worker.local/api/plan/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'x-app-key': 'clave-institucional-test',
        'x-docente-id': 'docente_test_sse_2'
      },
      body: JSON.stringify({
        messages: [{ role: 'user', text: 'Planifica Lengua Española 4.º tema el cuento' }],
        nivel: 'primario',
        confirmado: true
      })
    });
    const env2 = crearMockEnv({ GEMINI_THINKING_BUDGET: '2048' });
    const res2 = await worker.fetch(req2, env2, {});
    await res2.text(); // consumir stream para completar ejecución asíncrona
    assert.ok(capturedBody, 'Debe haber capturado el body en la segunda llamada');
    assert.equal(capturedBody.generationConfig?.thinkingConfig?.thinkingBudget, 2048, 'Debe contener thinkingBudget 2048');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('3.5.5 systemInstruction capturado según esquema CON BASE vs Tradicional', async () => {
  let capturedPrompt = null;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, opts) => {
    const s = String(url?.url || url);
    if (s.includes('supabase')) {
      return new Response(mockSecuenciasSupabase, { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (s.includes('generativelanguage.googleapis.com')) {
      if (s.includes('streamGenerateContent')) {
        const b = opts?.body ? JSON.parse(opts.body) : null;
        capturedPrompt = b?.systemInstruction?.parts?.[0]?.text || "";
        const payloadCandidate = {
          candidates: [{
            content: { parts: [{ text: JSON.stringify({ plan_completado: true, mensaje_chat: "ok", datos_planificacion: {} }) }] },
            finishReason: 'STOP'
          }]
        };
        return new Response(`data: ${JSON.stringify(payloadCandidate)}\n\n`, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' }
        });
      }
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "{}" }] } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return originalFetch(url, opts);
  };

  try {
    // CON BASE
    const reqConBase = new Request('https://worker.local/api/plan/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'x-app-key': 'clave-institucional-test',
        'x-docente-id': 'docente_prompt_cb'
      },
      body: JSON.stringify({
        messages: [{ role: 'user', text: 'Planifica Lengua Española 2.º tema el cuento' }],
        nivel: 'conbase',
        confirmado: true
      })
    });
    const resConBase = await worker.fetch(reqConBase, crearMockEnv(), {});
    await resConBase.text(); // consumir stream
    assert.ok(capturedPrompt, 'Debe haber capturado prompt en CON BASE');
    assert.ok(capturedPrompt.includes('usa las Guías de Secuencias CON BASE (es la fuente'), 'Debe incluir fuente CON BASE');
    assert.ok(!capturedPrompt.includes('PROTOCOLO OBLIGATORIO DE CLARIFICACIÓN'), 'No debe incluir protocolo obligatorio');
    assert.ok(!capturedPrompt.includes('absoluta fidelidad'), 'No debe incluir absoluta fidelidad');
    assert.ok(!capturedPrompt.includes('${'), 'No debe incluir plantillas sin interpolar ${');

    // Tradicional
    capturedPrompt = null;
    const reqTrad = new Request('https://worker.local/api/plan/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'x-app-key': 'clave-institucional-test',
        'x-docente-id': 'docente_prompt_trad'
      },
      body: JSON.stringify({
        messages: [{ role: 'user', text: 'Planifica Lengua Española 2.º tema la fábula' }],
        nivel: 'primario',
        confirmado: true
      })
    });
    const resTrad = await worker.fetch(reqTrad, crearMockEnv(), {});
    await resTrad.text(); // consumir stream
    assert.ok(capturedPrompt, 'Debe haber capturado prompt en Tradicional');
    assert.ok(capturedPrompt.includes('usa la Adecuación Curricular 2023 (es la fuente'), 'Debe incluir fuente Adecuación Curricular');
    assert.ok(!capturedPrompt.includes('PROTOCOLO OBLIGATORIO DE CLARIFICACIÓN'));
    assert.ok(!capturedPrompt.includes('absoluta fidelidad'));
    assert.ok(!capturedPrompt.includes('${'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('3.5.6 Orden de eventos SSE: iniciando -> curriculo -> razonando, y prechequeos devuelven JSON', async () => {
  const originalFetch = globalThis.fetch;
  let ordenEventos = [];
  let cicloResuelto = false;
  let iniciandoLlegoAntesDeResolver = false;

  globalThis.fetch = async (url, opts) => {
    const s = String(url?.url || url);
    if (s.includes('supabase')) {
      return new Response(mockSecuenciasSupabase, { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (s.includes('generativelanguage.googleapis.com')) {
      if (s.includes('generateContent')) {
        await new Promise(r => setTimeout(r, 60));
        cicloResuelto = true;
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: "sin herramientas" }] }, finishReason: "STOP" }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (s.includes('streamGenerateContent')) {
        const payloadCandidate = {
          candidates: [{
            content: { parts: [{ text: JSON.stringify({ plan_completado: true, mensaje_chat: "listo", datos_planificacion: {} }) }] },
            finishReason: 'STOP'
          }]
        };
        return new Response(`data: ${JSON.stringify(payloadCandidate)}\n\n`, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' }
        });
      }
    }
    return originalFetch(url, opts);
  };

  try {
    const req = new Request('https://worker.local/api/plan/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'x-app-key': 'clave-institucional-test',
        'x-docente-id': 'docente_sse_order_unique'
      },
      body: JSON.stringify({
        messages: [{ role: 'user', text: 'Planifica Matemática 5.º fracciones decimales' }],
        nivel: 'primario',
        confirmado: true
      })
    });

    const res = await worker.fetch(req, crearMockEnv(), {});
    assert.equal(res.status, 200);
    assert.ok(res.headers.get('content-type').includes('text/event-stream'));

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    const primerChunk = await reader.read();
    const textoPrimerChunk = decoder.decode(primerChunk.value);
    if (textoPrimerChunk.includes('"estado":"iniciando"') && !cicloResuelto) {
      iniciandoLlegoAntesDeResolver = true;
    }
    ordenEventos.push("iniciando");

    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value);
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data:')) {
          const txt = line.replace(/^data:\s*/, '').trim();
          if (txt === '[DONE]') continue;
          try {
            const parsed = JSON.parse(txt);
            if (parsed.estado && ['iniciando', 'curriculo', 'razonando'].includes(parsed.estado) && !ordenEventos.includes(parsed.estado)) {
              ordenEventos.push(parsed.estado);
            }
          } catch(e){}
        }
      }
    }

    assert.ok(iniciandoLlegoAntesDeResolver, 'El evento iniciando debe haber llegado antes de que se resuelva el ciclo de herramientas');
    assert.deepEqual(ordenEventos, ['iniciando', 'curriculo', 'razonando']);

    const bigArray = new Array(1024 * 1024 + 10).join('a');
    const reqBig = new Request('https://worker.local/api/plan/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-key': 'clave-institucional-test' },
      body: JSON.stringify({ payload: bigArray })
    });
    const resBig = await worker.fetch(reqBig, crearMockEnv(), {});
    assert.equal(resBig.status, 413);
    assert.ok(resBig.headers.get('content-type').includes('application/json'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
