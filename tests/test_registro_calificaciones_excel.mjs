import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  ESTUDIANTES_EJEMPLO_MINERD,
  extraerIndicadoresRegistro,
  obtenerClaveStorageNomina,
  estructurarPlanillaCalificaciones,
  estructurarPlanillaAsistencia
} from "../client/src/services/registroCalificacionesUtils.js";
import { generarXmlRegistroExcel } from "../client/src/services/generadorExcelRegistro.js";

test("Registro Calificaciones MINERD - 1. Nómina predeterminada y claves de almacenamiento", () => {
  assert.equal(ESTUDIANTES_EJEMPLO_MINERD.length, 25);
  assert.ok(ESTUDIANTES_EJEMPLO_MINERD[0].includes("Almonte Pérez"));

  const clave1 = obtenerClaveStorageNomina("4to Primaria", "A");
  assert.equal(clave1, "pm_nomina_estudiantes_4to_primaria_a");

  const clave2 = obtenerClaveStorageNomina("1ro Secundaria", "B");
  assert.equal(clave2, "pm_nomina_estudiantes_1ro_secundaria_b");
});

test("Registro Calificaciones MINERD - 2. Extracción de Indicadores de Logro", () => {
  const planConInd = {
    datosPlanificacion: {
      indicadores_logro: [
        "Comprende textos expositivos identificando la idea principal.",
        "Produce oraciones compuestas utilizando conectores lógicos."
      ]
    }
  };
  const inds = extraerIndicadoresRegistro(planConInd);
  assert.equal(inds.length, 2);
  assert.equal(inds[0].codigo, "Ind. 1");
  assert.ok(inds[0].descripcion.includes("textos expositivos"));

  // Respaldo canónico ante objeto vacío
  const indsVacio = extraerIndicadoresRegistro({});
  assert.ok(indsVacio.length >= 3);
  assert.ok(indsVacio[0].descripcion.includes("conceptos fundamentales"));
});

test("Registro Calificaciones MINERD - 3. Planilla de Calificaciones Primaria (L/P/I)", () => {
  const planPrimaria = {
    grado: "3ro Primaria",
    seccion: "B",
    area: "Ciencias de la Naturaleza",
    datosPlanificacion: {
      indicadores_logro: ["Distingue seres vivos de la materia inerte.", "Describe ecosistemas dominicanos."]
    }
  };

  const resultado = estructurarPlanillaCalificaciones(planPrimaria);
  assert.equal(resultado.indicadores.length, 2);
  assert.equal(resultado.totalEstudiantes, 25);
  assert.equal(resultado.esSecundaria, false);

  const primeraFila = resultado.filas[0];
  assert.equal(primeraFila.numero, 1);
  assert.ok(["L", "P", "I"].includes(primeraFila.valoresIndicadores["ind_1"]));
  assert.ok(["Logrado", "En Proceso", "Iniciado"].includes(primeraFila.condicion));
});

test("Registro Calificaciones MINERD - 4. Planilla de Calificaciones Secundaria (Numérica 0-100)", () => {
  const planSecundaria = {
    grado: "5to Secundaria",
    seccion: "A",
    area: "Matemáticas",
    datosPlanificacion: {
      indicadores_logro: ["Resuelve ecuaciones de segundo grado.", "Aplica funciones trigonométricas."]
    }
  };

  const resultado = estructurarPlanillaCalificaciones(planSecundaria);
  assert.equal(resultado.esSecundaria, true);
  const primeraFila = resultado.filas[0];
  const nota1 = primeraFila.valoresIndicadores["ind_1"];
  assert.equal(typeof nota1, "number");
  assert.ok(nota1 >= 60 && nota1 <= 100);
  assert.equal(typeof primeraFila.calificacionFinal, "number");
  assert.ok(["Aprobado", "Recuperación"].includes(primeraFila.condicion));
});

