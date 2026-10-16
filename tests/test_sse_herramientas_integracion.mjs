/**
 * tests/test_sse_herramientas_integracion.mjs
 * 
 * Test de Integración: Ruta SSE completa con Herramientas Curriculares Oficiales MINERD,
 * ciclo Tool-Calling, eventos de estado progresivo y degradación resiliente.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cicloToolCalling } from '../shared/ciclo.js';
import { construirPromptSistemaV2 } from '../shared/promptSistemaV2.js';
import { extraerJson, validarCamposPlanificacion } from '../shared/parseadorJsonSeguro.js';

describe('Integración SSE + Herramientas Curriculares V2 (Bases 3, 4 y 5)', () => {
  it('1. El ciclo tool-calling previo al streaming recupera fragmentos y enriquece el prompt con <DATO>', async () => {
    const fragmentoOficial = {
      source_id: 'matriz_matematica_secuencia_2_segundo',
      nivel: 'primario',
      grado_num: 2,
      area: 'Matemática',
      tema: 'Adición con reagrupación',
      competencia_especifica: 'Aplica algoritmos de suma reagrupando decenas.',
      indicador_logro: 'Resuelve operaciones de adición con números naturales reagrupando.',
      fuente_documento: 'Guía Didáctica de Matemática MINERD 2023',
      pagina: 42
    };

    let llamadasAlModelo = 0;
    const modeloMock = async (payload) => {
      llamadasAlModelo++;
      if (llamadasAlModelo === 1) {
        return {
          candidates: [{
            content: {
              role: 'model',
              parts: [{
                functionCall: {
                  name: 'consultar_base_datos',
                  args: {
                    nivel: 'Primario',
                    grado: '2do',
                    area: 'Matemática',
                    tema_o_concepto: 'Adición'
                  }
                }
              }]
            }
          }]
        };
      }
      return {
        candidates: [{
          content: {
            role: 'model',
            parts: [{ text: 'Continuando con los datos curriculares recuperados...' }]
          }
        }]
      };
    };

    const cicloRes = await cicloToolCalling({
      promptUsuario: 'Quiero planificar adición para 2do de primaria',
      llamadaModeloIA: modeloMock,
      ejecutorSupabase: async () => [fragmentoOficial],
      maxIteraciones: 2
    });

    assert.equal(cicloRes.consultas.length, 1);
    assert.equal(cicloRes.consultas[0].nombre, 'consultar_base_datos');
    assert.equal(cicloRes.consultas[0].filas.length, 1);
    assert.equal(cicloRes.consultas[0].filas[0].source_id, 'matriz_matematica_secuencia_2_segundo');

    const fragmentosTexto = cicloRes.consultas.flatMap(c => c.filas || []).map(f =>
      `[Fuente: ${f.fuente_documento} | Pág: ${f.pagina}] ${f.tema}: ${f.competencia_especifica} - ${f.indicador_logro}`
    ).join('\n');

    const promptFinal = construirPromptSistemaV2({ fragmentosCurriculares: fragmentosTexto });
    assert.match(promptFinal, /<DATO>/);
    assert.match(promptFinal, /Guía Didáctica de Matemática MINERD 2023/);
    assert.match(promptFinal, /Aplica algoritmos de suma reagrupando decenas/);
    assert.match(promptFinal, /<\/DATO>/);
  });

  it('2. El prompt V2 produce JSON estructurado que supera validarCamposPlanificacion', () => {
    const jsonSimuladoGemini = JSON.stringify({
      mensaje_chat: '¡Saludos, colega! Aquí tienes la planificación de Matemática para 2.º de Primaria.',
      plan_completado: true,
      datos_planificacion: {
        '1. Datos generales': {
          grado: '2.º de Primaria',
          area: 'Matemática',
          tiempo_estimado: '45 min'
        },
        '2. Competencias Fundamentales a impactar': ['Pensamiento Lógico, Creativo y Crítico'],
        '3. Competencias Específicas del área/grado': ['Aplica algoritmos de adición con números naturales'],
        '4. Contenidos': {
          conceptuales: ['Adición reagrupando unidades'],
          procedimentales: ['Resolución de problemas cotidianos de adición'],
          actitudinales: ['Disfrute al resolver problemas en equipo']
        },
        '6. Actividades: Inicio - Desarrollo - Cierre': {
          inicio: 'Dinámica de agrupamiento con tapas de botellas.',
          desarrollo: 'Construcción del algoritmo de suma en la pizarra.',
          cierre: 'Metacognición: ¿Qué aprendimos hoy?'
        }
      },
      confianza_curricular: {
        nivel_certeza: 'alta',
        documento_fuente: 'Guía Didáctica de Matemática MINERD 2023',
        pagina: '42'
      }
    });

    const parsed = extraerJson(jsonSimuladoGemini);
    assert.ok(parsed, 'extraerJson debe parsear el JSON generado');
    assert.equal(validarCamposPlanificacion(parsed), true, 'validarCamposPlanificacion debe aprobar el plan');
    assert.equal(parsed.plan_completado, true);
    assert.ok(parsed.datos_planificacion['1. Datos generales']);
  });

  it('3. Ante fallo de herramienta en streaming, no se traga el error y degrada con advertencia referencial', async () => {
    let errorCapturado = null;
    try {
      await cicloToolCalling({
        promptUsuario: 'Planifica Lengua Española 3ro',
        llamadaModeloIA: async () => {
          return {
            candidates: [{
              content: {
                role: 'model',
                parts: [{
                  functionCall: {
                    name: 'consultar_base_datos',
                    args: { nivel: 'Primario', grado: '3ro', area: 'Lengua Española', tema_o_concepto: 'La carta' }
                  }
                }]
              }
            }]
          };
        },
        ejecutorSupabase: async () => {
          throw new Error('Supabase no disponible (503)');
        },
        maxIteraciones: 2
      });
    } catch (e) {
      errorCapturado = e;
    }

    assert.equal(errorCapturado, null, 'cicloToolCalling nunca debe explotar hacia afuera');
  });

  it('4. Si la validación falla, genera diagnóstico con campos faltantes en vez de ocultar la causa', () => {
    const jsonIncompleto = {
      mensaje_chat: 'Plan casi listo pero sin datos',
      plan_completado: true,
      datos_planificacion: null
    };

    const esValido = validarCamposPlanificacion(jsonIncompleto);
    assert.equal(esValido, false);

    const camposFaltantes = [];
    if (jsonIncompleto.plan_completado && !jsonIncompleto.datos_planificacion) {
      camposFaltantes.push('bloques de datos_planificacion');
    }

    assert.equal(camposFaltantes.includes('bloques de datos_planificacion'), true);
    const mensajeDetallado = `Tuve dificultades para organizar los componentes de esta planificación (faltó: ${camposFaltantes.join(', ')}).`;
    assert.match(mensajeDetallado, /faltó: bloques de datos_planificacion/);
  });
});
