import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AsesorPedagogicoInteractivo } from '../worker/services/asesorPedagogicoInteractivo.js';
import { CerebroRobot } from '../worker/services/cerebroRobot.js';

describe('Pruebas del Asesor Pedagógico Interactivo y Detección de Redundancia (ORDEN 48)', () => {
  it('debe reconocer una petición duplicada o redundante en el historial y sugerir pausa activa', () => {
    const historial = [
      { role: 'user', parts: [{ text: 'Planificar clase sobre los números del 1 al 10 en 1er grado' }] },
      { role: 'model', parts: [{ text: 'Aquí está la planificación de los números...' }] },
      { role: 'user', parts: [{ text: 'Planificar clase sobre los números del 1 al 10 en 1er grado' }] }
    ];

    const resultado = AsesorPedagogicoInteractivo.detectarRedundancia(
      'Planificar clase sobre los números del 1 al 10 en 1er grado',
      historial
    );

    assert.equal(resultado.esRedundante, true);
    assert.ok(resultado.sugerenciaPausaActiva.includes('ya habíamos trabajado ese contenido'));
    assert.ok(resultado.sugerenciaPausaActiva.includes('lista de cotejo'));
  });

  it('debe retornar esRedundante: false cuando la consulta es nueva o variada', () => {
    const historial = [
      { role: 'user', parts: [{ text: 'Planificar clase de Lengua Española sobre la fábula' }] }
    ];

    const resultado = AsesorPedagogicoInteractivo.detectarRedundancia(
      'Planificar clase de Ciencias de la Naturaleza sobre las plantas',
      historial
    );

    assert.equal(resultado.esRedundante, false);
    assert.equal(resultado.sugerenciaPausaActiva, null);
  });

  it('debe emitir recomendación fraterna de adecuación cuando un tema no coincide con el ciclo', () => {
    const desfase = AsesorPedagogicoInteractivo.evaluarDesfaseCurricular(
      'Ecuaciones cuadráticas y factorización algebraica',
      'Primer Ciclo de Primaria (2do Grado)'
    );

    assert.equal(desfase.tieneDesfase, true);
    assert.ok(desfase.recomendacion.includes('noción concreta antes del algoritmo formal'));
    assert.ok(desfase.recomendacion.includes('material manipulativo'));
    assert.ok(desfase.recomendacion.includes('Ordenanza 04-2023'));
  });

  it('debe validar que no hay desfase cuando el tema corresponde al grado', () => {
    const desfase = AsesorPedagogicoInteractivo.evaluarDesfaseCurricular(
      'Conteo y valor posicional con unidades y decenas',
      '2do Grado de Primaria'
    );

    assert.equal(desfase.tieneDesfase, false);
    assert.equal(desfase.recomendacion, null);
  });

  it('debe generar exactamente las 2 preguntas pedagógicas guiadas de cierre', () => {
    const preguntas = AsesorPedagogicoInteractivo.generarPreguntasSeguimiento('1.° y 2.° Primaria');
    assert.ok(Array.isArray(preguntas));
    assert.equal(preguntas.length, 2);
    assert.equal(preguntas[0], '¿Deseas que prepare la rúbrica o lista de cotejo para evaluar esta clase?');
    assert.equal(preguntas[1], '¿Quieres que te desglose el material manipulativo sugerido (tarjetas, letras móviles o papelógrafos)?');
  });

  it('debe ejecutar evaluarPeticionDocente detectando peticion duplicada en historial de temas', () => {
    const historial = ['La noticia en 2do grado', 'El cuerpo humano'];
    const evaluacion = AsesorPedagogicoInteractivo.evaluarPeticionDocente(
      'Quiero otra clase de la noticia en 2do grado',
      historial
    );

    assert.equal(evaluacion.esRepetida, true);
    assert.equal(evaluacion.temaRepetido, 'La noticia en 2do grado');
    assert.ok(evaluacion.mensajePausa.includes('ya trabajamos una planificación'));
  });

  it('debe ejecutar evaluarPeticionDocente advirtiendo inconsistencias de nivel para docente novel', () => {
    const evaluacion = AsesorPedagogicoInteractivo.evaluarPeticionDocente(
      'Planificar ecuaciones para 1er grado de primaria',
      []
    );

    assert.equal(evaluacion.esRepetida, false);
    assert.equal(evaluacion.advertencias.length, 1);
    assert.equal(evaluacion.advertencias[0].motivo, 'Contenido desfasado para Primer Ciclo');
    assert.ok(evaluacion.advertencias[0].orientacion.includes('CON BASE'));
  });

  it('debe ejecutar evaluarPeticionDocente retornando estado limpio cuando no hay duplicados ni desfases', () => {
    const evaluacion = AsesorPedagogicoInteractivo.evaluarPeticionDocente(
      'Planificar la receta para 2do grado',
      ['Los seres vivos']
    );

    assert.equal(evaluacion.esRepetida, false);
    assert.equal(evaluacion.advertencias.length, 0);
  });

  it('debe acoplarse con CerebroRobot e inyectar la orientación pedagógica en la respuesta', async () => {
    const envMock = {
      GEMINI_API_KEY: 'test-key',
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-key'
    };

    const cerebro = new CerebroRobot(envMock);

    // Mock de generateContent
    cerebro.ai = {
      models: {
        generateContent: async () => ({
          candidates: [
            {
              content: {
                role: 'model',
                parts: [
                  {
                    text: '### Inicio (10m)\nPresentación.\n### Desarrollo (25m)\nTrabajo.\n### Cierre (10m)\nEvaluación.'
                  }
                ]
              }
            }
          ]
        })
      }
    };

    const historialRedundante = [
      { role: 'user', parts: [{ text: 'Clase de álgebra' }] }
    ];

    const respuesta = await cerebro.procesarMensaje({
      mensaje: 'Clase de álgebra',
      historial: historialRedundante,
      opciones: { grado: '1er grado Primaria' }
    });

    assert.ok(respuesta.texto.includes('### Inicio'));
    assert.ok(respuesta.texto.includes('Asesor Pedagógico') || respuesta.texto.includes('Orientación Curricular Oficial'));
    assert.ok(respuesta.asesor.desfase.tieneDesfase);
  });
});
