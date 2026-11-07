import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { manejarSolicitudPlanificacion } from '../worker/routes/manejadorPlanificacion.js';
import { CerebroRobot } from '../worker/services/cerebroRobot.js';

describe('Pruebas de la Capa de Enrutamiento: manejarSolicitudPlanificacion', () => {
  const envMock = {
    GEMINI_API_KEY: 'test-key',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    SUPABASE_ACCESS_TOKEN: 'sbp_mock_token',
    SUPABASE_PROJECT_REF: 'obcjdxearmmvtihfmtaa',
    TAVILY_API_KEY: 'tvly-mock-key'
  };

  it('debe rechazar métodos HTTP distintos de POST con código 405 y formato oficial', async () => {
    const requestGet = new Request('https://api.planifica.do/api/planificar', {
      method: 'GET'
    });

    const response = await manejarSolicitudPlanificacion(requestGet, envMock);
    assert.equal(response.status, 405);
    const body = await response.json();
    assert.deepEqual(body, {
      exito: false,
      error: 'Método no permitido. Utilice POST.'
    });
  });

  it('debe rechazar solicitudes sin prompt o con prompt vacío con código 400', async () => {
    const reqSinPrompt = new Request('https://api.planifica.do/api/planificar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const res1 = await manejarSolicitudPlanificacion(reqSinPrompt, envMock);
    assert.equal(res1.status, 400);
    const body1 = await res1.json();
    assert.deepEqual(body1, {
      exito: false,
      error: 'El prompt de planificación es obligatorio.'
    });

    const reqPromptEspacios = new Request('https://api.planifica.do/api/planificar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: '   ' })
    });

    const res2 = await manejarSolicitudPlanificacion(reqPromptEspacios, envMock);
    assert.equal(res2.status, 400);
    const body2 = await res2.json();
    assert.deepEqual(body2, {
      exito: false,
      error: 'El prompt de planificación es obligatorio.'
    });
  });

  it('debe procesar exitosamente un prompt docente con auto-auditoría y sustitución de marca', async () => {
    const originalProcesar = CerebroRobot.prototype.procesarMensaje;
    CerebroRobot.prototype.procesarMensaje = async function (prompt) {
      assert.equal(prompt, 'Planificar clase de Lengua Española sobre la receta');
      return {
        contenido: '# Plan de Clase\nContenido generado por IA según las guías CON BASE.',
        evidencias: [{ fuente: 'Guía Didáctica', pagina: 12 }]
      };
    };

    try {
      const req = new Request('https://api.planifica.do/api/planificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Planificar clase de Lengua Española sobre la receta' })
      });

      const response = await manejarSolicitudPlanificacion(req, envMock);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Content-Type'), 'application/json');
      assert.equal(response.headers.get('Cache-Control'), 'no-store');

      const body = await response.json();
      assert.equal(body.exito, true);
      assert.equal(body.sistema, 'Planifica Maestro — Sistema de Gestión y Planificación Docente');
      assert.ok('aprobado' in body.auditoria);
      assert.ok('dictamen' in body.auditoria);
      // Debe haber sustituido "generado por IA" por "Planifica Maestro"
      assert.ok(body.planificacion.includes('Planifica Maestro'));
      assert.ok(!body.planificacion.toLowerCase().includes('generado por ia'));
    } finally {
      CerebroRobot.prototype.procesarMensaje = originalProcesar;
    }
  });

  it('debe procesar exitosamente un prompt enviado como cuerpo.mensaje', async () => {
    const originalProcesar = CerebroRobot.prototype.procesarMensaje;
    CerebroRobot.prototype.procesarMensaje = async function (prompt) {
      assert.equal(prompt, 'Planificar unidad de Ciencias Sociales');
      return {
        contenido: '# Unidad Ciencias Sociales - Creado como modelo de lenguaje.'
      };
    };

    try {
      const req = new Request('https://api.planifica.do/api/planificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje: 'Planificar unidad de Ciencias Sociales' })
      });

      const response = await manejarSolicitudPlanificacion(req, envMock);
      assert.equal(response.status, 200);

      const body = await response.json();
      assert.equal(body.exito, true);
      assert.ok(body.planificacion.includes('Planifica Maestro'));
      assert.ok(!body.planificacion.toLowerCase().includes('modelo de lenguaje'));
    } finally {
      CerebroRobot.prototype.procesarMensaje = originalProcesar;
    }
  });

  it('debe capturar errores de inferencia o red y responder con código 500 y formato oficial', async () => {
    const originalProcesar = CerebroRobot.prototype.procesarMensaje;
    CerebroRobot.prototype.procesarMensaje = async function () {
      throw new Error('Fallo de conexión simulado con Supabase');
    };

    try {
      const req = new Request('https://api.planifica.do/api/planificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Cualquier tema' })
      });

      const response = await manejarSolicitudPlanificacion(req, envMock);
      assert.equal(response.status, 500);

      const body = await response.json();
      assert.equal(body.exito, false);
      assert.equal(body.sistema, 'Planifica Maestro');
      assert.equal(body.error, 'Fallo de conexión simulado con Supabase');
    } finally {
      CerebroRobot.prototype.procesarMensaje = originalProcesar;
    }
  });
});
