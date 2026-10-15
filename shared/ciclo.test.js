import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cicloToolCalling } from './ciclo.js';

const llamada = (args, name = 'consultar_base_datos') => ({
  candidates: [{ content: { role: 'model', parts: [{ functionCall: { name, args } }] } }]
});
const texto = t => ({ candidates: [{ content: { role: 'model', parts: [{ text: t }] } }] });
const argsOk = { nivel: 'Primario', grado: '2do', area: 'Matemática', tema_o_concepto: 'sumas reagrupando' };

// Modelo guionado: devuelve respuestas en orden y guarda los payloads recibidos
function modeloGuionado(...respuestas) {
  const payloads = [];
  const fn = async p => { payloads.push(p); return respuestas[payloads.length - 1]; };
  fn.payloads = payloads;
  return fn;
}

describe('Ciclo de Tool Calling', () => {
  it('envía los datos de Supabase al modelo en el segundo turno', async () => {
    const filas = [{ id: 1, indicador_logro: 'Resuelve adiciones reagrupando decenas' }];
    const modelo = modeloGuionado(llamada(argsOk), texto('Planificación lista'));
    const r = await cicloToolCalling({
      promptUsuario: 'Sumas con reagrupación para 2do',
      llamadaModeloIA: modelo,
      ejecutorSupabase: async () => filas
    });
    const ultimo = modelo.payloads[1].contents.at(-1);
    assert.equal(r.tipo, 'tool_calling_completado');
    assert.equal(ultimo.role, 'user');
    assert.deepEqual(ultimo.parts[0].functionResponse.response.resultado, filas);
    assert.ok(modelo.payloads[1].tools, 'las tools deben viajar en todos los turnos');
  });

  it('responde directo sin tocar la base en un saludo', async () => {
    let consultado = false;
    const r = await cicloToolCalling({
      promptUsuario: 'Hola colega',
      llamadaModeloIA: modeloGuionado(texto('¡Saludos, colega!')),
      ejecutorSupabase: async () => { consultado = true; return []; }
    });
    assert.equal(r.tipo, 'directa');
    assert.equal(consultado, false);
  });

  it('avisa al modelo cuando no hay resultados', async () => {
    const modelo = modeloGuionado(llamada(argsOk), texto('No encontré el tema'));
    await cicloToolCalling({ promptUsuario: 'x', llamadaModeloIA: modelo, ejecutorSupabase: async () => [] });
    const resp = modelo.payloads[1].contents.at(-1).parts[0].functionResponse.response;
    assert.match(resp.aviso, /No inventes/);
  });

  it('propaga el error de Supabase como functionResponse sin romper el ciclo', async () => {
    const modelo = modeloGuionado(llamada(argsOk), texto('Hubo un problema'));
    const r = await cicloToolCalling({
      promptUsuario: 'x',
      llamadaModeloIA: modelo,
      ejecutorSupabase: async () => { throw new Error('db caída'); }
    });
    assert.ok(modelo.payloads[1].contents.at(-1).parts[0].functionResponse.response.error);
    assert.equal(r.tipo, 'directa');
  });

  it('rechaza herramientas desconocidas y argumentos incompletos', async () => {
    let consultado = false;
    const ejecutor = async () => { consultado = true; return []; };
    await cicloToolCalling({ promptUsuario: 'x', llamadaModeloIA: modeloGuionado(llamada({}, 'borrar_todo'), texto('ok')), ejecutorSupabase: ejecutor });
    await cicloToolCalling({ promptUsuario: 'x', llamadaModeloIA: modeloGuionado(llamada({ grado: '2do' }), texto('ok')), ejecutorSupabase: ejecutor });
    assert.equal(consultado, false);
  });

  it('ejecuta varias llamadas en paralelo (multigrado)', async () => {
    const dosLlamadas = {
      candidates: [{ content: { role: 'model', parts: [
        { functionCall: { name: 'consultar_base_datos', args: { ...argsOk, grado: '1ro' } } },
        { functionCall: { name: 'consultar_base_datos', args: argsOk } }
      ] } }]
    };
    const grados = [];
    const modelo = modeloGuionado(dosLlamadas, texto('Listo'));
    await cicloToolCalling({
      promptUsuario: 'x',
      llamadaModeloIA: modelo,
      ejecutorSupabase: async (a) => { grados.push(a.grado); return [{ ok: true }]; }
    });
    assert.deepEqual(grados.sort(), ['1ro', '2do']);
    assert.equal(modelo.payloads[1].contents.at(-1).parts.length, 2);
  });

  it('corta el bucle al llegar al límite de iteraciones', async () => {
    const r = await cicloToolCalling({
      promptUsuario: 'x',
      llamadaModeloIA: async () => llamada(argsOk),
      ejecutorSupabase: async () => [{ ok: true }],
      maxIteraciones: 3
    });
    assert.equal(r.tipo, 'limite_iteraciones');
  });
});
