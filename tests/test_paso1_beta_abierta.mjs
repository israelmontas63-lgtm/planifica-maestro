import test from "node:test";
import assert from "node:assert/strict";

test("PASO 1: MODO BETA ABIERTA (SIN CUENTAS, SIN SUPABASE, CON DISPOSITIVO ESTABLE)", async (t) => {
  // Simular entorno de navegador (localStorage y window)
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (i) => [...store.keys()][i] || null
  };

  // 1. Verificar configuración con VITE_REQUIRE_LOGIN=false
  process.env.VITE_REQUIRE_LOGIN = "false";
  process.env.VITE_ENABLE_AUTH = "false";

  const { isAuthEnabled, isSupabaseConfigured, supabase } = await import("../client/src/services/supabaseClient.js");

  await t.test("1.1 El interruptor de autenticación está desactivado y Supabase duerme", () => {
    assert.equal(isAuthEnabled, false, "isAuthEnabled debe ser false");
    assert.equal(isSupabaseConfigured, false, "isSupabaseConfigured debe ser false cuando isAuthEnabled es false");
    assert.equal(supabase, null, "El cliente Supabase debe ser null para no hacer peticiones de red");
  });

  const { obtenerUsuarioIdActual, obtenerOrearDispositivoId } = await import("../client/src/hooks/useAuth.js");

  await t.test("1.2 Cada dispositivo recibe un identificador anónimo estable (pm_device_id)", () => {
    const devId1 = obtenerOrearDispositivoId();
    assert.ok(devId1.startsWith("dev_"), "El ID del dispositivo debe empezar con 'dev_'");
    assert.ok(devId1.length >= 10, "El ID debe ser robusto y único");

    // En llamadas posteriores debe mantenerse idéntico
    const devId2 = obtenerOrearDispositivoId();
    assert.equal(devId2, devId1, "El ID del dispositivo debe ser estable y persistir en localStorage");

    const userIdActual = obtenerUsuarioIdActual();
    assert.equal(userIdActual, devId1, "obtenerUsuarioIdActual debe retornar el device ID estable");
  });

  const { cargarPerfil, guardarPerfil } = await import("../client/src/services/perfilStorage.js");

  await t.test("1.3 El perfil docente se guarda y recupera en el dispositivo sin contraseñas", () => {
    // Inicialmente no hay perfil
    assert.equal(cargarPerfil(), null);

    // Guardar perfil sencillo
    guardarPerfil({
      nombre: "Prof. María Pérez",
      escuela: "Escuela Básica República Dominicana",
      grado: "4to de Primaria",
      tanda: "Jornada Escolar Extendida (JEE)"
    });

    const cargado = cargarPerfil();
    assert.ok(cargado !== null);
    assert.equal(cargado.nombre, "Prof. María Pérez");
    assert.equal(cargado.escuela, "Escuela Básica República Dominicana");
    assert.equal(cargado.grado, "4to de Primaria");
  });

  const {
    guardarPlanEnBiblioteca,
    obtenerTodasLasPlanificaciones,
  } = await import("../client/src/services/bibliotecaStorage.js");

  await t.test("1.4 Las planificaciones se guardan en la biblioteca local del dispositivo", () => {
    const planPrueba = {
      id: "plan_test_beta_001",
      titulo: "Planificación de Geometría y Cuerpos Redondos",
      grado: "4to de Primaria",
      area: "Matemática",
      fecha: new Date().toISOString(),
      datos: { tema: "Cuerpos redondos", actividades: "Manipulación de figuras" }
    };

    guardarPlanEnBiblioteca(planPrueba);

    const planes = obtenerTodasLasPlanificaciones();
    assert.equal(planes.length, 1, "Debe haber 1 plan guardado en la biblioteca del dispositivo");
    assert.equal(planes[0].id, "plan_test_beta_001");
    assert.equal(planes[0].titulo, "Planificación de Geometría y Cuerpos Redondos");
  });

  await t.test("1.5 Cero llamadas de red a Supabase cuando el cliente es null", async () => {
    const { sincronizarPerfilConNube } = await import("../client/src/services/perfilStorage.js");
    const { sincronizarBibliotecaConNube } = await import("../client/src/services/bibliotecaStorage.js");

    const resPerfil = await sincronizarPerfilConNube({ supabaseClient: null, userId: obtenerUsuarioIdActual() });
    assert.equal(resPerfil, null, "Sincronización de perfil debe abortar sin errores de red");

    const resBiblio = await sincronizarBibliotecaConNube({ supabaseClient: null, userId: obtenerUsuarioIdActual() });
    assert.ok(Array.isArray(resBiblio), "Sincronización de biblioteca debe retornar datos locales sin errores");
    assert.equal(resBiblio.length, 1);
  });

  await t.test("1.6 Recarga de página simula persistencia completa en el dispositivo", () => {
    const perfilPersistido = cargarPerfil();
    const planesPersistidos = obtenerTodasLasPlanificaciones();

    assert.equal(perfilPersistido.nombre, "Prof. María Pérez");
    assert.equal(planesPersistidos.length, 1);
    assert.equal(planesPersistidos[0].titulo, "Planificación de Geometría y Cuerpos Redondos");
  });

  await t.test("1.7 Generación oficial de documento Word (.docx) con matriz oficial y perfil", async () => {
    const { construirDocumentoWordOficial } = await import("../client/src/services/generadorWordConBase.js");
    const { Packer } = await import("docx");

    const doc = await construirDocumentoWordOficial({
      plan: "Tema: Cuerpos Redondos y Geometría en el Entorno\nActividades: Exploración táctil de cilindros y esferas",
      datos: { tema: "Cuerpos Redondos" },
      perfil: cargarPerfil(),
      titulo: "Planificacion_Geometria"
    });

    const buffer = await Packer.toBuffer(doc);
    assert.ok(Buffer.isBuffer(buffer), "Debe generar un buffer válido de Node");
    assert.ok(buffer.length > 5000, `El documento Word debe tener más de 5 KB (obtenido: ${buffer.length} bytes)`);
  });

  await t.test("1.8 Borrado de datos del navegador reinicia el dispositivo limpiamente", () => {
    store.clear();
    assert.equal(cargarPerfil(), null);
    assert.equal(obtenerTodasLasPlanificaciones().length, 0);

    const nuevoDevId = obtenerOrearDispositivoId();
    assert.ok(nuevoDevId.startsWith("dev_"));
  });
});

