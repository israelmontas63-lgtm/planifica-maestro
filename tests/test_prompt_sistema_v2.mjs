import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { construirPromptSistemaV2, VERSION_PROMPT_SISTEMA } from '../shared/promptSistemaV2.js';

describe('Prompt de Sistema V2 - Planifica Maestro', () => {
  it('exporta la versión canónica 2.0.0', () => {
    assert.equal(VERSION_PROMPT_SISTEMA, '2.0.0');
  });

  it('incluye identidad, tono dominicano y principio anti-invención', () => {
    const prompt = construirPromptSistemaV2();
    assert.match(prompt, /Planifica Maestro/);
    assert.match(prompt, /República Dominicana/);
    assert.match(prompt, /MINERD/);
    assert.match(prompt, /No inventes/);
    assert.match(prompt, /CON BASE/);
  });

  it('delimita los fragmentos curriculares dentro de etiquetas de seguridad <DATO>', () => {
    const fragmentos = 'Indicador: Resuelve operaciones básicas.';
    const prompt = construirPromptSistemaV2({ fragmentosCurriculares: fragmentos });
    assert.match(prompt, /<DATO>[\s\S]*Resuelve operaciones básicas[\s\S]*<\/DATO>/);
  });

  it('mantiene la regla de una sola pregunta clarificadora ante datos incompletos', () => {
    const prompt = construirPromptSistemaV2();
    assert.match(prompt, /haz UNA SOLA pregunta concisa/);
  });
});
