import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MotorCurricularRAG } from '../worker/services/motorCurricularRAG.js';

describe('MotorCurricularRAG - Consultas Curriculares y Secuencias Multigrado', () => {
  const envMock = {
    SUPABASE_URL: 'https://test-project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key'
  };

  it('debe conectar con la RPC buscar_curriculo_paginas enviando query_text, p_grado y p_limite (mínimo 3)', async () => {
    let endpointLlamado = null;
    let bodyCapturado = null;
    const fetchOriginal = global.fetch;

    global.fetch = async (url, opts) => {
      endpointLlamado = url;
      bodyCapturado = JSON.parse(opts.body);
      return {
        ok: true,
        json: async () => [
          { pagina: 110, texto: 'Secuencias de adición y resolución de problemas', fuente_documento: 'Adecuación Curricular 1er Ciclo' },
          { pagina: 112, texto: 'Uso del conteo y agrupamiento en decenas', fuente_documento: 'Adecuación Curricular 1er Ciclo' },
          { pagina: 115, texto: 'Estrategias de cálculo mental para primer grado', fuente_documento: 'Adecuación Curricular 1er Ciclo' }
        ]
      };
    };

    const motor = new MotorCurricularRAG(envMock);
    const res = await motor.consultarCurriculoPaginas({
      termino: 'adición',
      grado: 1,
      limite: 3
    });

    assert.ok(endpointLlamado.includes('/rest/v1/rpc/buscar_curriculo_paginas'));
    assert.equal(bodyCapturado.query_text, 'adición');
    assert.equal(bodyCapturado.p_grado, 1);
    assert.equal(bodyCapturado.p_limite, 3);

    assert.equal(res.ok, true);
    assert.equal(res.total, 3);
    assert.equal(res.fragmentos[0].pagina, 110);
    assert.ok(res.fragmentos[0].texto.includes('adición'));
    assert.equal(res.fragmentos[0].documento, 'Adecuación Curricular 1er Ciclo');

    global.fetch = fetchOriginal;
  });

  it('debe formatear el contexto RAG inyectando directriz y páginas oficiales', () => {
    const motor = new MotorCurricularRAG(envMock);
    const fragmentos = [
      { pagina: 85, texto: 'Comprensión de cuentos infantiles', documento: 'Lengua Española Primaria', grado: 2 }
    ];

    const contexto = motor.formatearContextoRAG(fragmentos);
    assert.ok(contexto.includes('500 PÁGINAS OFICIALES'));
    assert.ok(contexto.includes('Página Oficial: 85'));
    assert.ok(contexto.includes('Comprensión de cuentos infantiles'));
  });

  it('debe estructurar automáticamente la planificación multigrado con competencias, contenidos, indicadores y 45 min', async () => {
    const fetchOriginal = global.fetch;
    global.fetch = async () => ({
      ok: true,
      json: async () => [
        { pagina: 92, texto: 'Producción de oraciones simples con concordancia', fuente_documento: 'Adecuación Curricular 2023' }
      ]
    });

    const motor = new MotorCurricularRAG(envMock);
    const plan = await motor.estructurarPlanificacionMultigrado({
      tema: 'La oración simple',
      grado: 2,
      area: 'Lengua Española'
    });

    assert.equal(plan.tema, 'La oración simple');
    assert.equal(plan.grado, 2);
    assert.equal(plan.paginaCitada, 92);
    assert.ok(plan.planificacion.competencias_especificas.includes('pág. 92'));
    assert.ok(plan.planificacion.contenidos.conceptuales);
    assert.ok(plan.planificacion.contenidos.procedimentales);
    assert.ok(plan.planificacion.contenidos.actitudinales);
    assert.ok(plan.planificacion.indicadores_logro.includes('pág. 92'));

    // Estructura de 45 minutos
    assert.ok(plan.planificacion.secuencia_didactica_45min.inicio_10min);
    assert.ok(plan.planificacion.secuencia_didactica_45min.desarrollo_25min);
    assert.ok(plan.planificacion.secuencia_didactica_45min.cierre_10min);
    assert.equal(plan.planificacion.fuente_oficial, 'Adecuación Curricular 2023, pág. 92');

    global.fetch = fetchOriginal;
  });

  it('debe generar planificación multigrado asistida por LLM cuando se proporciona aiInstance', async () => {
    const fetchOriginal = global.fetch;
    global.fetch = async () => ({
      ok: true,
      json: async () => [
        { pagina: 48, texto: 'Secuencias numéricas hasta 99', fuente_documento: 'Adecuación Curricular MINERD' }
      ]
    });

    let promptRecibido = null;
    const mockAI = {
      models: {
        generateContent: async ({ contents }) => {
          promptRecibido = contents[0].parts[0].text;
          return {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: 'Planificación Multigrado 1° y 2°:\n1. Competencias: Resuelve problemas con números hasta 99 (pág. 48).\n2. Inicio (10 min)\n3. Desarrollo (25 min)\n4. Cierre (10 min).'
                    }
                  ]
                }
              }
            ]
          };
        }
      }
    };

    const motor = new MotorCurricularRAG(envMock);
    const plan = await motor.estructurarPlanificacionMultigrado({
      tema: 'Numeración hasta 99',
      grado: 1,
      area: 'Matemática',
      aiInstance: mockAI
    });

    assert.ok(promptRecibido.includes('Secuencias numéricas hasta 99'));
    assert.ok(promptRecibido.includes('pág. 48'));
    assert.ok(plan.planificacion.includes('pág. 48'));
    assert.equal(plan.paginaCitada, 48);

    global.fetch = fetchOriginal;
  });
});
