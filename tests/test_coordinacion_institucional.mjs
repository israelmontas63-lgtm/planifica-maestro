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

// ─────────────────────────────────────────────────────────────
// 4. INSIGNIAS VISUALES, DUA Y ALERTAS SLA PEDAGÓGICO
// ─────────────────────────────────────────────────────────────
test("FASE 12 - 4. Insignias Visuales de Retroalimentación y Alertas SLA en Tarjetas", async (t) => {
  await t.test("Detección de contenido DUA en revisiones o datos de planificación", () => {
    const planConDuaEnRevision = {
      id: "p_dua_1",
      ultimaRevision: {
        bloques_observados: { dua: "Apoyos multisensoriales" }
      }
    };
    const planConDuaEnDatos = {
      id: "p_dua_2",
      datosPlanificacion: {
        dua: "Textos en lectura fácil"
      }
    };
    const planSinDua = {
      id: "p_sin_dua",
      datosPlanificacion: {}
    };

    const tieneDua1 = Boolean(
      planConDuaEnRevision.ultimaRevision?.bloques_observados?.dua ||
      planConDuaEnRevision.datosPlanificacion?.dua
    );
    const tieneDua2 = Boolean(
      planConDuaEnDatos.ultimaRevision?.bloques_observados?.dua ||
      planConDuaEnDatos.datosPlanificacion?.dua
    );
    const tieneDua3 = Boolean(
      planSinDua.ultimaRevision?.bloques_observados?.dua ||
      planSinDua.datosPlanificacion?.dua
    );

    assert.equal(tieneDua1, true, "Debe detectar DUA en ultimaRevision");
    assert.equal(tieneDua2, true, "Debe detectar DUA en datosPlanificacion");
    assert.equal(tieneDua3, false, "No debe marcar DUA si no existe");
  });

  await t.test("Cálculo de SLA pedagógico para planes en espera de revisión", () => {
    const ahora = Date.now();
    const hace4Dias = new Date(ahora - 4 * 24 * 60 * 60 * 1000).toISOString();
    const hace1Dia = new Date(ahora - 1 * 24 * 60 * 60 * 1000).toISOString();
    const hoy = new Date(ahora).toISOString();

    function calcularAlerta(fechaIso) {
      const dias = Math.floor((ahora - new Date(fechaIso).getTime()) / (1000 * 60 * 60 * 24));
      if (dias >= 3) return { tipo: "critico", texto: `⚡ En espera (> ${dias} días)` };
      if (dias > 0) return { tipo: "reciente", texto: `⏱️ Enviado hace ${dias}d` };
      return { tipo: "hoy", texto: "⏱️ Enviado hoy" };
    }

    const alerta4 = calcularAlerta(hace4Dias);
    const alerta1 = calcularAlerta(hace1Dia);
    const alerta0 = calcularAlerta(hoy);

    assert.equal(alerta4.tipo, "critico");
    assert.ok(alerta4.texto.includes("> 4 días") || alerta4.texto.includes("> 3 días"));
    assert.equal(alerta1.tipo, "reciente");
    assert.equal(alerta0.tipo, "hoy");
  });

  await t.test("PanelCoordinacionModal.jsx contiene insignias DUA, alertas SLA y snippets de notas", () => {
    const modalPath = path.join(rootDir, "client/src/components/PanelCoordinacionModal.jsx");
    const contenido = fs.readFileSync(modalPath, "utf-8");

    assert.ok(contenido.includes("DUA / Inclusiva"), "Debe tener micro-insignia DUA / Inclusiva");
    assert.ok(contenido.includes("alertaAntiguedad"), "Debe calcular alertaAntiguedad para planes en espera");
    assert.ok(contenido.includes("observacionSnippet"), "Debe extraer observacionSnippet para planes observados");
    assert.ok(contenido.includes("duaSnippet"), "Debe extraer duaSnippet");
  });
});

