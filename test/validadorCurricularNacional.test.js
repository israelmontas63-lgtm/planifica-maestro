import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ValidadorCurricularNacional } from '../worker/services/validadorCurricularNacional.js';

describe('Validador Curricular Nacional de la República Dominicana (ORDEN 46)', () => {
  it('debe exponer los marcos normativos oficiales vigentes del MINERD', () => {
    const marcos = ValidadorCurricularNacional.marcosNormativos();
    assert.ok(marcos.inicial.includes('Resolución 09-2023') || marcos.inicial.includes('Ordenanza 01-2023'));
    assert.ok(marcos.primaria.includes('Ordenanza 04-2023'));
    assert.ok(marcos.secundaria.includes('Ordenanza 03-2023'));
  });

  it('debe validar la estructura obligatoria de Nivel Inicial (Momentos de la Rutina)', () => {
    const planInvalido = 'Planificación sin rutina ni zonas.';
    const resInvalido = ValidadorCurricularNacional.validarEstructuraPorNivel('Inicial', planInvalido);
    assert.equal(resInvalido.valido, false);
    assert.ok(resInvalido.fallas.some(f => f.includes('Nivel Inicial requiere momentos de la rutina')));

    const planValido = 'Actividades del día: Encuentro de Grupo y Juego-Trabajo en la zona de dramatización.';
    const resValido = ValidadorCurricularNacional.validarEstructuraPorNivel('Inicial', planValido);
    assert.equal(resValido.valido, true);
    assert.equal(resValido.fallas.length, 0);
  });

  it('debe validar la estructura obligatoria de Nivel Secundario (Situación de Aprendizaje)', () => {
    const planInvalido = 'Unidad de Física sobre cinemática sin situación articulada.';
    const resInvalido = ValidadorCurricularNacional.validarEstructuraPorNivel('Secundaria', planInvalido);
    assert.equal(resInvalido.valido, false);
    assert.ok(resInvalido.fallas.some(f => f.includes('Situación de Aprendizaje')));

    const planValido = 'Situación de Aprendizaje: Los estudiantes diseñan un prototipo hidropónico para la comunidad.';
    const resValido = ValidadorCurricularNacional.validarEstructuraPorNivel('Secundaria', planValido);
    assert.equal(resValido.valido, true);
  });

  it('debe validar la estructura obligatoria de Nivel Primario (3 Momentos Didácticos)', () => {
    const planInvalido = 'Inicio de la clase y cierre, pero falta la parte central de actividades.';
    const resInvalido = ValidadorCurricularNacional.validarEstructuraPorNivel('Primaria', planInvalido);
    assert.equal(resInvalido.valido, false);
    assert.ok(resInvalido.fallas.some(f => f.includes('3 momentos')));

    const planValido = 'Secuencia: Inicio con saberes previos, Desarrollo con letras móviles y Cierre evaluativo.';
    const resValido = ValidadorCurricularNacional.validarEstructuraPorNivel('Primaria', planValido);
    assert.equal(resValido.valido, true);
  });

  it('debe aplicar veto absoluto a menciones y frases de IA', () => {
    const planConIA = 'Inicio, Desarrollo y Cierre. Este documento fue generado por inteligencia artificial.';
    const res = ValidadorCurricularNacional.validarEstructuraPorNivel('Primaria', planConIA);
    assert.equal(res.valido, false);
    assert.ok(res.fallas.some(f => f.includes('mención prohibida de IA')));
  });

  it('debe sanitizar e interceptar menciones de IA reemplazándolas por Planifica Maestro', () => {
    const textoConIA = 'Planificación creada por IA mediante un modelo de lenguaje y asistente virtual.';
    const saneado = ValidadorCurricularNacional.sanitizarBranding(textoConIA);

    assert.ok(!saneado.includes('creada por IA'));
    assert.ok(!saneado.includes('modelo de lenguaje'));
    assert.ok(!saneado.includes('asistente virtual'));
    assert.ok(saneado.includes('Planifica Maestro'));
  });

  it('debe manejar entradas vacías o nulas sin lanzar excepciones', () => {
    const resVacio = ValidadorCurricularNacional.validarEstructuraPorNivel('Primaria', '');
    assert.equal(resVacio.valido, false);

    const resNull = ValidadorCurricularNacional.validarEstructuraPorNivel('Primaria', null);
    assert.equal(resNull.valido, false);

    const saneadoNull = ValidadorCurricularNacional.sanitizarBranding(null);
    assert.equal(saneadoNull, '');
  });
});
