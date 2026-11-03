import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularFaithfulness,
  calcularRelevance,
  registrarMetricasRagas
} from '../worker/services/evaluadorRagas.js';

describe('Evaluador RAGAS en Producción - MINERD', () => {
  it('calcularFaithfulness calcula proporción de términos de indicadores respaldados por el texto oficial', () => {
    const plan = {
      indicadores_logro: [
        'Identifica la anécdota como relato breve sobre hechos reales'
      ]
    };
    const fragmentoOficial = 'La anécdota es un relato sobre hechos reales de la vida cotidiana.';

    const score = calcularFaithfulness(plan, fragmentoOficial);
    assert.ok(score >= 0.70, `El score (${score}) debe ser alto para indicadores fieles`);

    // Con texto no respaldado
    const scoreBajo = calcularFaithfulness(plan, 'Texto de física cuántica y acelerador de partículas.');
    assert.ok(scoreBajo < 0.30, `El score (${scoreBajo}) debe ser bajo para alucinación`);
  });

  it('calcularRelevance asigna puntaje completo si tiene inicio, desarrollo, cierre y tema', () => {
    const plan = {
      actividades: {
        inicio: 'Presentación del cuento y preguntas previas',
        desarrollo: 'Lectura guiada del cuento y comprensión',
        cierre: 'Reflexión metacognitiva y evaluación'
      }
    };

    const score = calcularRelevance(plan, 'el cuento');
    assert.strictEqual(score, 1.0, 'Plan completo con momentos y tema debe ser 1.0');

    // Sin tema
    const scoreSinTema = calcularRelevance(plan, 'robótica submarina');
    assert.strictEqual(scoreSinTema, 0.5, 'Debe otorgar 0.50 por momentos pero 0 por tema');
  });

  it('registrarMetricasRagas envía auditoría sin lanzar excepciones', async () => {
    let llamado = false;
    let cuerpoEnviado = null;

    const mockEnv = {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-key'
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      llamado = true;
      cuerpoEnviado = JSON.parse(options.body);
      return { ok: true, json: async () => ({}) };
    };

    try {
      await registrarMetricasRagas(mockEnv, {
        sesionId: 'ses_123',
        grado: 3,
        area: 'Lengua Española',
        tema: 'El cuento',
        faithfulness: 0.95,
        relevance: 1.0,
        precision: 1.0
      });

      assert.strictEqual(llamado, true);
      assert.strictEqual(cuerpoEnviado.estado_alerta, 'OPTIMO');
      assert.strictEqual(cuerpoEnviado.faithfulness_score, 0.95);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('registrarMetricasRagas cataloga estado CRITICO ante puntajes deficientes', async () => {
    let alertaRegistrada = null;
    const mockEnv = {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-key'
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      const cuerpo = JSON.parse(options.body);
      alertaRegistrada = cuerpo.estado_alerta;
      return { ok: true };
    };

    try {
      await registrarMetricasRagas(mockEnv, {
        sesionId: 'ses_fallo',
        grado: 2,
        area: 'Matemática',
        tema: 'Multiplicación',
        faithfulness: 0.40,
        relevance: 0.30
      });

      assert.strictEqual(alertaRegistrada, 'CRITICO');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
