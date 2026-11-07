import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GestorMemoriaExperiencias } from '../worker/services/gestorMemoriaExperiencias.js';

describe('Pruebas de Memoria Episódica y Vectorial: GestorMemoriaExperiencias', () => {
  const envMock = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key'
  };

  it('debe despachar consulta RPC con formato vectorial correcto', async () => {
    const gestor = new GestorMemoriaExperiencias(envMock);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      if (url.includes('rpc/consultar_memoria_robot')) {
        const body = JSON.parse(options.body);
        assert.equal(body.p_umbral_similitud, 0.95);
        assert.equal(body.p_limite, 1);
        assert.ok(body.p_embedding.startsWith('[0.1,0.2'));

        return {
          ok: true,
          json: async () => [
            {
              id: 'exp-123',
              tema_consulta: 'Secuencia de la noticia 2do grado',
              planificacion_salida: '# Plan Canónico Aprobado',
              similitud: 0.98
            }
          ]
        };
      }
      return originalFetch(url, options);
    };

    try {
      const res = await gestor.consultarExperiencias({
        embedding: [0.1, 0.2, 0.3],
        umbralSimilitud: 0.95,
        limite: 1
      });

      assert.equal(res.length, 1);
      assert.equal(res[0].id, 'exp-123');
      assert.equal(res[0].similitud, 0.98);
      assert.ok(res[0].planificacion_salida.includes('# Plan Canónico Aprobado'));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('debe registrar experiencias exitosas en robot_memoria_experiencias', async () => {
    const gestor = new GestorMemoriaExperiencias(envMock);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      if (url.includes('robot_memoria_experiencias')) {
        assert.equal(options.method, 'POST');
        const body = JSON.parse(options.body);
        assert.equal(body.tema_consulta, 'Suma con reagrupación en Multigrado');
        assert.equal(body.calificacion_calidad, 5);
        assert.equal(body.validado_por_auditor, true);

        return {
          ok: true,
          json: async () => [{ id: 'nuevo-id-123', ...body }]
        };
      }
      return originalFetch(url, options);
    };

    try {
      const resultado = await gestor.guardarExperiencia({
        gradoNivel: 'Multigrado (1.° y 2.°)',
        areaCurricular: 'Matemática',
        temaConsulta: 'Suma con reagrupación en Multigrado',
        planificacionSalida: '# Secuencia Didáctica Exitosa',
        paginasMinerdCitadas: [45, 46],
        calificacionCalidad: 5,
        validadoPorAuditor: true
      });

      assert.equal(resultado.exito, true);
      assert.equal(resultado.registro.id, 'nuevo-id-123');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('debe retornar arreglo vacío cuando la consulta RPC falla o no hay conexión', async () => {
    const gestor = new GestorMemoriaExperiencias(envMock);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error('Sin conexión');
    };

    try {
      const res = await gestor.consultarExperiencias({
        embedding: [0.1, 0.2]
      });
      assert.deepEqual(res, []);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
