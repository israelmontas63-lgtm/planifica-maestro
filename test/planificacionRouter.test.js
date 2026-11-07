import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { planificacionRouter } from '../worker/routes/planificacionRouter.js';
import { CerebroRobot } from '../worker/services/cerebroRobot.js';

describe('Pruebas del Enrutador Modular de Planificación (planificacionRouter)', () => {
  const envMock = {
    GEMINI_API_KEY: 'test-key',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key'
  };

  it('debe responder a OPTIONS para CORS en rutas de planificación', async () => {
    const req = new Request('https://api.planifica.do/api/planificar', {
      method: 'OPTIONS'
    });

    const res = await planificacionRouter(req, envMock);
    assert.ok(res);
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
  });

  it('debe retornar null para rutas no manejadas', async () => {
    const req = new Request('https://api.planifica.do/api/health', {
      method: 'GET'
    });

    const res = await planificacionRouter(req, envMock);
    assert.equal(res, null);
  });

  it('debe despachar POST /api/planificar a CerebroRobot a través del manejador', async () => {
    const originalProcesar = CerebroRobot.prototype.procesarMensaje;
    CerebroRobot.prototype.procesarMensaje = async function (prompt) {
      assert.equal(prompt, 'Planificar clase de Ciencias de la Naturaleza');
      return {
        contenido: '# Plan de Ciencias MINERD'
      };
    };

    try {
      const req = new Request('https://api.planifica.do/api/planificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Planificar clase de Ciencias de la Naturaleza' })
      });

      const res = await planificacionRouter(req, envMock);
      assert.ok(res);
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.exito, true);
      assert.equal(body.sistema, 'Planifica Maestro — Sistema de Gestión y Planificación Docente');
      assert.equal(body.planificacion, '# Plan de Ciencias MINERD');
      assert.ok('aprobado' in body.auditoria);
    } finally {
      CerebroRobot.prototype.procesarMensaje = originalProcesar;
    }
  });

  it('debe despachar POST /api/plan/generate alternativo', async () => {
    const originalProcesar = CerebroRobot.prototype.procesarMensaje;
    CerebroRobot.prototype.procesarMensaje = async function (prompt) {
      return { contenido: '# Plan alternativo' };
    };

    try {
      const req = new Request('https://api.planifica.do/api/plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje: 'Planificar clase alternativa' })
      });

      const res = await planificacionRouter(req, envMock);
      assert.ok(res);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.exito, true);
      assert.equal(body.planificacion, '# Plan alternativo');
    } finally {
      CerebroRobot.prototype.procesarMensaje = originalProcesar;
    }
  });
});
