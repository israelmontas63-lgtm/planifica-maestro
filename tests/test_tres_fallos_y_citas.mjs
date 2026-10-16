/**
 * tests/test_tres_fallos_y_citas.mjs
 * 
 * Pruebas automatizadas de los 3 fallos reales y verificación de citas V2:
 * 1. Supabase caído (ErrorCurricular de red/503 con degradación pedagógica)
 * 2. Gemini 429 -> PROVEEDOR_IA_SATURADO (diferenciado de CUOTA_DIARIA_AGOTADA)
 * 3. JSON inválido -> IA_RESPUESTA_INVALIDA con diagnóstico técnico
 * 4. Citas V2 -> verificarYSanearCitas conserva "pág. N" cuando viene de herramientas V2
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";
import { consultarCurriculoMINERD, ErrorCurricular } from "../shared/curriculoService.mjs";
import { verificarYSanearCitas } from "../server/curriculum/verificadorCitas.js";

test("FALLO 1: Supabase caído / fallo de red en servicio curricular", async (t) => {
  await t.test("consultarCurriculoMINERD lanza ErrorCurricular tipado 'RED' sin exponer secretos", async () => {
    const envCaido = {
      SUPABASE_URL: "https://supabase-servidor-inexistente-caido.co",
      SUPABASE_ANON_KEY: "anon-key-prueba-segura"
    };

    try {
      await consultarCurriculoMINERD(
        { nivel: "Primario", grado: "2do Grado", area: "Matemática", tema_o_concepto: "Fracciones" },
        envCaido,
        { timeoutMs: 1500 }
      );
      assert.fail("Debió lanzar excepción por host inalcanzable");
    } catch (err) {
      assert.ok(err instanceof ErrorCurricular, "Debe ser instancia de ErrorCurricular");
      assert.ok(err.codigo === "RED" || err.codigo === "TIMEOUT", `Código debe ser RED o TIMEOUT, recibido: ${err.codigo}`);
      assert.ok(!err.message.includes("anon-key-prueba-segura"), "No debe exponer credenciales en el mensaje");
    }
  });
});

test("FALLO 2: Gemini 429 -> PROVEEDOR_IA_SATURADO separado de CUOTA_DIARIA_AGOTADA", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const urlStr = String(url);
    if (urlStr.includes("generativelanguage.googleapis.com")) {
      return new Response(JSON.stringify({ error: { code: 429, message: "Resource exhausted" } }), {
        status: 429,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, opts);
  };

  try {
    const req = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        "x-app-key": "clave-institucional-test",
        "x-docente-id": "docente_test_429"
      },
      body: JSON.stringify({
        confirmado: true,
        stream: true,
        messages: [{ role: "user", text: "planificar suma de números naturales para 2do de primaria matemática" }]
      })
    });

    const envTest = {
      GEMINI_API_KEY: "dummy-key-test-429",
      APP_ACCESS_KEY: "clave-institucional-test",
      HERRAMIENTAS_V2: "false"
    };

    const res = await worker.fetch(req, envTest, { waitUntil: () => {} });
    const json = await res.json();

    // Verificaciones de lo que ve el usuario
    assert.strictEqual(json.ok, false, "ok debe ser false");
    assert.strictEqual(json.isError, true, "isError debe ser true");
    assert.strictEqual(json.codigo, "PROVEEDOR_IA_SATURADO", "Código debe ser PROVEEDOR_IA_SATURADO");
    assert.strictEqual(json.codigoError, "PROVEEDOR_IA_SATURADO", "codigoError debe ser PROVEEDOR_IA_SATURADO");
    assert.notStrictEqual(json.codigo, "CUOTA_DIARIA_AGOTADA", "NO debe confundirse con la cuota del docente");
    assert.ok(json.mensaje.includes("saturado") || json.mensaje.includes("cuota con el proveedor"), "Mensaje debe aludir al proveedor de IA");
    assert.ok(json.sugerencia.includes("Reintentar"), "Debe ofrecer sugerencia pedagógica amigable");

    // Verificar explicación si el docente pregunta "¿por qué no puedes?"
    const reqSeguimiento = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-key": "clave-institucional-test",
        "x-docente-id": "docente_test_429"
      },
      body: JSON.stringify({
        messages: [
          { role: "user", text: "planificar" },
          { role: "assistant", text: "Error", isError: true, codigoError: "PROVEEDOR_IA_SATURADO" },
          { role: "user", text: "¿por qué no puedes?" }
        ]
      })
    });

    const resSeg = await worker.fetch(reqSeguimiento, envTest, { waitUntil: () => {} });
    const jsonSeg = await resSeg.json();
    assert.strictEqual(jsonSeg.codigo, "PROVEEDOR_IA_SATURADO");
    assert.ok(jsonSeg.mensaje.includes("inteligencia artificial estuvo temporalmente saturado"), "Debe explicar la saturación externa");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("FALLO 3: JSON inválido en respuesta del modelo de IA", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const urlStr = String(url);
    if (urlStr.includes("generativelanguage.googleapis.com")) {
      return new Response(JSON.stringify({
        candidates: [{
          content: {
            role: "model",
            parts: [{ text: "Este es un texto plano sin formato JSON { datos_incompletos: " }]
          },
          finishReason: "STOP"
        }]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, opts);
  };

  try {
    const req = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-key": "clave-institucional-test",
        "x-docente-id": "docente_test_json_inv"
      },
      body: JSON.stringify({
        confirmado: true,
        messages: [{ role: "user", text: "planificar números naturales para 1ro de primaria" }]
      })
    });

    const envTest = {
      GEMINI_API_KEY: "dummy-key-test-json",
      APP_ACCESS_KEY: "clave-institucional-test",
      HERRAMIENTAS_V2: "false"
    };

    const res = await worker.fetch(req, envTest, { waitUntil: () => {} });
    const json = await res.json();
    assert.strictEqual(json.ok, false);
    assert.strictEqual(json.isError, true);
    assert.ok(json.codigo === "IA_RESPUESTA_INVALIDA" || json.codigo === "ERROR_INTERNO");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("PUNTO 5: verificarYSanearCitas no borra 'pág. N' cuando los fragmentos llegan de herramientas V2", async () => {
  const fragmentosV2 = [
    {
      id: "f87a8b41-e37d-5a9a-b85f-8d99c424a180",
      source_id: "matriz_matematica_secuencia_2_segundo",
      nivel: "primario",
      grado_num: 2,
      area: "Matemática",
      tema: "Numeración y Adición",
      competencia_especifica: "Aplica conceptos y algoritmos de suma...",
      indicador_logro: "Resuelve operaciones de adición...",
      fuente_documento: "Guía Didáctica de Matemática (MINERD / CON BASE)",
      version_curricular: "2023",
      pagina: 40,
      estado_validacion: "validado"
    }
  ];

  const textoConCitaValidaEInventada = 
    "En la Guía Didáctica de Matemática (pág. 40) se articulan las sumas con reagrupación. Además consulta la guía apócrifa (pág. 999).";

  const resultado = verificarYSanearCitas(textoConCitaValidaEInventada, fragmentosV2);

  // 1. Debe conservar la pág. 40 oficial
  assert.ok(resultado.includes("pág. 40"), "La página 40 oficial de herramientas V2 debe conservarse intacta");
  // 2. Debe sanear o eliminar la pág. 999 que no está respaldada
  assert.ok(!resultado.includes("999"), "La página ficticia 999 no respaldada debe ser saneada");
});
