import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { auditarFidelidadCurricular, construirPromptCorreccion } from '../worker/services/criticoCurricular.js';

describe('Crítico Curricular - Self-RAG y Reflexión Interna', () => {
  const fragmentosEvidencia = [
    {
      fuente_documento: 'Adecuación Curricular 2023',
      pagina: 42,
      texto: 'Identifica y describe las características del cuento infantil, personajes principales y secundarios.'
    }
  ];

  it('rechaza planificaciones sin los tres momentos didácticos (Inicio, Desarrollo, Cierre)', () => {
    const planIncompleto = {
      actividades: {
        inicio: 'Lluvia de ideas sobre cuentos.',
        desarrollo: 'Lectura guiada.'
        // Falta cierre
      }
    };

    const res = auditarFidelidadCurricular(planIncompleto, fragmentosEvidencia);
    assert.equal(res.esValido, false);
    assert.match(res.motivoFallo, /Inicio, Desarrollo o Cierre/);
    assert.equal(res.scoreFidelidad, 0.3);
  });

  it('aprueba planificación completa con los tres momentos e indicadores anclados a la evidencia', () => {
    const planValido = {
      actividades: {
        inicio: 'Saberes previos sobre personajes.',
        desarrollo: 'Identifica y describe personajes principales del cuento infantil.',
        cierre: 'Metacognición y autoevaluación.'
      },
      indicadores_logro: 'Describe características de personajes principales en el cuento infantil.'
    };

    const res = auditarFidelidadCurricular(planValido, fragmentosEvidencia);
    assert.equal(res.esValido, true);
    assert.equal(res.motivoFallo, null);
    assert.ok(res.scoreFidelidad >= 0.5);
  });

  it('detecta alucinación si los indicadores no corresponden a la evidencia recuperada', () => {
    const planAlucinado = {
      actividades: {
        inicio: 'Motivación inicial.',
        desarrollo: 'Actividad práctica.',
        cierre: 'Evaluación formativa.'
      },
      indicadores_logro: 'Calcula integrales triples y ecuaciones diferenciales estocásticas avanzadas.'
    };

    const res = auditarFidelidadCurricular(planAlucinado, fragmentosEvidencia);
    assert.equal(res.esValido, false);
    assert.match(res.motivoFallo, /no corresponden al texto oficial/);
  });

  it('construye prompt de auto-corrección estructurado para reinyectar al modelo', () => {
    const promptCorrec = construirPromptCorreccion(
      {},
      'Falta momento de Cierre',
      'Pág 42: El cuento y sus partes.'
    );
    assert.match(promptCorrec, /SELF-RAG/);
    assert.match(promptCorrec, /Falta momento de Cierre/);
    assert.match(promptCorrec, /Pág 42: El cuento y sus partes/);
  });
});
