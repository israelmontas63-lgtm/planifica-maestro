/**
 * tests/test_rubrica_evaluacion_word.mjs
 * 
 * SUITE DE PRUEBAS AUTOMATIZADAS - BLOQUE 20:
 * Generador Canónico de Rúbricas e Instrumentos de Evaluación Formativa en Word (.docx)
 * Estándar Ministerial MINERD — Ordenanza 04-2023 y Adecuación Curricular 2023.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Packer } from "docx";
import {
  construirDocumentoRubricaOficial
} from "../client/src/services/generadorRubricaWord.js";
import {
  extraerCriteriosEvaluacion,
  estructurarMatrizRubrica,
  estructurarListaCotejo
} from "../client/src/services/evaluacionUtils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

test("BLOQUE 20 - 1. Integridad y Construcción Canónica DOCX de Rúbricas e Instrumentos", async (t) => {
  const datosPlanPrueba = {
    area: "Lengua Española",
    grado: "4to Primaria",
    seccion: "B",
    docente: "Prof. Rafael Encarnación",
    centro_educativo: "Escuela Primaria República de Colombia",
    tema: "El Informe de Lectura",
    intencion_pedagogica: "Comprender la estructura y función del informe de lectura",
    competencias_especificas: "Produce informes de lectura con coherencia y cohesión",
    evaluacion: "Rúbrica analítica por criterios e indicadores del Registro de Grado",
    actividades_diferenciadas: "Uso de tarjetas léxicas y apoyos visuales DUA"
  };

  await t.test("Construye Rúbrica Analítica oficial generando buffer binario PK DOCX válido", async () => {
    const doc = await construirDocumentoRubricaOficial({
      datos: datosPlanPrueba,
      tipoInstrumento: "rubrica_analitica",
      titulo: "Rubrica_Prueba_Lengua"
    });

    assert.ok(doc?.documentWrapper, "El documento debe tener documentWrapper inicializado");

    const buffer = await Packer.toBuffer(doc);
    assert.ok(Buffer.isBuffer(buffer), "Debe generar un Buffer de Node");
    assert.ok(buffer.length > 7000, `El tamaño DOCX (${buffer.length} bytes) debe superar los 7 KB`);

    // Validar cabecera PK de archivo ZIP/DOCX
    assert.strictEqual(buffer[0], 0x50, "Byte 0 debe ser 'P'");
    assert.strictEqual(buffer[1], 0x4b, "Byte 1 debe ser 'K'");
    assert.strictEqual(buffer[2], 0x03, "Byte 2 debe ser 0x03");
    assert.strictEqual(buffer[3], 0x04, "Byte 3 debe ser 0x04");
  });

  await t.test("Construye Lista de Cotejo Formativa generando buffer binario PK DOCX válido", async () => {
    const doc = await construirDocumentoRubricaOficial({
      datos: datosPlanPrueba,
      tipoInstrumento: "lista_cotejo",
      titulo: "Lista_Cotejo_Prueba"
    });

    assert.ok(doc?.documentWrapper);
    const buffer = await Packer.toBuffer(doc);
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 6000);
    assert.strictEqual(buffer[0], 0x50);
    assert.strictEqual(buffer[1], 0x4b);
  });
});

test("BLOQUE 20 - 2. Estructuración Curricular Oficial (Ordenanza 04-2023)", async (t) => {
  const criteriosMock = [
    {
      id: "c1",
      nombre: "Estructura del Texto",
      descripcion: "Identifica inicio, desarrollo y conclusión del informe de lectura",
      indicador: "Reconoce la estructura canónica del informe de lectura"
    },
    {
      id: "c2",
      nombre: "Cohesión y Conectores",
      descripcion: "Utiliza conectores de orden y causa en sus producciones",
      indicador: "Aplica conectores temporales y causales pertinentes"
    }
  ];

  await t.test("estructurarMatrizRubrica contiene los 4 niveles oficiales: Destacado, Logrado, En Proceso e Incipiente", () => {
    const matriz = estructurarMatrizRubrica(criteriosMock, {
      area: "Lengua Española",
      adaptacionesDua: "Uso de pictogramas"
    });

    assert.strictEqual(matriz.length, 2, "Debe estructurar 2 filas de rúbrica");

    for (const fila of matriz) {
      assert.ok(fila.niveles.destacado, "Debe contener nivel Destacado");
      assert.strictEqual(fila.niveles.destacado.codigo, "D");
      assert.ok(fila.niveles.destacado.descriptor.includes("Supera el estándar"));

      assert.ok(fila.niveles.logrado, "Debe contener nivel Logrado");
      assert.strictEqual(fila.niveles.logrado.codigo, "L");
      assert.ok(fila.niveles.logrado.descriptor.includes("Cumple el estándar"));

      assert.ok(fila.niveles.en_proceso, "Debe contener nivel En Proceso");
      assert.strictEqual(fila.niveles.en_proceso.codigo, "P");
      assert.ok(fila.niveles.en_proceso.descriptor.includes("En desarrollo"));

      assert.ok(fila.niveles.incipiente, "Debe contener nivel Incipiente");
      assert.strictEqual(fila.niveles.incipiente.codigo, "I");
      assert.ok(fila.niveles.incipiente.descriptor.includes("Nivel inicial"));

      assert.ok(fila.observacionDua.includes("Uso de pictogramas"), "Debe incorporar pauta DUA");
    }
  });

  await t.test("estructurarListaCotejo incluye escala valorativa (L, P, I) y pautas DUA", () => {
    const lista = estructurarListaCotejo(criteriosMock, {
      adaptacionesDua: "Tiempo extendido"
    });

    assert.strictEqual(lista.length, 2);
    assert.strictEqual(lista[0].numero, 1);
    assert.ok(lista[0].escala.includes("Logrado (L)"));
    assert.ok(lista[0].escala.includes("En Proceso (P)"));
    assert.ok(lista[0].escala.includes("Iniciado (I)"));
    assert.strictEqual(lista[0].ajusteDua, "Tiempo extendido");
  });
});

test("BLOQUE 20 - 3. Extracción Curricular y Tolerancia a Fallos en evaluacionUtils.js", async (t) => {
  await t.test("extraerCriteriosEvaluacion extrae criterios con datos completos", () => {
    const datos = {
      area: "Matemáticas",
      intencion_pedagogica: "Resolver problemas de fracciones",
      competencias_especificas: "Razona y argumenta sobre operaciones fraccionarias",
      evaluacion: "Resolución de problemas en cuaderno; Lista de cotejo; Participación activa",
      actividades_diferenciadas: "Material manipulativo de regletas"
    };

    const resultado = extraerCriteriosEvaluacion(datos);
    assert.strictEqual(resultado.area, "Matemáticas");
    assert.ok(resultado.criterios.length >= 2, "Debe desglosar al menos 2 criterios");
    assert.ok(resultado.adaptacionesDua.includes("regletas"));
  });

  await t.test("extraerCriteriosEvaluacion genera criterios canónicos de respaldo ante objeto vacío", () => {
    const resultado = extraerCriteriosEvaluacion({});
    assert.ok(resultado.criterios.length >= 3, "Debe generar al menos 3 criterios canónicos por defecto");
    assert.strictEqual(resultado.criterios[0].id, "crit_1");
  });
});

test("BLOQUE 20 - 4. Verificación de Integración de Componentes y Contratos UI", async (t) => {
  const rutaPlanResult = path.join(rootDir, "client/src/components/PlanResult.jsx");
  const rutaMisPlanes = path.join(rootDir, "client/src/components/MisPlanificaciones.jsx");
  const rutaApp = path.join(rootDir, "client/src/App.jsx");
  const rutaApi = path.join(rootDir, "client/src/api.js");
  const rutaModal = path.join(rootDir, "client/src/components/RubricaModal.jsx");

  await t.test("PlanResult.jsx incluye botón '📊 Rúbrica MINERD' y prop onAbrirRubrica", () => {
    assert.ok(fs.existsSync(rutaPlanResult));
    const content = fs.readFileSync(rutaPlanResult, "utf-8");
    assert.ok(content.includes("onAbrirRubrica"), "Debe recibir prop onAbrirRubrica");
    assert.ok(content.includes("Rúbrica MINERD"), "Debe contener texto del botón Rúbrica MINERD");
  });

  await t.test("MisPlanificaciones.jsx incluye botón '📊 Rúbrica' en las tarjetas", () => {
    assert.ok(fs.existsSync(rutaMisPlanes));
    const content = fs.readFileSync(rutaMisPlanes, "utf-8");
    assert.ok(content.includes("onAbrirRubrica"), "Debe recibir prop onAbrirRubrica");
    assert.ok(content.includes("📊 Rúbrica"), "Debe contener botón 📊 Rúbrica");
  });

  await t.test("App.jsx integra RubricaModal con lazy loading y orquesta su apertura", () => {
    assert.ok(fs.existsSync(rutaApp));
    const content = fs.readFileSync(rutaApp, "utf-8");
    assert.ok(content.includes("const RubricaModal = lazy("), "Debe cargar RubricaModal con React.lazy");
    assert.ok(content.includes("rubricaModalPlan"), "Debe declarar estado rubricaModalPlan");
    assert.ok(content.includes("<RubricaModal"), "Debe renderizar RubricaModal");
  });

  await t.test("api.js exporta exportarRubricaWord", () => {
    assert.ok(fs.existsSync(rutaApi));
    const content = fs.readFileSync(rutaApi, "utf-8");
    assert.ok(content.includes("export async function exportarRubricaWord"), "Debe exportar función exportarRubricaWord");
  });

  await t.test("RubricaModal.jsx existe y contiene controles de Word, Copiar e Imprimir", () => {
    assert.ok(fs.existsSync(rutaModal));
    const content = fs.readFileSync(rutaModal, "utf-8");
    assert.ok(content.includes("descargarRubricaWord"), "Debe invocar descargarRubricaWord");
    assert.ok(content.includes("handleCopiarTabla"), "Debe tener manejador de copia de tabla");
    assert.ok(content.includes("handleImprimir"), "Debe tener manejador de impresión");
    assert.ok(content.includes("rubrica_analitica"), "Debe manejar pestaña de rúbrica analítica");
    assert.ok(content.includes("lista_cotejo"), "Debe manejar pestaña de lista de cotejo");
  });
});
