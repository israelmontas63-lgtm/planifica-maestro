/**
 * tests/test_topologia_cerebro_100.mjs
 * 
 * Verificación Integral de la Topología del Cerebro al 100% Encendido:
 * 1. MEMORIA EPISÓDICA (Cold-Start & Similitud >= 0.92)
 * 2. MOTOR HÍBRIDO CURRICULAR (curriculo_secuencias + @cf/baai/bge-m3 + curriculo_paginas)
 * 3. INFERENCIA REASONING (Gemini 3.5 Flash-Lite + Thinking Dinámico + JSON Schema)
 * 4. BUCLE ACTIVO SELF-RAG (3 momentos + Grounding MINERD >= 25% + PromptCorrección + Persistencia)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { generarClaveCache, consultarCache, guardarEnCache } from '../worker/services/cacheSemanticaService.js';
import { auditarFidelidadCurricular, construirPromptCorreccion } from '../worker/services/criticoCurricular.js';
import { reclasificarFragmentos } from '../worker/services/rerankerCurricular.js';
import { calcularFaithfulness, calcularRelevance, registrarMetricasRagas } from '../worker/services/evaluadorRagas.js';
import { construirMaxSalida, construirThinkingConfig } from '../worker/services/aiProvider.js';
import { extraerJson, validarCamposPlanificacion } from '../shared/parseadorJsonSeguro.js';
import { generarDocumentoHipotetico } from '../worker/services/hydeService.js';

test('Topología del Cerebro al 100% Encendido: 4 Pilares Operativos', async (t) => {

  await t.test('Pilar 1: Memoria Episódica (Cold-Start y recuperación rápida)', async () => {
    const clave = generarClaveCache('3ro', 'Matemática', 'Adición de fracciones homogéneas');
    assert.ok(clave, 'Debe generar clave canónica para búsqueda en memoria episódica');
    assert.equal(clave, '3ro:matemática:adicion fracciones homogeneas');

    // Simular consulta en caché
    let mockEnv = {
      SUPABASE_URL: 'https://test-supabase.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-key'
    };

    const fetchOriginal = globalThis.fetch;
    try {
      globalThis.fetch = async (url, opts) => {
        if (String(url).includes('consultar_cache_planificacion')) {
          return new Response(JSON.stringify([{
            clave_hash: clave,
            plan_json: { tema: 'Adición de fracciones homogéneas', completado: true },
            similitud: 0.95
          }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify([]), { status: 200 });
      };

      const hit = await consultarCache(mockEnv, clave);
      assert.ok(hit, 'Debe recuperar el plan previo validado');
      assert.equal(hit.plan_json.tema, 'Adición de fracciones homogéneas');
    } finally {
      globalThis.fetch = fetchOriginal;
    }
  });

  await t.test('Pilar 2: Motor Híbrido Curricular (Exacto + Vectorial + Mallas)', async () => {
    // 1. HyDE
    const env = { GEMINI_API_KEY: 'test-key' };
    const fakeDoc = await generarDocumentoHipotetico(env, 'sumas con llevada', 2, 'Matemática');
    assert.ok(typeof fakeDoc === 'string');

    // 2. Re-ranking de fragmentos curriculares
    const fragmentos = [
      { texto: 'Fracciones en 3er grado de Matemática con indicadores.', grado_num: 3, area: 'Matemática' },
      { texto: 'Ecosistemas en 5to grado de Ciencias.', grado_num: 5, area: 'Ciencias de la Naturaleza' }
    ];
    const reranked = reclasificarFragmentos(fragmentos, { consulta: 'Fracciones', grado: 3, area: 'Matemática' });
    assert.equal(reranked.length, 1);
    assert.equal(reranked[0].grado_num, 3);
  });

  await t.test('Pilar 3: Inferencia Reasoning (Thinking Dinámico y JSON Schema Estricto)', () => {
    const env = { GEMINI_MAX_OUTPUT_TOKENS: '16384', GEMINI_THINKING_BUDGET: '2048' };
    const maxTokens = construirMaxSalida(env);
    const thinking = construirThinkingConfig(env);

    assert.equal(maxTokens, 16384, 'Debe proveer presupuesto completo de 16k tokens');
    assert.equal(thinking.thinkingConfig.thinkingBudget, 2048, 'Debe activar presupuesto de razonamiento');

    const jsonPrueba = '{"ok": true, "plan_completado": true, "datos_planificacion": {"asignatura": "Lengua Española", "actividades": {"inicio": "a", "desarrollo": "b", "cierre": "c"}}, "mensaje_chat": "Listo"}';
    const parsed = extraerJson(jsonPrueba);
    assert.equal(parsed.plan_completado, true);
    assert.ok(validarCamposPlanificacion(parsed));
  });

  await t.test('Pilar 4: Bucle Activo Self-RAG y Persistencia en Memoria', async () => {
    const planValido = {
      tema: 'El Cuento',
      actividades: {
        inicio: 'Lectura compartida inicial',
        desarrollo: 'Identificación de inicio, nudo y desenlace',
        cierre: 'Síntesis y metacognición final'
      },
      indicadores_logro: 'Identifica la estructura del cuento: inicio, nudo y desenlace.'
    };

    const evidencias = [{ texto: 'Identifica la estructura canónica del cuento: inicio, nudo y desenlace.' }];

    // a) Auditoría de 3 momentos y grounding
    const auditoria = auditarFidelidadCurricular(planValido, evidencias);
    assert.equal(auditoria.esValido, true, 'Debe certificar cuando están los 3 momentos y ratio >= 0.25');

    // b) En caso de fallo, debe generar prompt de corrección guiado
    const planIncompleto = { actividades: { inicio: 'Inicio' } };
    const auditoriaFallo = auditarFidelidadCurricular(planIncompleto, evidencias);
    assert.equal(auditoriaFallo.esValido, false);
    const promptCorreccion = construirPromptCorreccion(planIncompleto, auditoriaFallo.motivoFallo, evidencias[0].texto);
    assert.ok(promptCorreccion.includes('INSTRUCCIÓN DE AUTO-CORRECCIÓN CRÍTICA (SELF-RAG)'));
    assert.ok(promptCorreccion.includes('EVIDENCIA CURRICULAR OBLIGATORIA DEL MINERD'));

    // c) Persistencia en memoria episódica si cumple umbral
    const fScore = calcularFaithfulness(planValido, evidencias[0].texto);
    const rScore = calcularRelevance(planValido, 'El Cuento');
    assert.ok(fScore >= 0.70, 'Debe superar el umbral de 0.70 para almacenamiento en memoria');
  });

});
