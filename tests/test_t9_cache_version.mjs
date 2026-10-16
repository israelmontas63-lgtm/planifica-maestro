import test from "node:test";
import assert from "node:assert/strict";
import {
  obtenerClaveStringRawWorker,
  generarClaveCurricularSha256,
  guardarRespuestaEnCache,
  obtenerRespuestaDeCache,
  limpiarCacheCurricular
} from "../worker/cacheRespuestas.js";

test("T9 - Clave de caché incluye versiones de prompt y de herramientas", () => {
  const params = {
    grado: "3ro",
    area: "Matemática",
    tema: "Fracciones",
    nivel: "primario",
    periodo: "diaria",
    versionPrompt: "2.0.0",
    versionHerramientas: "2.0.0"
  };

  const raw = obtenerClaveStringRawWorker(params);
  assert.ok(raw.includes("2.0.0"));
  assert.equal(raw, "3ro|matemática|fracciones|primario|diaria|2.0.0|2.0.0");
});

test("T9 - Cambiar versionPrompt o versionHerramientas invalida hash y evita servir formato viejo", async () => {
  limpiarCacheCurricular();

  const paramsV1 = {
    grado: "3ro",
    area: "Matemática",
    tema: "Fracciones",
    nivel: "primario",
    periodo: "diaria",
    versionPrompt: "1.0.0",
    versionHerramientas: "1.0.0"
  };

  const paramsV2 = {
    grado: "3ro",
    area: "Matemática",
    tema: "Fracciones",
    nivel: "primario",
    periodo: "diaria",
    versionPrompt: "2.0.0",
    versionHerramientas: "2.0.0"
  };

  const hashV1 = await generarClaveCurricularSha256(paramsV1);
  const hashV2 = await generarClaveCurricularSha256(paramsV2);

  assert.notEqual(hashV1, hashV2, "Hashes de distintas versiones deben ser diferentes");

  // Guardar en caché bajo V1
  guardarRespuestaEnCache(hashV1, { formato: "viejo", plan_completado: true, datos_planificacion: {} });

  // Consultar con clave V2 -> debe ser null (no servir formato viejo)
  assert.equal(obtenerRespuestaDeCache(hashV2), null);
  assert.notEqual(obtenerRespuestaDeCache(hashV1), null);
});
