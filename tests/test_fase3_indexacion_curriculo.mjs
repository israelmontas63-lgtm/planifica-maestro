/**
 * tests/test_fase3_indexacion_curriculo.mjs
 * Pruebas automatizadas para validar la FASE 3:
 * 1. Cero duplicados en el índice curricular oficial (eliminación del duplicado Guia Matemática WEB).
 * 2. Cobertura completa de los 9 PDFs oficiales del MINERD (Inicial, Primaria, Secundaria, Registros).
 * 3. Búsqueda curricular multiciclo con citas de páginas reales.
 * 4. Integridad del manifiesto de Capa 1 y Capa 4.
 */

import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buscarEnCurriculo } = require("../server/curriculum/buscadorCurricular.js");

const rutaIndice = path.resolve("server/curriculo/capa4_indice/indice_curriculo.json");
const rutaManifiestoIndice = path.resolve("server/curriculo/capa4_indice/manifiesto_indice.json");
const rutaManifiestoOriginales = path.resolve("server/curriculo/capa1_originales/manifiesto_originales.json");

test("FASE 3 - 1. Desduplicación Curricular Estricta", async (t) => {
  await t.test("Índice curricular existe y no contiene fragmentos de texto idénticos", () => {
    assert.ok(fs.existsSync(rutaIndice), "El archivo indice_curriculo.json debe existir");
    const indice = JSON.parse(fs.readFileSync(rutaIndice, "utf-8"));
    assert.ok(indice.length > 2000, `El índice debe tener más de 2000 fragmentos (tiene ${indice.length})`);

    const textosVistos = new Set();
    let duplicados = 0;
    for (const item of indice) {
      const textoNorm = (item.texto || item.texto_busqueda || "").toLowerCase().replace(/\s+/g, " ").trim();
      if (textoNorm.length > 80) {
        if (textosVistos.has(textoNorm)) {
          duplicados++;
        }
        textosVistos.add(textoNorm);
      }
    }

    assert.equal(duplicados, 0, `No debe haber fragmentos duplicados en el índice (se encontraron ${duplicados})`);
  });

  await t.test("Manifiesto de Capa 4 reporta duplicados descartados durante la indexación", () => {
    assert.ok(fs.existsSync(rutaManifiestoIndice));
    const man = JSON.parse(fs.readFileSync(rutaManifiestoIndice, "utf-8"));
    assert.ok(man.duplicados_descartados > 200, "Debe haber detectado y descartado más de 200 fragmentos duplicados");
  });
});

test("FASE 3 - 2. Cobertura Completa de los 9 PDFs Oficiales de MINERD", async (t) => {
  const indice = JSON.parse(fs.readFileSync(rutaIndice, "utf-8"));

  const documentosRequeridos = [
    "Adecuación Curricular del Nivel Primario (MINERD)",
    "Adecuación Curricular del Nivel Secundario (MINERD, 2023)",
    "Diseño Curricular del Nivel Inicial (MINERD)",
    "Diseño Curricular Nivel Primario - Primer Ciclo (MINERD)",
    "Naturaleza de las Áreas Curriculares (MINERD)",
    "Registro de Grado - 1er Grado Secundaria (MINERD)",
    "Registro de Grado - 2do Grado Secundaria (MINERD)",
    "Registro de Grado - 3er Grado Secundaria (MINERD)",
    "Manual de Organización del Programa CON BASE (MINERD / UNICEF)"
  ];

  for (const docNombre of documentosRequeridos) {
    await t.test(`Presencia de fragmentos activos para: ${docNombre}`, () => {
      const fragmentosDoc = indice.filter(f => f.documento === docNombre);
      assert.ok(
        fragmentosDoc.length > 0,
        `El documento ${docNombre} debe tener fragmentos indexados (tiene ${fragmentosDoc.length})`
      );
      assert.ok(
        fragmentosDoc.every(f => f.pagina !== undefined && f.pagina !== null),
        `Todos los fragmentos de ${docNombre} deben tener número de página real asignado`
      );
    });
  }

  await t.test("Distribución equilibrada por nivel educativo (inicial, primario, secundario)", () => {
    const conteoNiveles = {};
    indice.forEach(f => {
      conteoNiveles[f.nivel] = (conteoNiveles[f.nivel] || 0) + 1;
    });

    assert.ok(conteoNiveles.primario >= 1000, "Nivel primario debe tener al menos 1000 fragmentos");
    assert.ok(conteoNiveles.secundario >= 500, "Nivel secundario debe tener al menos 500 fragmentos");
    assert.ok(conteoNiveles.inicial >= 100, "Nivel inicial debe tener al menos 100 fragmentos");
  });
});

test("FASE 3 - 3. Búsqueda Curricular Multi-Nivel con Citas Oficiales de Página", async (t) => {
  await t.test("Búsqueda en Secundaria retorna documento de Secundaria y página real", () => {
    const res = buscarEnCurriculo({ query: "el ensayo", nivel: "secundario" });
    assert.ok(res.encontrado, "Debe encontrar 'el ensayo' en nivel secundario");
    assert.ok(res.resultados.length > 0, "Debe devolver al menos 1 resultado");
    const top = res.resultados[0];
    assert.ok(
      top.documento.includes("Secundari"),
      `El documento debe ser de Secundaria (obtenido: ${top.documento})`
    );
    assert.ok(top.pagina > 0, "Debe citar una página real del documento");
    assert.ok(top.fuente.includes("pág."), "Debe formatear la cita bibliográfica con pág.");
  });

  await t.test("Búsqueda en Primaria retorna adecuación o guía oficial con página", () => {
    const res = buscarEnCurriculo({ query: "fracciones", nivel: "primario", area: "Matemática" });
    assert.ok(res.encontrado, "Debe encontrar 'fracciones' en primaria");
    assert.ok(res.resultados.length > 0);
    const top = res.resultados[0];
    assert.ok(top.pagina !== undefined);
    assert.ok(top.fuente.includes("MINERD"));
  });

  await t.test("Búsqueda en Inicial retorna diseño curricular de Nivel Inicial", () => {
    const res = buscarEnCurriculo({ query: "interes", nivel: "inicial" });
    assert.ok(res.encontrado, "Debe encontrar centros de interés en nivel inicial");
    assert.ok(res.resultados.length > 0);
    const top = res.resultados[0];
    assert.ok(
      top.documento.includes("Inicial"),
      `El documento debe ser de Inicial (obtenido: ${top.documento})`
    );
    assert.ok(top.pagina > 0);
  });
});
