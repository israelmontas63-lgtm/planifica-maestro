/**
 * tests/test_saludo_limites.mjs
 * 
 * Verificación 3C.8: Casos límite de la salvaguarda de saludos (10 casos de prueba).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { limpiarSaludoInnecesario } from "../worker/modoConversacional.js";

test("SALUDO: 10 CASOS LÍMITE DE SALVAGUARDA (3C.8)", async (t) => {
  // Caso 1: Docente saluda en su primer mensaje -> Se conserva
  await t.test("Caso 1: Saludo del docente en primer mensaje se conserva intacto", () => {
    const resp = "¡Hola, Profe! Con gusto te apoyo a planificar hoy.";
    const resultado = limpiarSaludoInnecesario(resp, true); // debePermitirSaludo = true
    assert.equal(resultado, "¡Hola, Profe! Con gusto te apoyo a planificar hoy.");
  });

  // Caso 2: Pregunta factual sin saludo -> Se poda el saludo inicial
  await t.test("Caso 2: Pregunta directa de Duarte poda '¡Hola, Profe!'", () => {
    const resp = "¡Hola, Profe! Juan Pablo Duarte fue el fundador de La Trinitaria y Padre de la Patria.";
    const resultado = limpiarSaludoInnecesario(resp, false);
    assert.ok(resultado.startsWith("Juan Pablo Duarte fue"), `Debe empezar directo por Duarte. Obtuvimos: "${resultado}"`);
  });

  // Caso 3: 'hola' dentro de una frase -> NO se borra
  await t.test("Caso 3: 'hola' dentro de la frase no se borra", () => {
    const resp = "En esta actividad los estudiantes aprenderán a decir hola en inglés y saludar al docente.";
    const resultado = limpiarSaludoInnecesario(resp, false);
    assert.equal(resultado, "En esta actividad los estudiantes aprenderán a decir hola en inglés y saludar al docente.");
  });

  // Caso 4: Pregunta factual municipios de Santiago -> Poda '¡Buenas tardes!'
  await t.test("Caso 4: Pregunta concisa poda '¡Buenas tardes!' y entrega el número en 1ra frase", () => {
    const resp = "¡Buenas tardes! La provincia de Santiago tiene 10 municipios.";
    const resultado = limpiarSaludoInnecesario(resp, false);
    assert.equal(resultado, "La provincia de Santiago tiene 10 municipios.");
  });

  // Caso 5: Docente saluda con 'Buenas tardes' -> Se conserva
  await t.test("Caso 5: Docente saluda con 'Buenas tardes' -> se conserva", () => {
    const resp = "¡Buenas tardes, Profe! ¿En qué grado nos enfocamos hoy?";
    const resultado = limpiarSaludoInnecesario(resp, true);
    assert.equal(resultado, resp);
  });

  // Caso 6: Turno posterior sin saludo -> Poda '¡Hola!'
  await t.test("Caso 6: Turno posterior sin saludo poda '¡Hola!'", () => {
    const resp = "¡Hola! Para esa clase te sugiero una dinámica grupal con tarjetas.";
    const resultado = limpiarSaludoInnecesario(resp, false);
    assert.ok(resultado.startsWith("Para esa clase"), `Debe empezar por 'Para esa clase'. Obtuvimos: "${resultado}"`);
  });

  // Caso 7: Fórmula protocolar 'Es un gusto saludarte' -> Se poda
  await t.test("Caso 7: Fórmula 'Es un gusto saludarte' se poda en respuesta factual", () => {
    const resp = "Es un gusto saludarte, colega. La fotosíntesis es el proceso de transformación de energía.";
    const resultado = limpiarSaludoInnecesario(resp, false);
    assert.ok(resultado.startsWith("La fotosíntesis es"), `Debe empezar por 'La fotosíntesis'. Obtuvimos: "${resultado}"`);
  });

  // Caso 8: Palabra que empieza por 'Hol' como 'Holanda' -> No se altera
  await t.test("Caso 8: Palabra 'Holanda' no se altera", () => {
    const resp = "Holanda es un país referente en educación participativa.";
    const resultado = limpiarSaludoInnecesario(resp, false);
    assert.equal(resultado, "Holanda es un país referente en educación participativa.");
  });

  // Caso 9: Usuario saluda a mitad de conversación -> Se permite saludo
  await t.test("Caso 9: Usuario saluda a mitad de conversación -> se permite saludo", () => {
    const resp = "¡Hola de nuevo, Profe! Claro que sí, revisemos esa lección de fracciones.";
    const resultado = limpiarSaludoInnecesario(resp, true);
    assert.equal(resultado, resp);
  });

  // Caso 10: Respuesta técnica que ya empieza por el dato -> Intacta
  await t.test("Caso 10: Respuesta que empieza directamente por el dato queda intacta", () => {
    const resp = "El debate es una técnica de discusión dirigida estructurada en tres momentos.";
    const resultado = limpiarSaludoInnecesario(resp, false);
    assert.equal(resultado, resp);
  });
});