// ─────────────────────────────────────────────────────────────
// 5. PLANTILLAS DE SUGERENCIAS RÁPIDAS MINERD PARA DICTAMEN
// ─────────────────────────────────────────────────────────────
test("FASE 12 - 5. Plantillas de Sugerencias Rápidas para Dictamen del Coordinador", async (t) => {
  function insertarTexto(prev, nuevo) {
    const limpia = prev ? prev.trim() : "";
    if (!limpia) return nuevo;
    if (limpia.includes(nuevo)) return limpia;
    return `${limpia} ${nuevo}`;
  }

  await t.test("Inserta la sugerencia en campo vacío", () => {
    const resultado = insertarTexto("", "Fortalecer saberes previos.");
    assert.equal(resultado, "Fortalecer saberes previos.");
  });

  await t.test("Concatena sin duplicar cuando el texto ya fue añadido", () => {
    const primero = insertarTexto("", "Fortalecer saberes previos.");
    const duplicado = insertarTexto(primero, "Fortalecer saberes previos.");
    assert.equal(duplicado, "Fortalecer saberes previos.", "No debe duplicar texto idéntico");

    const conSegundo = insertarTexto(primero, "Incluir rúbricas.");
    assert.equal(conSegundo, "Fortalecer saberes previos. Incluir rúbricas.");
  });

  await t.test("PanelCoordinacionModal.jsx declara las plantillas MINERD y botones de un clic", () => {
    const modalPath = path.join(rootDir, "client/src/components/PanelCoordinacionModal.jsx");
    const contenido = fs.readFileSync(modalPath, "utf-8");

    assert.ok(contenido.includes("SUGERENCIAS_COMENTARIOS_MINERD"), "Debe definir SUGERENCIAS_COMENTARIOS_MINERD");
    assert.ok(contenido.includes("SUGERENCIAS_DUA_MINERD"), "Debe definir SUGERENCIAS_DUA_MINERD");
    assert.ok(contenido.includes("handleInsertarComentario"), "Debe tener handleInsertarComentario");
    assert.ok(contenido.includes("handleInsertarDua"), "Debe tener handleInsertarDua");
    assert.ok(contenido.includes("Saberes Previos"), "Debe incluir plantilla de Saberes Previos");
    assert.ok(contenido.includes("Secuencia CON BASE"), "Debe incluir plantilla CON BASE");
    assert.ok(contenido.includes("Apoyos Visuales"), "Debe incluir plantilla DUA de Apoyos Visuales");
  });
});

