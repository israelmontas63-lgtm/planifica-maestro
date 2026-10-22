import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarArea } from '../shared/catalogoCurricular.mjs';
import { consultarCurriculoMINERD } from '../shared/curriculoService.mjs';

test('B2: normalizarArea cumple el orden y normalización estricta de las 11 entradas', () => {
  const casos = [
    { input: 'Ciencias Sociales', esperado: 'Ciencias Sociales' },
    { input: 'Ciencias de la Naturaleza', esperado: 'Ciencias de la Naturaleza' },
    { input: 'Educación Física', esperado: 'Educación Física' },
    { input: 'plan de educación física', esperado: 'Educación Física' },
    { input: 'Ciencias Físicas', esperado: 'Ciencias de la Naturaleza' },
    { input: 'Educación Artística', esperado: 'Educación Artística' },
    { input: 'Inglés', esperado: 'Lenguas Extranjeras - Inglés' },
    { input: 'Lenguas Extranjeras - Inglés', esperado: 'Lenguas Extranjeras - Inglés' },
    { input: 'Formación Integral Humana y Religiosa', esperado: 'Formación Integral Humana y Religiosa' },
    { input: 'Matemática', esperado: 'Matemática' },
    { input: 'Lengua Española', esperado: 'Lengua Española' }
  ];

  for (const c of casos) {
    const obtenido = normalizarArea(c.input);
    assert.equal(obtenido, c.esperado, `Fallo en normalización para "${c.input}": esperado "${c.esperado}", obtenido "${obtenido}"`);
  }
});

test('B3: consultarCurriculoMINERD propaga limite hasta 25 hacia RPC buscar_curriculo_secuencias', async () => {
  let bodyEnviado = null;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, opts) => {
    if (typeof url === 'string' && url.includes('/rpc/buscar_curriculo_secuencias')) {
      bodyEnviado = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => [
          { source_id: 'SEC-1', tema: 'Tema 1', coincide_tema: true },
          { source_id: 'SEC-2', tema: 'Tema 2', coincide_tema: true }
        ]
      };
    }
    return originalFetch(url, opts);
  };

  try {
    const res = await consultarCurriculoMINERD(
      {
        nivel: 'Primario',
        grado: '4.° Grado',
        area: 'Lengua Española',
        tema_o_concepto: 'agujeros negros',
        limite: 20
      },
      {
        SUPABASE_URL: 'https://fake-project.supabase.co',
        SUPABASE_ANON_KEY: 'sb_publishable_fake'
      }
    );

    assert.ok(bodyEnviado, 'Se debió enviar petición RPC a Supabase');
    assert.equal(bodyEnviado.p_limite, 20, `p_limite debió ser 20 pero fue ${bodyEnviado.p_limite}`);
    assert.equal(bodyEnviado.p_grado, 4);
    assert.equal(bodyEnviado.p_area, 'Lengua Española');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
