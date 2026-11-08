/**
 * tests/test_orden10_memoria_cache.mjs
 * Pruebas unitarias para Orden 10:
 * (a) Payload incluye sesionId UUID v4 estable en la conversación y distinto en una nueva
 * (b) Con sesionId se guarda el turno y el historial vuelve en orden user, model
 * (c) Segundo pedido idéntico en streaming sale de caché (HIT) sin llamar a Gemini
 * (d) Un HIT de caché no filtra datos del docente que lo generó
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import { obtenerSesionId, reiniciarSesionId } from '../client/src/api.js';
import { recuperarHistorialSesion, guardarTurnoConversacion } from '../worker/services/memoriaService.js';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test('2.4 (a) sesionId es un UUID v4, estable dentro de la conversación y distinto en nueva', () => {
  // Simular entorno sessionStorage en Node si no existe
  if (typeof globalThis.sessionStorage === 'undefined') {
    const store = new Map();
    globalThis.sessionStorage = {
      getItem: (k) => store.get(k) || null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear()
    };
  }

  // Conversación 1
  const id1 = reiniciarSesionId();
  assert.match(id1, UUID_V4_REGEX, 'sesionId debe ser un UUID v4 válido');

  // Turno posterior en la misma conversación
  const id1Turno2 = obtenerSesionId();
  assert.equal(id1Turno2, id1, 'El sesionId debe ser estable dentro de la misma conversación');

  // Nueva conversación
  const id2 = reiniciarSesionId();
  assert.match(id2, UUID_V4_REGEX, 'Nueva sesión debe ser un UUID v4 válido');
  assert.notEqual(id2, id1, 'Nueva conversación debe generar un sesionId diferente');
});

test('2.4 (b) Con sesionId se guarda el turno y el historial retorna en orden user, model', async () => {
  const mensajesGuardados = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, opts) => {
    const sUrl = String(url?.url || url);
    if (sUrl.includes('/rest/v1/chat_mensajes')) {
      const body = JSON.parse(opts.body);
      if (Array.isArray(body)) {
        mensajesGuardados.push(...body.map((b, idx) => ({ id: mensajesGuardados.length + idx + 1, ...b })));
      } else {
        mensajesGuardados.push({ id: mensajesGuardados.length + 1, ...body });
      }
      return new Response(JSON.stringify(mensajesGuardados), { status: 201 });
    }
    if (sUrl.includes('/rest/v1/rpc/obtener_historial_sesion')) {
      // Simula el orden correcto de la función SQL corregida: ORDER BY creado_en ASC, id ASC
      const result = mensajesGuardados.map(m => ({ rol: m.rol, contenido: m.contenido }));
      return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return originalFetch(url, opts);
  };

  try {
    const mockEnv = {
      SUPABASE_URL: 'https://mock.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'mock-key'
    };
    const sId = '11111111-1111-4111-8111-111111111111';

    await guardarTurnoConversacion(mockEnv, sId, '¿Cómo enseño fracciones?', 'Usa material concreto.');
    const historial = await recuperarHistorialSesion(mockEnv, sId);

    assert.equal(historial.length, 2);
    assert.equal(historial[0].role, 'user');
    assert.equal(historial[0].parts[0].text, '¿Cómo enseño fracciones?');
    assert.equal(historial[1].role, 'model');
    assert.equal(historial[1].parts[0].text, 'Usa material concreto.');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('2.4 (c) Segundo pedido idéntico en streaming sale de caché (HIT) sin llamar a Gemini', async () => {
  let geminiLlamado = false;
  const originalFetch = globalThis.fetch;

  const mockCachePlan = {
    plan_json: {
      "Datos Generales": {
        area: "Matemática",
        grado: "2.º Primaria",
        docente: "Docente Anterior",
        centro_educativo: "Escuela Antigua"
      },
      "Estrategias": ["Secuencia 3: Suma y resta"]
    },
    fuentes_utilizadas: {
      nivel_certeza: "alta",
      origen: "cache_semantica_validada"
    }
  };

  globalThis.fetch = async (url, opts) => {
    const sUrl = String(url?.url || url);
    if (sUrl.includes('generativelanguage.googleapis.com')) {
      geminiLlamado = true;
      return new Response(JSON.stringify({ candidates: [] }), { status: 200 });
    }
    if (sUrl.includes('/rest/v1/rpc/consultar_cache_planificacion')) {
      return new Response(JSON.stringify([mockCachePlan]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (sUrl.includes('curriculo_secuencias')) {
      return new Response(JSON.stringify([{ source_id: 'SEC-1', tema: 'Suma y resta' }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (sUrl.includes('/rest/v1/chat_mensajes') || sUrl.includes('supabase')) {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return originalFetch(url, opts);
  };

  try {
    const mockEnv = {
      APP_ACCESS_KEY: 'clave-test',
      SUPABASE_URL: 'https://mock.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'mock-key',
      GEMINI_API_KEY: 'mock-gemini-key',
      ACCESO_ABIERTO: 'true',
      HERRAMIENTAS_V2: 'false'
    };

    const req = new Request('https://worker.local/api/plan/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'x-app-key': 'clave-test',
        'x-device-id': 'dev_test_cache_stream',
        'x-docente-id': 'profe_nuevo_789'
      },
      body: JSON.stringify({
        messages: [{ role: 'user', text: 'Planifica Matemática 2.º Secuencia 3: Suma y resta' }],
        nivel: 'primario',
        sesionId: '33333333-3333-4333-8333-333333333333'
      })
    });

    const res = await worker.fetch(req, mockEnv, { waitUntil: () => {} });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('X-Cache-Status'), 'HIT', 'Debe retornar cabecera X-Cache-Status: HIT');
    assert.equal(res.headers.get('Content-Type')?.includes('text/event-stream'), true, 'Debe ser text/event-stream');
    assert.equal(geminiLlamado, false, 'NO debe llamar a Gemini en un cache HIT');

    const sseText = await res.text();
    assert.ok(sseText.includes('data: {"estado":"iniciando"}'), 'Debe emitir evento iniciando');
    assert.ok(sseText.includes('data: [DONE]'), 'Debe emitir [DONE]');
    assert.ok(sseText.includes('"plan_completado":true'), 'Debe contener plan_completado: true en final');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('2.4 (d) Un HIT de caché no filtra datos del docente que lo generó (aislamiento estricto)', async () => {
  const originalFetch = globalThis.fetch;

  const mockPlanOriginal = {
    plan_json: {
      "Datos Generales": {
        area: "Matemática",
        grado: "2.º Primaria",
        docente: "Lic. Pedro Martínez",
        centro_educativo: "Liceo Prof. Juan Bosch",
        seccion: "A",
        fecha: "2026-03-15"
      },
      "Contenidos": ["Operaciones básicas"]
    },
    fuentes_utilizadas: { nivel_certeza: "alta" }
  };

  globalThis.fetch = async (url, opts) => {
    const sUrl = String(url?.url || url);
    if (sUrl.includes('/rest/v1/rpc/consultar_cache_planificacion')) {
      return new Response(JSON.stringify([mockPlanOriginal]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (sUrl.includes('curriculo_secuencias')) {
      return new Response(JSON.stringify([{ source_id: 'SEC-1', tema: 'Suma y resta' }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (sUrl.includes('/rest/v1/chat_mensajes') || sUrl.includes('supabase')) {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return originalFetch(url, opts);
  };

  try {
    const mockEnv = {
      APP_ACCESS_KEY: 'clave-test',
      SUPABASE_URL: 'https://mock.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'mock-key',
      GEMINI_API_KEY: 'mock-gemini-key',
      ACCESO_ABIERTO: 'true'
    };

    const req = new Request('https://worker.local/api/plan/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-app-key': 'clave-test',
        'x-device-id': 'dev_docente_b',
        'x-docente-id': 'maria_rodriguez_45'
      },
      body: JSON.stringify({
        messages: [{ role: 'user', text: 'Planifica Matemática 2.º suma y resta' }],
        nivel: 'primario',
        stream: false
      })
    });

    const res = await worker.fetch(req, mockEnv, { waitUntil: () => {} });
    const json = await res.json();

    assert.equal(res.headers.get('X-Cache-Status'), 'HIT');
    const datosGen = json.datos_planificacion?.["Datos Generales"] || {};

    assert.notEqual(datosGen.docente, 'Lic. Pedro Martínez', 'No debe filtrar el nombre del docente que generó el plan');
    assert.notEqual(datosGen.centro_educativo, 'Liceo Prof. Juan Bosch', 'No debe filtrar el centro educativo original');
    assert.notEqual(datosGen.seccion, 'A', 'No debe filtrar la sección original');
    assert.equal(datosGen.centro_educativo, '', 'El centro educativo debe limpiarse');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
