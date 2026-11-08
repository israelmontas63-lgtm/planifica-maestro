import test from 'node:test';
import assert from 'node:assert/strict';
import { buscarCurriculoOficial } from '../shared/curriculoService.mjs';

test('CORRECCIÓN A / FIX 5: buscarCurriculoOficial retorna [] si faltan texto, grado o área', async () => {
  const env = { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_ANON_KEY: 'test-key' };
  
  assert.deepEqual(await buscarCurriculoOficial(env, {}), []);
  assert.deepEqual(await buscarCurriculoOficial(env, { texto: 'La Noticia' }), []);
  assert.deepEqual(await buscarCurriculoOficial(env, { texto: 'La Noticia', grado: '2' }), []);
  assert.deepEqual(await buscarCurriculoOficial(env, { grado: '2', area: 'Lengua Española' }), []);
});

test('CORRECCIÓN A: fuenteFiltro "guia_con_base_lengua" con filas cuyo fuente_documento es "Diseño Curricular…" devuelve las filas (no [])', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return new Response(JSON.stringify([{
      id: 'sec-1',
      fuente_documento: 'Diseño Curricular del Nivel Primario 2023',
      pagina: '45',
      tema: 'La Noticia',
      competencias_especificas: 'Comunica ideas',
      contenidos_texto_original: 'Estructura textual',
      indicadores_logro: ['Lee noticias']
    }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const env = { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_ANON_KEY: 'test-key' };
    const res = await buscarCurriculoOficial(env, {
      texto: 'La Noticia',
      grado: '2',
      area: 'Lengua Española',
      fuenteFiltro: 'guia_con_base_lengua'
    });

    assert.equal(res.length, 1);
    assert.equal(res[0].fuente_documento, 'Diseño Curricular del Nivel Primario 2023');
    assert.equal(res[0].pagina, '45');
    assert.ok(res[0].texto.includes('La Noticia'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('CORRECCIÓN A: asigna fallback oficial si fuente_documento no viene en el registro', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return new Response(JSON.stringify([{
      id: 'sec-2',
      tema: 'Estimación',
      competencias_especificas: 'Razona',
      contenidos_texto_original: 'Números naturales',
      indicadores_logro: ['Estima']
    }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const env = { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_ANON_KEY: 'test-key' };
    const res = await buscarCurriculoOficial(env, {
      texto: 'Estimación',
      grado: '1',
      area: 'Matemática'
    });

    assert.equal(res.length, 1);
    assert.equal(res[0].fuente_documento, 'Currículo oficial MINERD (base de datos curricular)');
    assert.equal(res[0].pagina, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
