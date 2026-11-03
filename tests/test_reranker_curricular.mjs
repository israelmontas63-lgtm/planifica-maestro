import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcularPuntajeRelevancia, reclasificarFragmentos } from '../worker/services/rerankerCurricular.js';

describe('Reranker Curricular - Cross-Scoring y Reclasificación', () => {
  const fragmentosPrueba = [
    {
      id: 'frag-1',
      fuente_documento: 'Adecuación Curricular 2023',
      pagina: 55,
      grado_num: 3,
      area: 'Ciencias de la Naturaleza',
      texto: 'Ecosistemas y biodiversidad. Indicadores de logro: Identifica los componentes bióticos y abióticos.'
    },
    {
      id: 'frag-2',
      fuente_documento: 'Adecuación Curricular 2023',
      pagina: 120,
      grado_num: 5,
      area: 'Ciencias de la Naturaleza',
      texto: 'Ecosistemas acuáticos y cadenas tróficas complejas.'
    },
    {
      id: 'frag-3',
      fuente_documento: 'Diseño Curricular',
      pagina: 30,
      grado_num: 3,
      area: 'Lengua Española',
      texto: 'La fábula y la moraleja en la lectura comunitaria.'
    }
  ];

  it('calcula mayor puntaje para el fragmento del mismo grado, área y términos con indicadores', () => {
    const scoreExacto = calcularPuntajeRelevancia({
      consulta: 'ecosistemas y biodiversidad',
      grado: 3,
      area: 'Ciencias de la Naturaleza',
      fragmento: fragmentosPrueba[0]
    });

    const scoreOtroGrado = calcularPuntajeRelevancia({
      consulta: 'ecosistemas y biodiversidad',
      grado: 3,
      area: 'Ciencias de la Naturaleza',
      fragmento: fragmentosPrueba[1]
    });

    assert.ok(scoreExacto > scoreOtroGrado, `Score exacto (${scoreExacto}) debe ser mayor que otro grado (${scoreOtroGrado})`);
    assert.ok(scoreExacto >= 0.70, `Score exacto debe ser alto (>= 0.70), obtenido: ${scoreExacto}`);
  });

  it('penaliza fragmentos de distinta área curricular', () => {
    const scoreDistintaArea = calcularPuntajeRelevancia({
      consulta: 'ecosistemas',
      grado: 3,
      area: 'Ciencias de la Naturaleza',
      fragmento: fragmentosPrueba[2]
    });

    assert.ok(scoreDistintaArea < 0.45, `Score de distinta área (${scoreDistintaArea}) debe ser inferior al umbral 0.45`);
  });

  it('reclasifica y poda fragmentos por debajo del umbral mínimo', () => {
    const resultados = reclasificarFragmentos(
      fragmentosPrueba,
      { consulta: 'ecosistemas biodiversidad', grado: 3, area: 'Ciencias de la Naturaleza' },
      { umbralMinimo: 0.45, maxFragmentos: 2 }
    );

    assert.ok(resultados.length >= 1, 'Debe devolver al menos el fragmento exacto');
    assert.equal(resultados[0].id, 'frag-1', 'El primer fragmento debe ser el más afín (frag-1)');
    assert.ok(resultados[0].score_rerank >= 0.45, 'El score debe superar el umbral');
  });
});
