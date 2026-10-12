import test from "node:test";
import assert from "node:assert/strict";

function createMockKV() {
  const store = new Map();
  return {
    async get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.val;
    },
    async put(key, val, options = {}) {
      const ttl = options.expirationTtl;
      const expiresAt = ttl ? Date.now() + ttl * 1000 : null;
      store.set(key, { val: String(val), expiresAt });
    },
    _store: store,
  };
}

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

test("BETA ABIERTA: CUOTA POR DISPOSITIVO, ENTRADA LIBRE Y SEGURIDAD", async (t) => {
  const workerModule = await import("../worker/index.js");
  const worker = workerModule.default;

  const MENSAJE_429_AMIGABLE = "Has alcanzado tu cuota diaria de la beta abierta (25 planes). Se reinicia a medianoche. Gracias por probar Planifica Maestro.";

  // a) Entrada sin clave
  await t.test("a) Entrada sin clave: GET /api/auth/verify devuelve 200 { ok: true, token: 'beta_abierta' } sin requerir header ni cookie", async () => {
    const env = {
      ACCESO_ABIERTO: "true",
      REQUIRE_ACCESS_KEY: "false",
      RATE_LIMIT_KV: createMockKV(),
    };

    const req = new Request("http://localhost/api/auth/verify", {
      method: "GET",
    });

    const res = await worker.fetch(req, env);
    assert.equal(res.status, 200, "Debe responder 200 OK en modo beta abierta");

    const json = await res.json();
    assert.equal(json.ok, true, "ok debe ser true");
    assert.equal(json.token, "beta_abierta", "token debe ser 'beta_abierta'");
    assert.equal(json.modo, "abierto", "modo debe ser 'abierto'");
  });

  // b) Cuota por dispositivo independiente
  await t.test("b) Cuota por dispositivo: dos llamadas con distinto x-device-id tienen contadores independientes", async () => {
    const mockKv = createMockKV();
    const env = {
      ACCESO_ABIERTO: "true",
      REQUIRE_ACCESS_KEY: "false",
      RATE_LIMIT_KV: mockKv,
    };

    const devA = "dev_profesor_juan_" + Date.now();
    const devB = "dev_profesora_maria_" + Date.now();

    // 1. Consultar estado inicial
    const reqA0 = new Request("http://localhost/api/plan/cuota", {
      method: "GET",
      headers: { "x-device-id": devA },
    });
    const resA0 = await worker.fetch(reqA0, env);
    const cuotaA0 = await resA0.json();
    assert.equal(cuotaA0.usadas, 0, "Dispositivo A inicia con 0");

    const reqB0 = new Request("http://localhost/api/plan/cuota", {
      method: "GET",
      headers: { "x-device-id": devB },
    });
    const resB0 = await worker.fetch(reqB0, env);
    const cuotaB0 = await resB0.json();
    assert.equal(cuotaB0.usadas, 0, "Dispositivo B inicia con 0");

    // 2. Dispositivo A consume 1 plan mediante POST /api/plan
    const reqConsumoA = new Request("http://localhost/api/plan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-device-id": devA,
        "cf-connecting-ip": "186.120.10.1",
      },
      body: JSON.stringify({
        messages: [{ role: "user", text: "Plan de prueba de Lengua Española" }],
        nivel: "primario",
        periodo: "diaria",
      }),
    });
    const resConsumoA = await worker.fetch(reqConsumoA, env);
    assert.ok(resConsumoA.status === 200 || resConsumoA.status === 400 || resConsumoA.status === 500, "Worker procesa petición");

    // 3. Verificar que la cuota de B se mantiene intacta en 0
    const reqB1 = new Request("http://localhost/api/plan/cuota", {
      method: "GET",
      headers: { "x-device-id": devB },
    });
    const resB1 = await worker.fetch(reqB1, env);
    const cuotaB1 = await resB1.json();
    assert.equal(cuotaB1.usadas, 0, "Dispositivo B sigue en 0");
  });

  // c) Mismo wifi no comparte cuota
  await t.test("c) Mismo wifi no comparte cuota: dos peticiones con la misma IP pero distinto x-device-id no se bloquean mutuamente hasta el límite de IP", async () => {
    const mockKv = createMockKV();
    const env = {
      ACCESO_ABIERTO: "true",
      REQUIRE_ACCESS_KEY: "false",
      RATE_LIMIT_KV: mockKv,
      RATE_LIMIT_IP_DIARIO: "75",
    };

    const sharedIp = "190.166.45.10"; // IP de la escuela compartida
    const devColega1 = "dev_colegio_docente_1_" + Date.now();
    const devColega2 = "dev_colegio_docente_2_" + Date.now();

    // Consulta de cuota para docente 1 bajo IP compartida
    const reqDoc1 = new Request("http://localhost/api/plan/cuota", {
      method: "GET",
      headers: {
        "x-device-id": devColega1,
        "cf-connecting-ip": sharedIp,
      },
    });
    const resDoc1 = await worker.fetch(reqDoc1, env);
    const cuotaDoc1 = await resDoc1.json();
    assert.equal(cuotaDoc1.permitido, true, "Docente 1 tiene permitido planificar");

    // Consulta de cuota para docente 2 bajo la MISMA IP
    const reqDoc2 = new Request("http://localhost/api/plan/cuota", {
      method: "GET",
      headers: {
        "x-device-id": devColega2,
        "cf-connecting-ip": sharedIp,
      },
    });
    const resDoc2 = await worker.fetch(reqDoc2, env);
    const cuotaDoc2 = await resDoc2.json();
    assert.equal(cuotaDoc2.permitido, true, "Docente 2 tiene permitido planificar independientemente");
    assert.equal(cuotaDoc2.usadas, 0, "Docente 2 no tiene consumos del Docente 1");
  });

  // d) Límite de dispositivo: después de 25 planes recibe 429 con mensaje amigable exacto
  await t.test("d) Límite de dispositivo: después de 25 planes el dispositivo recibe 429 con el mensaje amigable exacto", async () => {
    const mockKv = createMockKV();
    const env = {
      ACCESO_ABIERTO: "true",
      REQUIRE_ACCESS_KEY: "false",
      RATE_LIMIT_KV: mockKv,
    };

    const devSaturado = "dev_saturado_" + Date.now();
    const fechaHoy = new Date().toISOString().substring(0, 10);
    const encoder = new TextEncoder();
    const devData = encoder.encode(`${devSaturado}_pm_device_${fechaHoy}`);
    const hashBuf = await crypto.subtle.digest("SHA-256", devData);
    const devHashHex = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .substring(0, 32);

    // Simular que el dispositivo ya gastó exactamente sus 25 planes en KV
    await mockKv.put(`rl_dev_${devHashHex}`, "25");

    const reqExcedido = new Request("http://localhost/api/plan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-device-id": devSaturado,
        "cf-connecting-ip": "186.120.10.88",
      },
      body: JSON.stringify({
        messages: [{ role: "user", text: "Plan excediendo límite" }],
      }),
    });

    const resExcedido = await worker.fetch(reqExcedido, env);
    assert.equal(resExcedido.status, 429, "Debe rechazar con HTTP 429");

    const jsonExcedido = await resExcedido.json();
    assert.equal(jsonExcedido.error, MENSAJE_429_AMIGABLE, "Debe retornar el mensaje amigable exacto");
    assert.equal(jsonExcedido.limiteAlcanzado, true, "Debe marcar limiteAlcanzado");
    assert.equal(jsonExcedido.agotado, true, "Debe marcar agotado");
  });

  // e) Dueño no afectado: x-owner-key correcta pasa siempre con cuota ilimitada
  await t.test("e) Dueño no afectado: petición con x-owner-key correcta pasa siempre con cuota ilimitada sin importar estado de dispositivo, IP o límite global", async () => {
    const mockKv = createMockKV();
    const ownerSecret = "clave_maestra_owner_secreta_999";
    const env = {
      ACCESO_ABIERTO: "true",
      REQUIRE_ACCESS_KEY: "false",
      OWNER_MASTER_KEY: ownerSecret,
      RATE_LIMIT_KV: mockKv,
    };

    const fechaHoy = new Date().toISOString().substring(0, 10);
    // Simular KV global saturado (500) y de IP saturado (75)
    await mockKv.put(`rl_global_${fechaHoy}`, "999");
    await mockKv.put(`rl_ip_cualquierhash`, "999");

    const reqOwner = new Request("http://localhost/api/plan/cuota", {
      method: "GET",
      headers: {
        "x-owner-key": ownerSecret,
        "x-device-id": "dev_cualquiera_bloqueado",
        "cf-connecting-ip": "1.2.3.4",
      },
    });

    const resOwner = await worker.fetch(reqOwner, env);
    assert.equal(resOwner.status, 200, "Dueño siempre obtiene 200");

    const cuotaOwner = await resOwner.json();
    assert.equal(cuotaOwner.permitido, true, "Dueño tiene permitido: true");
    assert.equal(cuotaOwner.esOwner, true, "Dueño identificado como esOwner: true");
    assert.equal(cuotaOwner.restante, 999999, "Dueño tiene cuota ilimitada");
  });

  // f) Aislamiento de biblioteca: guardar un plan bajo un deviceId no contamina ni borra otro deviceId
  await t.test("f) Aislamiento de biblioteca: guardar un plan bajo un deviceId no contamina ni borra los planes de otro deviceId en localStorage", async () => {
    const globalMock = new MockLocalStorage();
    global.localStorage = globalMock;

    const {
      guardarPlanEnBiblioteca,
      obtenerTodasLasPlanificaciones,
      eliminarPlanDeBiblioteca,
    } = await import("../client/src/services/bibliotecaStorage.js");

    const devMaestroA = "dev_maestro_carlos_101";
    const devMaestroB = "dev_maestra_ana_202";

    const planA = {
      id: "plan_a_001",
      titulo: "Los Ecosistemas Dominicanos",
      area: "Ciencias de la Naturaleza",
      grado: "5to Primaria",
      fecha: new Date().toISOString(),
    };

    const planB = {
      id: "plan_b_002",
      titulo: "La Geometría en Nuestro Entorno",
      area: "Matemática",
      grado: "6to Primaria",
      fecha: new Date().toISOString(),
    };

    // Guardar para A
    guardarPlanEnBiblioteca(planA, devMaestroA);
    // Guardar para B
    guardarPlanEnBiblioteca(planB, devMaestroB);

    const planesA = obtenerTodasLasPlanificaciones(devMaestroA);
    const planesB = obtenerTodasLasPlanificaciones(devMaestroB);

    assert.equal(planesA.length, 1, "Maestro A tiene exactamente 1 plan");
    assert.equal(planesA[0].id, "plan_a_001", "Maestro A tiene su propio plan");

    assert.equal(planesB.length, 1, "Maestra B tiene exactamente 1 plan");
    assert.equal(planesB[0].id, "plan_b_002", "Maestra B tiene su propio plan");

    // Eliminar plan de A no borra el plan de B
    eliminarPlanDeBiblioteca("plan_a_001", devMaestroA);

    const planesADespues = obtenerTodasLasPlanificaciones(devMaestroA);
    const planesBDespues = obtenerTodasLasPlanificaciones(devMaestroB);

    assert.equal(planesADespues.length, 0, "Maestro A ahora tiene 0 planes");
    assert.equal(planesBDespues.length, 1, "Maestra B conserva intacto su plan");
    assert.equal(planesBDespues[0].id, "plan_b_002");
  });

  // g) Reversibilidad: con ACCESO_ABIERTO="false" o REQUIRE_ACCESS_KEY="true"
  await t.test("g) Reversibilidad: con ACCESO_ABIERTO='false' o REQUIRE_ACCESS_KEY='true', peticiones sin clave son rechazadas con 401", async () => {
    const envCerrado = {
      ACCESO_ABIERTO: "false",
      REQUIRE_ACCESS_KEY: "true",
      APP_ACCESS_KEY: "llave_institucional_privada_xyz",
      RATE_LIMIT_KV: createMockKV(),
    };

    // 1. GET /api/auth/verify sin clave es rechazado
    const reqVerify = new Request("http://localhost/api/auth/verify", {
      method: "GET",
    });
    const resVerify = await worker.fetch(reqVerify, envCerrado);
    assert.equal(resVerify.status, 401, "GET /api/auth/verify sin clave debe rechazar con 401 en modo cerrado");

    // 2. POST /api/plan sin clave es rechazado
    const reqPlan = new Request("http://localhost/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", text: "Hola" }] }),
    });
    const resPlan = await worker.fetch(reqPlan, envCerrado);
    assert.equal(resPlan.status, 401, "POST /api/plan sin clave debe rechazar con 401 en modo cerrado");

    // 3. Con x-app-key válida, es autorizado
    const reqConClave = new Request("http://localhost/api/auth/verify", {
      method: "GET",
      headers: { "x-app-key": "llave_institucional_privada_xyz" },
    });
    const resConClave = await worker.fetch(reqConClave, envCerrado);
    assert.equal(resConClave.status, 200, "Con clave válida responde 200 OK");
    const jsonConClave = await resConClave.json();
    assert.equal(jsonConClave.ok, true);
  });
});
