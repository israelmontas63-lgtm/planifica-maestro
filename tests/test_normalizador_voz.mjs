/**
 * tests/test_normalizador_voz.mjs
 * Pruebas (Node, no navegador) para la normalización de voz, comparación de perfil
 * y sugerencias sin nombres fijos en el código.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizarOrdinalesYNumeros,
  detectarSugerenciaBibliografia,
  compararConPerfil,
  analizarEntidadesDictado
} from "../client/src/utils/normalizadorVoz.js";

test("SUITE DE PRUEBAS: Normalizador de Voz y Perfil Dinámico [Node, no navegador]", async (t) => {

  await t.test("1. Normaliza ordinales dictados a formato dominicano (segundo -> 2.º)", () => {
    const salida = normalizarOrdinalesYNumeros("Planificación de segundo grado y primero");
    assert.ok(salida.includes("2.º"));
    assert.ok(salida.includes("1.º"));
  });

  await t.test("2. Normaliza números en palabras para minutos (cuarenta y cinco minutos -> 45 minutos)", () => {
    const salida = normalizarOrdinalesYNumeros("tiempo cuarenta y cinco minutos");
    assert.equal(salida, "tiempo 45 minutos");
  });

  await t.test("3. 'bibliografía' frente a 'biografía' solo se SUGIERE, nunca se cambia sola", () => {
    const texto = "tema bibliografía de un individuo";
    const sug = detectarSugerenciaBibliografia(texto);
    assert.equal(sug.tieneSugerencia, true);
    assert.equal(sug.sugerencia, "biografía");
    // Verificar que normalizarOrdinalesYNumeros NO la altera
    const norm = normalizarOrdinalesYNumeros(texto);
    assert.ok(norm.includes("bibliografía"), "No debe sustituirla de manera forzada");
  });

  await t.test("4. Comparación dinámica con el perfil sin nombres fijos en el código", () => {
    // Si coinciden fonéticamente sin importar tildes (ej. montas vs Montás)
    const resCoincide = compararConPerfil("israel montas", "Israel Montás");
    assert.equal(resCoincide.coincide, true);
    assert.equal(resCoincide.valorSugerido, "Israel Montás");

    // Si difieren totalmente
    const resDifiere = compararConPerfil("Pedro Pérez", "Israel Montás");
    assert.equal(resDifiere.difiere, true);
    assert.equal(resDifiere.coincide, false);
  });

  await t.test("5. Analiza la frase completa del usuario y genera el resumen con viñetas medias", () => {
    const frase = "Planificación de segundo, tema biografía de un individuo, escuela Batey Piñones, maestro israel montas, tiempo cuarenta y cinco minutos";
    const perfilMock = {
      nombre: "Israel Montás",
      escuela: "Escuela Batey Piñones",
      grado: "2.º de Primaria"
    };

    const analizado = analizarEntidadesDictado(frase, perfilMock);
    assert.ok(analizado.resumenEstructurado.includes("2.º"));
    assert.ok(analizado.resumenEstructurado.includes("Tema: biografía de un individuo"));
    assert.ok(analizado.resumenEstructurado.includes("Israel Montás"));
    assert.ok(analizado.resumenEstructurado.includes("45 minutos"));
    assert.equal(analizado.minutosNum, 45);
    assert.equal(analizado.sugerencia.tieneSugerencia, false);
  });

  await t.test("6. Los minutos van disponibles para el campo de tiempo del Word", () => {
    const frase = "Planificación de 3.º, tiempo 45 minutos";
    const analizado = analizarEntidadesDictado(frase);
    assert.equal(analizado.minutosNum, 45);
    assert.equal(analizado.tiempo, "45 minutos");
  });

});
