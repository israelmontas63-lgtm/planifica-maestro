import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';

// Mismo método que tests/test_grado_explicito_mensaje.mjs: se importa el handler,
// se simula fetch y se REGISTRA el grado de la primera consulta grado_num=eq.X.
// Las aserciones comparan contra el "esperado v2" de forma incondicional.

function simularPeticionPlan(cuerpo) {
  return new Request('https://worker.local/api/plan/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-app-key': 'clave-institucional-test',
      'x-docente-id': 'docente_test_grado_robusto'
    },
    body: JSON.stringify({ confirmado: true, ...cuerpo })
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
  globalThis.fetch = async (url) => {
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
    await worker.fetch(simularPeticionPlan(cuerpo), crearMockEnv());
    return primerGradoConsultado;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const AREA_DE = (msg) => {
  if (/Ciencias Sociales/.test(msg)) return 'Ciencias Sociales';
  if (/Ciencias de la Naturaleza/.test(msg)) return 'Ciencias de la Naturaleza';
  if (/Matemática/.test(msg)) return 'Matemática';
  return 'Lengua Española';
};

const CASOS = [
  [1, '2', 'Quiero la planificación de Ciencias Sociales 3.º tema El barrio', '3'],
  [2, '2', 'Quiero la planificación de Ciencias Sociales tercer grado tema El barrio', '3'],
  [3, '2', 'Quiero la planificación de Ciencias Sociales tema El barrio', '2'],
  [4, '2', 'Quiero la planificación de Ciencias Sociales 2.º tema El barrio', '2'],
  [5, '2', 'Quiero la planificación de Ciencias de la Naturaleza tema los 5 sentidos', '2'],
  [6, '4', 'Quiero la planificación de Matemática tema suma de 2 + 3', '4'],
  [7, '1', 'Quiero la planificación de Lengua Española. Quiero 3 actividades de Lengua Española', '1'],
  [8, '2', 'Quiero la planificación de Lengua Española para primero y segundo', '2'],
  [9, '2', 'Quiero la planificación de Lengua Española para 1.º y 2.º grado', '2'],
  [10, '1', 'Quiero la planificación de Lengua Española multigrado 1.º y 2.º', '1'],
  [11, '4', 'Quiero la planificación de Matemática, primer momento: inicio, tema suma', '4'],
  [12, '2', 'Primero quiero la planificación de Ciencias Sociales tema El barrio', '2'],
  [13, '2', 'Quiero la planificación de Lengua Española, tercera actividad: lectura', '2'],
  [14, '2', 'Quiero la planificación de Ciencias Sociales 3ero tema El barrio', '3'],
  [15, '2', 'Quiero la planificación de Ciencias Sociales 3.er tema El barrio', '3'],
  [16, '2', 'Quiero la planificación de Ciencias Sociales para tercero tema El barrio', '3'],
  [17, '2', 'Quiero la planificación de Ciencias Sociales 3.º y 4.º tema El barrio', '2']
];

for (const [n, gradoCuerpo, mensaje, esperado] of CASOS) {
  test(`Caso ${n}: body.grado=${gradoCuerpo} | "${mensaje}" -> esperado v2 ${esperado}`, async () => {
    const obtenido = await ejecutarYCapturarGrado({
      grado: gradoCuerpo,
      area: AREA_DE(mensaje),
      messages: [{ role: 'user', text: mensaje }]
    });
    console.log(`RESULTADO_CASO ${n} ${obtenido === null ? 'null' : obtenido}`);
    assert.equal(obtenido, esperado, `Caso ${n}: esperado grado_num=${esperado}, consultado=${obtenido}`);
  });
}
