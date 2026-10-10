import { describe, it } from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  clasificarCategoria6: clasificarNode,
  CATEGORIAS_6: CAT_NODE
} = require("../server/ia/clasificadorIntencion.js");

import {
  clasificarCategoria6 as clasificarWorker,
  CATEGORIAS_6 as CAT_WORKER
} from "../worker/clasificadorIntencion.js";

describe("Clasificador de Consultas en 6 Categorías (Node y Worker)", () => {
  const casos = [
    { texto: "Planificación de matemática para 3er grado de Primaria", esperado: "A_CURRICULAR_RD", codigo: "A" },
    { texto: "Indicadores de logro de Lengua Española en 4to grado", esperado: "A_CURRICULAR_RD", codigo: "A" },
    { texto: "Secuencia didáctica del cuento para 2do grado con CON BASE", esperado: "A_CURRICULAR_RD", codigo: "A" },

    { texto: "Estrategias para motivar a los estudiantes en el aula", esperado: "B_PEDAGOGIA_GENERAL", codigo: "B" },
    { texto: "Dinámicas de grupo para romper el hielo el primer día", esperado: "B_PEDAGOGIA_GENERAL", codigo: "B" },
    { texto: "¿Cómo evaluar con rúbricas de manera formativa?", esperado: "B_PEDAGOGIA_GENERAL", codigo: "B" },

    { texto: "¿Quién fue Juan Pablo Duarte?", esperado: "C_CONOCIMIENTO_GENERAL", codigo: "C" },
    { texto: "¿Qué es la fotosíntesis y cómo funciona?", esperado: "C_CONOCIMIENTO_GENERAL", codigo: "C" },
    { texto: "¿Cuántos municipios tiene la República Dominicana?", esperado: "C_CONOCIMIENTO_GENERAL", codigo: "C" },

    { texto: "¿Cuándo inician las clases según el calendario escolar oficial?", esperado: "D_NORMATIVA_O_ACTUALIDAD", codigo: "D" },
    { texto: "Resolución del MINERD sobre el año escolar y las efemérides", esperado: "D_NORMATIVA_O_ACTUALIDAD", codigo: "D" },
    { texto: "Noticias de hoy sobre el concurso docente del MINERD", esperado: "D_NORMATIVA_O_ACTUALIDAD", codigo: "D" },

    { texto: "¿Cuáles son los DBA de matemáticas para tercer grado?", esperado: "E_TERMINO_AJENO", codigo: "E", pais: "Colombia" },
    { texto: "Campos formativos y aprendizajes clave en primaria", esperado: "E_TERMINO_AJENO", codigo: "E", pais: "México" },
    { texto: "Estándares básicos de competencias en ciencias", esperado: "E_TERMINO_AJENO", codigo: "E", pais: "Colombia" },
    { texto: "¿En qué consisten los núcleos de aprendizaje prioritarios?", esperado: "E_TERMINO_AJENO", codigo: "E", pais: "Argentina" },
    { texto: "Objetivos de aprendizaje (OA) de lectura y escritura", esperado: "E_TERMINO_AJENO", codigo: "E", pais: "Chile" },
    { texto: "¿Dónde está la malla curricular de 5to de primaria?", esperado: "E_TERMINO_AJENO", codigo: "E" },

    { texto: "Dame una receta para cocinar un sancocho", esperado: "F_FUERA_DE_ALCANCE", codigo: "F" },
    { texto: "¿Cómo reparar el alternador de un carro en el taller?", esperado: "F_FUERA_DE_ALCANCE", codigo: "F" },
    { texto: "Resultados de la lotería y jugadas de anoche", esperado: "F_FUERA_DE_ALCANCE", codigo: "F" }
  ];

  for (const c of casos) {
    it(`Node: "${c.texto}" -> ${c.codigo} (${c.esperado})`, () => {
      const res = clasificarNode(c.texto);
      assert.strictEqual(res.codigo, c.codigo, `Código no coincide para: "${c.texto}"`);
      assert.strictEqual(res.categoria, c.esperado, `Categoría no coincide para: "${c.texto}"`);
      if (c.pais) {
        assert.ok(res.termino_ajeno, "Debe incluir objeto de término ajeno");
        assert.ok(
          res.termino_ajeno.pais_origen.includes(c.pais),
          `País debe ser ${c.pais}, obtenido: ${res.termino_ajeno.pais_origen}`
        );
      }
    });

    it(`Worker: "${c.texto}" -> ${c.codigo} (${c.esperado})`, () => {
      const res = clasificarWorker(c.texto);
      assert.strictEqual(res.codigo, c.codigo, `Código no coincide para: "${c.texto}"`);
      assert.strictEqual(res.categoria, c.esperado, `Categoría no coincide para: "${c.texto}"`);
      if (c.pais) {
        assert.ok(res.termino_ajeno, "Debe incluir objeto de término ajeno");
        assert.ok(
          res.termino_ajeno.pais_origen.includes(c.pais),
          `País debe ser ${c.pais}, obtenido: ${res.termino_ajeno.pais_origen}`
        );
      }
    });
  }
});
