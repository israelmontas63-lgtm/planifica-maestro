import test from 'node:test';
import assert from 'node:assert/strict';
import { generarPlanificacion } from '../client/src/api.js';

test('FASE D: generarPlanificacion reconstruye eventos SSE y JSON final partidos en chunks arbitrarios de 17 bytes', async () => {
  const originalFetch = globalThis.fetch;

  const finalObj = {
    plan_completado: true,
    mensaje_chat: 'Planificación completa con tildes (áéíóú, ñ) y currículo MINERD.',
    datos_planificacion: {
      '1. Aspectos Generales': { grado: '4.º', area: 'Matemática', tema: 'Fracciones equivalentes' },
      actividades: { inicio: 'Exploración', desarrollo: 'Práctica guiada', cierre: 'Síntesis' },
      indicadores_logro: ['Compara fracciones equivalentes'],
    },
    auditoria: { aprobado: true, estadoValidacion: 'APROBADO' },
  };

  const sseCompleto = [
    `data: ${JSON.stringify({ estado: 'iniciando' })}\n\n`,
    `data: ${JSON.stringify({ delta: 'Hola ' })}\n\n`,
    `data: ${JSON.stringify({ delta: 'docente.' })}\n\n`,
    `data: ${JSON.stringify({ final: finalObj })}\n\n`,
    'data: [DONE]\n\n',
  ].join('');

  const bytes = new TextEncoder().encode(sseCompleto);

  globalThis.fetch = async () => {
    let offset = 0;
    const stream = new ReadableStream({
      pull(controller) {
        if (offset >= bytes.length) {
          controller.close();
          return;
        }
        const slice = bytes.slice(offset, offset + 17);
        offset += 17;
        controller.enqueue(slice);
      },
    });
    return new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
    });
  };

  const estados = [];
  let textoAcumulado = '';
  try {
    const res = await generarPlanificacion({
      messages: [{ role: 'user', text: 'Planifica fracciones 4to' }],
      nivel: 'primario',
      periodo: 'diaria',
      onChunk: (delta, accum, estado) => {
        if (estado) estados.push(estado);
        if (accum) textoAcumulado = accum;
      },
    });

    assert.deepEqual(estados, ['iniciando']);
    assert.equal(textoAcumulado, 'Hola docente.');
    assert.equal(res.plan_completado, true);
    assert.equal(res.auditoria?.estadoValidacion, 'APROBADO');
    assert.equal(res.datos_planificacion?.actividades?.cierre, 'Síntesis');
    assert.ok(res.mensaje_chat.includes('áéíóú, ñ'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
