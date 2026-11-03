import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HERRAMIENTAS_INVESTIGACION } from '../shared/herramientasInvestigacion.mjs';
import { HANDLERS } from '../shared/herramientas.mjs';
import { recuperarHistorialSesion, guardarTurnoConversacion } from '../worker/services/memoriaService.js';

describe('Herramientas de Investigación y Memoria', () => {
  it('declara formalmente consultar_fuente_curricular y buscar_contexto_web', () => {
    assert.equal(HERRAMIENTAS_INVESTIGACION.length, 2);
    const nombres = HERRAMIENTAS_INVESTIGACION.map(h => h.name);
    assert.ok(nombres.includes('consultar_fuente_curricular'));
    assert.ok(nombres.includes('buscar_contexto_web'));

    const fuenteTool = HERRAMIENTAS_INVESTIGACION.find(h => h.name === 'consultar_fuente_curricular');
    assert.deepEqual(fuenteTool.parameters.required, ['fuente', 'grado', 'area', 'termino']);

    const webTool = HERRAMIENTAS_INVESTIGACION.find(h => h.name === 'buscar_contexto_web');
    assert.deepEqual(webTool.parameters.required, ['consulta']);
  });

  it('registra los handlers en HANDLERS de shared/herramientas.mjs', () => {
    assert.equal(typeof HANDLERS.consultar_fuente_curricular, 'function');
    assert.equal(typeof HANDLERS.buscar_contexto_web, 'function');
  });

  it('memoriaService maneja adecuadamente entornos sin Supabase retornando [] sin error', async () => {
    const res = await recuperarHistorialSesion({}, 'sesion-test-123', 8);
    assert.deepEqual(res, []);
  });

  it('guardarTurnoConversacion no lanza excepción si no hay credenciales', async () => {
    await assert.doesNotReject(async () => {
      await guardarTurnoConversacion({}, 'sesion-test-123', 'hola', 'saludo');
    });
  });
});
