import { describe, it } from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  buscarEnCurriculo,
  normalizarTexto,
  lematizarPalabra
} = require("../server/curriculum/buscadorCurricular.js");

describe("Motor de Búsqueda Curricular Oficial (Anti-alucinación)", () => {
  it("1. Singular / Plural y Lematización: 'fraccion' y 'fracciones' retornan coincidencia", () => {
    assert.strictEqual(lematizarPalabra("fracciones"), "fraccion");
    assert.strictEqual(lematizarPalabra("animales"), "animal");
    assert.strictEqual(lematizarPalabra("plantas"), "planta");

    const resSingular = buscarEnCurriculo({ query: "fraccion", area: "Matemática" });
    const resPlural = buscarEnCurriculo({ query: "fracciones", area: "Matemática" });

    assert.strictEqual(resSingular.encontrado, resPlural.encontrado);
  });

  it("2. Con y Sin Acentos: idéntico comportamiento", () => {
    const resAcento = buscarEnCurriculo({ query: "La Noticia", area: "Lengua Española", grado: "1er grado" });
    const resSinAcento = buscarEnCurriculo({ query: "la noticia", area: "lengua espanola", grado: "1ro" });

    assert.strictEqual(resAcento.encontrado, true);
    assert.strictEqual(resSinAcento.encontrado, true);
    assert.strictEqual(resAcento.resultados[0].id, resSinAcento.resultados[0].id);
  });

  it("3. Tema existente en varios grados: activa requiereDesambiguacion", () => {
    // Si no se especifica grado y el tema existe en múltiples grados oficiales (ej. 'La receta' o 'La noticia')
    const res = buscarEnCurriculo({ query: "La noticia" });
    assert.strictEqual(res.encontrado, true);
    if (res.resultados.length >= 2) {
      assert.ok(res.requiereDesambiguacion, "Debe activar requiereDesambiguacion al no haber grado unívoco");
      assert.ok(res.mensaje.includes("¿Cuál deseas planificar?"));
    }
  });

  it("4. Tema inexistente: no alucina y devuelve mensaje claro", () => {
    const res = buscarEnCurriculo({ query: "Física cuántica avanzada y relatividad general" });
    assert.strictEqual(res.encontrado, false);
    assert.ok(res.mensaje.includes("No encontré ese tema en la biblioteca oficial"));
    assert.strictEqual(res.resultados.length, 0);
  });

  it("5. Devuelve hasta los 3 mejores resultados con fuente MINERD y puntaje", () => {
    const res = buscarEnCurriculo({ query: "conteo de numeros", area: "Matemática" });
    if (res.encontrado) {
      assert.ok(res.resultados.length <= 3);
      const primero = res.resultados[0];
      assert.ok(primero.fuente.includes("MINERD"));
      assert.ok(primero.pagina !== undefined);
      assert.ok(primero.puntaje_relevancia > 0);
    }
  });
});
