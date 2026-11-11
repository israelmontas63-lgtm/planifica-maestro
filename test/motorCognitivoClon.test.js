import test from 'node:test';
import assert from 'node:assert/strict';
import { MotorCognitivoClon } from '../worker/services/motorCognitivoClon.js';

test('MotorCognitivoClon - Declaración formal de herramientas (OpenAPI)', () => {
  const motor = new MotorCognitivoClon({ GEMINI_API_KEY: 'test-key' });
  const tools = motor.declararHerramientas();
  assert.equal(tools.length, 1);
  const fn = tools[0].functionDeclarations[0];
  assert.equal(fn.name, 'consultar_curriculo_minerd');
  assert.equal(fn.parameters.type, 'OBJECT');
  assert.deepEqual(fn.parameters.required, ['termino', 'grado']);
});

test('MotorCognitivoClon - Normalización de entorno docente (Smart Defaults)', () => {
  const motor = new MotorCognitivoClon({ GEMINI_API_KEY: 'test-key' });
  
  // Caso 1: Sin metadatos explícitos
  const env1 = motor.normalizarEntornoDocente('Planifica una clase de lectura');
  assert.equal(env1.docente, 'Israel Montás');
  assert.equal(env1.escuela, 'Escuela Primaria Batey Pinos');
  assert.equal(env1.modalidad, 'Multigrado (1.º y 2.º de Primaria)');
  assert.equal(env1.duracion, '45 minutos');
  assert.equal(env1.grado, 1);
  assert.equal(env1.area, 'Lengua Española');

  // Caso 2: Matemática para 2do grado
  const env2 = motor.normalizarEntornoDocente('Clase de matemática para 2do grado');
  assert.equal(env2.grado, 2);
  assert.equal(env2.area, 'Matemática');
  assert.equal(env2.termino, 'numeración y adición');
});

test('MotorCognitivoClon - Ejecución curricular con bucle de autorreparación', async () => {
  let llamadas = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    const consulta = body.p_consulta || body.query_text;
    llamadas.push(consulta);
    if (consulta === 'sustracción avanzada') {
      return { ok: true, json: async () => [] };
    }
    return {
      ok: true,
      json: async () => [{ pagina: 64, texto: 'Sustracción de números naturales', fuente_documento: 'Adecuación Curricular' }]
    };
  };

  try {
    const motor = new MotorCognitivoClon({ GEMINI_API_KEY: 'test-key', SUPABASE_SERVICE_ROLE_KEY: 'srv' });
    const res = await motor.ejecutarConsultaCurricular('sustracción avanzada', 1);

    assert.equal(res.length, 1);
    assert.equal(res[0].pagina, 64);
    assert.deepEqual(llamadas, ['sustracción avanzada', 'alfabetizacion numeracion basica']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('MotorCognitivoClon - Inferencia y orquestación con mock de @google/genai', async () => {
  let promptEnviado = null;
  let systemInstructionEnviado = null;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => [{ pagina: 48, texto: 'Lectura de palabras', fuente_documento: 'MINERD Primaria' }]
  });

  try {
    const motor = new MotorCognitivoClon({ GEMINI_API_KEY: 'test-key' });

    motor.ai = {
      models: {
        generateContent: async ({ contents, config }) => {
          promptEnviado = contents;
          systemInstructionEnviado = config.systemInstruction;
          return { text: 'Secuencia didáctica generada directamente.' };
        }
      }
    };

    const salida = await motor.procesarPlanificacion('Planifica clase de lectura');
    assert.equal(salida, 'Secuencia didáctica generada directamente.');
    assert.equal(promptEnviado, 'Planifica clase de lectura');
    assert.match(systemInstructionEnviado, /Israel Montás/);
    assert.match(systemInstructionEnviado, /Escuela Primaria Batey Pinos/);
    assert.match(systemInstructionEnviado, /Inicio \(10 min\)/);
    assert.match(systemInstructionEnviado, /Desarrollo \(25 min\)/);
    assert.match(systemInstructionEnviado, /Cierre \(10 min\)/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
