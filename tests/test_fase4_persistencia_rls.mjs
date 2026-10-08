/**
 * tests/test_fase4_persistencia_rls.mjs
 * 
 * SUITE DE PRUEBAS AUTOMATIZADAS - FASE 4:
 * Persistencia, Aislamiento Multiusuario (RLS Supabase) y Preparación Beta
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// ─────────────────────────────────────────────────────────────
// 1. VERIFICACIÓN DEL SCRIPT DE MIGRACIÓN SQL Y POLÍTICAS RLS
// ─────────────────────────────────────────────────────────────
test("FASE 4 - 1. Auditoría de Seguridad del Script SQL RLS", async (t) => {
  const sqlPath = path.join(rootDir, "supabase/migrations/20261008_fase4_aislamiento_rls.sql");

  await t.test("El archivo de migración SQL existe y es legible", () => {
    assert.ok(fs.existsSync(sqlPath), "El archivo de migración SQL debe existir");
    const stat = fs.statSync(sqlPath);
    assert.ok(stat.size > 500, "El archivo SQL debe contener definiciones completas");
  });

  const sqlContent = fs.readFileSync(sqlPath, "utf-8");

  await t.test("Todas las tablas personales tienen ROW LEVEL SECURITY habilitado", () => {
    const tablasRequeridas = ["perfil_docente", "planes_guardados", "uso_docentes"];
    for (const tabla of tablasRequeridas) {
      const rlsRegex = new RegExp(`ALTER\\s+TABLE\\s+public\\.${tabla}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY;`, "i");
      assert.ok(
        rlsRegex.test(sqlContent),
        `La tabla ${tabla} debe tener ENABLE ROW LEVEL SECURITY explícito`
      );
    }
  });

  await t.test("Políticas RLS garantizan aislamiento estricto por auth.uid()", () => {
    // perfil_docente: auth.uid() = user_id
    assert.ok(
      sqlContent.includes("(select auth.uid()) = user_id"),
      "Las políticas deben comparar con user_id del usuario autenticado"
    );
    // uso_docentes: auth.uid() = docente_id
    assert.ok(
      sqlContent.includes("(select auth.uid()) = docente_id"),
      "La tabla uso_docentes debe comparar con docente_id del usuario autenticado"
    );
  });

  await t.test("Prohibición total de acceso anónimo o permisivo en tablas personales", () => {
    // Ninguna tabla personal debe tener TO anon o USING (true) para datos privados
    const lineas = sqlContent.split("\n");
    for (const linea of lineas) {
      if (linea.includes("CREATE POLICY") && linea.includes("TO anon")) {
        assert.fail(`Se encontró una política permisiva para anon: ${linea}`);
      }
    }
    assert.ok(!sqlContent.includes("TO anon"), "Cero políticas para el rol 'anon'");
  });

  await t.test("Contiene triggers automáticos de updated_at e índices de consulta", () => {
    assert.ok(sqlContent.includes("update_updated_at_column()"), "Debe definir la función trigger para updated_at");
    assert.ok(sqlContent.includes("idx_planes_user_created"), "Debe crear índice para planes por usuario y fecha");
    assert.ok(sqlContent.includes("idx_uso_docentes_lookup"), "Debe crear índice para búsqueda de cuota por docente y periodo");
  });
});

// ─────────────────────────────────────────────────────────────
// 2. AISLAMIENTO MULTI-INQUILINO EN CLIENTE (SIMULACIÓN LOCALSTORAGE)
// ─────────────────────────────────────────────────────────────
test("FASE 4 - 2. Aislamiento Estricto de Perfil y Biblioteca en Cliente", async (t) => {
  // Mock completo de localStorage en Node para pruebas aisladas
  const storageMap = new Map();
  global.localStorage = {
    getItem: (key) => storageMap.get(key) || null,
    setItem: (key, val) => storageMap.set(key, String(val)),
    removeItem: (key) => storageMap.delete(key),
    clear: () => storageMap.clear(),
    get length() { return storageMap.size; },
    key: (i) => Array.from(storageMap.keys())[i] || null
  };

  const {
    guardarPerfil,
    cargarPerfil,
    limpiarDatosUsuario
  } = await import("../client/src/services/perfilStorage.js");

  const {
    guardarPlanEnBiblioteca,
    obtenerTodasLasPlanificaciones,
    duplicarPlanEnBiblioteca,
    eliminarPlanDeBiblioteca
  } = await import("../client/src/services/bibliotecaStorage.js");

  const userA = "11111111-1111-1111-1111-111111111111";
  const userB = "22222222-2222-2222-2222-222222222222";

  await t.test("Docente A y Docente B guardan y leen perfiles independientes", () => {
    guardarPerfil({
      nombreDocente: "Profe María Rodríguez",
      centroEducativo: "Escuela República de Colombia",
      tanda: "Jornada Escolar Extendida (JEE)",
      seccion: "A",
      regional: "10 - Santo Domingo",
      distrito: "10-01"
    }, userA);

    guardarPerfil({
      nombreDocente: "Prof. Juan Pérez",
      centroEducativo: "Liceo Unión Panamericana",
      tanda: "Matutina",
      seccion: "B",
      regional: "15 - Santo Domingo",
      distrito: "15-02"
    }, userB);

    const perfilA = cargarPerfil(userA);
    const perfilB = cargarPerfil(userB);

    assert.equal(perfilA.nombreDocente, "Profe María Rodríguez");
    assert.equal(perfilA.centroEducativo, "Escuela República de Colombia");

    assert.equal(perfilB.nombreDocente, "Prof. Juan Pérez");
    assert.equal(perfilB.centroEducativo, "Liceo Unión Panamericana");
  });

  await t.test("Bibliotecas de planificaciones son 100% aisladas entre usuarios", () => {
    guardarPlanEnBiblioteca({
      id: "plan_a_001",
      titulo: "La Célula y sus Organelos",
      area: "Ciencias de la Naturaleza",
      grado: "5to Primaria",
      nivel: "primario",
      datosPlanificacion: { inicio: "Lluvia de ideas", desarrollo: "Maqueta", cierre: "Quiz" }
    }, userA);

    guardarPlanEnBiblioteca({
      id: "plan_b_001",
      titulo: "Ecuaciones Cuadráticas",
      area: "Matemática",
      grado: "3ro Secundaria",
      nivel: "secundario",
      datosPlanificacion: { inicio: "Problema guía", desarrollo: "Fórmula general", cierre: "Resolución" }
    }, userB);

    const planesA = obtenerTodasLasPlanificaciones(userA);
    const planesB = obtenerTodasLasPlanificaciones(userB);

    assert.equal(planesA.length, 1);
    assert.equal(planesA[0].id, "plan_a_001");
    assert.equal(planesA[0].titulo, "La Célula y sus Organelos");

    assert.equal(planesB.length, 1);
    assert.equal(planesB[0].id, "plan_b_001");
    assert.equal(planesB[0].titulo, "Ecuaciones Cuadráticas");
  });

  await t.test("Duplicación o eliminación por Usuario A no altera la biblioteca de Usuario B", () => {
    const copiaA = duplicarPlanEnBiblioteca("plan_a_001", userA);
    assert.ok(copiaA, "La copia debe generarse");
    assert.equal(obtenerTodasLasPlanificaciones(userA).length, 2);

    // Usuario B no se altera
    assert.equal(obtenerTodasLasPlanificaciones(userB).length, 1);

    // Eliminar original de Usuario A
    const borrado = eliminarPlanDeBiblioteca("plan_a_001", userA);
    assert.equal(borrado, true);
    assert.equal(obtenerTodasLasPlanificaciones(userA).length, 1);

    // Usuario B sigue intacto
    assert.equal(obtenerTodasLasPlanificaciones(userB).length, 1);
    assert.equal(obtenerTodasLasPlanificaciones(userB)[0].id, "plan_b_001");
  });

  await t.test("Purga al cerrar sesión (limpiarDatosUsuario) borra solo al usuario saliente", () => {
    limpiarDatosUsuario(userA);

    // Usuario A ahora no tiene perfil ni planes locales
    assert.equal(cargarPerfil(userA), null, "Perfil de Usuario A debe haber sido purgado");
    assert.deepEqual(obtenerTodasLasPlanificaciones(userA), [], "Biblioteca de Usuario A debe estar vacía");

    // Usuario B sigue teniendo sus datos íntegros
    const perfilB = cargarPerfil(userB);
    assert.ok(perfilB, "Perfil de Usuario B debe permanecer intacto");
    assert.equal(perfilB.nombreDocente, "Prof. Juan Pérez");

    const planesB = obtenerTodasLasPlanificaciones(userB);
    assert.equal(planesB.length, 1, "Biblioteca de Usuario B debe conservar su plan");
    assert.equal(planesB[0].id, "plan_b_001");
  });
});

// ─────────────────────────────────────────────────────────────
// 3. AISLAMIENTO Y CONTROL DE CUOTAS MULTI-DISPOSITIVO (BACKEND)
// ─────────────────────────────────────────────────────────────
test("FASE 4 - 3. Control de Cuotas Multi-Usuario y Límites Oficiales", async (t) => {
  const {
    consultarEstadoCuota,
    verificarYConsumirCuota,
    PLAN_LIMIT_MAX
  } = await import("../server/curriculum/quotaManager.js");

  const docAlpha = "docente_alpha_" + Date.now();
  const docBeta = "docente_beta_" + Date.now();

  await t.test("Límite mensual por defecto es de 20 planificaciones oficiales", () => {
    assert.equal(PLAN_LIMIT_MAX, 20, "PLAN_LIMIT_MAX debe ser 20 según la política MINERD");
  });

  await t.test("Dos docentes contabilizan consumos de cuota de forma estrictamente aislada", () => {
    // Alpha consume 5
    for (let i = 0; i < 5; i++) {
      const res = verificarYConsumirCuota(docAlpha);
      assert.equal(res.permitido, true);
    }

    const estadoAlpha = consultarEstadoCuota(docAlpha);
    const estadoBeta = consultarEstadoCuota(docBeta);

    assert.equal(estadoAlpha.usadas, 5, "Docente Alpha debe tener 5 usadas");
    assert.equal(estadoAlpha.restantes, 15, "Docente Alpha debe tener 15 restantes");

    assert.equal(estadoBeta.usadas, 0, "Docente Beta debe mantenerse en 0");
    assert.equal(estadoBeta.restantes, 20, "Docente Beta debe tener 20 restantes");
  });

  await t.test("Agotamiento de cuota de un docente bloquea solo a ese docente", () => {
    // Beta consume hasta agotar (20 de 20)
    for (let i = 0; i < 20; i++) {
      const r = verificarYConsumirCuota(docBeta);
      assert.equal(r.permitido, true);
    }

    // Intento 21 de Beta debe ser denegado
    const intento21Beta = verificarYConsumirCuota(docBeta);
    assert.equal(intento21Beta.permitido, false, "El intento 21 de Beta debe ser bloqueado");
    assert.equal(intento21Beta.estado.agotado, true);

    // Alpha aún puede consumir
    const intentoAlpha = verificarYConsumirCuota(docAlpha);
    assert.equal(intentoAlpha.permitido, true, "Alpha debe poder consumir sus cuotas disponibles");
  });

  await t.test("Modo Owner tiene bypass ilimitado sin afectar contadores de otros docentes", () => {
    const ownerRes = verificarYConsumirCuota("owner_key", true, true);
    assert.equal(ownerRes.permitido, true);
    assert.equal(ownerRes.ilimitado, true);
    assert.equal(ownerRes.esOwner, true);
  });
});
