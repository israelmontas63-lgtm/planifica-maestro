import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ejecutarAuditoriaInterna, activarModoDeCrisis } from '../worker/services/auditorHemisferio.js';
import { sanitizarAntiAlucinacion, limpiarSaludoInnecesario } from '../shared/modoConversacional.js';

describe('Hemisferio 1: Auditor de Estado Interno (ejecutarAuditoriaInterna)', () => {
  it('debe certificar estado operativo cuando Supabase y Gemini están configurados correctamente', async () => {
    const envMock = {
      GEMINI_API_KEY: 'test-gemini-key-123456789'
    };
    const supabaseClientMock = {
      from: (tabla) => {
        assert.equal(tabla, 'curriculo_fragmentos');
        return {
          select: (columna) => {
            assert.equal(columna, 'id');
            return {
              limit: async (n) => ({ data: [{ id: 1 }], error: null })
            };
          }
        };
      }
    };

    const reporte = await ejecutarAuditoriaInterna(envMock, supabaseClientMock);
    assert.equal(reporte.estado_general, 'operativo');
    assert.equal(reporte.identidad_sistema, 'Planifica Maestro');
    assert.equal(reporte.fallos_detectados.length, 0);
  });

  it('debe reportar estado degradado cuando Supabase retorna error o data vacía', async () => {
    const envMock = {
      GEMINI_API_KEY: 'test-gemini-key-123456789'
    };
    const supabaseClientFalla = {
      from: () => ({
        select: () => ({
          limit: async () => ({ data: null, error: new Error('Conexión rechazada') })
        })
      })
    };

    const reporte = await ejecutarAuditoriaInterna(envMock, supabaseClientFalla);
    assert.equal(reporte.estado_general, 'degradado');
    assert.ok(reporte.fallos_detectados.some(f => f.includes('CRÍTICO: Base de datos Supabase')));
  });

  it('debe capturar excepciones no controladas de Supabase', async () => {
    const envMock = {
      GEMINI_API_KEY: 'test-gemini-key-123456789'
    };
    const supabaseClientExcepcion = {
      from: () => {
        throw new Error('Network timeout socket closed');
      }
    };

    const reporte = await ejecutarAuditoriaInterna(envMock, supabaseClientExcepcion);
    assert.equal(reporte.estado_general, 'degradado');
    assert.ok(reporte.fallos_detectados.some(f => f.includes('CRÍTICO: Excepción en conexión a Supabase')));
  });

  it('debe reportar estado crítico cuando falta GEMINI_API_KEY', async () => {
    const envSinGemini = {};
    const supabaseClientMock = {
      from: () => ({
        select: () => ({
          limit: async () => ({ data: [{ id: 1 }], error: null })
        })
      })
    };

    const reporte = await ejecutarAuditoriaInterna(envSinGemini, supabaseClientMock);
    assert.equal(reporte.estado_general, 'critico');
    assert.ok(reporte.fallos_detectados.some(f => f.includes('CRÍTICO: Clave de API de Gemini ausente')));
  });

  it('debe mantener identidad fija e inmutable Planifica Maestro bajo cualquier condición', async () => {
    const reporte = await ejecutarAuditoriaInterna({}, null);
    assert.equal(reporte.identidad_sistema, 'Planifica Maestro');
    assert.notEqual(reporte.identidad_sistema, 'Alquimia Studio');
  });

  it('debe filtrar y corregir de inmediato alucinaciones como "Soy Alquimia..." (Capa Anti-Alucinación)', () => {
    const textoConAlucinacion = '¡Hola Profe! Soy Alquimia Studio y estoy aquí para ayudarte con tu planificación.';
    const sanitizado = sanitizarAntiAlucinacion(textoConAlucinacion);
    assert.ok(!sanitizado.includes('Alquimia'));
    assert.ok(sanitizado.includes('Planifica Maestro'));

    const textoLimpio = limpiarSaludoInnecesario(textoConAlucinacion, false);
    assert.ok(!textoLimpio.includes('Alquimia'));
  });

  it('debe activar Modo de Crisis entregando planificación completa ante fallos de infraestructura', () => {
    const planCrisis = activarModoDeCrisis({ grado: 2, area: 'Matemática', tema: 'La suma con llevada' }, 'Base de datos inaccesible');
    assert.equal(planCrisis.ok, true);
    assert.equal(planCrisis.plan_completado, true);
    assert.equal(planCrisis.modo_operativo, 'CRISIS_CONTINGENCIA_LOCAL');
    assert.ok(planCrisis.mensaje_chat.includes('Modo de Crisis'));
    assert.ok(planCrisis.datos_planificacion);
    assert.ok(planCrisis.datos_planificacion.momentos_clase.inicio);
    assert.ok(planCrisis.datos_planificacion.momentos_clase.desarrollo);
    assert.ok(planCrisis.datos_planificacion.momentos_clase.cierre);
    assert.ok(!JSON.stringify(planCrisis).includes('Alquimia'));
  });
});
