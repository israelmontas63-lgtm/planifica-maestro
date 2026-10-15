import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  NIVELES,
  AREAS,
  GRADOS,
  gradoANumero,
  cicloDeGrado,
  normalizarNivel,
  normalizarArea
} from './catalogoCurricular.mjs';

describe('shared/catalogoCurricular.mjs', () => {
  it('expone constantes inmutables canónicas', () => {
    assert.deepEqual(NIVELES, ['Inicial', 'Primario', 'Secundario']);
    assert.deepEqual(AREAS, ['Matemática', 'Lengua Española']);
    assert.deepEqual(GRADOS, ['1ro', '2do', '3ro', '4to', '5to', '6to']);
  });

  it('gradoANumero reconoce variantes y ordinales', () => {
    const casos = {
      '1er Grado': 1, '1ro': 1, '1.º': 1, '1.°': 1, 'Primero': 1, 'primer grado': 1,
      '2do Grado': 2, '2do': 2, '2.º': 2, 'Segundo': 2, 'segundo': 2,
      '3ro': 3, '3er Grado': 3, '3.º': 3, 'Tercero': 3, 'tercer': 3,
      '4to': 4, '4to Grado': 4, '4.º': 4, 'Cuarto': 4,
      '5to': 5, '5.º': 5, 'quinto grado': 5,
      '6to': 6, '6to Grado': 6, '6.º': 6, 'Sexto': 6
    };
    for (const [entrada, esperado] of Object.entries(casos)) {
      assert.equal(gradoANumero(entrada), esperado, `Fallo en: ${entrada}`);
    }
  });

  it('gradoANumero rechaza valores inválidos y múltiples', () => {
    const invalidos = ['7mo', 'abc', '', null, '0', '2do 3ro', 'secundaria', undefined];
    for (const inv of invalidos) {
      assert.equal(gradoANumero(inv), null, `Debería ser null: ${inv}`);
    }
  });

  it('cicloDeGrado deriva correctamente Primer y Segundo Ciclo', () => {
    assert.equal(cicloDeGrado(1), 'Primer Ciclo');
    assert.equal(cicloDeGrado(2), 'Primer Ciclo');
    assert.equal(cicloDeGrado(3), 'Primer Ciclo');
    assert.equal(cicloDeGrado(4), 'Segundo Ciclo');
    assert.equal(cicloDeGrado(5), 'Segundo Ciclo');
    assert.equal(cicloDeGrado(6), 'Segundo Ciclo');
    assert.equal(cicloDeGrado(7), null);
    assert.equal(cicloDeGrado(null), null);
  });

  it('normalizarNivel estandariza niveles', () => {
    assert.equal(normalizarNivel('primario'), 'Primario');
    assert.equal(normalizarNivel('PRIMARIA'), 'Primario');
    assert.equal(normalizarNivel('inicial'), 'Inicial');
    assert.equal(normalizarNivel('secundaria'), 'Secundario');
    assert.equal(normalizarNivel('universitario'), null);
  });

  it('normalizarArea reconoce áreas del catálogo y rechaza desconocidas', () => {
    assert.equal(normalizarArea('matematica'), 'Matemática');
    assert.equal(normalizarArea('MATEMÁTICA'), 'Matemática');
    assert.equal(normalizarArea('lengua espanola'), 'Lengua Española');
    assert.equal(normalizarArea('Lengua Española'), 'Lengua Española');

    assert.throws(() => normalizarArea('Ciencias Sociales'), /Área curricular no reconocida/);
    assert.throws(() => normalizarArea('Química'), /Área curricular no reconocida/);
  });
});
