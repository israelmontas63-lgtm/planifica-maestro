import test from 'node:test';
import assert from 'node:assert/strict';
import { esVectorValido1024, consultarMemoriaEpisodica, guardarExperienciaEpisodica } from '../worker/services/memoriaEpisodica.js';
import { GestorMemoriaExperiencias } from '../worker/services/gestorMemoriaExperiencias.js';
import worker from '../worker/index.js';

function vectorFalso(dims, valor = 0.01) {
  return Array.from({ length: dims }, () => valor);
}

test('FASE B.1: esVectorValido1024 acepta únicamente vectores numéricos finitos de 1024 dimensiones', () => {
  assert.equal(esVectorValido1024(vectorFalso(1024)), true);
  assert.equal(esVectorValido1024(vectorFalso(768)), false);
  assert.equal(esVectorValido1024(null), false);
  const conNaN = vectorFalso(1024);
  conNaN[10] = Number.NaN;
  assert.equal(esVectorValido1024(conNaN), false);
});

test('FASE B.2: consultarMemoriaEpisodica detecta y clasifica errores HTTP 400/401/500 sin ocultarlos', async () => {
  const originalFetch = globalThis.fetch;
  const envMock = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    AI: { run: async () => ({ data: [vectorFalso(1024)] }) },
  };

  try {
    globalThis.fetch = async () => new Response('different vector dimensions 768 and 1024', { status: 400 });
    const r400 = await consultarMemoriaEpisodica(envMock, 'Fracciones 4to grado');
    assert.equal(r400.ok, false);
    assert.equal(r400.motivo, 'INCOMPATIBILIDAD_DIMENSIONES');

    globalThis.fetch = async () => new Response('Forbidden', { status: 403 });
    const r403 = await consultarMemoriaEpisodica(envMock, 'Fracciones 4to grado');
    assert.equal(r403.ok, false);
    assert.equal(r403.motivo, 'PERMISOS_O_AUTENTICACION');

    globalThis.fetch = async () => new Response('Internal Server Error', { status: 500 });
    const r500 = await consultarMemoriaEpisodica(envMock, 'Fracciones 4to grado');
    assert.equal(r500.ok, false);
    assert.equal(r500.motivo, 'ERROR_SERVIDOR_SUPABASE');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('FASE B.3: guardarExperienciaEpisodica no persiste si no fue validado o si vector != 1024 y reporta fallo HTTP', async () => {
  const originalFetch = globalThis.fetch;

  const noVal = await guardarExperienciaEpisodica({}, {
    temaConsulta: 'Tema X',
    datosPlanificacion: { a: 1 },
    esValido: false,
  });
  assert.equal(noVal.ok, false);
  assert.equal(noVal.motivo, 'NO_VALIDADO_POR_AUDITOR');

  const env768 = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    AI: { run: async () => ({ data: [vectorFalso(768)] }) },
  };
  const rDim = await guardarExperienciaEpisodica(env768, {
    temaConsulta: 'Tema X',
    datosPlanificacion: { a: 1 },
    esValido: true,
  });
  assert.equal(rDim.ok, false);
  assert.equal(rDim.motivo, 'EMBEDDING_NO_DISPONIBLE_O_DIMENSION_INVALIDA');

  const env1024 = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    AI: { run: async () => ({ data: [vectorFalso(1024)] }) },
  };
  try {
    globalThis.fetch = async () => new Response('Error de BD', { status: 500 });
    const rErr = await guardarExperienciaEpisodica(env1024, {
      temaConsulta: 'Tema X',
      datosPlanificacion: { a: 1 },
      esValido: true,
    });
    assert.equal(rErr.ok, false);
    assert.equal(rErr.motivo, 'ERROR_SERVIDOR_SUPABASE');

    globalThis.fetch = async () => new Response(JSON.stringify([{ id: 'exp-uuid-1' }]), { status: 201 });
    const rOk = await guardarExperienciaEpisodica(env1024, {
      temaConsulta: 'Tema X',
      datosPlanificacion: { a: 1 },
      esValido: true,
    });
    assert.equal(rOk.ok, true);
    assert.equal(rOk.id, 'exp-uuid-1');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('FASE B.4: Recuperación entre sesiones distintas desde robot_memoria_experiencias con vector 1024', async () => {
  const originalFetch = globalThis.fetch;
  const memoriaSimulada = [];

  const env = {
    APP_ACCESS_KEY: 'clave-institucional-test',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    GEMINI_API_KEY: 'gemini-key',
    AI: {
      run: async () => ({ data: [vectorFalso(1024, 0.03)] }),
    },
  };

  globalThis.fetch = async (url, opts) => {
    const s = String(url?.url || url);

    if (s.includes('/rest/v1/rpc/consultar_memoria_robot')) {
      const body = JSON.parse(opts.body);
      assert.ok(body.p_embedding.startsWith('['), 'Debe enviar vector serializado');
      const dims = body.p_embedding.slice(1, -1).split(',').length;
      assert.equal(dims, 1024, 'La consulta debe enviar exactamente 1024 dimensiones');

      if (memoriaSimulada.length === 0) {
        return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify([{
        id: memoriaSimulada[0].id,
        tema_consulta: memoriaSimulada[0].tema_consulta,
        planificacion_salida: memoriaSimulada[0].planificacion_salida,
        similitud: 0.97,
      }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (s.includes('/rest/v1/robot_memoria_experiencias') && opts?.method === 'POST') {
      const payload = JSON.parse(opts.body);
      memoriaSimulada.push({ id: 'mem-1024-001', ...payload });
      return new Response(JSON.stringify([{ id: 'mem-1024-001' }]), { status: 201 });
    }

    if (s.includes('curriculo_secuencias')) {
      return new Response(JSON.stringify([{
        source_id: 'SEC-MEM-1',
        tema: 'La célula vegetal',
        competencias_especificas: 'Identifica organelos',
        contenidos_texto_original: 'Célula vegetal y pared celular',
        indicadores_logro: ['Reconoce la célula vegetal'],
        coincide_tema: true,
        estado_validacion: 'validado',
      }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (s.includes('generativelanguage.googleapis.com')) {
      const plan = {
        plan_completado: true,
        mensaje_chat: 'Plan de célula vegetal.',
        datos_planificacion: {
          '1. Aspectos Generales': { grado: '5.º', area: 'Ciencias de la Naturaleza', tema: 'La célula vegetal' },
          actividades: { inicio: 'Observación', desarrollo: 'Esquema', cierre: 'Síntesis' },
          indicadores_logro: ['Reconoce la célula vegetal'],
        },
      };
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify(plan) }] }, finishReason: 'STOP' }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    // Sesión 1: genera y persiste
    const req1 = new Request('https://worker.local/api/plan/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-app-key': 'clave-institucional-test',
        'x-docente-id': 'docente_sesion_1',
      },
      body: JSON.stringify({
        confirmado: true,
        stream: false,
        sesionId: 'sesion_1',
        grado: '5',
        area: 'Ciencias de la Naturaleza',
        messages: [{ role: 'user', text: 'Planifica 5to grado Ciencias de la Naturaleza sobre La célula vegetal' }],
      }),
    });

    const res1 = await worker.fetch(req1, env);
    assert.equal(res1.status, 200);
    // Esperar un tick para que la promesa asíncrona de guardado concluya
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(memoriaSimulada.length, 1, 'Debe haber guardado la experiencia validada');

    // Sesión 2 (nueva sesión, paráfrasis del tema): recupera desde robot_memoria_experiencias
    const req2 = new Request('https://worker.local/api/plan/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-app-key': 'clave-institucional-test',
        'x-docente-id': 'docente_sesion_2',
      },
      body: JSON.stringify({
        confirmado: true,
        stream: false,
        sesionId: 'sesion_2',
        grado: '5',
        area: 'Ciencias de la Naturaleza',
        tema: 'estructura de la célula vegetal',
        messages: [{ role: 'user', text: 'Planifica 5to grado Ciencias de la Naturaleza sobre estructura de la célula vegetal' }],
      }),
    });

    const res2 = await worker.fetch(req2, env);
    assert.equal(res2.status, 200);
    const body2 = await res2.json();
    assert.equal(body2.confianza_curricular?.origen, 'robot_memoria_experiencias', `Respuesta recibida: ${JSON.stringify(body2).slice(0, 300)}`);
    assert.equal(body2.confianza_curricular?.score, 0.97);
    assert.equal(body2.datos_planificacion?.actividades?.cierre, 'Síntesis');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('FASE B.5: GestorMemoriaExperiencias legado rechaza vectores de 768 dimensiones', async () => {
  const gestor = new GestorMemoriaExperiencias({
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'key',
  });
  const res = await gestor.consultarExperiencias({ embedding: vectorFalso(768) });
  assert.deepEqual(res, []);
});
