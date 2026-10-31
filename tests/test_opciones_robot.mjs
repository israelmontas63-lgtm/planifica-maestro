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

// ============================================================================
// (6) Opción de grado vecino: mensaje con el grado real y sin "(n.º)"
// ============================================================================
test('6. Opción de grado vecino: mensaje contiene el grado del tema vecino y NO contiene "(1.º)" ni "(3.º)"', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const urlStr = String(url);
    if (urlStr.includes('curriculo_secuencias')) {
      if (urlStr.includes('grado_num=eq.2')) {
        return {
          ok: true,
          json: async () => [
            { source_id: 'SEC-CS-2', tema: 'El barrio, el paraje y los símbolos patrios' }
          ]
        };
      }
      if (urlStr.includes('grado_num=eq.1')) {
        return {
          ok: true,
          json: async () => [
            { source_id: 'SEC-CS-1', tema: 'La familia, la escuela y la comunidad' }
          ]
        };
      }
      if (urlStr.includes('grado_num=eq.3')) {
        return {
          ok: true,
          json: async () => [
            { source_id: 'SEC-CS-3', tema: 'El municipio y la provincia' }
          ]
        };
      }
    }
    return originalFetch(url, opts);
  };

  try {
    const envWithSupabase = {
      ...envBase,
      SUPABASE_URL: 'https://test-curriculo.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key'
    };

    const req = new Request('https://planifica-maestro.test.workers.dev/api/plan/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-app-key': 'clave-institucional-test'
      },
      body: JSON.stringify({
        messages: [{ role: 'user', text: 'Quiero la planificación de ciencias sociales de 2.º tema la familia' }]
      })
    });

    const res = await worker.fetch(req, envWithSupabase, { waitUntil: () => {} });
    assert.strictEqual(res.status, 200);
    const data = await res.json();

    assert.strictEqual(data.codigo, 'CURRICULO_SIN_DATOS');
    assert.ok(Array.isArray(data.opciones), 'Debe tener opciones');

    // Buscar la opción del grado vecino 1.º
    const optVecino1 = data.opciones.find((o) => o.texto.includes('(1.º)'));
    assert.ok(optVecino1, 'Debe existir una opción para el tema de 1.º');
    assert.ok(optVecino1.mensaje.includes('1.º'), `El mensaje debe contener 1.º: ${optVecino1.mensaje}`);
    assert.ok(!optVecino1.mensaje.includes('(1.º)'), `El mensaje NO debe tener el sufijo "(1.º)": ${optVecino1.mensaje}`);
    assert.ok(!optVecino1.mensaje.includes('(3.º)'), `El mensaje NO debe tener el sufijo "(3.º)": ${optVecino1.mensaje}`);
    assert.strictEqual(
      optVecino1.mensaje,
      'Quiero la planificación de Ciencias Sociales 1.º tema La familia, la escuela y la comunidad'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// (7) Área y grado sin datos: motivo empieza por "No tengo secuencias cargadas de",
//     incluye área y grado, y opciones solo tienen grados con datos
// ============================================================================
test('7. Área y grado sin datos: motivo empieza por "No tengo secuencias cargadas de", incluye área y grado, y opciones solo tienen grados que sí tienen datos', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const urlStr = String(url);
    if (urlStr.includes('curriculo_secuencias')) {
      if (urlStr.includes('grado_num=eq.5') && urlStr.includes('area=eq.Lengua%20Espa%C3%B1ola')) {
        return { ok: true, json: async () => [] };
      }
      if (urlStr.includes('select=grado_num')) {
        return {
          ok: true,
          json: async () => [{ grado_num: 1 }, { grado_num: 2 }, { grado_num: 3 }]
        };
      }
    }
    return originalFetch(url, opts);
  };

  try {
    const envWithSupabase = {
      ...envBase,
      SUPABASE_URL: 'https://test-curriculo.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key'
    };

    const req = new Request('https://planifica-maestro.test.workers.dev/api/plan/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-app-key': 'clave-institucional-test'
      },
      body: JSON.stringify({
        messages: [{ role: 'user', text: 'Quiero la planificación de lengua española de 5.º tema el cuento' }]
      })
    });

    const res = await worker.fetch(req, envWithSupabase, { waitUntil: () => {} });
    assert.strictEqual(res.status, 200);
    const data = await res.json();

    assert.strictEqual(data.codigo, 'CURRICULO_SIN_DATOS');
    assert.ok(data.motivo.startsWith('No tengo secuencias cargadas de'), `Motivo debe empezar por "No tengo secuencias cargadas de": ${data.motivo}`);
    assert.ok(data.motivo.includes('Lengua Española'), `Motivo debe incluir el área: ${data.motivo}`);
    assert.ok(data.motivo.includes('5.º'), `Motivo debe incluir el grado pedido: ${data.motivo}`);
    assert.ok(data.motivo.includes('Sí tengo Lengua Española en: 1.º, 2.º, 3.º'), `Motivo debe listar los grados disponibles: ${data.motivo}`);

    assert.ok(Array.isArray(data.opciones), 'Debe tener opciones');
    assert.strictEqual(data.opciones.length, 3);
    assert.ok(data.opciones.every((o) => ['1.º', '2.º', '3.º'].some((g) => o.texto.includes(g))));
    assert.ok(!data.opciones.some((o) => o.texto.includes('5.º')), 'No debe incluir el grado sin datos');
    assert.ok(
      data.opciones.every(
        (o) =>
          o.mensaje.startsWith('Muéstrame temas de ') &&
          o.mensaje.includes('Lengua Española') &&
          ['1.º', '2.º', '3.º'].some((g) => o.mensaje.includes(g))
      ),
      `Cada mensaje de opción debe empezar por "Muéstrame temas de " y contener área y grado: ${JSON.stringify(data.opciones)}`
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// (8) Área sin ningún dato en ningún grado: sin opciones
// ============================================================================
test('8. Área sin ningún dato en ningún grado: sin opciones', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const urlStr = String(url);
    if (urlStr.includes('curriculo_secuencias')) {
      return { ok: true, json: async () => [] };
    }
    return originalFetch(url, opts);
  };

  try {
    const envWithSupabase = {
      ...envBase,
      SUPABASE_URL: 'https://test-curriculo.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key'
    };

    const req = new Request('https://planifica-maestro.test.workers.dev/api/plan/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-app-key': 'clave-institucional-test'
      },
      body: JSON.stringify({
        messages: [{ role: 'user', text: 'Quiero la planificación de educación física de 2.º tema calentamiento' }]
      })
    });

    const res = await worker.fetch(req, envWithSupabase, { waitUntil: () => {} });
    assert.strictEqual(res.status, 200);
    const data = await res.json();

    assert.strictEqual(data.codigo, 'CURRICULO_SIN_DATOS');
    assert.ok(data.motivo.startsWith('No tengo secuencias cargadas de'), `Motivo debe empezar por "No tengo secuencias cargadas de": ${data.motivo}`);
    assert.strictEqual(data.motivo, 'No tengo secuencias cargadas de Educación Física en ningún grado.');
    assert.ok(Array.isArray(data.opciones), 'Debe tener arreglo de opciones');
    assert.strictEqual(data.opciones.length, 0, 'No debe tener opciones si no hay datos en ningún grado');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// (9) Botones de grados disponibles con tema en el pedido abren lista de temas
