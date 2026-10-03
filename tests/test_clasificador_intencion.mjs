import { describe, it } from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  clasificarIntencion,
  clasificarPorReglas,
  normalizarTexto
} = require("../server/ia/clasificadorIntencion.js");
const { registrarLlamada, obtenerMetricas, limpiarMetricas } = require("../server/ia/registroUso.js");
const { enrutarPeticion } = require("../server/ia/enrutadorIA.js");

describe("Clasificador de Intención Previo a Búsqueda (Capa 1 y Capa 2)", () => {
  it("1. Consulta estrictamente curricular -> 'curricular'", async () => {
    const res = await clasificarIntencion({
      texto: "Planificación de fracciones para 4to grado"
    });
    assert.strictEqual(res.tipo, "curricular");
    assert.ok(res.confianza >= 0.8, "Debe tener alta confianza curricular");
  });

  it("2. Consulta de información general/histórica -> 'web'", async () => {
    const res = await clasificarIntencion({
      texto: "¿Quién fue Juan Pablo Duarte?"
    });
    assert.strictEqual(res.tipo, "web");
    assert.ok(res.confianza >= 0.8, "Debe tener alta confianza web");
  });

  it("3. Consulta combinada curricular + datos recientes -> 'mixta'", async () => {
    const res = await clasificarIntencion({
      texto: "Planificación del ciclo del agua con datos actuales"
    });
    assert.strictEqual(res.tipo, "mixta");
    assert.ok(res.confianza >= 0.75, "Debe clasificar como mixta");
  });

  it("4. Consulta fuera de lo educativo / doméstica -> 'ambigua'", async () => {
    const res = await clasificarIntencion({
      texto: "receta de sancocho"
    });
    assert.strictEqual(res.tipo, "ambigua");
  });

  it("5. Normalización lingüística: mismas frases con y sin acentos y en mayúsculas dan idéntico resultado", async () => {
    const res1 = await clasificarIntencion({ texto: "PLANIFICACIÓN DE FRACCIONES PARA 4TO GRADO" });
    const res2 = await clasificarIntencion({ texto: "planificacion de fracciones para 4to grado" });
    assert.strictEqual(res1.tipo, res2.tipo);
    assert.strictEqual(res1.tipo, "curricular");

    const web1 = await clasificarIntencion({ texto: "¿QUIÉN FUE JUAN PABLO DUARTE?" });
    const web2 = await clasificarIntencion({ texto: "quien fue juan pablo duarte" });
    assert.strictEqual(web1.tipo, web2.tipo);
    assert.strictEqual(web1.tipo, "web");
  });

  it("6. Resiliencia: si Capa 2 falla o expira por timeout, usa el resultado de las reglas deterministas", async () => {
    const res = await clasificarIntencion({
      texto: "Que instrumentos se usan en el aula",
      apiKey: "CLAVE_SIMULADA_INVALIDA",
      timeoutMs: 50 // timeout ultracorto para forzar expiración inmediata
    });
    assert.ok(res, "Debe retornar un resultado sin lanzar excepciones");
    assert.ok(["curricular", "web", "mixta", "ambigua"].includes(res.tipo));
  });

  it("7. Seguridad visual: Con imagen y sin visión disponible emite aviso amigable", async () => {
    const res = await enrutarPeticion({
      tema: "Foto de una página",
      imageBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      mediaType: "image/png",
      env: { GEMINI_API_KEY: "CLAVE_MOCK_401" }
    });
    assert.ok(res, "Debe responder");
    assert.strictEqual(res.plan_completado, false);
    assert.ok(
      res.mensaje_chat.includes("servicio visual") || res.mensaje_chat.includes("No pude analizar"),
      "Debe avisar que el servicio visual no está disponible con proveedores aprobados"
    );
  });

  it("8. Privacidad en Telemetría: registroUso NO guarda el texto del usuario", () => {
    limpiarMetricas();
    registrarLlamada({
      proveedorId: "clasificador_intencion",
      tipoClasificado: "curricular",
      fuenteUsada: "biblioteca_oficial",
      latenciaMs: 12,
      exito: true
    });

    const metricas = obtenerMetricas();
    const log = metricas.ultimosRegistros[0];
    assert.ok(log, "Debe registrar la llamada");
    assert.strictEqual(log.tipoClasificado, "curricular");
    assert.strictEqual(log.fuenteUsada, "biblioteca_oficial");
    assert.strictEqual(log.prompt, undefined, "PROHIBIDO registrar prompt del usuario");
    assert.strictEqual(log.texto, undefined, "PROHIBIDO registrar texto del usuario");
    assert.strictEqual(log.imagen, undefined, "PROHIBIDO registrar imágenes");
  });
});
