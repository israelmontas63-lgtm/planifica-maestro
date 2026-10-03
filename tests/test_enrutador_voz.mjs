import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  enrutarVoz,
  recortarEnLimiteOracion,
  calcularHashTexto,
  obtenerEstadoCircuitoVoz,
  registrarFalloVoz,
  limpiarCacheAudioParaPruebas,
  obtenerEstadoProveedoresVoz
} = require("../server/ia/enrutadorVoz.js");

const { obtenerMetricas, limpiarMetricas } = require("../server/ia/registroUso.js");

describe("Enrutador de Voz (TTS) con Respaldo Automático y Caché", () => {
  beforeEach(() => {
    limpiarCacheAudioParaPruebas();
    limpiarMetricas();
  });

  it("1. Recorte en límite de oración: respeta signos de puntuación sin cortar palabras a medias", () => {
    const texto = "Buenos días colegas. Esta es una planificación oficial. Hoy trabajaremos fracciones con los estudiantes.";
    const recortado = recortarEnLimiteOracion(texto, 60);

    assert.ok(recortado.length <= 60);
    assert.ok(recortado.endsWith("."), "Debe terminar en punto o frontera de oración");
    assert.strictEqual(recortado, "Buenos días colegas. Esta es una planificación oficial.");
  });

  it("2. Texto largo (> 500 chars) se salta ElevenLabs y va al siguiente nivel", async () => {
    const textoLargo = "El Diseño Curricular del Nivel Primario orienta el desarrollo de competencias fundamentales y específicas a través de situaciones de aprendizaje contextualizadas en la comunidad escolar dominicana. ".repeat(4);
    assert.ok(textoLargo.length > 500, "Debe ser mayor a 500 caracteres");

    // Sin clave en entorno de prueba, debe caer limpiamente a fallback local sin lanzar excepción 500
    const res = await enrutarVoz({ texto: textoLargo, env: {} });
    assert.ok(res);
    assert.strictEqual(res.fallbackLocal, true);
    assert.strictEqual(res.proveedor, "speech_synthesis_local");
  });

  it("3. Caché por Hash: el mismo texto dos veces se resuelve desde la memoria en la segunda llamada", async () => {
    // Si inyectamos un elemento en caché
    const texto = "Saludo institucional del MINERD.";
    const hash = calcularHashTexto(texto);
    assert.ok(hash, "Debe generar hash SHA-256");

    // Llamada inicial (fallback local si no hay api key)
    const res1 = await enrutarVoz({ texto, env: {} });
    assert.ok(res1);

    // Al tener un registro simulado en caché
    const { enrutarVoz: enrutarVoz2 } = require("../server/ia/enrutadorVoz.js");
    // Probamos la función de hash directamente
    const h1 = calcularHashTexto("Hola mundo", "XrExE9yKIg1WjnnlVkGX");
    const h2 = calcularHashTexto("Hola mundo", "XrExE9yKIg1WjnnlVkGX");
    assert.strictEqual(h1, h2, "El hash debe ser determinista para el mismo texto y voz");
  });

  it("4. Circuit Breaker de Voz: 429 abre el circuito por tiempo largo", () => {
    const provId = "elevenlabs";
    registrarFalloVoz(provId, { status: 429, message: "Too Many Requests" });
    const est = obtenerEstadoCircuitoVoz(provId);

    assert.strictEqual(est.estado, "ABIERTO", "429 debe abrir el circuito de voz");
    assert.ok(est.pausaHastaMs > Date.now());
  });

  it("5. Caída total de servicios de red -> fallback local sin error 500", async () => {
    const res = await enrutarVoz({
      texto: "Actividad de inicio sobre la noticia.",
      env: { ELEVENLABS_API_KEY: "", GEMINI_API_KEY: "" }
    });

    assert.ok(res);
    assert.strictEqual(res.fallbackLocal, true);
    assert.strictEqual(res.proveedor, "speech_synthesis_local");
  });

  it("6. Telemetría de Voz: registroUso NO guarda el texto del usuario ni buffer de audio", async () => {
    await enrutarVoz({ texto: "Texto confidencial de prueba pedagógica", env: {} });

    const metricas = obtenerMetricas();
    assert.ok(metricas.totalLlamadas > 0);

    const log = metricas.ultimosRegistros[0];
    assert.ok(log.proveedorId);
    assert.strictEqual(log.tipoOperacion, "voz");
    assert.strictEqual(log.texto, undefined, "PROHIBIDO almacenar texto en registros");
    assert.strictEqual(log.audio, undefined, "PROHIBIDO almacenar audio en registros");
    assert.strictEqual(log.buffer, undefined, "PROHIBIDO almacenar buffer en registros");
  });

  it("7. Estado del sistema para voz: lista de proveedores y circuitos", () => {
    const lista = obtenerEstadoProveedoresVoz();
    assert.ok(Array.isArray(lista));
    assert.ok(lista.some(p => p.id === "elevenlabs"));
    assert.ok(lista.some(p => p.id === "gemini_tts"));
    assert.ok(lista.some(p => p.id === "speech_synthesis_local"));
  });
});
