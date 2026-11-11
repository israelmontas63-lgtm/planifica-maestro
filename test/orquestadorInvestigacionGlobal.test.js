import test from 'node:test';
import assert from 'node:assert/strict';
import { OrquestadorInvestigacionGlobal } from '../worker/services/orquestadorInvestigacionGlobal.js';

test('OrquestadorInvestigacionGlobal - Declaración formal de herramientas', () => {
  const orq = new OrquestadorInvestigacionGlobal({ GEMINI_API_KEY: 'test-key' });
  const tools = orq.obtenerHerramientasSistema();
  assert.equal(tools.length, 1);
  const declarations = tools[0].functionDeclarations;
  assert.equal(declarations.length, 2);
  assert.equal(declarations[0].name, 'consultar_curriculo_minerd');
  assert.equal(declarations[1].name, 'investigar_web_global');
  assert.ok(declarations[1].parameters.properties.dominio_prioritario);
});

test('OrquestadorInvestigacionGlobal - Búsqueda web real vía Tavily (mocked) con fallback', async () => {
  // Caso 1: Sin Tavily Key devuelve fallback local
  const orqSinClave = new OrquestadorInvestigacionGlobal({ GEMINI_API_KEY: 'test-key' });
  const fallbackRes = await orqSinClave.ejecutarBusquedaWeb('fotosíntesis');
  assert.equal(fallbackRes.length, 1);
  assert.equal(fallbackRes[0].fuente, 'Web Fallback');

  // Caso 2: Con Tavily Key llama al endpoint
  let urlLlamada = '';
  let payloadLlamada = null;

  const mockFetch = async (url, opts) => {
    urlLlamada = url;
    payloadLlamada = JSON.parse(opts.body);
    return {
      ok: true,
      json: async () => ({
        results: [
          { url: 'https://educando.edu.do/recurso', title: 'Recurso Oficial', content: 'Guía pedagógica' }
        ]
      })
    };
  };

  const orqConClave = new OrquestadorInvestigacionGlobal({
    GEMINI_API_KEY: 'test-key',
    TAVILY_API_KEY: 'tavily-test'
  }, { fetchFn: mockFetch });

  const resultados = await orqConClave.ejecutarBusquedaWeb('guía docente', 'educando.edu.do');
  assert.equal(resultados.length, 1);
  assert.equal(resultados[0].fuente, 'https://educando.edu.do/recurso');
  assert.equal(payloadLlamada.max_results, 4);
  assert.match(payloadLlamada.query, /site:educando\.edu\.do/);
});

test('OrquestadorInvestigacionGlobal - Consulta curricular con autorreparación semántica', async () => {
  let consultasRpc = [];

  const mockFetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    const consulta = body.p_consulta || body.query_text;
    consultasRpc.push(consulta);
    if (consulta === 'sustracción compleja') {
      return { ok: true, json: async () => [] };
    }
    return {
      ok: true,
      json: async () => [{ pagina: 85, fuente_documento: 'MINERD Primaria', texto: 'Contenidos de numeración' }]
    };
  };

  const orq = new OrquestadorInvestigacionGlobal({
    GEMINI_API_KEY: 'test-key',
    SUPABASE_SERVICE_ROLE_KEY: 'srv'
  }, { fetchFn: mockFetch });

  const res = await orq.ejecutarConsultaCurricular('sustracción compleja', 1);
  assert.equal(res.length, 1);
  assert.equal(res[0].pagina, 85);
  assert.deepEqual(consultasRpc, ['sustracción compleja', 'alfabetización inicial numeración']);
});

test('OrquestadorInvestigacionGlobal - Generar respuesta verificada con grounding forzado', async () => {
  let systemInstructionCapturado = null;

  const mockFetch = async (url) => {
    if (url.includes('tavily')) {
      return {
        ok: true,
        json: async () => ({ results: [{ url: 'https://gob.do/doc', content: 'Normativa MINERD' }] })
      };
    }
    return {
      ok: true,
      json: async () => [{ pagina: 48, fuente_documento: 'Adecuación Curricular', texto: 'Adición básica' }]
    };
  };

  const orq = new OrquestadorInvestigacionGlobal({
    GEMINI_API_KEY: 'test-key',
    TAVILY_API_KEY: 'tavily-test',
    SUPABASE_SERVICE_ROLE_KEY: 'srv'
  }, { fetchFn: mockFetch });

  orq.ai = {
    models: {
      generateContent: async ({ config }) => {
        systemInstructionCapturado = config.systemInstruction;
        return { text: 'Matriz verificada con grounding forzado.' };
      }
    }
  };

  const res = await orq.generarRespuestaVerificada('Planifica clase de matemática para 2do grado');
  assert.equal(res, 'Matriz verificada con grounding forzado.');
  assert.match(systemInstructionCapturado, /Israel Montás/);
  assert.match(systemInstructionCapturado, /Escuela Primaria Batey Pinos/);
  assert.match(systemInstructionCapturado, /PROTOCOLO INVIOLABLE DE GROUNDING/);
  assert.match(systemInstructionCapturado, /INICIO \(10 min\)/);
  assert.match(systemInstructionCapturado, /DESARROLLO \(25 min\)/);
  assert.match(systemInstructionCapturado, /CIERRE \(10 min\)/);
  assert.match(systemInstructionCapturado, /Pág\. 48/);
});
