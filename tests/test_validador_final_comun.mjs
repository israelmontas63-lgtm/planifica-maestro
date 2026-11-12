import test from 'node:test';
import assert from 'node:assert/strict';
import { clasificarEstadoValidacion } from '../worker/services/validadorFinalPlan.js';
import worker from '../worker/index.js';

test('FASE C.1: clasificarEstadoValidacion distingue los 5 estados normativos', () => {
  assert.equal(clasificarEstadoValidacion({ esValidoEstructura: false }), 'ERROR_DE_VALIDACION');
  assert.equal(clasificarEstadoValidacion({ esValidoEstructura: true, auditoriaFidelidad: { esValido: false } }), 'NECESITA_CORRECCION');
  assert.equal(clasificarEstadoValidacion({
    esValidoEstructura: true,
    auditoriaFidelidad: { esValido: true },
    fScore: 0.9,
    totalFragmentos: 0,
  }), 'NO_VERIFICADO');
  assert.equal(clasificarEstadoValidacion({
    esValidoEstructura: true,
    auditoriaFidelidad: { esValido: true },
    fScore: 0.55,
    totalFragmentos: 2,
    crag: { estado: 'CORRECT' },
  }), 'APROBADO_CON_OBSERVACIONES');
  assert.equal(clasificarEstadoValidacion({
    esValidoEstructura: true,
    auditoriaFidelidad: { esValido: true },
    fScore: 0.85,
    totalFragmentos: 2,
    crag: { estado: 'CORRECT' },
  }), 'APROBADO');
});

test('FASE C.2: usaHerramientasV2 rechaza JSON incompleto que incumple validarCamposPlanificacion', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const s = String(url?.url || url);
    if (s.includes('generativelanguage.googleapis.com')) {
      return new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                plan_completado: true,
                mensaje_chat: '',
                datos_planificacion: null,
              }),
            }],
          },
          finishReason: 'STOP',
        }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 200 });
  };

  try {
    const req = new Request('https://worker.local/api/plan/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-app-key': 'clave-test',
        'x-docente-id': 'docente_c2',
      },
      body: JSON.stringify({
        confirmado: true,
        stream: false,
        grado: '4',
        area: 'Matemática',
        tema: 'Las fracciones',
        messages: [{ role: 'user', text: 'Planifica 4to Matemática sobre Las fracciones' }],
      }),
    });

    const res = await worker.fetch(req, {
      APP_ACCESS_KEY: 'clave-test',
      GEMINI_API_KEY: 'gemini-key',
      HERRAMIENTAS_V2: 'true',
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.plan_completado, false);
    assert.equal(data.codigo, 'IA_RESPUESTA_INVALIDA');
    assert.equal(data.auditoria?.estadoValidacion, 'ERROR_DE_VALIDACION');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
