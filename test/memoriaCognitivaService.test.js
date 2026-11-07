import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoriaCognitivaService } from '../worker/services/memoriaCognitivaService.js';

describe('Pruebas del Servicio de Memoria Cognitiva y Caché Semántica (MemoriaCognitivaService)', () => {
  const envMock = {
    GEMINI_API_KEY: 'test-key',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key'
  };

  it('debe generar vector semántico utilizando el modelo text-embedding-004', async () => {
    const memoria = new MemoriaCognitivaService(envMock);

    // Mock de embedContent en GoogleGenAI
    memoria.ai = {
      models: {
        embedContent: async ({ model, contents }) => {
          assert.equal(model, 'text-embedding-004');
          assert.equal(contents, 'Planificar la receta en Lengua Española');
          return {
            embedding: {
              values: [0.01, 0.02, 0.03]
            }
          };
        }
      }
    };

    const vector = await memoria.generarVector('Planificar la receta en Lengua Española');
    assert.deepEqual(vector, [0.01, 0.02, 0.03]);
  });

  it('debe recuperar memoria previa con similitud >= 0.94 si existe coincidencia previa', async () => {
    const memoria = new MemoriaCognitivaService(envMock);
    memoria.generarVector = async () => [0.05, 0.06];

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      if (url.includes('rpc/consultar_memoria_robot')) {
        const body = JSON.parse(options.body);
        assert.deepEqual(body.p_embedding, [0.05, 0.06]);
        assert.equal(body.p_umbral_similitud, 0.94);
        assert.equal(body.p_limite, 1);

        return {
          ok: true,
          json: async () => [
            {
              id: 'exp-prev-001',
              tema_consulta: 'La receta',
              planificacion_salida: '# Secuencia Aprobada de la Receta',
              similitud: 0.96
            }
          ]
        };
      }
      return originalFetch(url, options);
    };

    try {
      const match = await memoria.recuperarMemoriaPrevia('La receta');
      assert.ok(match);
      assert.equal(match.id, 'exp-prev-001');
      assert.equal(match.similitud, 0.96);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('debe retornar null cuando no hay coincidencia semántica en la memoria', async () => {
    const memoria = new MemoriaCognitivaService(envMock);
    memoria.generarVector = async () => [0.05, 0.06];

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      if (url.includes('rpc/consultar_memoria_robot')) {
        return {
          ok: true,
          json: async () => []
        };
      }
      return originalFetch(url);
    };

    try {
      const match = await memoria.recuperarMemoriaPrevia('Tema nuevo sin precedentes');
      assert.equal(match, null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('debe descartar la consolidación de aprendizaje si esValido es false (Saber qué está mal)', async () => {
    const memoria = new MemoriaCognitivaService(envMock);
    let vectorLlamado = false;
    memoria.generarVector = async () => {
      vectorLlamado = true;
      return [0.1];
    };

    const exito = await memoria.consolidarAprendizaje({
      grado: '2.° Primaria',
      area: 'Matemática',
      tema: 'Plan con errores',
      planTexto: '# Plan incompleto',
      paginasCitadas: [],
      esValido: false
    });

    assert.equal(exito, false);
    assert.equal(vectorLlamado, false, 'No debe generar vector para planes no válidos');
  });

  it('debe consolidar en base de datos cuando el plan es válido y aprobado (Saber qué está bien)', async () => {
    const memoria = new MemoriaCognitivaService(envMock);
    memoria.generarVector = async (texto) => {
      assert.equal(texto, 'Cuerpo geométrico');
      return [0.11, 0.22];
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      if (url.includes('robot_memoria_experiencias')) {
        assert.equal(options.method, 'POST');
        const body = JSON.parse(options.body);
        assert.equal(body.grado_nivel, '2.° Primaria');
        assert.equal(body.area_curricular, 'Matemática');
        assert.equal(body.tema_consulta, 'Cuerpo geométrico');
        assert.deepEqual(body.embedding, [0.11, 0.22]);
        assert.equal(body.calificacion_calidad, 5);
        assert.equal(body.validado_por_auditor, true);
        assert.deepEqual(body.paginas_minerd_citadas, [80, 81]);

        return { ok: true };
      }
      return originalFetch(url, options);
    };

    try {
      const exito = await memoria.consolidarAprendizaje({
        grado: '2.° Primaria',
        area: 'Matemática',
        tema: 'Cuerpo geométrico',
        planTexto: '# Plan Oficial Cuerpos Geométricos',
        paginasCitadas: [80, 81],
        esValido: true
      });

      assert.equal(exito, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
