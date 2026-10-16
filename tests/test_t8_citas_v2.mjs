import test from "node:test";
import assert from "node:assert/strict";
import { verificarYSanearCitas as verificarServer } from "../server/curriculum/verificadorCitas.js";
import { verificarYSanearCitas as verificarWorker } from "../worker/verificadorCitas.js";

test("T8 - verificarYSanearCitas conserva pág. N cuando fragmentos vienen de herramientas v2 con campos normalizados", () => {
  const fragmentosV2 = [
    {
      id: "frag-t8-1",
      area: "Lengua Española",
      grado_num: 2,
      tema: "La Noticia",
      pagina: 45,
      fuente_documento: "Adecuación Curricular Nivel Primario (MINERD, 2023)"
    },
    {
      id: "frag-t8-2",
      area: "Matemática",
      grado_num: 2,
      tema: "Adición",
      pagina: 118,
      fuente_documento: "Guía Didáctica de Matemática"
    }
  ];

  const texto = "En la Adecuación Curricular (pág. 45) y la Guía Didáctica (pág. 118) se orienta la enseñanza. Pero en el texto apócrifo (pág. 500) se dice otra cosa.";

  for (const verificar of [verificarServer, verificarWorker]) {
    const res = verificar(texto, fragmentosV2);
    assert.ok(res.includes("pág. 45"), "Debe conservar pág. 45");
    assert.ok(res.includes("pág. 118"), "Debe conservar pág. 118");
    assert.ok(!res.includes("500"), "Debe eliminar o sanear pág. 500 no respaldada");
  }
});