// ─────────────────────────────────────────────────────────────
// 6. NOTIFICACIONES REACTIVAS DE DICTAMEN PEDAGÓGICO PARA EL DOCENTE
// ─────────────────────────────────────────────────────────────
test("FASE 12 - 6. Notificaciones Reactivas de Dictamen Pedagógico para el Docente", async (t) => {
  const globalMock = new MockLocalStorage();
  global.localStorage = globalMock;

  const {
    guardarRevisionPedagogica,
    obtenerNotificacionesDocente,
    marcarNotificacionLeida,
    marcarTodasNotificacionesLeidas,
    obtenerConteoNotificacionesNoLeidas
  } = await import("../client/src/services/coordinacionService.js");

  const {
    guardarPlanEnBiblioteca,
    obtenerTodasLasPlanificaciones
  } = await import("../client/src/services/bibliotecaStorage.js");

  const testDocenteId = "docente_ramon_456";

  // 1. Crear un plan en la biblioteca del docente
  guardarPlanEnBiblioteca({
    id: "plan_notif_001",
    titulo: "La Célula y su Estructura",
    area: "Ciencias de la Naturaleza",
    grado: "5to Primaria"
  }, testDocenteId);

  await t.test("Inicialmente el docente no tiene dictámenes ni notificaciones", () => {
    const notifs = obtenerNotificacionesDocente({ userId: testDocenteId });
    const count = obtenerConteoNotificacionesNoLeidas({ userId: testDocenteId });
    assert.equal(notifs.length, 0, "No debe haber notificaciones sin revisiones emitidas");
    assert.equal(count, 0, "El conteo de no leídas debe ser 0");
  });

  await t.test("Al emitir dictamen, se sincroniza con la biblioteca y genera notificación no leída", async () => {
    const res = await guardarRevisionPedagogica({
      planificacionId: "plan_notif_001",
      coordinadorId: "coord_pedagogica_01",
      coordinadorNombre: "Coordinadora Carmen",
      estadoRevision: "aprobada",
      comentariosGenerales: "Excelente secuencia con base e integración curricular.",
      bloquesObservados: { dua: "Añadir material concreto para apoyos táctiles." }
    });

    assert.ok(res.revision, "Debe generar objeto de revisión");

    // Verificar sincronización automática en la biblioteca del docente
    const planesDoc = obtenerTodasLasPlanificaciones(testDocenteId);
    const planActualizado = planesDoc.find(p => p.id === "plan_notif_001");
    assert.ok(planActualizado, "El plan debe persistir en la biblioteca");
    assert.equal(planActualizado.estado, "aprobada", "El estado del plan docente debe actualizarse a 'aprobada'");
    assert.ok(planActualizado.ultimaRevision, "Debe contener ultimaRevision en el plan local");

    // Verificar notificación generada
    const notifs = obtenerNotificacionesDocente({ userId: testDocenteId });
    assert.equal(notifs.length, 1, "Debe existir exactamente 1 notificación");
    assert.equal(notifs[0].planId, "plan_notif_001");
    assert.equal(notifs[0].estadoRevision, "aprobada");
    assert.equal(notifs[0].coordinadorNombre, "Coordinadora Carmen");
    assert.equal(notifs[0].leida, false, "La notificación debe iniciar como no leída");
    assert.equal(notifs[0].bloquesObservados.dua, "Añadir material concreto para apoyos táctiles.");

    const count = obtenerConteoNotificacionesNoLeidas({ userId: testDocenteId });
    assert.equal(count, 1, "El contador de notificaciones no leídas debe ser 1");
  });

  await t.test("Marcar notificación individual como leída actualiza el conteo", () => {
    const notifs = obtenerNotificacionesDocente({ userId: testDocenteId });
    assert.equal(notifs.length, 1);
    
    marcarNotificacionLeida(notifs[0].id, testDocenteId);

    const notifsDespues = obtenerNotificacionesDocente({ userId: testDocenteId });
    assert.equal(notifsDespues[0].leida, true, "La notificación debe figurar como leída");

    const count = obtenerConteoNotificacionesNoLeidas({ userId: testDocenteId });
    assert.equal(count, 0, "El conteo de no leídas debe ser 0 tras marcar como leída");
  });

  await t.test("Marcar todas como leídas procesa múltiples dictámenes pendientes", async () => {
    // Añadir un segundo plan y revisión
    guardarPlanEnBiblioteca({
      id: "plan_notif_002",
      titulo: "Fracciones y Números Decimales",
      area: "Matemática",
      grado: "4to Primaria"
    }, testDocenteId);

    await guardarRevisionPedagogica({
      planificacionId: "plan_notif_002",
      coordinadorId: "coord_pedagogica_01",
      coordinadorNombre: "Coordinadora Carmen",
      estadoRevision: "requiere_ajustes",
      comentariosGenerales: "Ajustar el tiempo de la actividad de cierre."
    });

    const countAntes = obtenerConteoNotificacionesNoLeidas({ userId: testDocenteId });
    assert.equal(countAntes, 1, "Debe haber 1 notificación pendiente (la segunda)");

    marcarTodasNotificacionesLeidas(testDocenteId);

    const countDespues = obtenerConteoNotificacionesNoLeidas({ userId: testDocenteId });
    assert.equal(countDespues, 0, "Todas las notificaciones deben quedar leídas");
  });

  await t.test("NotificacionesModal.jsx, Header.jsx y MisPlanificaciones.jsx cumplen el contrato reactivo", () => {
    const notifModalPath = path.join(rootDir, "client/src/components/NotificacionesModal.jsx");
    const notifModalContent = fs.readFileSync(notifModalPath, "utf-8");
    assert.ok(notifModalContent.includes("Dictámenes de Supervisión"), "Modal debe tener sección de dictámenes de supervisión");
    assert.ok(notifModalContent.includes("obtenerNotificacionesDocente"), "Modal debe importar y usar obtenerNotificacionesDocente");
    assert.ok(notifModalContent.includes("marcarNotificacionLeida"), "Modal debe usar marcarNotificacionLeida");
    assert.ok(notifModalContent.includes("onAbrirPlanConRevision"), "Modal debe invocar onAbrirPlanConRevision");

    const headerPath = path.join(rootDir, "client/src/components/Header.jsx");
    const headerContent = fs.readFileSync(headerPath, "utf-8");
    assert.ok(headerContent.includes("contadorNotificaciones"), "Header debe recibir contadorNotificaciones");
    assert.ok(headerContent.includes("pm-notif-badge"), "Header debe renderizar pm-notif-badge");

    const misPlanesPath = path.join(rootDir, "client/src/components/MisPlanificaciones.jsx");
    const misPlanesContent = fs.readFileSync(misPlanesPath, "utf-8");
    assert.ok(misPlanesContent.includes("planInicialId"), "MisPlanificaciones debe aceptar prop planInicialId");
  });
});