test("Registro Calificaciones MINERD - 5. Matriz de Asistencia Mensual (20 Días)", () => {
  const resultado = estructurarPlanillaAsistencia(null, 20);
  assert.equal(resultado.totalDias, 20);
  assert.equal(resultado.dias.length, 20);
  assert.equal(resultado.filas.length, 25);

  const primeraFila = resultado.filas[0];
  assert.ok(primeraFila.presentes >= 0);
  assert.ok(primeraFila.porcentajeAsistencia >= 0 && primeraFila.porcentajeAsistencia <= 100);
  assert.equal(typeof primeraFila.alertaDesercion, "boolean");
});

test("Registro Calificaciones MINERD - 6. Generación de XML SpreadsheetML de Microsoft Excel", () => {
  const plan = {
    titulo: "La Célula y sus Funciones",
    grado: "5to Primaria",
    seccion: "C",
    area: "Ciencias de la Naturaleza",
    escuela: "Escuela Primaria República Dominicana",
    codigoMinerd: "010203",
    datosPlanificacion: {
      indicadores_logro: ["Identifica los organelos celulares.", "Explica la fotosíntesis y respiración celular."]
    }
  };

  const perfil = {
    nombre: "Prof. Alberto Duarte",
    escuela: "Escuela Primaria República Dominicana"
  };

  const xml = generarXmlRegistroExcel(plan, perfil);
  assert.ok(typeof xml === "string");
  assert.ok(xml.includes('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(xml.includes('<?mso-application progid="Excel.Sheet"?>'));
  assert.ok(xml.includes('<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"'));

  // Ambas hojas deben estar presentes
  assert.ok(xml.includes('<Worksheet ss:Name="Registro de Calificaciones">'));
  assert.ok(xml.includes('<Worksheet ss:Name="Control de Asistencia">'));

  // Metadatos oficiales del MINERD
  assert.ok(xml.includes("MINISTERIO DE EDUCACIÓN DE LA REPÚBLICA DOMINICANA (MINERD)"));
  assert.ok(xml.includes("ORDENANZA 04-2023"));
  assert.ok(xml.includes("Escuela Primaria República Dominicana"));
  assert.ok(xml.includes("Prof. Alberto Duarte"));
  assert.ok(xml.includes("5to Primaria"));

  // Estilos y leyendas oficiales
  assert.ok(xml.includes("P = Presente | A = Ausente Injustificado"));
  assert.ok(xml.includes("L = Logrado (80-100 pts)"));
});

test("Registro Calificaciones MINERD - 7. Verificación de Contratos UI y Exportaciones", () => {
  const cwd = process.cwd();
  const root = cwd.endsWith("planifica-maestro") ? cwd : path.join(cwd, "planifica-maestro");

  // api.js exporta exportarRegistroExcel
  const apiCode = fs.readFileSync(path.join(root, "client/src/api.js"), "utf-8");
  assert.ok(apiCode.includes("export async function exportarRegistroExcel"));

  // PlanResult.jsx recibe onAbrirRegistro y tiene botón
  const planResultCode = fs.readFileSync(path.join(root, "client/src/components/PlanResult.jsx"), "utf-8");
  assert.ok(planResultCode.includes("onAbrirRegistro"));
  assert.ok(planResultCode.includes("📊 Registro y Asistencia"));

  // MisPlanificaciones.jsx recibe onAbrirRegistro y tiene botón
  const misPlanesCode = fs.readFileSync(path.join(root, "client/src/components/MisPlanificaciones.jsx"), "utf-8");
  assert.ok(misPlanesCode.includes("onAbrirRegistro"));
  assert.ok(misPlanesCode.includes("btn-registro"));

  // App.jsx importa RegistroCalificacionesModal con lazy loading
  const appCode = fs.readFileSync(path.join(root, "client/src/App.jsx"), "utf-8");
  assert.ok(appCode.includes('import("./components/RegistroCalificacionesModal.jsx")'));
  assert.ok(appCode.includes("registroModalPlan"));
  assert.ok(appCode.includes("<RegistroCalificacionesModal"));
});
