import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";
import { obtenerOSetearSesionId } from "../client/src/api.js";
import { guardarTurnoConversacion, recuperarHistorialSesion } from "../worker/services/memoriaService.js";
import { generarClaveCache, guardarEnCache } from "../worker/services/cacheSemanticaService.js";

test("FASE 2 - Propuesta de Memoria y Caché Semántica en Streaming", async (t) => {

  await t.test("(a) el payload incluye sesionId UUID, estable dentro de la conversación y distinto en una nueva", () => {
    // Mock de sessionStorage
    const storage = new Map();
    globalThis.sessionStorage = {
      getItem: (k) => storage.get(k) || null,
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k)
    };

    // 1. Primera llamada genera sesionId UUID
    const id1 = obtenerOSetearSesionId();
    assert.ok(id1 && typeof id1 === "string", "Debe retornar un sesionId");
    assert.match(id1, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Debe tener formato UUID");

    // 2. Estable dentro de la misma conversación
    const id2 = obtenerOSetearSesionId();
    assert.equal(id1, id2, "Debe ser estable en la misma conversación");

    // 3. Distinto al forzar una conversación nueva
    const id3 = obtenerOSetearSesionId(true);
    assert.notEqual(id1, id3, "Debe generar un nuevo UUID al iniciar nueva conversación");
    assert.equal(obtenerOSetearSesionId(), id3, "El nuevo UUID debe persistir en sessionStorage");
  });

  await t.test("(b) con sesionId se guarda el turno y el historial vuelve en orden user, model", async () => {
    const sesionId = "00000000-1111-2222-3333-444444444444";
    const baseDatos = [];

    const mockEnv = {
      SUPABASE_URL: "https://mock.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "mock_key"
    };

    // Interceptar fetch para simular Supabase PostgREST
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      const urlStr = String(url);
      if (urlStr.includes("/rest/v1/chat_mensajes") && options.method === "POST") {
        const body = JSON.parse(options.body);
        if (Array.isArray(body)) {
          baseDatos.push(...body);
        } else {
          baseDatos.push(body);
        }
        return new Response(null, { status: 201 });
      }
      if (urlStr.includes("/rest/v1/rpc/obtener_historial_sesion") && options.method === "POST") {
        const { p_sesion_id } = JSON.parse(options.body);
        const filtrados = baseDatos
          .filter(m => m.sesion_id === p_sesion_id)
          .map((m, idx) => ({ id: idx + 1, rol: m.rol, contenido: m.contenido, creado_en: new Date().toISOString() }));
        return new Response(JSON.stringify(filtrados), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      return originalFetch(url, options);
    };

    try {
      // Guardar turno
      await guardarTurnoConversacion(mockEnv, sesionId, "Hola, planifica lengua española 3ro", "¡Hola! Con gusto planificamos.");

      // Recuperar historial
      const historial = await recuperarHistorialSesion(mockEnv, sesionId);

      assert.equal(historial.length, 2, "Deben haberse guardado y recuperado exactamente 2 mensajes (turno completo)");
      assert.equal(historial[0].role, "user", "El primer mensaje debe ser rol user");
      assert.equal(historial[0].parts[0].text, "Hola, planifica lengua española 3ro");
      assert.equal(historial[1].role, "model", "El segundo mensaje debe ser rol model");
      assert.equal(historial[1].parts[0].text, "¡Hola! Con gusto planificamos.");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test("(c) un segundo pedido idéntico en streaming sale de la caché sin llamar a Gemini", async () => {
    let llamadasGemini = 0;
    const cacheStorage = new Map();

    const mockEnv = {
      ACCESO_ABIERTO: "true",
      MODO_PRUEBA: "true",
      GEMINI_API_KEY: "mock_gemini_key",
      SUPABASE_URL: "https://mock.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "mock_key",
      STREAMING_PROGRESIVO: "true"
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      const urlStr = String(url);
      if (urlStr.includes("generativelanguage.googleapis.com")) {
        llamadasGemini++;
        return new Response("{}", { status: 500 });
      }
      if (urlStr.includes("/rest/v1/rpc/consultar_cache_planificacion")) {
        const { p_clave_hash } = JSON.parse(options.body);
        const hit = cacheStorage.get(p_clave_hash);
        return new Response(JSON.stringify(hit ? [hit] : []), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (urlStr.includes("/rest/v1/curriculo_cache_semantica")) {
        const body = JSON.parse(options.body);
        cacheStorage.set(body.clave_hash, body);
        return new Response(null, { status: 201 });
      }
      if (urlStr.includes("/rest/v1/chat_mensajes")) {
        return new Response(null, { status: 201 });
      }
      return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
    };

    try {
      // 1. Precargar en caché semántica un plan validado
      const clave = generarClaveCache(3, "Matemática", "la suma");
      cacheStorage.set(clave, {
        clave_hash: clave,
        grado: "3",
        area: "Matemática",
        tema_consulta: "la suma",
        plan_json: {
          tema: "La Suma",
          secuenciaDidactica: { inicio: "Inicio...", desarrollo: "Desarrollo...", cierre: "Cierre..." }
        }
      });

      // 2. Ejecutar petición en streaming hacia el Worker
      const req = new Request("https://planifica-maestro.test/api/plan/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream",
          "x-device-id": "dev_test_cache"
        },
        body: JSON.stringify({
          messages: [{ role: "user", text: "Quiero la planificación de Matemática 3.º tema la suma" }],
          nivel: "primario",
          stream: true,
          sesionId: "00000000-2222-3333-4444-555555555555"
        })
      });

      const res = await worker.fetch(req, mockEnv, {});

      assert.equal(res.status, 200);
      assert.equal(res.headers.get("X-Cache-Status"), "HIT", "Debe retornar cabecera X-Cache-Status: HIT");
      assert.match(res.headers.get("Content-Type"), /text\/event-stream/, "Debe responder en formato SSE streaming");
      assert.equal(llamadasGemini, 0, "No debe haber realizado ninguna llamada a Gemini");

      const bodyText = await res.text();
      assert.match(bodyText, /"estado":"recuperando_cache"/, "Debe emitir evento de estado inicial");
      assert.match(bodyText, /"plan_completado":true/, "Debe incluir plan_completado true");
      assert.match(bodyText, /data: \[DONE\]/, "Debe finalizar con [DONE]");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test("(d) un HIT no filtra datos del docente que lo generó", async () => {
    const mockEnv = {
      ACCESO_ABIERTO: "true",
      MODO_PRUEBA: "true",
      GEMINI_API_KEY: "mock_gemini_key",
      SUPABASE_URL: "https://mock.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "mock_key"
    };

    const originalFetch = globalThis.fetch;
    const clave = generarClaveCache(4, "Lengua Española", "el cuento");

    // En la caché está un plan generado previamente por "Prof. Maria Perez" de la "Escuela Republica de Colombia"
    const cacheMock = {
      clave_hash: clave,
      plan_json: {
        tema: "El Cuento",
        docente: "Prof. Maria Perez",
        centro: "Escuela Republica de Colombia",
        seccion: "4to B",
        fecha: "2026-11-01",
        estrategia: "Comprensión lectora"
      }
    };

    globalThis.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes("/rest/v1/rpc/consultar_cache_planificacion")) {
        return new Response(JSON.stringify([cacheMock]), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
    };

    try {
      // Docente B ("Prof. Juan Rodriguez") hace la misma petición
      const reqDocenteB = new Request("https://planifica-maestro.test/api/plan/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-id": "dev_docente_b"
        },
        body: JSON.stringify({
          messages: [{ role: "user", text: "Quiero la planificación de Lengua Española 4.º tema el cuento" }],
          nivel: "primario",
          docenteId: "docente_juan_rodriguez",
          stream: false
        })
      });

      const res = await worker.fetch(reqDocenteB, mockEnv, {});
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("X-Cache-Status"), "HIT");

      const json = await res.json();
      assert.notEqual(json.datos_planificacion.docente, "Prof. Maria Perez", "No debe filtrar el nombre del docente A");
      assert.notEqual(json.datos_planificacion.centro, "Escuela Republica de Colombia", "No debe filtrar la escuela del docente A");
      assert.equal(json.datos_planificacion.docente, "docente_juan_rodriguez", "Debe personalizarse con el docente actual");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

});