// ─────────────────────────────────────────────────────────────
// 7. CICLO CIRCULAR DE REENVÍO CON AJUSTES Y NOTA DEL DOCENTE
// ─────────────────────────────────────────────────────────────
test("FASE 12 - 7. Ciclo Circular de Reenvío con Ajustes y Nota de Entrega", async (t) => {
  const globalMock = new MockLocalStorage();
  global.localStorage = globalMock;

  const {
    enviarPlanACoordinacion,
    guardarRevisionPedagogica,
    obtenerPlanificacionesParaSupervision
  } = await import("../client/src/services/coordinacionService.js");

  const {
    guardarPlanEnBiblioteca,
    obtenerTodasLasPlanificaciones,
    actualizarEstadoPlanEnBiblioteca
  } = await import("../client/src/services/bibliotecaStorage.js");

  const testDocenteId = "docente_lucia_789";

  // 1. Docente crea un plan inicial (Borrador)
  const planInicial = guardarPlanEnBiblioteca({
    id: "plan_ciclo_001",
    titulo: "El Cuento y la Narración Estructurada",
    area: "Lengua Española",
    grado: "3ro Primaria"
  }, testDocenteId);

  await t.test("Envío inicial a coordinación establece ciclo 1 sin nota", async () => {
    const enviado = await enviarPlanACoordinacion({
      plan: planInicial,
      userId: testDocenteId,
      docenteNombre: "Profe Lucía"
    });

    assert.equal(enviado.estado, "enviada_revision");
    assert.equal(enviado.ciclo_revision, 1, "El ciclo inicial debe ser 1");
    assert.equal(enviado.notaDocente, "", "No debe haber nota de ajustes en primer envío");

    actualizarEstadoPlanEnBiblioteca(planInicial.id, "enviada_revision", null, testDocenteId, {
      ciclo_revision: enviado.ciclo_revision
    });
  });

  await t.test("Coordinador dictamina 'requiere_ajustes' pasando el plan a 'observada'", async () => {
    const res = await guardarRevisionPedagogica({
      planificacionId: "plan_ciclo_001",
      coordinadorId: "coord_01",
      coordinadorNombre: "Coordinador Marcos",
      estadoRevision: "requiere_ajustes",
      comentariosGenerales: "Ajustar las actividades del momento de Cierre para incluir metacognición.",
      bloquesObservados: { dua: "Añadir tarjetas ilustradas para estudiantes no alfabetizados." }
    });

    assert.equal(res.nuevoEstadoPlan, "observada");

    // Verificar en la biblioteca del docente
    const planesDoc = obtenerTodasLasPlanificaciones(testDocenteId);
    const planObs = planesDoc.find(p => p.id === "plan_ciclo_001");
    assert.equal(planObs.estado, "observada");
    assert.ok(planObs.ultimaRevision);
  });

  await t.test("Reenvío con ajustes incrementa automáticamente ciclo a 2 y persiste notaDocente", async () => {
    const planesDoc = obtenerTodasLasPlanificaciones(testDocenteId);
    const planObs = planesDoc.find(p => p.id === "plan_ciclo_001");

    const reenviado = await enviarPlanACoordinacion({
      plan: planObs,
      userId: testDocenteId,
      docenteNombre: "Profe Lucía",
      notaDocente: "Se agregaron preguntas metacognitivas en el Cierre y tarjetas visuales DUA."
    });

    assert.equal(reenviado.estado, "enviada_revision", "El estado debe volver a enviada_revision");
    assert.equal(reenviado.ciclo_revision, 2, "El ciclo debe incrementarse a 2");
    assert.equal(
      reenviado.notaDocente,
      "Se agregaron preguntas metacognitivas en el Cierre y tarjetas visuales DUA.",
      "Debe conservar la nota de ajustes del docente"
    );

    // Verificar visibilidad en el pool de supervisión
    const planesSupervision = await obtenerPlanificacionesParaSupervision({
      userId: "coord_01",
      rol: "coordinador_area"
    });
    const enSupervision = planesSupervision.find(p => p.id === "plan_ciclo_001");
    assert.ok(enSupervision);
    assert.equal(enSupervision.ciclo_revision, 2);
    assert.equal(enSupervision.notaDocente, "Se agregaron preguntas metacognitivas en el Cierre y tarjetas visuales DUA.");
  });

  await t.test("Segunda revisión del coordinador aprueba el ciclo 2 con historial completo", async () => {
    const resSegunda = await guardarRevisionPedagogica({
      planificacionId: "plan_ciclo_001",
      coordinadorId: "coord_01",
      coordinadorNombre: "Coordinador Marcos",
      estadoRevision: "aprobada",
      comentariosGenerales: "Ajustes incorporados satisfactoriamente. Secuencia didáctica aprobada."
    });

    assert.equal(resSegunda.nuevoEstadoPlan, "aprobada");

    const planesDoc = obtenerTodasLasPlanificaciones(testDocenteId);
    const planFinal = planesDoc.find(p => p.id === "plan_ciclo_001");
    assert.equal(planFinal.estado, "aprobada");
    assert.ok(planFinal.revisiones.length >= 2, "Debe preservar el historial completo de dictámenes");
    assert.equal(planFinal.revisiones[0].estado_revision, "aprobada");
    assert.equal(planFinal.revisiones[1].estado_revision, "requiere_ajustes");
  });

  await t.test("Componentes UI declaran soporte para notas de entrega, ciclo e historial", () => {
    const misPlanesPath = path.join(rootDir, "client/src/components/MisPlanificaciones.jsx");
    const misPlanesContent = fs.readFileSync(misPlanesPath, "utf-8");
    assert.ok(misPlanesContent.includes("Reenviar con Ajustes"), "MisPlanificaciones debe tener botón Reenviar con Ajustes");
    assert.ok(misPlanesContent.includes("Nota de Entrega del Docente"), "MisPlanificaciones debe mostrar nota del docente");
    assert.ok(misPlanesContent.includes("Historial de Supervisión"), "MisPlanificaciones debe tener Historial de Supervisión");
    assert.ok(misPlanesContent.includes("Ciclo"), "MisPlanificaciones debe mostrar insignia de Ciclo");

    const coordModalPath = path.join(rootDir, "client/src/components/PanelCoordinacionModal.jsx");
    const coordModalContent = fs.readFileSync(coordModalPath, "utf-8");
    assert.ok(coordModalContent.includes("Nota de Ajustes del Docente"), "PanelCoordinacionModal debe mostrar nota del docente");
    assert.ok(coordModalContent.includes("Reenvío"), "PanelCoordinacionModal debe mostrar insignia de reenvío");
  });
});