// ============================================================================
test('9. Botones de grados disponibles con tema en el pedido abren lista de temas', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const urlStr = String(url);
    if (urlStr.includes('curriculo_secuencias')) {
      if (urlStr.includes('grado_num=eq.5') && urlStr.includes('area=eq.Lengua%20Espa%C3%B1ola')) {
        return { ok: true, json: async () => [] };
      }
      if (urlStr.includes('select=grado_num')) {
        return {
          ok: true,
          json: async () => [{ grado_num: 1 }, { grado_num: 2 }, { grado_num: 3 }]
        };
      }
    }
    return originalFetch(url, opts);
  };

  try {
    const envWithSupabase = {
      ...envBase,
      SUPABASE_URL: 'https://test-curriculo.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key'
    };

    const req = new Request('https://planifica-maestro.test.workers.dev/api/plan/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-app-key': 'clave-institucional-test'
      },
      body: JSON.stringify({
        messages: [{ role: 'user', text: 'Quiero la planificación de lengua española de 5.º tema el cuento' }]
      })
    });

    const res = await worker.fetch(req, envWithSupabase, { waitUntil: () => {} });
    assert.strictEqual(res.status, 200);
    const data = await res.json();

    assert.ok(data.opciones.length > 0, 'Debe haber botones de grados disponibles');
    assert.ok(
      data.opciones.every((o) => o.mensaje.startsWith('Muéstrame temas de ') && !/tema el cuento/i.test(o.mensaje)),
      `Los botones deben abrir la lista de temas, no pedir el tema original: ${JSON.stringify(data.opciones)}`
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// (10) Descarte de temas fragmentados en lista_temas
// ============================================================================
test('10. Descarte de temas fragmentados en lista_temas: no incluye "naturales como mínimo"', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const urlStr = String(url);
    if (urlStr.includes('curriculo_secuencias')) {
      return {
        ok: true,
        json: async () => [
          { source_id: 'SEC-PRI-2-MAT-001', tema: 'Conteo y representación de números' },
          { source_id: 'SEC-PRI-2-MAT-002', tema: 'Series numéricas y valor de posición' },
          { source_id: 'SEC-PRI-2-MAT-003', tema: 'Suma y resta con agrupamientos de 10' },
          { source_id: 'SEC-PRI-2-MAT-007', tema: 'naturales como mínimo' }
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
    assert.ok(Array.isArray(data.temas), 'Debe traer arreglo de temas');
    assert.ok(!data.temas.includes('naturales como mínimo'), 'data.temas NO debe contener "naturales como mínimo"');
    assert.ok(!data.opciones.some((o) => /naturales/i.test(o.mensaje)), 'ningún data.opciones[].mensaje debe contener "naturales"');
    assert.ok(!data.mensaje_chat.includes('naturales como mínimo'), 'data.mensaje_chat NO debe contener "naturales como mínimo"');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('11. Modo curricular sin tema coincidente filtra fragmentos de la lista de temas disponibles', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const urlStr = String(url);
    if (urlStr.includes('buscar_curriculo_hibrido')) {
      return {
        ok: true,
        json: async () => []
      };
    }
    if (urlStr.includes('curriculo_secuencias')) {
      return {
        ok: true,
        json: async () => [
          { source_id: 'SEC-PRI-2-MAT-001', tema: 'Conteo y representación de números' },
          { source_id: 'SEC-PRI-2-MAT-002', tema: 'Series numéricas y valor de posición' },
          { source_id: 'SEC-PRI-2-MAT-007', tema: 'naturales como mínimo' }
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
        messages: [{ role: 'user', text: 'qué dice el currículo de Matemática 2.º grado sobre astronomía' }]
      })
    });

    const res = await worker.fetch(req, envWithSupabase, { waitUntil: () => {} });
    assert.strictEqual(res.status, 200);
    const data = await res.json();

    assert.strictEqual(data.modo, 'consulta_curricular');
    assert.ok(data.mensaje_chat.includes('Temas disponibles en la base para ese grado y área:'));
    assert.ok(data.mensaje_chat.includes('Conteo y representación de números'));
    assert.ok(!data.mensaje_chat.includes('naturales como mínimo'), 'El mensaje curricular NO debe contener el fragmento "naturales como mínimo"');
  } finally {
    globalThis.fetch = originalFetch;
  }
});



