import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";

const envBase = {
  APP_ACCESS_KEY: "clave-institucional-test",
  RATE_LIMIT_DISPOSITIVO_DIARIO: "100",
  SUPABASE_URL: "https://test-supabase.supabase.co",
  SUPABASE_ANON_KEY: "anon-key-test"
};

test("A1.1 - Fila con coincide_tema true: muestra su tema y su página real", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (typeof url === "string" && url.includes("/rest/v1/rpc/buscar_curriculo_secuencias")) {
      return new Response(JSON.stringify([
        {
          source_id: "SEC-TEST-001",
          grado_num: 2,
          area: "Lengua Española",
          tema: "La Noticia",
          competencia_especifica: "Comprende noticias sencillas",
          indicador_logro: "Identifica la estructura de la noticia",
          fuente_documento: "Adecuación Curricular MINERD",
          pagina: 75,
          coincide_tema: true,
          estado_validacion: "validado"
        }
      ]), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return originalFetch(url, options);
  };

  try {
    const req = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-key": "clave-institucional-test",
        "x-docente-id": "docente_test_a1_1"
      },
      body: JSON.stringify({
        confirmado: true,
        messages: [{ role: "user", text: "¿Cuáles son los contenidos de La Noticia para 2do de primaria en Lengua Española?" }]
      })
    });

    const res = await worker.fetch(req, envBase);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.modo, "consulta_curricular");
    assert.match(data.mensaje_chat, /La Noticia/);
    assert.match(data.mensaje_chat, /\(pág\.\s*75\)/);
    assert.doesNotMatch(data.mensaje_chat, /pendiente de validación/i);
    assert.equal(data.fragmentos.length, 1);
    assert.equal(data.fragmentos[0].pagina, 75);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("A1.2 - Solo filas coincide_tema false: aparece 'No encontré' y no muestra el contenido como respuesta", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (typeof url === "string" && url.includes("/rest/v1/rpc/buscar_curriculo_secuencias")) {
      return new Response(JSON.stringify([
        {
          source_id: "SEC-TEST-002",
          grado_num: 2,
          area: "Matemática",
          tema: "Geometría Espacial",
          competencia_especifica: "Describe cuerpos geométricos",
          indicador_logro: "Identifica pirámides",
          fuente_documento: "Adecuación Curricular MINERD",
          pagina: 118,
          coincide_tema: false,
          estado_validacion: "validado"
        }
      ]), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return originalFetch(url, options);
  };

  try {
    const req = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-key": "clave-institucional-test",
        "x-docente-id": "docente_test_a1_2"
      },
      body: JSON.stringify({
        confirmado: true,
        messages: [{ role: "user", text: "¿Cuáles son los contenidos de Fracciones para 2do de primaria en Matemática según el currículo?" }]
      })
    });

    const res = await worker.fetch(req, envBase);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.match(data.mensaje_chat, /No encontré en la base curricular cargada una secuencia verificada/i);
    assert.doesNotMatch(data.mensaje_chat, /Describe cuerpos geométricos/);
    assert.equal(data.fragmentos.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("A1.3 - 0 filas: NO aparece 'pág. 1', ni 'Adecuación Curricular MINERD', ni 'Consulta Curricular Oficial'", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (typeof url === "string" && url.includes("/rest/v1/rpc/buscar_curriculo_secuencias")) {
      return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return originalFetch(url, options);
  };

  try {
    const req = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-key": "clave-institucional-test",
        "x-docente-id": "docente_test_a1_3"
      },
      body: JSON.stringify({
        confirmado: true,
        messages: [{ role: "user", text: "¿Cuáles son los contenidos de Termodinámica Cuántica para 3er grado de Primaria en Matemática según el currículo?" }]
      })
    });

    const res = await worker.fetch(req, envBase);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.doesNotMatch(data.mensaje_chat, /pág\.\s*1\b/i);
    assert.doesNotMatch(data.mensaje_chat, /Adecuación Curricular MINERD/i);
    assert.doesNotMatch(data.mensaje_chat, /Consulta Curricular Oficial/i);
    assert.equal(data.fragmentos.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("A1.4 - Fila con estado_validacion distinto de 'validado': Fuente añade '(pendiente de validación)'", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (typeof url === "string" && url.includes("/rest/v1/rpc/buscar_curriculo_secuencias")) {
      return new Response(JSON.stringify([
        {
          source_id: "SEC-TEST-004",
          grado_num: 2,
          area: "Lengua Española",
          tema: "La Noticia Pendiente",
          competencia_especifica: "Analiza la noticia",
          indicador_logro: "Explica las causas",
          fuente_documento: "Diseño Curricular MINERD",
          pagina: 142,
          coincide_tema: true,
          estado_validacion: "pendiente_validacion"
        }
      ]), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return originalFetch(url, options);
  };

  try {
    const req = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-key": "clave-institucional-test",
        "x-docente-id": "docente_test_a1_4"
      },
      body: JSON.stringify({
        confirmado: true,
        messages: [{ role: "user", text: "¿Cuáles son los contenidos de La Noticia Pendiente para 2do de Primaria en Lengua Española?" }]
      })
    });

    const res = await worker.fetch(req, envBase);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.match(data.mensaje_chat, /Fuente:.*\(pág\.\s*142\)\s*\(pendiente de validación\)/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("A1.5 - Término del glosario sin filas: encabezado de glosario local sin página", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (typeof url === "string" && url.includes("/rest/v1/rpc/buscar_curriculo_secuencias")) {
      return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return originalFetch(url, options);
  };

  try {
    const req = new Request("http://localhost/api/plan/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-key": "clave-institucional-test",
        "x-docente-id": "docente_test_a1_5"
      },
      body: JSON.stringify({
        confirmado: true,
        messages: [{ role: "user", text: "¿Cuáles son los contenidos en el currículo sobre tanda extendida?" }]
      })
    });

    const res = await worker.fetch(req, envBase);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.match(data.mensaje_chat, /Glosario de Planifica Maestro \(referencia local, no es cita del currículo oficial\)/i);
    assert.doesNotMatch(data.mensaje_chat, /pág\./i);
    assert.doesNotMatch(data.mensaje_chat, /Oficial/);
    assert.equal(data.fragmentos.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
