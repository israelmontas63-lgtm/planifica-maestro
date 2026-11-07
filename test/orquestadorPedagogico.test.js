import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OrquestadorPedagogico, SMART_DEFAULTS } from '../worker/services/orquestadorPedagogico.js';

describe('OrquestadorPedagogico - Smart Defaults y Mapeo de Esquemas', () => {
  const envMock = {
    SUPABASE_URL: 'https://test-project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key'
  };

  it('debe normalizar automáticamente a grado 3 y Lengua Española por defecto ante peticiones genéricas', () => {
    const orquestador = new OrquestadorPedagogico(envMock);
    
    // Petición genérica sin especificar grado ni asignatura
    const params1 = orquestador.normalizarParametros('hazme una planificación sobre la fábula');
    assert.equal(params1.grado, 3);
    assert.equal(params1.asignatura, 'Lengua Española');
    assert.equal(params1.docente, 'Israel Montás');
    assert.equal(params1.centro, 'Escuela Batey Pinos');
    assert.equal(params1.tiempoClase, '45 minutos');
    assert.ok(params1.tema.includes('fábula'));

    // Petición especificando solo grado 3 sin asignatura
    const params2 = orquestador.normalizarParametros('planifica para tercer grado el tema de la noticia');
    assert.equal(params2.grado, 3);
    assert.equal(params2.asignatura, 'Lengua Española');
    assert.equal(params2.docente, 'Israel Montás');
    assert.equal(params2.centro, 'Escuela Batey Pinos');
  });

  it('debe detectar asignaturas canónicas y grados específicos cuando se mencionan', () => {
    const orquestador = new OrquestadorPedagogico(envMock);

    const paramsMat = orquestador.normalizarParametros('necesito un plan de matemática para 2do grado sobre adición');
    assert.equal(paramsMat.grado, 2);
    assert.equal(paramsMat.asignatura, 'Matemática');

    const paramsNat = orquestador.normalizarParametros('plan de ciencias de la naturaleza para 1er grado sobre seres vivos');
    assert.equal(paramsNat.grado, 1);
    assert.equal(paramsNat.asignatura, 'Ciencias de la Naturaleza');

    const paramsSoc = orquestador.normalizarParametros('planificación de ciencias sociales para grado 3 sobre los símbolos patrios');
    assert.equal(paramsSoc.grado, 3);
    assert.equal(paramsSoc.asignatura, 'Ciencias Sociales');
  });

  it('debe preservar campos de esquemas arbitrarios suministrados en el prompt o configuración', () => {
    const orquestador = new OrquestadorPedagogico(envMock);
    const contexto = orquestador.normalizarParametros('planifica para 3er grado');

    const esquemaArbitrario = {
      'Eje Transversal': '',
      'Estrategia de Enseñanza-Aprendizaje': '',
      'Momento de Exploración Sensorial': '',
      'Instrumento de Evaluación Formativa': '',
      'Observaciones para Inclusión': ''
    };

    const promptMaestro = orquestador.construirPromptMaestro(contexto, {}, esquemaArbitrario);

    // Debe contener las directivas de Smart Defaults
    assert.ok(promptMaestro.includes('Israel Montás'));
    assert.ok(promptMaestro.includes('Escuela Batey Pinos'));
    assert.ok(promptMaestro.includes('3.° de Primaria'));
    assert.ok(promptMaestro.includes('Lengua Española'));

    // Debe preservar fielmente los campos del esquema arbitrario
    assert.ok(promptMaestro.includes('Eje Transversal'));
    assert.ok(promptMaestro.includes('Estrategia de Enseñanza-Aprendizaje'));
    assert.ok(promptMaestro.includes('Momento de Exploración Sensorial'));
    assert.ok(promptMaestro.includes('Instrumento de Evaluación Formativa'));
    assert.ok(promptMaestro.includes('Observaciones para Inclusión'));

    // Debe indicar directiva de no repreguntar
    assert.ok(promptMaestro.includes('NO hagas preguntas de vuelta al docente'));
  });

  it('debe soportar esquemas suministrados en formato de texto o plantilla de usuario', () => {
    const orquestador = new OrquestadorPedagogico(envMock);
    const contexto = orquestador.normalizarParametros('plan para 2do grado');

    const plantillaTexto = '| Bloque | Actividad | Tiempo | Recursos |\n| [Inicio] | ... | ... | ... |';
    const promptMaestro = orquestador.construirPromptMaestro(contexto, {}, plantillaTexto);

    assert.ok(promptMaestro.includes('PLANTILLA TEXTUAL SUMINISTRADA POR EL USUARIO'));
    assert.ok(promptMaestro.includes('| Bloque | Actividad | Tiempo | Recursos |'));
  });

  it('debe consultar la RPC buscar_curriculo_paginas en Supabase y manejar fallos con fallback resiliente', async () => {
    let urlLlamada = null;
    let bodyLlamado = null;
    const fetchOriginal = global.fetch;

    global.fetch = async (url, opts) => {
      urlLlamada = url;
      bodyLlamado = JSON.parse(opts.body);
      return {
        ok: true,
        json: async () => [
          { pagina: 118, texto: 'Comprensión y producción de la fábula y moraleja', fuente_documento: 'Adecuación Curricular 3ro' }
        ]
      };
    };

    const orquestador = new OrquestadorPedagogico(envMock);
    const res = await orquestador.consultarFundamentacionCurricular('la fábula', 3, 3);

    assert.ok(urlLlamada.includes('buscar_curriculo_paginas'));
    assert.equal(bodyLlamado.query_text, 'la fábula');
    assert.equal(bodyLlamado.p_grado, 3);
    assert.equal(res.ok, true);
    assert.equal(res.fragmentos[0].pagina, 118);

    // Prueba de fallo con fallback resiliente
    global.fetch = async () => ({
      ok: false,
      status: 503
    });

    const resFallback = await orquestador.consultarFundamentacionCurricular('la fábula', 3, 3);
    assert.equal(resFallback.ok, true);
    assert.equal(resFallback.fuente, 'conocimiento_base_oficial');
    assert.equal(resFallback.fragmentos[0].pagina, 120);

    global.fetch = fetchOriginal;
  });
});
