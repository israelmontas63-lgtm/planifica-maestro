/**
 * tests/test_verificador_citas.mjs
 * 
 * Prueba de verificación en código de citas curriculares (Regla 3C.5):
 * 1. Cita a página inventada sin fragmentos -> Se elimina/reemplaza por "conocimiento general, sin respaldo".
 * 2. Cita a página respaldada por fragmento -> Se conserva intacta.
 * 3. Múltiples menciones con páginas apócrifas -> Saneamiento completo.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { verificarYSanearCitas, extraerPaginasDeFragmentos } from "../server/curriculum/verificadorCitas.js";

test("VERIFICADOR DE CITAS CURRICULARES EN CÓDIGO (3C.5)", async (t) => {
  await t.test("1. Respuesta que cita página inexistente (sin fragmentos) se reemplaza por conocimiento general", () => {
    const textoEntrada = "Para 3er grado de Primaria, según el Diseño Curricular del Nivel Primario (pág. 215), se abordan los seres vivos.";
    // Fragmentos vacíos porque Ciencias de la Naturaleza NO está indexado en el RAG activo
    const fragmentosRecuperados = [];

    const resultado = verificarYSanearCitas(textoEntrada, fragmentosRecuperados);

    assert.ok(!resultado.includes("pág. 215"), "No debe conservar la página 215 inventada");
    assert.ok(
      resultado.includes("(explicación de conocimiento general pedagógico, sin respaldo en los documentos oficiales indexados)"),
      "Debe incluir la advertencia honesta de falta de respaldo"
    );
  });

  await t.test("2. Respuesta que cita página que SÍ existe en los fragmentos recuperados se conserva intacta", () => {
    const textoEntrada = "En la Guía Didáctica de Lengua Española (pág. 45) se describe la estructura del debate.";
    const fragmentosRecuperados = [
      { documento: "Guía Didáctica de Lengua Española", pagina: 45, texto: "El debate en el aula..." }
    ];

    const resultado = verificarYSanearCitas(textoEntrada, fragmentosRecuperados);

    assert.ok(resultado.includes("pág. 45"), "Debe conservar la página 45 porque está en los fragmentos");
    assert.ok(!resultado.includes("sin respaldo"), "No debe marcar como sin respaldo una cita válida");
  });

  await t.test("3. Respuesta con número de página aislado inventado (ej: pág. 142) se elimina limpiamente", () => {
    const textoEntrada = "Consulta el bloque temático (pág. 142, área de Matemática) para más detalles.";
    const fragmentosRecuperados = [];

    const resultado = verificarYSanearCitas(textoEntrada, fragmentosRecuperados);

    assert.ok(!resultado.includes("142"), "Debe eliminar el número 142 ficticio");
  });
});
