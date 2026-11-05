import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';

function simularPeticionPlan(cuerpo) {
  return new Request('https://worker.local/api/plan/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      'x-app-key': 'clave-institucional-test',
      'x-docente-id': 'docente_test_sse'
    },
    body: JSON.stringify({
      confirmado: true,
      ...cuerpo
    })
  });
}

function crearMockEnv(extra = {}) {
  return {
    APP_ACCESS_KEY: 'clave-institucional-test',
    SUPABASE_URL: 'https://test-supabase.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon-key',
    GEMINI_API_KEY: 'mock-gemini-key',
    ...extra
  };
}

test('Captura de body a Gemini y verificación de grado en systemInstruction y contents', async () => {
  let geminiBodyCapturado = null;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, opts) => {
    const s = String(url?.url || url);

    if (s.includes('generativelanguage.googleapis.com')) {
      geminiBodyCapturado = opts?.body ? JSON.parse(opts.body) : null;

      // Mock SSE válido según formato data: {...}\n\n
      const payloadCandidate = {
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                plan_completado: true,
                mensaje_chat: "Plan generado",
                datos_planificacion: { "1. Aspectos Generales": { grado: "3.º" } }
              })
            }]
          },
          finishReason: 'STOP'
        }]
      };

      const streamText = `data: ${JSON.stringify(payloadCandidate)}\n\n`;
      return new Response(streamText, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream'
        }
      });
    }

    if (s.includes('curriculo_secuencias')) {
      return new Response(JSON.stringify([{
        source_id: 'SEC-TEST',
        tema: 'El barrio',
        competencias_especificas: 'Comprende el entorno',
        contenidos_texto_original: 'El barrio y la comunidad',
        indicadores_logro: ['Identifica su barrio'],
        coincide_tema: true,
        estado_validacion: 'validado'
      }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const req = simularPeticionPlan({
      grado: '2',
      area: 'Ciencias Sociales',
      messages: [{ role: 'user', text: 'Quiero la planificación de Ciencias Sociales 3.º tema El barrio' }]
    });

    const res = await worker.fetch(req, crearMockEnv());
    assert.equal(res.status, 200);

    // Consumir el stream
    const reader = res.body.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    assert.ok(geminiBodyCapturado, "Debe haberse capturado el body enviado a Gemini");

    const systemInstruction = geminiBodyCapturado.systemInstruction?.parts?.[0]?.text || "";
    const userContents = geminiBodyCapturado.contents?.map(c => c.parts?.map(p => p.text || "").join(" ")).join(" ") || "";

    console.log("=== RESULTADOS CAPTURA GEMINI ===");
    console.log("systemInstruction.Length:", systemInstruction.length);
    console.log("userContents.Length:", userContents.length);

    console.log("¿Aparece 3.º en systemInstruction?:", systemInstruction.includes("3.º"));
    console.log("¿Aparece 2.º en systemInstruction?:", systemInstruction.includes("2.º"));
    console.log("¿Aparece 3.º en userContents?:", userContents.includes("3.º"));
    console.log("¿Aparece 2.º en userContents?:", userContents.includes("2.º"));

    // Guardar en scratch para inspección
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    fs.writeFileSync(path.join(os.tmpdir(), 'gemini_capture.json'), JSON.stringify({
      systemInstruction,
      userContents
    }, null, 2));

  } finally {
    globalThis.fetch = originalFetch;
  }
});
