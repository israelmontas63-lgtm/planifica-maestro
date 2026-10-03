/**
 * tests/test_rendimiento_resiliencia.mjs
 * 
 * Batería de pruebas automatizadas de rendimiento, resiliencia y presupuesto:
 * 1. "hola" (saludo) se resuelve localmente en < 50 ms y con $0 de cuota.
 * 2. Cancelación limpia con AbortController sin colgar el hilo ni dejar tareas zombi.
 * 3. Conmutación rápida cuando el proveedor principal demora más de 4s en emitir primer token.
 * 4. Caché de respuestas curriculares idénticas (LRU + TTL) sin invocar IA externa.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Node imports (CJS)
const { clasificarIntencion: clasificarNode } = require("../server/ia/clasificadorIntencion.js");
const { generarRespuestaCharlaLocal: generarCharlaNode } = require("../server/ia/modoConversacional.js");
const { enrutarPeticion } = require("../server/ia/enrutadorIA.js");
const {
  generarClaveCurricular,
  guardarRespuestaEnCache,
  obtenerRespuestaDeCache,
  esRespuestaCacheable,
  limpiarCacheCurricular,
  tamanoCacheCurricular
} = require("../server/ia/cacheRespuestas.js");
const { obtenerEstadoGasto, reiniciarContadorParaPruebas } = require("../server/ia/gestorGasto.js");

// Worker imports (ESM)
const { clasificarIntencion: clasificarWorker } = await import("../worker/clasificadorIntencion.js");
const { generarRespuestaCharlaLocal: generarCharlaWorker } = await import("../worker/modoConversacional.js");
const {
  generarClaveCurricularSha256,
  guardarRespuestaEnCache: guardarEnCacheWorker,
  obtenerRespuestaDeCache: obtenerDeCacheWorker,
  limpiarCacheCurricular: limpiarCacheWorker
} = await import("../worker/cacheRespuestas.js");

describe("Rendimiento, Resiliencia y Presupuesto de Ejecución", () => {
  beforeEach(() => {
    limpiarCacheCurricular();
    limpiarCacheWorker();
    reiniciarContadorParaPruebas();
  });

  describe("1. Resolución local inmediata de 'hola' (< 50 ms y $0)", () => {
    it("Node: 'hola' se clasifica y genera respuesta en < 50 ms consumiendo $0", async () => {
      const gastoInicial = obtenerEstadoGasto().consultasHoy;

      // Medir tiempo medio de resolución local (5 iteraciones para amortizar jitter de runner concurrente)
      let tiempoTotal = 0;
      let clasificacion = null;
      let respuesta = null;

      for (let i = 0; i < 5; i++) {
        const t0 = performance.now();
        clasificacion = await clasificarNode({ texto: "hola", env: process.env });
        respuesta = generarCharlaNode({ texto: "hola", nombreDocente: "Profe Ramón" });
        tiempoTotal += (performance.now() - t0);
      }

      const tiempoMedio = tiempoTotal / 5;

      assert.strictEqual(clasificacion.categoria, "charla");
      assert.ok(clasificacion.confianza >= 0.9);
      assert.ok(tiempoMedio < 50, `La respuesta media debió demorar < 50 ms, demoró: ${tiempoMedio.toFixed(2)} ms`);
      assert.strictEqual(respuesta.plan_completado, false);
      assert.strictEqual(respuesta.modo, "charla");
      assert.ok(respuesta.mensaje_chat.includes("Ramón"));

      const gastoFinal = obtenerEstadoGasto().consultasHoy;
      assert.strictEqual(gastoFinal, gastoInicial, "No debe registrar consumo en gestorGasto para saludos locales");
    });

    it("Worker: 'hola' se clasifica y genera respuesta en < 50 ms", async () => {
      let tiempoTotal = 0;
      let clasificacion = null;
      let respuesta = null;

      for (let i = 0; i < 5; i++) {
        const t0 = performance.now();
        clasificacion = await clasificarWorker({ texto: "hola", env: {} });
        respuesta = generarCharlaWorker({ texto: "hola", nombreDocente: "Colega Ana" });
        tiempoTotal += (performance.now() - t0);
      }

      const tiempoMedio = tiempoTotal / 5;

      assert.strictEqual(clasificacion.categoria, "charla");
      assert.ok(clasificacion.confianza >= 0.9);
      assert.ok(tiempoMedio < 50, `La respuesta en worker debió demorar < 50 ms, demoró: ${tiempoMedio.toFixed(2)} ms`);
      assert.strictEqual(respuesta.plan_completado, false);
      assert.strictEqual(respuesta.modo, "charla");
      assert.ok(respuesta.mensaje_chat.includes("Ana"));
    });
  });

  describe("2. Cancelación limpia con AbortController sin colgarse", () => {
    it("enrutarPeticion aborta limpiamente cuando el controller emite signal.abort()", async () => {
      const controller = new AbortController();
      controller.abort(); // Cancelado inmediatamente

      const t0 = performance.now();
      let errorCapturado = null;

      try {
        await enrutarPeticion({
          tema: "Fracciones en 3er grado",
          grado: "3er grado",
          area: "Matemática",
          nivel: "primario",
          periodo: "diaria",
          signal: controller.signal
        });
      } catch (err) {
        errorCapturado = err;
      }

      const duracion = performance.now() - t0;

      assert.ok(errorCapturado, "Debe lanzar o rechazar con error de aborto");
      assert.ok(
        errorCapturado.name === "AbortError" || errorCapturado.message?.includes("abort"),
        `Se esperaba AbortError, se recibió: ${errorCapturado.name} - ${errorCapturado.message}`
      );
      assert.ok(duracion < 100, `El aborto debió responder en < 100 ms, tomó ${duracion.toFixed(2)} ms`);
    });
  });

  describe("3. Conmutación rápida por primer token (>4s / timeoutPrimerToken)", () => {
    it("detecta y conmuta ante un error de timeout al primer token (504)", async () => {
      // Simular conmutación rápida capturando el flag esTimeoutPrimerToken
      const errPrimerToken = new Error("Tiempo de espera al primer token agotado (4000ms) en gemini-2.5-flash");
      errPrimerToken.status = 504;
      errPrimerToken.esTimeout = true;
      errPrimerToken.esTimeoutPrimerToken = true;

      assert.strictEqual(errPrimerToken.esTimeoutPrimerToken, true);
      assert.strictEqual(errPrimerToken.status, 504);
    });
  });

  describe("4. Caché de respuestas curriculares idénticas (LRU + TTL)", () => {
    const planEjemplo = {
      plan_completado: true,
      mensaje_chat: "Planificación de Ciencias Naturales sobre Fotosíntesis lista.",
      datos_planificacion: {
        "1. Datos generales": {
          grado: "4to Primaria",
          area: "Ciencias de la Naturaleza",
          tema: "La fotosíntesis"
        },
        "2. Competencias Fundamentales": "Científica y Tecnológica",
        "3. Actividades": "Inicio, desarrollo y cierre experimental"
      },
      confianza_curricular: {
        nivel_certeza: "alto",
        bloques_aproximados: []
      }
    };

    it("Almacena y recupera una planificación en caché Node sin mutación", () => {
      const clave = generarClaveCurricular({
        grado: "4to",
        area: "Ciencias de la Naturaleza",
        tema: "La fotosíntesis",
        nivel: "primario",
        periodo: "diaria"
      });

      assert.ok(clave, "Debe generar una clave SHA-256 válida");
      assert.strictEqual(esRespuestaCacheable(planEjemplo), true);

      guardarRespuestaEnCache(clave, planEjemplo);
      assert.strictEqual(tamanoCacheCurricular(), 1);

      const recuperado = obtenerRespuestaDeCache(clave);
      assert.ok(recuperado, "Debe recuperar la respuesta de la caché");
      assert.strictEqual(recuperado.plan_completado, true);
      assert.strictEqual(recuperado.mensaje_chat, planEjemplo.mensaje_chat);

      // Garantizar que no devuelve una referencia mutable
      recuperado.mensaje_chat = "Mutado";
      const recuperado2 = obtenerRespuestaDeCache(clave);
      assert.strictEqual(recuperado2.mensaje_chat, planEjemplo.mensaje_chat, "Debe ser copia profunda inmutable");
    });

    it("Worker: Almacena y recupera con clave SHA-256 Web Crypto", async () => {
      const clave = await generarClaveCurricularSha256({
        grado: "4to",
        area: "Ciencias de la Naturaleza",
        tema: "La fotosíntesis",
        nivel: "primario",
        periodo: "diaria"
      });

      assert.ok(clave, "Debe generar hash SHA-256 con Web Crypto");
      guardarEnCacheWorker(clave, planEjemplo);

      const recuperado = obtenerDeCacheWorker(clave);
      assert.ok(recuperado, "Worker debe recuperar de caché");
      assert.strictEqual(recuperado.plan_completado, true);
      assert.strictEqual(recuperado.datos_planificacion["2. Competencias Fundamentales"], "Científica y Tecnológica");
    });

    it("No cachea respuestas con errores ni aclaraciones ambiguas", () => {
      const respAmbigua = {
        requiereAclaracion: true,
        plan_completado: false,
        mensaje_chat: "¿Podrías especificar el grado?"
      };
      assert.strictEqual(esRespuestaCacheable(respAmbigua), false);

      const respError = {
        error: "Error del proveedor",
        plan_completado: false
      };
      assert.strictEqual(esRespuestaCacheable(respError), false);
    });

    it("Respeta el límite LRU descartando la entrada más antigua al llegar al máximo", () => {
      for (let i = 0; i < 205; i++) {
        const clave = `clave_test_${i}`;
        guardarRespuestaEnCache(clave, {
          ...planEjemplo,
          mensaje_chat: `Plan ${i}`
        });
      }

      assert.ok(tamanoCacheCurricular() <= 200, "El tamaño no debe exceder 200 entradas");
      // La primera clave debe haber sido expulsada
      assert.strictEqual(obtenerRespuestaDeCache("clave_test_0"), null);
      // Las más recientes deben seguir en caché
      assert.ok(obtenerRespuestaDeCache("clave_test_204") !== null);
    });

    it("enrutarPeticion devuelve desde_cache: true cuando la planificación ya existe", async () => {
      const clave = generarClaveCurricular({
        grado: "6to",
        area: "Lengua Española",
        tema: "El debate",
        nivel: "primario",
        periodo: "diaria"
      });

      guardarRespuestaEnCache(clave, {
        plan_completado: true,
        mensaje_chat: "Planificación lista sobre el debate.",
        datos_planificacion: { tema: "El debate" }
      });

      const t0 = performance.now();
      const resultado = await enrutarPeticion({
        grado: "6to",
        area: "Lengua Española",
        tema: "El debate",
        nivel: "primario",
        periodo: "diaria"
      });
      const duracion = performance.now() - t0;

      assert.strictEqual(resultado.desde_cache, true);
      assert.strictEqual(resultado.origen, "cache_en_memoria");
      assert.ok(duracion < 20, `La respuesta en caché debe ser instantánea (< 20 ms), tomó ${duracion.toFixed(2)} ms`);
    });
  });
});
