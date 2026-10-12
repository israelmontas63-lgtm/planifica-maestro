import test from "node:test";
import assert from "node:assert/strict";
import {
  COMPETENCIAS_FUNDAMENTALES_MINERD,
  calcularAnaliticaInstitucional
} from "../client/src/services/analiticaCurricularService.js";

test("Analítica Curricular MINERD - Estructura canónica y constantes", () => {
  assert.equal(COMPETENCIAS_FUNDAMENTALES_MINERD.length, 7);
  const ids = COMPETENCIAS_FUNDAMENTALES_MINERD.map((c) => c.id);
  assert.ok(ids.includes("etica_ciudadana"));
  assert.ok(ids.includes("comunicativa"));
  assert.ok(ids.includes("pensamiento_logico"));
  assert.ok(ids.includes("resolucion_problemas"));
  assert.ok(ids.includes("cientifica_tecnologica"));
  assert.ok(ids.includes("ambiental_salud"));
  assert.ok(ids.includes("desarrollo_personal"));
});

test("calcularAnaliticaInstitucional - Manejo tolerante de lista vacía o nula", () => {
  const resVacio = calcularAnaliticaInstitucional([]);
  assert.equal(resVacio.total, 0);
  assert.equal(resVacio.tasaAprobacion, 0);
  assert.equal(resVacio.tasaDua, 0);
  assert.equal(resVacio.coberturaCompetencias.length, 7);
  assert.equal(resVacio.coberturaCompetencias[0].porcentaje, 0);
  assert.equal(resVacio.coberturaCompetencias[0].nivelTrabajo, "Sin datos");
  assert.equal(resVacio.alertasPedagogicas.length, 1);
  assert.equal(resVacio.alertasPedagogicas[0].tipo, "info");

  const resNull = calcularAnaliticaInstitucional(null);
  assert.equal(resNull.total, 0);
});

test("calcularAnaliticaInstitucional - Tasas de aprobación, observación y pendientes", () => {
  const planes = [
    { id: "1", estado: "aprobada", titulo: "Geometría básica", area: "Matemáticas", grado: "4to Primaria" },
    { id: "2", estado: "aprobada", titulo: "Fracciones", area: "Matemáticas", grado: "4to Primaria" },
    { id: "3", estado: "observada", titulo: "Ecosistemas", area: "Ciencias de la Naturaleza", grado: "5to Primaria" },
    { id: "4", estado: "enviada_revision", titulo: "La Célula", area: "Ciencias de la Naturaleza", grado: "5to Primaria" }
  ];

  const resultado = calcularAnaliticaInstitucional(planes);
  assert.equal(resultado.total, 4);
  assert.equal(resultado.tasaAprobacion, 50); // 2 de 4 = 50%
  assert.equal(resultado.tasaObservadas, 25); // 1 de 4 = 25%
  assert.equal(resultado.tasaPendientes, 25); // 1 de 4 = 25%
  assert.equal(resultado.conteoEstados.aprobadas, 2);
  assert.equal(resultado.conteoEstados.observadas, 1);
  assert.equal(resultado.conteoEstados.pendientes, 1);
});

test("calcularAnaliticaInstitucional - Detección de inclusión DUA y NEAE", () => {
  const planes = [
    { id: "1", estado: "aprobada", tiene_dua: true },
    { id: "2", estado: "aprobada", datosPlanificacion: { actividades_diferenciadas: "Apoyo visual para NEAE" } },
    { id: "3", estado: "observada", texto: "Se incluyen adaptaciones con actividades diferenciadas" },
    { id: "4", estado: "aprobada", texto: "Plan tradicional sin adaptaciones especificadas" }
  ];

  const res = calcularAnaliticaInstitucional(planes);
  assert.equal(res.tasaDua, 75); // 3 de 4 = 75%
  const alertaDua = res.alertasPedagogicas.find((a) => a.titulo.includes("DUA"));
  assert.ok(alertaDua);
  assert.equal(alertaDua.tipo, "exito");
});

