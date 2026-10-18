import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';

test('P4.1: Sin el flag HABILITAR_TRAZA_CAPAS -> Cero eventos emitidos en respuestas', async (t) => {
  const env = {
    APP_ACCESS_KEY: 'test-app-key',
    RATE_LIMIT_DISPOSITIVO_DIARIO: '25'
    // HABILITAR_TRAZA_CAPAS ausente (por defecto apagado)
  };

  // Petición de saludo (charla)
  const reqSaludo = new Request('http://localhost/api/plan/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-app-key': 'test-app-key' },
    body: JSON.stringify({
      messages: [{ role: 'user', text: '¡Hola! Buenos días' }]
    })
  });
  const resSaludo = await worker.fetch(reqSaludo, env);
  const dataSaludo = await resSaludo.json();

  assert.equal(dataSaludo.traza_capas, undefined, 'Sin el flag de prueba, traza_capas no debe emitirse');

  // Petición con error previo (fallo_anterior)
  const reqFallo = new Request('http://localhost/api/plan/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-app-key': 'test-app-key' },
    body: JSON.stringify({
      messages: [
        { role: 'assistant', isError: true, codigoError: 'IA_NO_DISPONIBLE' },
        { role: 'user', text: '¿por qué falló?' }
      ]
    })
  });
  const resFallo = await worker.fetch(reqFallo, env);
  const dataFallo = await resFallo.json();

  assert.equal(dataFallo.traza_capas, undefined, 'En fallo_anterior sin flag, traza_capas no debe emitirse');
});

test('P4.2: Con HABILITAR_TRAZA_CAPAS = "true" -> Emite metadatos estructurales y CERO texto del docente', async (t) => {
  const CANARIO_DOCENTE = 'CANARIO_PRIVACIDAD_DOCENTE_MINERD_XYZ_777';
  const env = {
    APP_ACCESS_KEY: 'test-app-key',
    RATE_LIMIT_DISPOSITIVO_DIARIO: '25',
    HABILITAR_TRAZA_CAPAS: 'true'
  };

  const req = new Request('http://localhost/api/plan/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-app-key': 'test-app-key' },
    body: JSON.stringify({
      messages: [{ role: 'user', text: 'Hola colega ' + CANARIO_DOCENTE }]
    })
  });
  const res = await worker.fetch(req, env);
  const data = await res.json();

  assert.ok(Array.isArray(data.traza_capas), 'Con flag activo, debe emitir arreglo de traza_capas');
  assert.ok(data.traza_capas.length > 0, 'Debe registrar al menos los eventos de enrutamiento y saludo');

  // Verificar que el canario del docente NO aparezca en ningún campo de la traza
  const trazaStr = JSON.stringify(data.traza_capas);
  assert.equal(
    trazaStr.includes(CANARIO_DOCENTE),
    false,
    'El texto confidencial del docente no debe figurar en la traza de capas (ni completo ni recortado)'
  );

  // Verificar que los campos contengan solo metadatos estructurales
  for (const ev of data.traza_capas) {
    assert.ok(typeof ev.capa === 'number', 'Cada evento debe tener número de capa');
    assert.ok(typeof ev.nombre === 'string', 'Cada evento debe tener nombre de capa');
    assert.ok(typeof ev.ms === 'number' || typeof ev.latencia_ms === 'number', 'Cada evento debe tener latencia');
  }
});
