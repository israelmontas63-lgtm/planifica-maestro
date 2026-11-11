import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CerebroRobot } from '../worker/services/cerebroRobot.js';

describe('Pruebas del Motor Autónomo CerebroRobot', () => {
  const envMock = {
    GEMINI_API_KEY: 'test-key',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    SUPABASE_ACCESS_TOKEN: 'sbp_mock_token',
    SUPABASE_PROJECT_REF: 'obcjdxearmmvtihfmtaa',
    TAVILY_API_KEY: 'tvly-mock-key'
  };

  it('debe registrar formalmente las 3 herramientas de ejecución', () => {
    const cerebro = new CerebroRobot(envMock);
    const tools = cerebro.obtenerHerramientas();

    assert.equal(tools.length, 3);
    const nombres = tools.map(t => t.name);
    assert.ok(nombres.includes('consultar_curriculo_minerd'));
    assert.ok(nombres.includes('investigar_web'));
    assert.ok(nombres.includes('ejecutar_ddl_supabase'));
  });

  it('debe despachar correctamente la estructura de DDL a la API de Supabase', async () => {
    const cerebro = new CerebroRobot(envMock);
    
    // Mock de fetch global temporal
    const originalFetch = global.fetch;
    global.fetch = async (url, options) => {
      if (url.includes('database/query')) {
        assert.equal(options.method, 'POST');
        assert.ok(options.headers.Authorization.includes('sbp_mock_token'));
        return { ok: true, json: async () => ({ success: true }) };
      }
      return originalFetch(url, options);
    };

    const resultado = await cerebro.despacharHerramienta('ejecutar_ddl_supabase', {
      sql: 'CREATE TABLE public.prueba_test (id INT);'
    });

    assert.equal(resultado.status, 'success');
    global.fetch = originalFetch;
  });

  it('debe despachar consulta curricular vía Supabase RPC', async () => {
    const cerebro = new CerebroRobot(envMock);

    const originalFetch = global.fetch;
    global.fetch = async (url, options) => {
      if (url.includes('buscar_curriculo_paginas')) {
        assert.equal(options.method, 'POST');
        assert.equal(options.headers.apikey, 'test-service-key');
        return {
          ok: true,
          json: async () => [{ pagina: 115, area: 'Matemática', texto: 'Adición' }]
        };
      }
      return originalFetch(url, options);
    };

    const res = await cerebro.despacharHerramienta('consultar_curriculo_minerd', {
      termino: 'adición',
      grado: 1
    });

    assert.equal(res.length, 1);
    assert.equal(res[0].pagina, 115);
    global.fetch = originalFetch;
  });

  it('debe despachar búsqueda web vía Tavily Search API', async () => {
    const cerebro = new CerebroRobot(envMock);

    const originalFetch = global.fetch;
    global.fetch = async (url, options) => {
      if (url.includes('api.tavily.com/search')) {
        assert.equal(options.method, 'POST');
        const body = JSON.parse(options.body);
        assert.equal(body.api_key, 'tvly-mock-key');
        assert.equal(body.query, 'calendario escolar minerd');
        return {
          ok: true,
          json: async () => ({
            results: [
              { title: 'Calendario Escolar', content: 'Inicio en agosto', url: 'https://minerd.gob.do' }
            ]
          })
        };
      }
      return originalFetch(url, options);
    };

    const res = await cerebro.despacharHerramienta('investigar_web', {
      consulta: 'calendario escolar minerd'
    });

    assert.equal(res.length, 1);
    assert.equal(res[0].titulo, 'Calendario Escolar');
    assert.equal(res[0].url, 'https://minerd.gob.do');
    global.fetch = originalFetch;
  });

  it('debe ejecutar el bucle procesarMensaje con visión y despacho de herramientas', async () => {
    const cerebro = new CerebroRobot(envMock);

    let turno = 0;
    cerebro.ai = {
      models: {
        generateContent: async ({ contents }) => {
          turno++;
          if (turno === 1) {
            // Verifica que se procese la imagen multimodal y el texto
            const userContent = contents.find(c => c.role === 'user');
            assert.ok(userContent.parts.some(p => p.inlineData));
            assert.ok(userContent.parts.some(p => p.text));

            return {
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        functionCall: {
                          name: 'consultar_curriculo_minerd',
                          args: { termino: 'secuencias', grado: 1 }
                        }
                      }
                    ]
                  }
                }
              ]
            };
          }

          return {
            candidates: [
              {
                content: {
                  parts: [
                    { text: 'Respuesta multimodal verificada con éxito.' }
                  ]
                }
              }
            ]
          };
        }
      }
    };

    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: true,
      json: async () => [{ pagina: 40, texto: 'Secuencias didácticas' }]
    });

    const res = await cerebro.procesarMensaje({
      mensaje: 'Analiza esta imagen y busca la secuencia',
      imagenBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    });

    assert.equal(res.texto, 'Respuesta multimodal verificada con éxito.');
    assert.ok(res.historialActualizado.length >= 3);

    global.fetch = originalFetch;
  });

  it('debe ejecutar autorreparación semántica cuando la consulta curricular inicial retorna vacío', async () => {
    const cerebro = new CerebroRobot(envMock);
    const llamadas = [];

    const originalFetch = global.fetch;
    global.fetch = async (url, opts) => {
      if (url.includes('buscar_curriculo_paginas')) {
        const body = JSON.parse(opts.body);
        const consulta = body.p_consulta || body.query_text;
        llamadas.push(consulta);
        if (consulta === 'termino_inexistente_xyz') {
          return { ok: true, json: async () => [] };
        }
        return {
          ok: true,
          json: async () => [{ pagina: 88, texto: 'Contenido reparado de alfabetización' }]
        };
      }
      return originalFetch(url, opts);
    };

    const res = await cerebro.despacharHerramienta('consultar_curriculo_minerd', {
      termino: 'termino_inexistente_xyz',
      grado: 1
    });

    assert.equal(res.length, 1);
    assert.equal(res[0].pagina, 88);
    assert.deepEqual(llamadas, ['termino_inexistente_xyz', 'alfabetización inicial numeración']);

    global.fetch = originalFetch;
  });

  it('debe enviar configuración estricta de inferencia (temperature: 0.2, maxOutputTokens: 2500, Smart Defaults)', async () => {
    const cerebro = new CerebroRobot(envMock);
    let configCapturada = null;

    cerebro.ai = {
      models: {
        generateContent: async ({ config }) => {
          configCapturada = config;
          return {
            candidates: [{
              content: { parts: [{ text: 'Inferencia validada.' }] }
            }]
          };
        }
      }
    };

    const res = await cerebro.procesarMensaje({ mensaje: 'Planifica clase' });
    assert.equal(res.texto, 'Inferencia validada.');
    assert.equal(configCapturada.temperature, 0.2);
    assert.equal(configCapturada.maxOutputTokens, 2500);
    assert.match(configCapturada.systemInstruction, /Israel Montás/);
    assert.match(configCapturada.systemInstruction, /Escuela Primaria Batey Pinos/);
    assert.match(configCapturada.systemInstruction, /45 min/);
  });

  it('debe seleccionar dinámicamente entre Modo Producción y Modo Demostrativo con CON BASE', () => {
    const cerebro = new CerebroRobot(envMock);

    // Modo Producción
    const promptProd = cerebro.determinarSystemPrompt('planifica una clase de adición');
    assert.match(promptProd, /Israel Montás/);
    assert.match(promptProd, /Escuela Primaria Batey Pinos/);
    assert.match(promptProd, /PRINCIPIO MULTIGRADO CON BASE/);
    assert.match(promptProd, /PROHIBICIÓN TOTAL DE ALUCINACIÓN/);

    // Modo Demostrativo
    const promptDemo = cerebro.determinarSystemPrompt('dame un ejemplo de planificación para 3er grado');
    assert.match(promptDemo, /MODO DEMOSTRATIVO/);
    assert.match(promptDemo, /PRINCIPIO MULTIGRADO CON BASE/);
    assert.match(promptDemo, /CONTEXTO OPERATIVO ASIGNADO/);
  });

  it('debe generar tupla verificable de cita curricular [Fuente | Pág. X | Cita] en consultar_curriculo_minerd', async () => {
    const cerebro = new CerebroRobot(envMock);
    const originalFetch = global.fetch;

    global.fetch = async () => ({
      ok: true,
      json: async () => [{ pagina: 48, fuente_documento: 'Adecuación Curricular MINERD', texto: 'Contenido de adición' }]
    });

    const res = await cerebro.despacharHerramienta('consultar_curriculo_minerd', { termino: 'adición', grado: 1 });
    assert.equal(res.length, 1);
    assert.ok(res[0].citaVerificada);
    assert.match(res[0].citaVerificada, /\[Fuente: Adecuación Curricular MINERD \| Pág\. 48 \| Contenido de adición\]/);

    global.fetch = originalFetch;
  });

  it('debe registrar formalmente las herramientas avanzadas de producción (obtenerHerramientasProduccion y obtenerHerramientasAvanzadas)', () => {
    const cerebro = new CerebroRobot(envMock);
    const tools = cerebro.obtenerHerramientasProduccion();
    const toolsAdv = cerebro.obtenerHerramientasAvanzadas();

    assert.equal(tools.length, 2);
    assert.equal(toolsAdv.length, 2);
    const names = tools.map(t => t.name);
    assert.ok(names.includes('generar_rubrica_evaluacion'));
    assert.ok(names.includes('registrar_plan_en_base_datos'));

    const catalogoActivo = cerebro.obtenerHerramientasActivas();
    assert.equal(catalogoActivo.length, 5);
  });

  it('debe despachar la generación de rúbricas analíticas oficiales (generar_rubrica_evaluacion)', async () => {
    const cerebro = new CerebroRobot(envMock);
    const rubrica = await cerebro.despacharHerramienta('generar_rubrica_evaluacion', {
      area: 'Lengua Española',
      indicador_logro: 'Reconoce la estructura y función del letrero en su entorno',
      grados: [1, 2]
    });

    assert.ok(rubrica.titulo.includes('Lengua Española'));
    assert.equal(rubrica.grados, '1.° y 2.°');
    assert.equal(rubrica.criterios.length, 2);
    assert.ok(rubrica.criterios[0].niveles.receptivo);
    assert.ok(rubrica.criterios[0].niveles.estrategico);
    assert.match(rubrica.sello_normativo, /Ordenanza 04-2023/);
  });

  it('debe persistir el plan generado en base de datos (registrar_plan_en_base_datos)', async () => {
    const cerebro = new CerebroRobot(envMock);
    const originalFetch = global.fetch;

    global.fetch = async (url, opts) => {
      assert.ok(url.includes('registro_planes_aula') || url.includes('planes_docentes'));
      assert.equal(opts.method, 'POST');
      return {
        ok: true,
        json: async () => [{ id: 'plan-123', titulo: 'Plan de Adición' }]
      };
    };

    const res = await cerebro.despacharHerramienta('registrar_plan_en_base_datos', {
      titulo: 'Plan de Adición',
      grado_nivel: '1.° y 2.° Primaria Multigrado',
      paginas_minerd_citadas: [48, 84],
      contenido_plan: 'Matriz didáctica completa'
    });

    assert.equal(res.status, 'success');
    assert.equal(res.registro.id, 'plan-123');

    global.fetch = originalFetch;
  });
});
