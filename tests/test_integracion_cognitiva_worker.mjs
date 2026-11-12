import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";
import {
  crearRegistroHerramientasProductivo,
  resolverPermisosServidor,
} from "../worker/services/adaptadorCognitivo.js";
import {
  limpiarCacheCurricular,
  esRespuestaCacheable,
  guardarRespuestaEnCache,
  obtenerRespuestaDeCache,
} from "../worker/cacheRespuestas.js";

function crearEnvBase(overrides = {}) {
  return {
    APP_ACCESS_KEY: "test_access_key_123",
    OWNER_MASTER_KEY: "test_owner_key_456",
    GEMINI_API_KEY: "test_gemini_key",
    HERRAMIENTAS_V2: "false",
    ...overrides,
  };
}

function crearRequestPlan(body, { headers = {}, owner = false } = {}) {
  return new Request("https://planifica.local/api/plan/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-app-key": "test_access_key_123",
      ...(owner ? { "x-owner-key": "test_owner_key_456" } : {}),
      "x-device-id": "docente_real_1",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

test("Escenario A: solicitud sencilla responde sin activar el planificador DAG", async () => {
  limpiarCacheCurricular();
  const env = crearEnvBase();
  const res = await worker.fetch(
    crearRequestPlan({ messages: [{ role: "user", text: "Hola, ¿cómo estás?" }] }),
    env,
    { waitUntil() {} }
  );
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.trazabilidad_cognitiva, undefined);
  assert.equal(data.plan_completado, false);
});

test("Escenario B: tarea compleja ejecuta ejecutarCicloOperativo desde el Worker productivo", async () => {
  limpiarCacheCurricular();
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("tavily") || u.includes("search")) {
      return new Response(JSON.stringify({ results: [{ title: "Calendario MINERD", url: "https://minerd.gob.do", content: "Noviembre" }] }), { status: 200 });
    }
    // Supabase / RPC curricular mock
    return new Response(JSON.stringify([
      { id: "1", tema: "Fracciones", contenido: "Fracciones propias", coincide_tema: true, fuente_documento: "Adecuación Curricular 2023", pagina: 42 }
    ]), { status: 200 });
  };

  try {
    const env = crearEnvBase({
      SUPABASE_URL: "https://mock.supabase.co",
      SUPABASE_ANON_KEY: "mock_anon",
      SUPABASE_SERVICE_ROLE_KEY: "mock_srv",
      TAVILY_API_KEY: "mock_tavily",
    });

    const res = await worker.fetch(
      crearRequestPlan({
        messages: [{ role: "user", text: "Consulta el currículo de fracciones" }],
        tareasPlan: [
          {
            id: "T1",
            objetivo: "Consultar currículo de fracciones",
            dependencias: [],
            herramientaRequerida: "consultar_base_datos",
            datosNecesarios: { nivel: "Primario", grado: "4to", area: "Matemática", tema_o_concepto: "Fracciones" },
          },
          {
            id: "T2",
            objetivo: "Consolidar contexto",
            dependencias: ["T1"],
            herramientaRequerida: null,
          },
        ],
      }),
      env,
      { waitUntil() {} }
    );

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.estadoOperativo, "COMPLETADA");
    assert.equal(data.trazabilidad_cognitiva.verificacionesRealizadas.length, 2);
    assert.deepEqual(data.trazabilidad_cognitiva.herramientasConsultadas, ["consultar_base_datos"]);
    assert.equal(data.auditoria_herramientas.length, 1);
    assert.equal(data.auditoria_herramientas[0].autorizacion, "APROBADA");
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("Escenario C & D: herramienta autorizada ejecuta vía registro y herramienta sin permiso se bloquea", async () => {
  const registro = crearRegistroHerramientasProductivo({
    env: { SUPABASE_URL: "https://mock.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "srv", TAVILY_API_KEY: "tv" },
    opciones: {
      ejecutor: async () => [{ id: "c1", tema: "Sumas", contenido: "Suma básica", coincide_tema: true }],
    },
  });

  // C. Autorizada: docente autenticado con permiso 'curriculo'
  const okRes = await registro.ejecutar(
    "consultar_base_datos",
    { nivel: "Primario", grado: "1ro", area: "Matemática", tema_o_concepto: "Sumas" },
    {
      usuarioId: "docente_1",
      usuarioAutenticado: true,
      permisosUsuario: resolverPermisosServidor({ isOwner: false, docenteId: "docente_1" }),
      origenFuente: "usuario",
    }
  );
  assert.equal(okRes.ok, true);
  assert.equal(okRes.datos.resultado.length, 1);

  // D. Sin permiso: usuario anónimo intenta buscar_contexto_web (requiere 'investigacion')
  const bloqRes = await registro.ejecutar(
    "buscar_contexto_web",
    { consulta: "calendario escolar MINERD" },
    {
      usuarioId: "dev_anon_1.2.3.4",
      usuarioAutenticado: true,
      permisosUsuario: resolverPermisosServidor({ isOwner: false, docenteId: "dev_anon_1.2.3.4" }),
      origenFuente: "usuario",
    }
  );
  assert.equal(bloqRes.ok, false);
  assert.equal(bloqRes.codigo, "PERMISO_DENEGADO");
});

test("Escenario E: acción Nivel 3 en el Worker exige autorización explícita real y bloquea origen externo", async () => {
  const env = crearEnvBase();

  // Sin autorización explícita -> HTTP 403 PENDIENTE_DE_AUTORIZACION
  const resSinAuth = await worker.fetch(
    crearRequestPlan(
      { messages: [{ role: "user", text: "Abre notepad en Windows" }] },
      { owner: true }
    ),
    env,
    { waitUntil() {} }
  );
  assert.equal(resSinAuth.status, 403);
  const dataSinAuth = await resSinAuth.json();
  assert.equal(dataSinAuth.requiereAutorizacion, true);
  assert.equal(dataSinAuth.estadoOperativo, "PENDIENTE_DE_AUTORIZACION");

  // Con flag true pero origen externo 'web' -> bloqueado igual
  const resWeb = await worker.fetch(
    crearRequestPlan(
      {
        messages: [{ role: "user", text: "Abre notepad en Windows" }],
        autorizacionExplicitaUsuario: true,
        origenFuente: "web",
      },
      { owner: true }
    ),
    env,
    { waitUntil() {} }
  );
  assert.equal(resWeb.status, 403);
  const dataWeb = await resWeb.json();
  assert.equal(dataWeb.requiereAutorizacion, true);

  // Con autorización explícita del propietario + origen usuario -> ejecutada y auditada
  const resOk = await worker.fetch(
    crearRequestPlan(
      {
        messages: [{ role: "user", text: "Abre notepad en Windows" }],
        autorizacionExplicitaUsuario: true,
        origenFuente: "usuario",
        claveIdempotencia: "op_win_001",
      },
      { owner: true }
    ),
    env,
    { waitUntil() {} }
  );
  assert.equal(resOk.status, 200);
  const dataOk = await resOk.json();
  assert.equal(dataOk.ok, true);
  assert.equal(dataOk.estadoOperativo, "COMPLETADA");
});

test("Escenario F: error de una subtarea en el Worker no declara la tarea completada", async () => {
  const env = crearEnvBase();
  const res = await worker.fetch(
    crearRequestPlan({
      messages: [{ role: "user", text: "Ejecuta tarea con herramienta inexistente" }],
      tareasPlan: [
        {
          id: "T_FAIL",
          objetivo: "Paso inválido",
          dependencias: [],
          herramientaRequerida: "herramienta_que_no_existe",
          datosNecesarios: { x: 1 },
        },
      ],
    }),
    env,
    { waitUntil() {} }
  );
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.ok, false);
  assert.equal(data.plan_completado, false);
  assert.equal(data.estadoOperativo, "FALLIDA");
});

test("Escenario G: flujo JSON estándar corrige, valida y almacena solo la versión corregida APROBADA en caché", async () => {
  limpiarCacheCurricular();
  const origFetch = globalThis.fetch;
  let geminiCalls = 0;

  // Plan inicial con error curricular ("concepto inexistente" / sin contenido coincidente) y corrección válida
  const planIncorrecto = {
    mensaje_chat: "Borrador inicial",
    plan_completado: true,
    datos_planificacion: {
      tema: "Fracciones",
      competencias_especificas: ["Competencia inventada XYZ"],
      indicadores_de_logro: ["Indicador inventado XYZ"],
      actividades: { inicio: "Inicio", desarrollo: "Desarrollo", cierre: "Cierre" },
      recursos: ["Pizarra"],
      evaluacion: "Rúbrica",
    },
  };
  const planCorregido = {
    mensaje_chat: "Planificación corregida",
    plan_completado: true,
    datos_planificacion: {
      tema: "Fracciones equivalentes",
      competencias_especificas: ["Resuelve problemas con fracciones equivalentes"],
      indicadores_de_logro: ["Identifica fracciones equivalentes en representaciones gráficas"],
      actividades: { inicio: "Exploración", desarrollo: "Práctica guiada", cierre: "Síntesis" },
      recursos: ["Regletas"],
      evaluacion: "Lista de cotejo",
    },
  };

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("generativelanguage.googleapis.com")) {
      geminiCalls += 1;
      const payload = geminiCalls === 1 ? planIncorrecto : planCorregido;
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(JSON.stringify([]), { status: 200 });
  };

  try {
    // Verificar regla de almacenamiento en cacheRespuestas.js para estados no APROBADO
    assert.equal(esRespuestaCacheable({ ...planCorregido, auditoria: { aprobado: false, estadoValidacion: "NECESITA_CORRECCION" } }), false);
    assert.equal(esRespuestaCacheable({ ...planCorregido, auditoria: { aprobado: true, estadoValidacion: "NO_VERIFICADO" } }), false);
    assert.equal(esRespuestaCacheable({ ...planCorregido, auditoria: { aprobado: false, estadoValidacion: "ERROR_DE_VALIDACION" } }), false);
    assert.equal(esRespuestaCacheable({ ...planCorregido, auditoria: { aprobado: true, estadoValidacion: "APROBADO_CON_OBSERVACIONES" } }), false);
    assert.equal(esRespuestaCacheable({ ...planCorregido, auditoria: { aprobado: true, estadoValidacion: "APROBADO" } }), true);

    // Simular guardado y rechazo de entrada no aprobada en caché
    guardarRespuestaEnCache("clave_rechazada", { ...planIncorrecto, auditoria: { aprobado: false, estadoValidacion: "NECESITA_CORRECCION" } });
    assert.equal(obtenerRespuestaDeCache("clave_rechazada"), null);

    // Probar flujo JSON estándar del Worker (sin HERRAMIENTAS_V2 y con fragmentos recuperados)
    const env = crearEnvBase({ HERRAMIENTAS_V2: "false", DESACTIVAR_CAPA_4: "true" });
    const reqBody = {
      grado: "4to",
      area: "Matemática",
      tema: "Fracciones equivalentes",
      nivel: "primario",
      periodo: "diaria",
      stream: false,
      messages: [{ role: "user", text: "Planifica una clase de 4to grado de Matemática sobre Fracciones equivalentes" }],
    };
    const res1 = await worker.fetch(crearRequestPlan(reqBody), env, { waitUntil() {} });
    assert.equal(res1.status, 200);
    const data1 = await res1.json();
    assert.equal(data1.plan_completado, true);
    // Sin fragmentos recuperados en este mock, estadoValidacion es NO_VERIFICADO -> NO debe quedar en caché
    assert.equal(data1.auditoria.estadoValidacion, "NO_VERIFICADO");

    // Segunda llamada no debe recibir caché contaminada con estado NO_VERIFICADO
    const res2 = await worker.fetch(crearRequestPlan(reqBody), env, { waitUntil() {} });
    const data2 = await res2.json();
    assert.notEqual(data2.origen, "cache_en_memoria");
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("Escenario H: aislamiento entre usuarios e idempotencia por usuario", async () => {
  const registro = crearRegistroHerramientasProductivo({ env: {} });

  // Usuario docente_A sin permiso 'accion_sistema' es bloqueado en Nivel 3 incluso con claveIdempotencia
  const resA = await registro.ejecutar(
    "accion_externa_nivel_3",
    { accion: "exportar_datos" },
    {
      usuarioId: "docente_A",
      usuarioAutenticado: true,
      permisosUsuario: resolverPermisosServidor({ isOwner: false, docenteId: "docente_A" }),
      autorizacionExplicitaUsuario: true,
      claveIdempotencia: "k_shared",
    }
  );
  assert.equal(resA.ok, false);
  assert.equal(resA.codigo, "PERMISO_DENEGADO");

  // Propietario con permiso '*' ejecuta con idempotencia aislada por usuarioId
  const resOwner1 = await registro.ejecutar(
    "accion_externa_nivel_3",
    { accion: "exportar_datos" },
    {
      usuarioId: "owner_1",
      usuarioAutenticado: true,
      permisosUsuario: resolverPermisosServidor({ isOwner: true, docenteId: "owner_1" }),
      autorizacionExplicitaUsuario: true,
      claveIdempotencia: "k_shared",
    }
  );
  assert.equal(resOwner1.ok, true);
  assert.equal(resOwner1.duplicada, undefined);

  const resOwner2 = await registro.ejecutar(
    "accion_externa_nivel_3",
    { accion: "exportar_datos" },
    {
      usuarioId: "owner_1",
      usuarioAutenticado: true,
      permisosUsuario: resolverPermisosServidor({ isOwner: true, docenteId: "owner_1" }),
      autorizacionExplicitaUsuario: true,
      claveIdempotencia: "k_shared",
    }
  );
  assert.equal(resOwner2.ok, true);
  assert.equal(resOwner2.duplicada, true);
});
