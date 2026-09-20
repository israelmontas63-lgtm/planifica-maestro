/**
 * Script de prueba de endpoints de Planifica Maestro
 * Uso: node tests/test_endpoints.mjs [URL_BASE]
 * Por defecto: https://planifica-maestro.israelmontas65.workers.dev
 */

const BASE_URL = (process.argv[2] || "https://planifica-maestro.israelmontas65.workers.dev").replace(/\/$/, "");

console.log(`\n======================================================`);
console.log(`EJECUTANDO PRUEBAS DE ENDPOINTS EN: ${BASE_URL}`);
console.log(`======================================================\n`);

let passed = 0;
let failed = 0;

async function testEndpoint({ name, method, path, body, headers = {}, expectedStatuses = [200], validateJson }) {
  const url = `${BASE_URL}${path}`;
  process.stdout.write(`[TEST] ${method} ${path} (${name})... `);

  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-docente-id": "test_runner",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const isHtml = (res.headers.get("content-type") || "").includes("text/html");
    let data = null;
    let rawText = "";

    try {
      data = await res.json();
    } catch (e) {
      rawText = await res.text().catch(() => "");
    }

    if (!expectedStatuses.includes(res.status)) {
      console.log(`❌ FALLÓ (Status inesperado: ${res.status}, esperado: ${expectedStatuses.join(",")})`);
      if (isHtml) console.log(`   -> ALERTA: Devolvió HTML en lugar de JSON.`);
      failed++;
      return false;
    }

    if (isHtml) {
      console.log(`❌ FALLÓ (Devolvió text/html en lugar de JSON de API)`);
      failed++;
      return false;
    }

    if (validateJson && data) {
      const errorMsg = validateJson(data);
      if (errorMsg) {
        console.log(`❌ FALLÓ (${errorMsg})`);
        failed++;
        return false;
      }
    }

    console.log(`✅ OK (HTTP ${res.status})`);
    passed++;
    return true;
  } catch (err) {
    console.log(`❌ FALLÓ con error de conexión: ${err.message}`);
    failed++;
    return false;
  }
}

async function run() {
  // 1. Healthcheck
  await testEndpoint({
    name: "Salud del servidor y servicios",
    method: "GET",
    path: "/api/health",
    expectedStatuses: [200],
    validateJson: (data) => {
      if (data.status !== "ok") return `status esperado 'ok', recibido '${data.status}'`;
      if (!data.services) return "Falta objeto 'services'";
      return null;
    },
  });

  // 2. Esquemas curriculares
  await testEndpoint({
    name: "Catálogo de esquemas curriculares MINERD",
    method: "GET",
    path: "/api/plan/esquemas",
    expectedStatuses: [200],
    validateJson: (data) => {
      if (!data.esquemas || !data.esquemas.conbase) return "Falta esquema 'conbase'";
      return null;
    },
  });

  // 3. Cuota de docente
  await testEndpoint({
    name: "Consulta de cuota del docente",
    method: "GET",
    path: "/api/plan/cuota?docenteId=docente_test",
    expectedStatuses: [200],
    validateJson: (data) => {
      if (typeof data.limite !== "number") return "Falta campo 'limite'";
      if (typeof data.usadas !== "number") return "Falta campo 'usadas'";
      return null;
    },
  });

  // 4. Verificación de clave institucional
  await testEndpoint({
    name: "Verificación de clave institucional (intento controlado)",
    method: "POST",
    path: "/api/auth/verify",
    body: { password: "clave_de_prueba_invalida" },
    expectedStatuses: [200, 401], // 200 si modo dev abierto, 401 si clave incorrecta
  });

  // 5. Verificación de dueño
  await testEndpoint({
    name: "Verificación de dueño (intento controlado)",
    method: "POST",
    path: "/api/auth/owner-verify",
    body: { key: "llave_prueba_invalida" },
    expectedStatuses: [401, 500],
  });

  // 6. Patrones docente
  await testEndpoint({
    name: "Resumen de patrones aprendidos",
    method: "GET",
    path: "/api/plan/patrones-docente",
    expectedStatuses: [200],
  });

  console.log(`\n------------------------------------------------------`);
  console.log(`RESUMEN: ${passed} pasadas, ${failed} falladas.`);
  console.log(`------------------------------------------------------\n`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

run();
