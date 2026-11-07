import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { CerebroExperto } from '../worker/services/cerebroExperto.js';

describe('Auditoría del Cerebro Multimodal Edge (CerebroExperto)', () => {
  const mockEnv = {
    GEMINI_API_KEY: 'test-ai-key',
    SUPABASE_URL: 'https://obcjdxearmmvtihfmtaa.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    TAVILY_API_KEY: 'test-tavily-key'
  };

  it('debe registrar formalmente las herramientas con sus parámetros obligatorios', () => {
    const cerebro = new CerebroExperto(mockEnv);
    const tools = cerebro.obtenerHerramientas();
    const decls = tools[0].functionDeclarations;

    assert.equal(decls.length, 2);
    const curriculo = decls.find(d => d.name === 'consultar_curriculo_minerd');
    assert.ok(curriculo);
    assert.deepEqual(curriculo.parameters.required, ['termino', 'grado']);
    const web = decls.find(d => d.name === 'investigar_web_educativa');
    assert.ok(web);
    assert.deepEqual(web.parameters.required, ['consulta']);
  });

  it('debe formatear correctamente la consulta RPC hacia Supabase', async () => {
    const cerebro = new CerebroExperto(mockEnv);
    const fetchOriginal = global.fetch;

    global.fetch = async (url, opts) => {
      if (url.includes('buscar_curriculo_paginas')) {
        const body = JSON.parse(opts.body);
        assert.equal(body.query_text, 'fracciones');
        assert.equal(body.p_grado, 2);
        return {
          ok: true,
          json: async () => [{ pagina: 120, texto: 'Contenido curricular', fuente_documento: 'adecuacion' }]
        };
      }
      return fetchOriginal(url, opts);
    };

    const res = await cerebro.ejecutarHerramienta('consultar_curriculo_minerd', {
      termino: 'fracciones',
      grado: 2
    });

    assert.equal(res.resultados.length, 1);
    assert.equal(res.resultados[0].pagina, 120);
    global.fetch = fetchOriginal;
  });

  it('debe despachar buscar_curriculo_oficial hacia Supabase RPC', async () => {
    const originalFetch = global.fetch;
    let urlCapturada = null;
    let bodyCapturado = null;

    global.fetch = async (url, opts) => {
      urlCapturada = url;
      bodyCapturado = JSON.parse(opts.body);
      return {
        ok: true,
        json: async () => [{ pagina: 115, contenido: 'Suma de números naturales' }]
      };
    };

    const experto = new CerebroExperto(mockEnv);
    const res = await experto.despacharHerramienta('buscar_curriculo_oficial', {
      termino: 'adición',
      grado: 1
    });

    assert.equal(urlCapturada, 'https://obcjdxearmmvtihfmtaa.supabase.co/rest/v1/rpc/buscar_curriculo_paginas');
    assert.equal(bodyCapturado.query_text, 'adición');
    assert.equal(bodyCapturado.p_grado, 1);
    assert.equal(res.length, 1);
    assert.equal(res[0].pagina, 115);

    global.fetch = originalFetch;
  });

  it('debe despachar investigar_web_tavily hacia Tavily Search API', async () => {
    const originalFetch = global.fetch;
    let bodyCapturado = null;

    global.fetch = async (url, opts) => {
      bodyCapturado = JSON.parse(opts.body);
      return {
        ok: true,
        json: async () => ({
          results: [
            { title: 'Resolución 01-2023', content: 'Adecuación curricular oficial', url: 'https://minerd.gob.do/res' }
          ]
        })
      };
    };

    const experto = new CerebroExperto(mockEnv);
    const res = await experto.despacharHerramienta('investigar_web_tavily', {
      consulta: 'resolución adecuación curricular 2023'
    });

    assert.equal(bodyCapturado.api_key, 'test-tavily-key');
    assert.equal(bodyCapturado.query, 'resolución adecuación curricular 2023');
    assert.equal(res.length, 1);
    assert.equal(res[0].titulo, 'Resolución 01-2023');
    assert.equal(res[0].extracto, 'Adecuación curricular oficial');
    assert.equal(res[0].link, 'https://minerd.gob.do/res');

    global.fetch = originalFetch;
  });

  it('debe ejecutar la herramienta investigar_web_educativa con filtro oficial del MINERD', async () => {
    const originalFetch = global.fetch;
    let bodyCapturado = null;

    global.fetch = async (url, opts) => {
      bodyCapturado = JSON.parse(opts.body);
      return {
        ok: true,
        json: async () => ({
          results: [
            { title: 'Calendario Escolar', content: 'Efemérides patrias y días no laborables', url: 'https://ministeriodeeducacion.gob.do/cal' }
          ]
        })
      };
    };

    const experto = new CerebroExperto(mockEnv);
    const res = await experto.ejecutarHerramienta('investigar_web_educativa', {
      consulta: 'efemérides febrero'
    });

    assert.ok(bodyCapturado.query.includes('efemérides febrero'));
    assert.ok(bodyCapturado.query.includes('ministeriodeeducacion.gob.do'));
    assert.equal(res.resultados.length, 1);
    assert.equal(res.resultados[0].titulo, 'Calendario Escolar');
    assert.equal(res.resultados[0].resumen, 'Efemérides patrias y días no laborables');
    assert.equal(res.resultados[0].link, 'https://ministeriodeeducacion.gob.do/cal');

    global.fetch = originalFetch;
  });

  it('debe cargar historial y persistir mensajes en Supabase REST', async () => {
    const originalFetch = global.fetch;
    const peticiones = [];

    global.fetch = async (url, opts) => {
      peticiones.push({ url, opts });
      if (opts?.method === 'GET') {
        return {
          ok: true,
          json: async () => [
            { rol: 'user', contenido: 'Pregunta previa' },
            { rol: 'model', contenido: 'Respuesta previa' }
          ]
        };
      }
      return { ok: true, json: async () => ({}) };
    };

    const experto = new CerebroExperto(mockEnv);
    const hist = await experto.cargarHistorial('ses-456');
    assert.equal(hist.length, 2);
    assert.equal(hist[0].role, 'user');
    assert.equal(hist[0].parts[0].text, 'Pregunta previa');
    assert.equal(hist[1].role, 'model');

    await experto.persistirMensaje('ses-456', 'user', 'Nueva consulta', true);
    const postReq = peticiones.find(p => p.opts?.method === 'POST');
    assert.ok(postReq);
    const postBody = JSON.parse(postReq.opts.body);
    assert.equal(postBody.sesion_id, 'ses-456');
    assert.equal(postBody.rol, 'user');
    assert.equal(postBody.contenido, 'Nueva consulta');
    assert.equal(postBody.tiene_imagen, true);

    global.fetch = originalFetch;
  });

  it('debe orquestar el bucle ReAct completo con modelo mock e inyección de respuestas de herramientas', async () => {
    const mensajesGuardados = [];
    const mockMemoria = {
      obtenerHistorial: async (sesionId, limite) => [
        { role: 'user', parts: [{ text: 'Hola, soy la profesora María.' }] },
        { role: 'model', parts: [{ text: 'Hola, Profe María. ¿En qué te puedo orientar?' }] }
      ],
      guardarMensaje: async (msg) => {
        mensajesGuardados.push(msg);
      }
    };

    let turnoGenAI = 0;
    const mockAI = {
      models: {
        generateContent: async ({ contents }) => {
          turnoGenAI++;
          if (turnoGenAI === 1) {
            return {
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        functionCall: {
                          name: 'consultar_curriculo_minerd',
                          args: { termino: 'secuencias didácticas', grado: 2 }
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
                    {
                      text: 'En segundo grado, las secuencias didácticas de Lengua Española articulan la comprensión y producción oral y escrita.'
                    }
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
      json: async () => [{ pagina: 80, texto: 'Secuencias didácticas en lengua española' }]
    });

    const experto = new CerebroExperto({
      ...mockEnv,
      ai: mockAI,
      memoria: mockMemoria
    });

    const resultado = await experto.ejecutar({
      sesionId: 'sesion-test-99',
      mensaje: '¿Cómo trabajo las secuencias didácticas en 2do grado?',
      imagenBase64: 'data:image/jpeg;base64,123456'
    });

    assert.equal(resultado.sesionId, 'sesion-test-99');
    assert.ok(resultado.respuesta.includes('secuencias didácticas'));
    assert.equal(mensajesGuardados.length, 2);
    assert.equal(mensajesGuardados[0].rol, 'user');
    assert.equal(mensajesGuardados[0].contenido, '¿Cómo trabajo las secuencias didácticas en 2do grado?');
    assert.equal(mensajesGuardados[1].rol, 'model');
    assert.ok(mensajesGuardados[1].contenido.includes('secuencias didácticas'));

    global.fetch = originalFetch;
  });

  it('debe orquestar el flujo multimodal en turno 0: almacenamiento frío, síntesis visual y persistencia liviana', async () => {
    let storageSubido = false;
    let sintesisEjecutada = false;
    let mensajePersistido = null;

    const mockGestorArchivos = {
      subirImagenBase64: async (base64, mime) => {
        storageSubido = true;
        return {
          archivoId: 'img_test_123.jpg',
          archivoUrl: 'https://test-supabase.co/capturas_asistente/img_test_123.jpg'
        };
      }
    };

    const mockAI = {
      models: {
        generateContent: async ({ contents }) => {
          const userContent = contents.find(c => c.role === 'user');
          const tienePromptSintesis = userContent?.parts?.some(p => p.text?.includes('describe qué interfaz'));
          if (tienePromptSintesis) {
            sintesisEjecutada = true;
            return {
              candidates: [
                { content: { parts: [{ text: 'Pantalla de edición curricular con botón guardar deshabilitado.' }] } }
              ]
            };
          }
          return {
            candidates: [
              { content: { parts: [{ text: 'Debes completar los campos obligatorios para habilitar el botón.' }] } }
            ]
          };
        }
      }
    };

    const mockMemoria = {
      obtenerHistorial: async () => [],
      guardarMensaje: async (msg) => {
        if (msg.rol === 'user') {
          mensajePersistido = msg;
        }
      }
    };

    const experto = new CerebroExperto({
      ...mockEnv,
      ai: mockAI,
      memoria: mockMemoria,
      gestorArchivos: mockGestorArchivos
    });

    const res = await experto.procesar({
      sesionId: 'ses-cold-flow',
      prompt: '¿Por qué no puedo guardar mi planificación?',
      imagenBase64: 'data:image/jpeg;base64,abcdef123456'
    });

    assert.equal(res.exito, true);
    assert.ok(res.respuesta.includes('completar los campos obligatorios'));
    assert.equal(storageSubido, true);
    assert.equal(sintesisEjecutada, true);

    assert.ok(mensajePersistido);
    assert.equal(mensajePersistido.rol, 'user');
    assert.equal(mensajePersistido.archivoId, 'img_test_123.jpg');
    assert.equal(mensajePersistido.archivoUrl, 'https://test-supabase.co/capturas_asistente/img_test_123.jpg');
    assert.equal(mensajePersistido.resumenVisual, 'Pantalla de edición curricular con botón guardar deshabilitado.');
  });

  // TAREAS ORDEN 28
  it('debe elaborar estructura completa con citas curriculares y datos de Batey Pinos ante solicitudes abiertas ("ejemplo de planificación")', async () => {
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      if (url.includes('buscar_curriculo_paginas')) {
        return {
          ok: true,
          json: async () => [
            { pagina: 48, texto: 'Adición de números naturales y resolución de problemas cotidianos.', fuente_documento: 'Adecuación Curricular 1ro' }
          ]
        };
      }
      return { ok: true, json: async () => [] };
    };

    const experto = new CerebroExperto(mockEnv);
    const plan = await experto.elaborarPlanificacionProfunda('dame un ejemplo de planificación para mi clase');

    // Validación de arquetipo docente y aula
    assert.equal(plan.docente, 'Israel Montás');
    assert.equal(plan.centro, 'Escuela Primaria Batey Pinos');
    assert.equal(plan.nivel, 'Primaria Multigrado (1.º y 2.º)');
    assert.equal(plan.duracion, '45 minutos');

    // Validación de fundamentación y citas
    assert.ok(plan.citaCurricular);
    assert.equal(plan.citaCurricular.pagina, 48);
    assert.ok(plan.citaCurricular.documento.includes('Adecuación Curricular'));

    // Validación de secuencia didáctica completa (Inicio 10m, Desarrollo 25m, Cierre 10m)
    assert.equal(plan.secuenciaDidactica.inicio.tiempo, '10 minutos');
    assert.equal(plan.secuenciaDidactica.desarrollo.tiempo, '25 minutos');
    assert.ok(plan.secuenciaDidactica.desarrollo.actividadesMultigrado.primerGrado);
    assert.ok(plan.secuenciaDidactica.desarrollo.actividadesMultigrado.segundoGrado);
    assert.equal(plan.secuenciaDidactica.cierre.tiempo, '10 minutos');

    // Validación de memoria docente inyectada
    assert.ok(plan.memoriaDocenteInyectada.includes('Israel Montás'));
    assert.ok(plan.memoriaDocenteInyectada.includes('Escuela Primaria Batey Pinos'));

    global.fetch = originalFetch;
  });

  it('debe activar el bucle de autorreparación cuando una búsqueda curricular inicial devuelve vacío', async () => {
    const originalFetch = global.fetch;
    let intentos = 0;
    const terminosBuscados = [];

    global.fetch = async (url, opts) => {
      if (url.includes('buscar_curriculo_paginas')) {
        intentos++;
        const body = JSON.parse(opts.body);
        terminosBuscados.push(body.query_text);

        // Primer intento con término ultra-específico devuelve 0 registros
        if (body.query_text === 'suma con reagrupación') {
          return { ok: true, json: async () => [] };
        }

        // Segundo intento con término troncal reformulado ('adición') devuelve registros
        if (body.query_text === 'adición') {
          return {
            ok: true,
            json: async () => [
              { pagina: 52, texto: 'Algoritmo de la adición y cálculo mental', fuente_documento: 'Adecuación Curricular MINERD' }
            ]
          };
        }
      }
      return { ok: true, json: async () => [] };
    };

    const experto = new CerebroExperto(mockEnv);
    const resultado = await experto.ejecutarHerramienta('consultar_curriculo_minerd', {
      termino: 'suma con reagrupación',
      grado: 1
    });

    // Validar bucle de autorreparación ejecutado
    assert.equal(intentos, 2);
    assert.equal(resultado.autorreparado, true);
    assert.equal(resultado.termino_original, 'suma con reagrupación');
    assert.equal(resultado.termino_consultado, 'adición');
    assert.deepEqual(terminosBuscados, ['suma con reagrupación', 'adición']);

    // Validar resultados recuperados tras autorreparación
    assert.equal(resultado.resultados.length, 1);
    assert.equal(resultado.resultados[0].pagina, 52);
    assert.ok(resultado.resultados[0].texto.includes('adición'));

    global.fetch = originalFetch;
  });

  it('debe validar que ninguna operación intente modificar archivos sellados del repositorio', () => {
    const repoRoot = path.resolve(process.cwd());
    const rutaHashes = path.resolve(repoRoot, 'PROTEGIDO.hashes.json');
    assert.ok(fs.existsSync(rutaHashes), 'El manifiesto PROTEGIDO.hashes.json debe existir');

    const config = JSON.parse(fs.readFileSync(rutaHashes, 'utf8'));
    const totalEsperado = config.total_archivos || 83;
    assert.equal(totalEsperado, 83);

    // Muestra de verificación de archivos críticos sellados
    const archivosCriticos = [
      'worker/index.js',
      'worker/services/asistenteService.js',
      'worker/services/curriculoService.js',
      'worker/services/aiProvider.js',
      'scripts/guardia.js'
    ];

    for (const rel of archivosCriticos) {
      const fullPath = path.resolve(repoRoot, rel);
      assert.ok(fs.existsSync(fullPath), `El archivo sellado ${rel} debe existir`);
      const hashDisco = crypto.createHash('sha256').update(fs.readFileSync(fullPath)).digest('hex');
      const hashEsperado = config.hashes[rel];
      assert.equal(hashDisco, hashEsperado, `El archivo sellado ${rel} no debe haber sido modificado`);
    }
  });

  // TAREAS ORDEN 30: PROTOCOLO METODOLÓGICO DE RAZONAMIENTO Y VERIFICACIÓN
  it('debe inyectar el protocolo metodológico de razonamiento y verificación en el System Prompt Maestro', () => {
    const experto = new CerebroExperto(mockEnv);
    const memoriaMock = '### MEMORIA PERMANENTE DEL DOCENTE:\n- [perfil] nombre_docente: Israel Montás\n- [aula] centro_educativo: Escuela Primaria Batey Pinos\n';
    const promptMaestro = experto.construirSystemPromptMaestro(memoriaMock);

    // 1. Inferencia de datos canónicos sin preguntas redundantes
    assert.ok(promptMaestro.includes('Israel Montás'));
    assert.ok(promptMaestro.includes('Escuela Primaria Batey Pinos'));
    assert.ok(/Primaria Multigrado \(1\.[ºo] y 2\.[ºo] Grado\)/i.test(promptMaestro));
    assert.ok(promptMaestro.includes('45 minutos'));
    assert.ok(/preguntas/i.test(promptMaestro));

    // 2. Fundamentación curricular estricta sin alucinaciones desde Supabase
    assert.ok(promptMaestro.includes('consultar_curriculo_minerd'));
    assert.ok(promptMaestro.includes('public.curriculo_paginas'));
    assert.ok(promptMaestro.includes('números de página'));

    // 3. Secuencia didáctica obligatoria en 3 momentos terminada al 100%
    assert.ok(promptMaestro.includes('Inicio (10 min)'));
    assert.ok(promptMaestro.includes('Desarrollo (25 min)'));
    assert.ok(promptMaestro.includes('Cierre (10 min)'));
    assert.ok(/Actividades.*diferenciadas.*1\.[ºo] y 2\.[ºo] grado/i.test(promptMaestro));

    // 4. Filtro heurístico de fuentes web institucionales
    assert.ok(promptMaestro.includes('investigar_web_educativa'));
    assert.ok(promptMaestro.includes('.gob.do'));
    assert.ok(promptMaestro.includes('unicef.org'));
  });

  // TAREAS ORDEN 31: INTEGRACIÓN DEL PROMPT DE CLONACIÓN COGNITIVA DESDE ARCHIVO
  it('debe cargar el archivo worker/prompts/sistema_cerebro_clon.md y garantizar Smart Defaults para Batey Pinos', () => {
    const experto = new CerebroExperto(mockEnv);
    const contenidoArchivo = experto.cargarPromptArchivo();
    assert.ok(contenidoArchivo, 'El archivo sistema_cerebro_clon.md debe cargarse exitosamente');
    assert.ok(contenidoArchivo.includes('PLANIFICA MAESTRO'));
    assert.ok(contenidoArchivo.includes('Israel Montás'));
    assert.ok(contenidoArchivo.includes('Escuela Primaria Batey Pinos'));
    assert.ok(/Primaria Multigrado \(1\.[ºo] y 2\.[ºo] Grado\)/i.test(contenidoArchivo));
    assert.ok(contenidoArchivo.includes('45 minutos'));

    // Validar integración en llamada con memoria docente
    const promptFinal = experto.construirSystemPromptMaestro('### MEMORIA PERMANENTE DEL DOCENTE:\n- [aula] centro_educativo: Escuela Primaria Batey Pinos');
    assert.ok(promptFinal.includes('Escuela Primaria Batey Pinos'));
    assert.ok(promptFinal.includes('Israel Montás'));
    assert.ok(promptFinal.includes('página oficial'));
  });

  // TAREAS ORDEN 38: INTEGRACIÓN DE PROMPTS CERTIFICADOS Y DOBLE MODO
  it('debe seleccionar dinámicamente entre MODO PRODUCCIÓN y MODO DEMOSTRATIVO con prompts certificados', () => {
    const experto = new CerebroExperto(mockEnv);

    // 1. Detección automática de modo
    assert.equal(experto.determinarModo('hazme una clase de matemática'), 'produccion');
    assert.equal(experto.determinarModo('planifica una clase en modo demostrativo'), 'demostrativo');
    assert.equal(experto.determinarModo('ejemplo libre para 5to grado de secundaria'), 'demostrativo');
    assert.equal(experto.determinarModo('clase para profesora Ana Gómez en Liceo Juan Pablo Duarte'), 'demostrativo');

    // 2. Construcción de prompt en MODO PRODUCCIÓN (Smart Defaults garantizados)
    const promptProduccion = experto.construirSystemPromptMaestro('', 'produccion');
    assert.ok(promptProduccion.includes('Israel Montás'));
    assert.ok(promptProduccion.includes('Escuela Primaria Batey Pinos'));
    assert.ok(promptProduccion.includes('45 minutos'));

    // 3. Construcción de prompt en MODO DEMOSTRATIVO (Libre albedrío sin forzar Batey Pinos)
    const promptDemostrativo = experto.construirSystemPromptMaestro('', 'demostrativo');
    assert.ok(promptDemostrativo.includes('ENRUTADOR DINÁMICO DE MODOS COGNITIVOS'));
    assert.ok(promptDemostrativo.includes('MODO DEMOSTRATIVO / PRUEBAS'));
    assert.ok(promptDemostrativo.includes('INVESTIGADOR Y VALIDADOR DE FUENTES'));
    assert.ok(promptDemostrativo.includes('Libre Albedrío Pedagógico'));
  });
});
