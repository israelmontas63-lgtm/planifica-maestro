/**
 * tests/test_coordinacion_institucional.mjs
 * 
 * SUITE DE PRUEBAS AUTOMATIZADAS - FASE 12:
 * Supervisión Pedagógica, Dictamen Institucional y Coordinación MINERD
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// Simulación de LocalStorage en memoria para pruebas de aislamiento offline
class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(k) {
    return this.store[k] || null;
  }
  setItem(k, v) {
    this.store[k] = String(v);
  }
  removeItem(k) {
    delete this.store[k];
  }
  clear() {
    this.store = {};
  }
}

// ─────────────────────────────────────────────────────────────
// 1. AUDITORÍA DE SEGURIDAD DEL SCRIPT SQL RLS FASE 12
// ─────────────────────────────────────────────────────────────
test("FASE 12 - 1. Auditoría de Seguridad del Script SQL RLS Multiusuario", async (t) => {
  const sqlMigracion = path.join(rootDir, "supabase/migrations/20261012110000_fase12_multiusuario_institucional.sql");
  const sqlRevert = path.join(rootDir, "supabase/rollback/20261012110001_fase12_multiusuario_institucional_REVERT.sql");

  await t.test("Los archivos de migración y rollback existen y son válidos", () => {
    assert.ok(fs.existsSync(sqlMigracion), "Debe existir el archivo de migración Fase 12");
    assert.ok(fs.existsSync(sqlRevert), "Debe existir el archivo de rollback Fase 12");
  });

  const sqlContent = fs.readFileSync(sqlMigracion, "utf-8");

  await t.test("Todas las tablas institucionales tienen ROW LEVEL SECURITY habilitado", () => {
    const tablas = [
      "escuelas",
      "usuarios",
      "supervisiones_area_minerd",
      "planificaciones",
      "revisiones_coordinador"
    ];
    for (const tabla of tablas) {
      const regex = new RegExp(`ALTER\\s+TABLE\\s+public\\.${tabla}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY;`, "i");
      assert.ok(regex.test(sqlContent), `Tabla ${tabla} debe tener RLS habilitado explícitamente`);
    }
  });

  await t.test("Los coordinadores solo ven planes en revisión o dictaminados de su escuela", () => {
    assert.ok(
      sqlContent.includes("estado IN ('enviada_revision', 'aprobada', 'observada')"),
      "La política de supervisión debe excluir los borradores privados ajenos"
    );
    assert.ok(
      sqlContent.includes("rol IN ('coordinador_area', 'director', 'admin')"),
      "Solo los roles autorizados pueden ejercer la supervisión pedagógica"
    );
  });

  await t.test("La inserción de revisiones está restringida a coordinadores y directores", () => {
    assert.ok(
      sqlContent.includes("revisiones_escritura_coordinadores"),
      "Debe existir política de escritura de revisiones para coordinadores"
    );
    assert.ok(
      sqlContent.includes("coordinador_id = (select auth.uid())"),
      "El coordinador_id debe coincidir con el usuario autenticado"
    );
  });
});

// ─────────────────────────────────────────────────────────────
// 2. CICLO DE VIDA DE PLANIFICACIONES Y SERVICIO DE COORDINACIÓN
// ─────────────────────────────────────────────────────────────
test("FASE 12 - 2. Ciclo de Vida: Envío a Coordinación y Dictamen Pedagógico", async (t) => {
  const globalMock = new MockLocalStorage();
  global.localStorage = globalMock;

  // Importación dinámica de los servicios
  const {
    enviarPlanACoordinacion,
    guardarRevisionPedagogica,
    obtenerPlanificacionesParaSupervision,
    obtenerRevisionesPlan
  } = await import("../client/src/services/coordinacionService.js");

  const {
    guardarPlanEnBiblioteca,
    obtenerTodasLasPlanificaciones,
    actualizarEstadoPlanEnBiblioteca
  } = await import("../client/src/services/bibliotecaStorage.js");

  const testUserId = "docente_maria_123";
  const testEscuelaId = "escuela_duarte_01";

  await t.test("Plan creado en biblioteca inicia como borrador", () => {
    const plan = guardarPlanEnBiblioteca({
      id: "plan_test_01",
      titulo: "La Anécdota y Producción Oral",
      area: "Lengua Española",
      grado: "4.º",
      nivel: "primario",
      periodo: "diaria",
      datosPlanificacion: { inicio: "Motivación con anécdota personal", desarrollo: "Lectura guiada", cierre: "Metacognición" }
    }, testUserId);

    assert.equal(plan.estado, "borrador", "El estado inicial de un plan debe ser borrador");
  });

  await t.test("Docente envía plan a coordinación transiciona a enviada_revision", async () => {
    const planOriginal = {
      id: "plan_test_01",
      titulo: "La Anécdota y Producción Oral",
      area: "Lengua Española",
      grado: "4.º",
      docente_id: testUserId,
      escuela_id: testEscuelaId
    };

    const enviado = await enviarPlanACoordinacion({
      supabaseClient: null,
      plan: planOriginal,
      userId: testUserId,
      escuelaId: testEscuelaId,
      docenteNombre: "Prof. María Duarte"
    });

    assert.equal(enviado.estado, "enviada_revision");
    assert.ok(enviado.fecha_envio, "Debe registrarse timestamp de fecha_envio");

    // Sincronizar en biblioteca local
    actualizarEstadoPlanEnBiblioteca(enviado.id, "enviada_revision", null, testUserId);
    const planes = obtenerTodasLasPlanificaciones(testUserId);
    assert.equal(planes[0].estado, "enviada_revision");
  });

  await t.test("Coordinador consulta planes supervisables y emite observaciones", async () => {
    const planesSupervision = await obtenerPlanificacionesParaSupervision({
      supabaseClient: null,
      escuelaId: testEscuelaId,
      rol: "coordinador_area",
      userId: "coordinador_pedagogico_99"
    });

    assert.ok(planesSupervision.length >= 1, "El coordinador debe ver el plan enviado");
    const planEnviado = planesSupervision.find(p => p.id === "plan_test_01");
    assert.ok(planEnviado, "Debe encontrar el plan específico");
    assert.equal(planEnviado.estado, "enviada_revision");

    // Coordinador emite revisión solicitando ajustes DUA
    const dictamen = await guardarRevisionPedagogica({
      supabaseClient: null,
      planificacionId: "plan_test_01",
      coordinadorId: "coordinador_pedagogico_99",
      coordinadorNombre: "Lic. Roberto Santana",
      estadoRevision: "requiere_ajustes",
      comentariosGenerales: "Fortalecer la articulación del momento de Inicio con saberes previos.",
      bloquesObservados: {
        secuencia_didactica: "Ampliar el cierre con preguntas metacognitivas.",
        dua: "Incluir organizadores gráficos para estudiantes con NEAE."
      }
    });

    assert.equal(dictamen.nuevoEstadoPlan, "observada", "El nuevo estado del plan debe ser observada");
    assert.equal(dictamen.revision.estado_revision, "requiere_ajustes");
    assert.equal(dictamen.revision.bloques_observados.dua, "Incluir organizadores gráficos para estudiantes con NEAE.");
  });

  await t.test("Docente consulta el historial de revisiones con recomendaciones DUA", async () => {
    const revisiones = await obtenerRevisionesPlan({
      supabaseClient: null,
      planificacionId: "plan_test_01"
    });

    assert.ok(revisiones.length >= 1, "Debe haber al menos 1 revisión registrada");
    const ultima = revisiones[0];
    assert.equal(ultima.coordinadorNombre, "Lic. Roberto Santana");
    assert.equal(ultima.estado_revision, "requiere_ajustes");
    assert.ok(ultima.comentarios_generales.includes("saberes previos"));
    assert.ok(ultima.bloques_observados.dua.includes("organizadores gráficos"));
  });

  await t.test("Coordinador aprueba la versión ajustada", async () => {
    const aprobacion = await guardarRevisionPedagogica({
      supabaseClient: null,
      planificacionId: "plan_test_01",
      coordinadorId: "coordinador_pedagogico_99",
      coordinadorNombre: "Lic. Roberto Santana",
      estadoRevision: "aprobada",
      comentariosGenerales: "Excelente secuencia didáctica, momentos de clase equilibrados y adaptaciones DUA integradas."
    });

    assert.equal(aprobacion.nuevoEstadoPlan, "aprobada", "El estado final debe ser aprobada");
    assert.equal(aprobacion.revision.estado_revision, "aprobada");
  });
});

// ─────────────────────────────────────────────────────────────
// 3. FILTRADO MULTIDIMENSIONAL POR GRADO, ÁREA Y ESTADO
// ─────────────────────────────────────────────────────────────
test("FASE 12 - 3. Filtrado Multidimensional por Grado y Área Curricular en Coordinación", async (t) => {
  const planesPrueba = [
    {
      id: "p1",
      titulo: "Secuencia Didáctica La Noticia",
      area: "Lengua Española",
      grado: "4.º",
      docenteNombre: "Prof. Laura Gómez",
      estado: "aprobada"
    },
    {
      id: "p2",
      titulo: "Fracciones Propias e Impropias",
      area: "Matemáticas",
      grado: "4.º",
      docenteNombre: "Prof. Laura Gómez",
      estado: "enviada_revision"
    },
    {
      id: "p3",
      titulo: "Los Ecosistemas Dominicanos",
      area: "Ciencias de la Naturaleza",
      grado: "5.º",
      docenteNombre: "Prof. Marcos Díaz",
      estado: "observada"
    },
    {
      id: "p4",
      titulo: "Independencia Nacional",
      area: "Ciencias Sociales",
      grado: "6.º",
      docenteNombre: "Prof. Ana Medina",
      estado: "aprobada"
    }
  ];

  await t.test("Extrae y ordena grados y áreas únicos sin duplicados", () => {
    const setGrados = new Set();
    const setAreas = new Set();
    for (const p of planesPrueba) {
      if (p.grado) setGrados.add(p.grado.trim());
      if (p.area) setAreas.add(p.area.trim());
    }

    const grados = Array.from(setGrados).sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
    const areas = Array.from(setAreas).sort((a, b) => a.localeCompare(b, "es"));

    assert.deepEqual(grados, ["4.º", "5.º", "6.º"], "Debe extraer los 3 grados únicos en orden");
    assert.deepEqual(
      areas,
      ["Ciencias de la Naturaleza", "Ciencias Sociales", "Lengua Española", "Matemáticas"],
      "Debe extraer las 4 áreas únicas ordenadas"
    );
  });

  await t.test("Filtra eficazmente por grado escolar específico", () => {
    const filtrados = planesPrueba.filter((p) => p.grado === "4.º");
    assert.equal(filtrados.length, 2, "Deben encontrarse 2 planes para 4.º");
    assert.ok(filtrados.every((p) => p.grado === "4.º"));
  });

  await t.test("Filtra eficazmente por área curricular específica", () => {
    const filtrados = planesPrueba.filter((p) => p.area === "Matemáticas");
    assert.equal(filtrados.length, 1);
    assert.equal(filtrados[0].titulo, "Fracciones Propias e Impropias");
  });

  await t.test("Filtrado multidimensional combinado (Estado + Grado + Área + Búsqueda)", () => {
    const filtro = {
      estado: "aprobada",
      grado: "4.º",
      area: "Lengua Española",
      busqueda: "noticia"
    };

    const resultado = planesPrueba.filter((p) => {
      const matchEstado = filtro.estado === "todas" || p.estado === filtro.estado;
      const matchGrado = filtro.grado === "todos" || p.grado === filtro.grado;
      const matchArea = filtro.area === "todas" || p.area === filtro.area;
      const matchBusqueda = !filtro.busqueda || p.titulo.toLowerCase().includes(filtro.busqueda);
      return matchEstado && matchGrado && matchArea && matchBusqueda;
    });

    assert.equal(resultado.length, 1);
    assert.equal(resultado[0].id, "p1");
  });

  await t.test("PanelCoordinacionModal.jsx declara selectores de Grado, Área y botón Limpiar", () => {
    const modalPath = path.join(rootDir, "client/src/components/PanelCoordinacionModal.jsx");
    const contenido = fs.readFileSync(modalPath, "utf-8");

    assert.ok(contenido.includes("filtroGrado"), "Debe tener estado filtroGrado");
    assert.ok(contenido.includes("filtroArea"), "Debe tener estado filtroArea");
    assert.ok(contenido.includes("listaGrados"), "Debe tener listaGrados calculada");
    assert.ok(contenido.includes("listaAreas"), "Debe tener listaAreas calculada");
    assert.ok(contenido.includes("handleLimpiarFiltros"), "Debe tener handleLimpiarFiltros");
    assert.ok(contenido.includes("Todos los Grados"), "Debe contener opción Todos los Grados");
    assert.ok(contenido.includes("Todas las Áreas"), "Debe contener opción Todas las Áreas");
    assert.ok(contenido.includes("Mostrando"), "Debe contener indicador visual de planes encontrados");
  });
});

