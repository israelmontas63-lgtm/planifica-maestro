/**
 * tests/test_opciones_robot.mjs
 * Pruebas unitarias para Orden 043:
 * (1) sin grado y con área y tema => DATOS_INCOMPLETOS con 6 opciones sin IA
 * (2) con grado explícito en el cuerpo => no pregunta el grado
 * (3) "Muéstrame temas de Matemática 2.º" => modo lista_temas con opción tocable
 * (4) tema inexistente => cercanos <= 4 y última opción "Ver todos los temas de ..."
 * (5) autodiagnóstico: "Probar otra vez" solo si hay mensajeUsuario guardado y con ese texto
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';

const envBase = {
  APP_ACCESS_KEY: 'clave-institucional-test',
  HERRAMIENTAS_V2: 'false'
};

function crearKvMock() {
  const store = new Map();
  return {
    store,
    async get(key) {
      return store.get(key) || null;
    },
    async put(key, val) {
      store.set(key, String(val));
    }
  };
}

// ============================================================================
// (1) Sin grado y con área y tema => DATOS_INCOMPLETOS con 6 opciones sin IA
// ============================================================================
test('1. Sin grado y con área y tema: responde DATOS_INCOMPLETOS con 6 botones de grado sin llamar a IA', async () => {
  const req = new Request('http://localhost/api/plan/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-app-key': 'clave-institucional-test'
    },
    body: JSON.stringify({
      messages: [{ role: 'user', text: 'Quiero una planificación de matemática tema suma' }]
    })
  });

  const res = await worker.fetch(req, envBase, { waitUntil: () => {} });
  assert.strictEqual(res.status, 200);
  const data = await res.json();

  assert.strictEqual(data.ok, false);
  assert.strictEqual(data.codigo, 'DATOS_INCOMPLETOS');
  assert.strictEqual(data.codigoError, 'DATOS_INCOMPLETOS');
  assert.strictEqual(data.plan_completado, false);
  assert.ok(Array.isArray(data.opciones), 'Debe tener arreglo de opciones');
  assert.strictEqual(data.opciones.length, 6, 'Debe ofrecer los 6 grados (1.º a 6.º)');
  assert.strictEqual(data.opciones[0].texto, '1.º');
  assert.strictEqual(data.opciones[5].texto, '6.º');
  assert.ok(data.opciones.every((o) => o.mensaje.includes('tema suma') && o.mensaje.includes('Matemática')));
});

// ============================================================================
// (2) Con grado explícito en el cuerpo => no pregunta el grado
// ============================================================================
test('2. Con grado explícito en el cuerpo: no pregunta el grado', async () => {
  const req = new Request('http://localhost/api/plan/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-app-key': 'clave-institucional-test'
    },
    body: JSON.stringify({
      grado: '2do',
      messages: [{ role: 'user', text: 'Quiero una planificación de matemática tema suma' }]
    })
  });

  const res = await worker.fetch(req, envBase, { waitUntil: () => {} });
  const data = await res.json();
  // No debe responder DATOS_INCOMPLETOS por falta de grado
  if (data.codigo === 'DATOS_INCOMPLETOS') {
    const faltantes = data.datos?.faltantes || [];
    assert.ok(!faltantes.includes('grado'), 'No debe reportar grado como faltante');
  } else {
    assert.notStrictEqual(data.codigo, 'DATOS_INCOMPLETOS');
  }
});

// ============================================================================
// (3) "Muéstrame temas de Matemática 2.º" => modo lista_temas con botones
// ============================================================================
test('3. "Muéstrame temas de Matemática 2.º": modo lista_temas con al menos 1 opción cuyo mensaje empieza por "Quiero la planificación de"', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const urlStr = String(url);
    if (urlStr.includes('curriculo_secuencias')) {
      return {
        ok: true,
        json: async () => [
          { source_id: 'SEC-PRI-2-MAT-001', tema: 'Conteo y representación de números' },
          { source_id: 'SEC-PRI-2-MAT-002', tema: 'Series numéricas y valor de posición' },
          { source_id: 'SEC-PRI-2-MAT-003', tema: 'Suma y resta con agrupamientos de 10' }
        ]
      };
    }
    return originalFetch(url, opts);
  };

  try {
    const envWithSupabase = {
      ...envBase,
      SUPABASE_URL: 'https://test-curriculo.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key'
    };

    const req = new Request('http://localhost/api/plan/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-app-key': 'clave-institucional-test'
      },
      body: JSON.stringify({
        messages: [{ role: 'user', text: 'Muéstrame temas de Matemática 2.º' }]
      })
    });

    const res = await worker.fetch(req, envWithSupabase, { waitUntil: () => {} });
    assert.strictEqual(res.status, 200);
    const data = await res.json();

    assert.strictEqual(data.ok, true);
    assert.strictEqual(data.modo, 'lista_temas');
    assert.ok(Array.isArray(data.opciones), 'Debe tener opciones tocables');
    assert.ok(data.opciones.length >= 1, 'Debe traer al menos una opción');
    assert.ok(
      data.opciones[0].mensaje.startsWith('Quiero la planificación de'),
      `El mensaje debe empezar por "Quiero la planificación de": ${data.opciones[0].mensaje}`
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// (4) Tema inexistente => "cercanos" <= 4 y última opción "Ver todos los temas de ..."
// ============================================================================
test('4. Tema inexistente: cercanos <= 4 y la última opción es "Ver todos los temas de ..."', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const urlStr = String(url);
    if (urlStr.includes('curriculo_secuencias')) {
      return {
        ok: true,
        json: async () => [
          { source_id: 'SEC-1', tema: 'Conteo y números' },
          { source_id: 'SEC-2', tema: 'Suma y resta' },
          { source_id: 'SEC-3', tema: 'Geometría' },
          { source_id: 'SEC-4', tema: 'Medición' },
          { source_id: 'SEC-5', tema: 'Estadística' }
        ]
      };
    }
    return originalFetch(url, opts);
  };

  try {
    const envWithSupabase = {
      ...envBase,
      SUPABASE_URL: 'https://test-curriculo.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key'
    };

    // Usamos host externo para que esLocalhost sea false
    const req = new Request('https://planifica-maestro.test.workers.dev/api/plan/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-app-key': 'clave-institucional-test'
      },
      body: JSON.stringify({
        messages: [{ role: 'user', text: 'Quiero la planificación de matemática de 2.º tema astrofisica cuantica' }]
      })
    });

    const res = await worker.fetch(req, envWithSupabase, { waitUntil: () => {} });
    assert.strictEqual(res.status, 200);
    const data = await res.json();

    assert.strictEqual(data.codigo, 'CURRICULO_SIN_DATOS');
    assert.ok(Array.isArray(data.cercanos), 'Debe tener cercanos');
    assert.ok(data.cercanos.length <= 4, `cercanos debe ser <= 4, tiene ${data.cercanos.length}`);
    assert.ok(Array.isArray(data.opciones), 'Debe tener opciones');
    const ultimaOpcion = data.opciones[data.opciones.length - 1];
    assert.ok(ultimaOpcion, 'Debe haber una última opción');
    assert.match(ultimaOpcion.texto, /^Ver todos los temas de/);
    assert.match(ultimaOpcion.mensaje, /^Muéstrame temas de/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// (5) Autodiagnóstico: "Probar otra vez" condicional según mensajeUsuario guardado
// ============================================================================
test('5. Autodiagnóstico: omite "Probar otra vez" sin mensajeUsuario y la incluye cuando sí lo hay', async () => {
  const kv = crearKvMock();
  const envWithKv = {
    ...envBase,
    RATE_LIMIT_KV: kv
  };

  // 5a. Sin mensajeUsuario previo
  const req1 = new Request('http://localhost/api/plan/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-app-key': 'clave-institucional-test',
      'x-device-id': 'dev-sin-mensaje'
    },
    body: JSON.stringify({
      messages: [{ role: 'user', text: 'Por qué no puedes hacer la planificación' }]
    })
  });
  const res1 = await worker.fetch(req1, envWithKv, { waitUntil: () => {} });
  const data1 = await res1.json();
  assert.strictEqual(data1.modo, 'autodiagnostico');
  const opciones1 = data1.opciones || [];
  assert.ok(
    !opciones1.some((o) => o.texto.includes('Probar otra vez')),
    'No debe incluir "Probar otra vez" si no hay mensajeUsuario guardado'
  );

  // 5b. Con mensajeUsuario previo guardado
  await kv.put(
    'ultimo_fallo:dev-con-mensaje',
    JSON.stringify({
      codigoError: 'CONFLICTO_AREA_TEMA',
      componente: 'Interpretación del pedido',
      motivo: '"matemática" es un área, no un tema.',
      queFalta: 'Que me confirmes cuál quieres.',
      mensajeUsuario: 'Quiero la planificación de ciencias sociales de 2.º tema matemática',
      area: 'Ciencias Sociales',
      grado: 2,
      ts: Date.now()
    })
  );

  const req2 = new Request('http://localhost/api/plan/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-app-key': 'clave-institucional-test',
      'x-device-id': 'dev-con-mensaje'
    },
    body: JSON.stringify({
      messages: [{ role: 'user', text: 'Por qué no puedes hacer la planificación' }]
    })
  });
  const res2 = await worker.fetch(req2, envWithKv, { waitUntil: () => {} });
  const data2 = await res2.json();
  assert.strictEqual(data2.modo, 'autodiagnostico');
  assert.ok(Array.isArray(data2.opciones), 'Debe tener opciones');

  const optProbar = data2.opciones.find((o) => o.texto === 'Probar otra vez con los mismos datos');
  assert.ok(optProbar, 'Debe incluir opción "Probar otra vez con los mismos datos"');
  assert.strictEqual(optProbar.mensaje, 'Quiero la planificación de ciencias sociales de 2.º tema matemática');

  const optCambiar = data2.opciones.find((o) => o.texto === 'Cambiar el tema');
  assert.ok(optCambiar, 'Debe incluir opción "Cambiar el tema"');
  assert.strictEqual(optCambiar.mensaje, 'Muéstrame temas de Ciencias Sociales 2.º');
});