test("calcularAnaliticaInstitucional - Alerta de fortalecimiento DUA si es menor al 40%", () => {
  const planes = [
    { id: "1", estado: "aprobada", tiene_dua: false },
    { id: "2", estado: "aprobada", tiene_dua: false },
    { id: "3", estado: "aprobada", tiene_dua: true },
    { id: "4", estado: "aprobada", tiene_dua: false }
  ];

  const res = calcularAnaliticaInstitucional(planes);
  assert.equal(res.tasaDua, 25); // 1 de 4 = 25%
  const alertaDua = res.alertasPedagogicas.find((a) => a.titulo.includes("DUA") || a.titulo.includes("inclusivo"));
  assert.ok(alertaDua);
  assert.equal(alertaDua.tipo, "atencion");
});

test("calcularAnaliticaInstitucional - Cobertura de las 7 Competencias Fundamentales", () => {
  const planes = [
    {
      id: "1",
      estado: "aprobada",
      titulo: "Ciudadanía y deberes democráticos",
      texto: "Reflexión ética sobre la convivencia y resolución de problemas cotidianos."
    },
    {
      id: "2",
      estado: "aprobada",
      titulo: "El informe de lectura",
      texto: "Competencia comunicativa y pensamiento lógico a través del análisis crítico de textos."
    },
    {
      id: "3",
      estado: "aprobada",
      titulo: "Tecnología y robótica escolar",
      texto: "Investigación científica y tecnológica para el cuidado ambiental y de la salud."
    }
  ];

  const res = calcularAnaliticaInstitucional(planes);
  const mapa = {};
  res.coberturaCompetencias.forEach((c) => {
    mapa[c.id] = c;
  });

  // Ética detectada en plan 1
  assert.ok(mapa.etica_ciudadana.conteo >= 1);
  // Comunicativa detectada en plan 2
  assert.ok(mapa.comunicativa.conteo >= 1);
  // Lógico detectado en plan 2
  assert.ok(mapa.pensamiento_logico.conteo >= 1);
  // Resolución detectado en plan 1
  assert.ok(mapa.resolucion_problemas.conteo >= 1);
  // Científica detectado en plan 3
  assert.ok(mapa.cientifica_tecnologica.conteo >= 1);
  // Ambiental detectado en plan 3
  assert.ok(mapa.ambiental_salud.conteo >= 1);

  // Niveles de trabajo asignados correctamente
  assert.ok(["Destacado", "Adecuado", "Bajo"].includes(mapa.comunicativa.nivelTrabajo));
});

test("calcularAnaliticaInstitucional - Detección de SLA de supervisión vencido (>3 días)", () => {
  const haceCuatroDias = new Date(Date.now() - 4 * 86400000).toISOString();
  const hoy = new Date().toISOString();

  const planes = [
    { id: "1", estado: "enviada_revision", fecha_envio: haceCuatroDias },
    { id: "2", estado: "enviada_revision", fecha_envio: hoy },
    { id: "3", estado: "aprobada", fecha_envio: haceCuatroDias } // ya aprobada, no cuenta para SLA pendiente
  ];

  const res = calcularAnaliticaInstitucional(planes);
  const alertaSla = res.alertasPedagogicas.find((a) => a.titulo.includes("supera") || a.titulo.includes("espera"));
  assert.ok(alertaSla);
  assert.equal(alertaSla.tipo, "advertencia");
  assert.ok(alertaSla.titulo.includes("1 planificación supera"));
});

test("calcularAnaliticaInstitucional - Desglose agrupado por Área Curricular y Grado", () => {
  const planes = [
    { id: "1", area: "Lengua Española", grado: "3ro Primaria", estado: "aprobada" },
    { id: "2", area: "Lengua Española", grado: "3ro Primaria", estado: "observada" },
    { id: "3", area: "Lengua Española", grado: "4to Primaria", estado: "aprobada" },
    { id: "4", area: "Matemáticas", grado: "3ro Primaria", estado: "enviada_revision" }
  ];

  const res = calcularAnaliticaInstitucional(planes);
  assert.equal(res.distribucionAreas.length, 2);
  // Lengua Española debe estar primera (3 planes)
  assert.equal(res.distribucionAreas[0].area, "Lengua Española");
  assert.equal(res.distribucionAreas[0].total, 3);
  assert.equal(res.distribucionAreas[0].aprobadas, 2);
  assert.equal(res.distribucionAreas[0].observadas, 1);

  // Grados
  assert.equal(res.distribucionGrados.length, 2);
  const g3 = res.distribucionGrados.find((g) => g.grado === "3ro Primaria");
  assert.ok(g3);
  assert.equal(g3.total, 3);
});
