import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';

function simularPeticionPlan(cuerpo) {
  return new Request('https://worker.local/api/plan/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-app-key': 'clave-institucional-test',
      'x-docente-id': 'docente_test_grado'
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
    ...extra
  };
}

async function ejecutarYCapturarGrado(cuerpo) {
  let primerGradoConsultado = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const s = String(url?.url || url);
    if (s.includes('curriculo_secuencias') && s.includes('grado_num=eq.')) {
      const match = s.match(/grado_num=eq\.([^&]+)/);
      if (match && primerGradoConsultado === null) {
        primerGradoConsultado = decodeURIComponent(match[1]);
      }
      return new Response(JSON.stringify([{ source_id: 'SEC-TEST', tema: 'El barrio' }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const env = crearMockEnv();
    const req = simularPeticionPlan(cuerpo);
    await worker.fetch(req, env);
    return primerGradoConsultado;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('Caso (i): body.grado=2 + "Quiero la planificación de Ciencias Sociales 3.º tema El barrio" -> consulta grado 3', async () => {
  const gradoConsultado = await ejecutarYCapturarGrado({
    grado: '2',
    area: 'Ciencias Sociales',
    messages: [{ role: 'user', text: 'Quiero la planificación de Ciencias Sociales 3.º tema El barrio' }]
  });
  assert.equal(gradoConsultado, '3', `Esperaba consulta curricular a grado 3 pero consultó: ${gradoConsultado}`);
});

test('Caso (ii): body.grado=2 + mensaje sin grado -> consulta grado 2 (fallback al cuerpo)', async () => {
  const gradoConsultado = await ejecutarYCapturarGrado({
    grado: '2',
    area: 'Ciencias Sociales',
    messages: [{ role: 'user', text: 'Quiero la planificación de Ciencias Sociales tema El barrio' }]
  });
  assert.equal(gradoConsultado, '2', `Esperaba consulta curricular a grado 2 pero consultó: ${gradoConsultado}`);
});

test('Caso (iii): body.grado=2 + mensaje con "2.º" -> consulta grado 2', async () => {
  const gradoConsultado = await ejecutarYCapturarGrado({
    grado: '2',
    area: 'Ciencias Sociales',
    messages: [{ role: 'user', text: 'Quiero la planificación de Ciencias Sociales 2.º tema El barrio' }]
  });
  assert.equal(gradoConsultado, '2', `Esperaba consulta curricular a grado 2 pero consultó: ${gradoConsultado}`);
});

test('Falso positivo 1: body.grado=2 + "Ciencias de la Naturaleza tema los 5 sentidos" -> consulta grado 2', async () => {
  const gradoConsultado = await ejecutarYCapturarGrado({
    grado: '2',
    area: 'Ciencias de la Naturaleza',
    messages: [{ role: 'user', text: 'Quiero la planificación de Ciencias de la Naturaleza tema los 5 sentidos' }]
  });
  assert.equal(gradoConsultado, '2', `Esperaba que no se confundiera '5 sentidos' con grado 5 y consultara 2, pero consultó: ${gradoConsultado}`);
});

test('Falso positivo 2: body.grado=4 + "Matemática tema suma de 2 + 3" -> consulta grado 4', async () => {
  const gradoConsultado = await ejecutarYCapturarGrado({
    grado: '4',
    area: 'Matemática',
    messages: [{ role: 'user', text: 'Quiero la planificación de Matemática tema suma de 2 + 3' }]
  });
  assert.equal(gradoConsultado, '4', `Esperaba que no se confundiera '2 + 3' con grado y consultara 4, pero consultó: ${gradoConsultado}`);
});

test('Falso positivo 3: body.grado=1 + "Quiero 3 actividades de Lengua Española" -> consulta grado 1', async () => {
  const gradoConsultado = await ejecutarYCapturarGrado({
    grado: '1',
    area: 'Lengua Española',
    messages: [{ role: 'user', text: 'Quiero la planificación de Lengua Española. Quiero 3 actividades de Lengua Española' }]
  });
  assert.equal(gradoConsultado, '1', `Esperaba que no se confundiera '3 actividades' con grado 3 y consultara 1, pero consultó: ${gradoConsultado}`);
});

test('Prueba 4a: Prompt a Gemini - cuerpo capturado contiene grado 3.º y no 2.º', async () => {
  let geminiBody = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const s = String(url?.url || url);
    if (s.includes('generativelanguage.googleapis.com')) {
      geminiBody = opts?.body ? JSON.parse(opts.body) : null;
      return new Response(JSON.stringify({
        candidates: [{
          content: { parts: [{ text: JSON.stringify({ plan_completado: true, mensaje_chat: 'Plan generado' }) }] },
          finishReason: 'STOP'
        }]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
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
    const env = crearMockEnv({ GEMINI_API_KEY: 'clave-falsa-test' });
    const req = simularPeticionPlan({
      grado: '2',
      area: 'Ciencias Sociales',
      messages: [{ role: 'user', text: 'Quiero la planificación de Ciencias Sociales 3.º tema El barrio' }]
    });

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 200, `Worker status esperado 200, recibido: ${res.status}`);
    assert.ok(geminiBody, 'El cuerpo enviado a Gemini debió ser capturado');

    const rawUserText = geminiBody?.contents?.[0]?.parts?.[0]?.text || '';
    assert.equal(rawUserText.includes('3.º'), true, 'El cuerpo de Gemini debe contener grado 3.º');
    assert.equal(rawUserText.includes('2.º'), false, 'El cuerpo de Gemini NO debe contener grado 2.º como grado de planificación');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
