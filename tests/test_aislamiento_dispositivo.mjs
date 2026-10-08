import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import http from "node:http";

const require = createRequire(import.meta.url);
const express = require("../server/node_modules/express");
const planRoutes = require("../server/routes/plan.js");
const authRoutes = require("../server/routes/auth.js");
const authMiddleware = require("../server/middleware/auth.js");
const { verificarYConsumirCuota, consultarEstadoCuota } = require("../server/curriculum/quotaManager.js");
const { registrarPlan, cargarHistorialDocente } = require("../server/curriculum/teacherHistory.js");
const gestorGasto = require("../server/ia/gestorGasto.js");

// Asegurar claves para pruebas
if (!process.env.OWNER_MASTER_KEY || process.env.OWNER_MASTER_KEY === "ESCRIBE_AQUI_TU_LLAVE_SECRETA") {
  process.env.OWNER_MASTER_KEY = "llave_maestra_owner_test_999";
}
process.env.REQUIRE_ACCESS_KEY = "false";

test("AISLAMIENTO POR DISPOSITIVO Y SEGURIDAD", async (t) => {
  // 1. Configurar servidor Express de prueba sobre puerto efímero
  const app = express();
  app.use(express.json());
  app.use(authMiddleware);
  app.use("/api/auth", authRoutes);
  app.use("/api/plan", planRoutes);

  let server;
  let baseUrl;

  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  t.after(() => {
    if (server) server.close();
  });

  await t.test("1. Dos x-device-id distintos NO comparten cuota ni historial de planificaciones", () => {
    const devA = "device_alpha_" + Date.now();
    const devB = "device_beta_" + Date.now();

    // Estado inicial: ambos con 0 usadas
    const estadoA0 = consultarEstadoCuota(devA);
    const estadoB0 = consultarEstadoCuota(devB);
    assert.equal(estadoA0.usadas, 0);
    assert.equal(estadoB0.usadas, 0);

    // Consumir 2 planificaciones para el dispositivo A
    verificarYConsumirCuota(devA);
    verificarYConsumirCuota(devA);

    const estadoA1 = consultarEstadoCuota(devA);
    const estadoB1 = consultarEstadoCuota(devB);

    assert.equal(estadoA1.usadas, 2, "Dispositivo A debe tener 2 consumidas");
    assert.equal(estadoB1.usadas, 0, "Dispositivo B debe mantenerse intacto en 0");

    // Registrar historial para dispositivo A
    registrarPlan({
      docenteId: devA,
      nivel: "primario",
      datosPlanificacion: { tema: "Fracciones" }
    });

    const historialA = cargarHistorialDocente(devA);
    const historialB = cargarHistorialDocente(devB);

    assert.ok(historialA.length >= 1, "Dispositivo A debe tener su historial guardado");
    assert.equal(historialB.length, 0, "Dispositivo B no debe ver ningún plan de A");
  });

  await t.test("2. Límite de tasa por dispositivo: máximo 25 peticiones por minuto (la 26ª es rechazada con 429)", async () => {
    const devRateLimit = "device_rate_" + Date.now();
    const payload = {
      messages: [{ role: "user", text: "hola" }],
      nivel: "primario",
      periodo: "diaria"
    };

    // Realizar 25 solicitudes permitidas
    for (let i = 1; i <= 25; i++) {
      const res = await fetch(`${baseUrl}/api/plan/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-id": devRateLimit,
          "x-forwarded-for": `10.0.0.${i}` // IP distinta para aislar del rate limit de IP
        },
        body: JSON.stringify(payload)
      });
      assert.equal(res.status, 200, `Petición ${i} del dispositivo debe ser permitida (200)`);
    }

    // La petición 26 debe ser bloqueada inmediatamente con 429
    const resBloqueada = await fetch(`${baseUrl}/api/plan/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-device-id": devRateLimit,
        "x-forwarded-for": "10.0.0.99"
      },
      body: JSON.stringify(payload)
    });

    assert.equal(resBloqueada.status, 429, "Petición 26 debe ser rechazada con código HTTP 429");
    const jsonBloqueada = await resBloqueada.json();
    assert.ok(jsonBloqueada.error.includes("Demasiadas peticiones consecutivas desde este dispositivo"));
  });

  await t.test("3. Límite de tasa por dirección IP: máximo 60 peticiones por minuto (la 61ª es rechazada con 429)", async () => {
    const ipRateLimit = "192.168.100.42";
    const payload = {
      messages: [{ role: "user", text: "hola" }],
      nivel: "primario",
      periodo: "diaria"
    };

    // Realizar 60 peticiones permitidas desde esa IP con diferentes device IDs
    for (let i = 1; i <= 60; i++) {
      const res = await fetch(`${baseUrl}/api/plan/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-id": `device_random_${Date.now()}_${i}`,
          "x-forwarded-for": ipRateLimit
        },
        body: JSON.stringify(payload)
      });
      assert.equal(res.status, 200, `Petición ${i} de la IP debe ser permitida (200)`);
    }

    // La petición 61 desde esa misma IP debe ser rechazada con 429
    const resBloqueadaIp = await fetch(`${baseUrl}/api/plan/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-device-id": `device_random_extra_${Date.now()}`,
        "x-forwarded-for": ipRateLimit
      },
      body: JSON.stringify(payload)
    });

    assert.equal(resBloqueadaIp.status, 429, "Petición 61 de la IP debe ser rechazada con código HTTP 429");
    const jsonBloqueadaIp = await resBloqueadaIp.json();
    assert.ok(jsonBloqueadaIp.error.includes("Demasiadas solicitudes desde esta dirección IP"));
  });

  await t.test("4. Tope diario global de gasto/cuota: bloquea consultas de usuarios cuando se agota", async () => {
    // Simular que se consumieron todas las consultas del día (> 500)
    gestorGasto.reiniciarContadorParaPruebas(999999);

    try {
      const resTope = await fetch(`${baseUrl}/api/plan/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-id": "dev_normal_user_" + Date.now(),
          "x-forwarded-for": "172.16.0.50"
        },
        body: JSON.stringify({
          messages: [{ role: "user", text: "hola" }],
          nivel: "primario",
          periodo: "diaria"
        })
      });

      assert.equal(resTope.status, 429, "Debe rechazar con 429 si el tope diario global está agotado");
      const jsonTope = await resTope.json();
      assert.ok(jsonTope.error.includes("límite diario global"));
    } finally {
      gestorGasto.reiniciarContadorParaPruebas(0);
    }
  });

  await t.test("5. Panel de dueño (/api/auth/owner-stats): estrictamente protegido con x-owner-key", async () => {
    // 5a. Sin header x-owner-key -> Rechazo 403 Forbidden
    const resSinClave = await fetch(`${baseUrl}/api/auth/owner-stats`, {
      method: "GET"
    });
    assert.equal(resSinClave.status, 403, "Acceso a /owner-stats sin clave debe retornar 403");

    // 5b. Con x-owner-key inválida -> Rechazo 403 Forbidden
    const resClaveFalsa = await fetch(`${baseUrl}/api/auth/owner-stats`, {
      method: "GET",
      headers: {
        "x-owner-key": "clave_totalmente_incorrecta_987"
      }
    });
    assert.equal(resClaveFalsa.status, 403, "Acceso con clave incorrecta debe retornar 403");

    // 5c. Con x-owner-key válida -> Acceso 200 OK con métricas agregadas
    const resValida = await fetch(`${baseUrl}/api/auth/owner-stats`, {
      method: "GET",
      headers: {
        "x-owner-key": process.env.OWNER_MASTER_KEY
      }
    });
    assert.equal(resValida.status, 200, "Acceso con llave de dueño debe retornar 200");
    const jsonValida = await resValida.json();
    assert.equal(jsonValida.ok, true);
    assert.ok(jsonValida.stats !== undefined);
    assert.ok(typeof jsonValida.stats.totalDocentes === "number");
  });
});
