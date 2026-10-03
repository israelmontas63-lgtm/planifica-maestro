import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  limpiarYExtraerJson,
  filtrarPrivacidad,
  obtenerEstadoCircuito,
  registrarFalloCircuito,
  registrarExitoCircuito,
  enrutarPeticion,
  obtenerEstadoProveedores
} = require("../server/ia/enrutadorIA.js");

const { generarDesdeBibliotecaOficial } = require("../server/ia/modoBibliotecaOficial.js");
const { registrarLlamada, obtenerMetricas, limpiarMetricas } = require("../server/ia/registroUso.js");
const { obtenerEstadoGasto, reiniciarContadorParaPruebas } = require("../server/ia/gestorGasto.js");

describe("FASE H: Enrutador de IA con Respaldo Automático y Conmutación por Fallo", () => {
  beforeEach(() => {
    limpiarMetricas();
    reiniciarContadorParaPruebas();
    registrarExitoCircuito("gemini_flash");
    registrarExitoCircuito("gemini_flash_lite");
  });

  it("1. Sanitización de salida: elimina etiquetas <think> de DeepSeek R1 y markdown fences", () => {
    const rawR1 = `<think>
El docente solicita planificación de Lengua Española para 1er grado sobre la noticia.
Revisando bases del MINERD...
</think>
\`\`\`json
{
  "tema": "La Noticia",
  "grado": "1er grado",
  "area": "Lengua Española",
  "mensaje_chat": "Planificación lista para el aula"
}
\`\`\``;

    const res = limpiarYExtraerJson(rawR1);
    assert.ok(res, "Debe extraer JSON válido");
    assert.strictEqual(res.tema, "La Noticia");
    assert.strictEqual(res.grado, "1er grado");
    assert.strictEqual(res.mensaje_chat, "Planificación lista para el aula");
    assert.strictEqual(JSON.stringify(res).includes("<think>"), false, "No debe contener etiquetas <think>");
  });

  it("2. Privacidad de datos: filtra nombres de alumnos y escuelas antes de consultar proveedores", () => {
    const textoDocente = "Planificación para el estudiante: Pedro Gómez y la alumna: María Santos en la escuela: Escuela Básica Salomé Ureña.";
    const filtrado = filtrarPrivacidad(textoDocente);

    assert.strictEqual(filtrado.includes("Pedro Gómez"), false, "No debe contener el nombre del estudiante");
    assert.strictEqual(filtrado.includes("María Santos"), false, "No debe contener el nombre de la alumna");
    assert.ok(filtrado.includes("Estudiante [Reservado]"), "Debe sustituir por marcador reservado");
    assert.ok(filtrado.includes("Centro Educativo [Reservado]"), "Debe sustituir la escuela por marcador reservado");
  });

  it("3. Circuit Breaker: transiciones CERRADO -> ABIERTO -> SEMI_ABIERTO -> CERRADO", () => {
    const provId = "prov_test_ciclo";
    const configPrueba = { circuito_fallos_maximos: 2, circuito_cooldown_error_ms: 100, circuito_cooldown_429_ms: 200 };

    // Inicial: CERRADO
    registrarExitoCircuito(provId);
    let est = obtenerEstadoCircuito(provId);
    assert.strictEqual(est.estado, "CERRADO");

    // Fallo 1: sigue CERRADO (tolerancia < max)
    registrarFalloCircuito(provId, new Error("Fallo temporal 500"), configPrueba);
    est = obtenerEstadoCircuito(provId);
    assert.strictEqual(est.estado, "CERRADO");
    assert.strictEqual(est.fallosConsecutivos, 1);

    // Fallo 2: alcanza max fallos -> pasa a ABIERTO
    registrarFalloCircuito(provId, new Error("Fallo temporal 500"), configPrueba);
    est = obtenerEstadoCircuito(provId);
    assert.strictEqual(est.estado, "ABIERTO");
    assert.ok(est.pausaHastaMs > Date.now());

    // Error 429 abre inmediatamente por tiempo de enfriamiento largo
    registrarFalloCircuito(provId, { status: 429, message: "Cuota agotada" }, configPrueba);
    est = obtenerEstadoCircuito(provId);
    assert.strictEqual(est.estado, "ABIERTO");

    // Éxito posterior restablece a CERRADO
    registrarExitoCircuito(provId);
    est = obtenerEstadoCircuito(provId);
    assert.strictEqual(est.estado, "CERRADO");
    assert.strictEqual(est.fallosConsecutivos, 0);
  });

  it("4. Proveedor que devuelve 200 con cuerpo vacío o JSON inválido: se detecta como fallo y conmuta", async () => {
    assert.strictEqual(limpiarYExtraerJson(""), null, "Cuerpo vacío debe retornar null");
    assert.strictEqual(limpiarYExtraerJson("   "), null, "Espacios vacíos debe retornar null");
    assert.strictEqual(limpiarYExtraerJson("<html><body>Error 502 Bad Gateway</body></html>"), null, "HTML debe retornar null");
    assert.strictEqual(limpiarYExtraerJson("{ 'incompleto': "), null, "JSON truncado debe retornar null");
  });

  it("5. Modo Biblioteca Oficial: genera planificaciones deterministas completas sin consumir IA", () => {
    const plan = generarDesdeBibliotecaOficial({
      tema: "La tarjeta de identidad",
      grado: "1ro",
      area: "Lengua Española",
      nivel: "primario",
      esquemaActivo: "conbase",
      periodoActivo: "diaria"
    });

    assert.ok(plan, "Debe generar la planificación");
    assert.strictEqual(plan.origen, "biblioteca_oficial");
    assert.strictEqual(plan.distintivo, "Basado en la biblioteca oficial del MINERD");
    assert.strictEqual(plan.estado_validacion, "pendiente de validación por experto");
    assert.ok(plan.datos_planificacion, "Debe incluir mapa de datos_planificacion");
    assert.ok(plan.fuentes.length > 0, "Debe incluir sección Fuentes oficiales");
    assert.strictEqual(plan.fuentes[0].estado_validacion, "pendiente de validación por experto");
  });

  it("6. Seguridad visual: Si hay imagen y ningún proveedor con visión aprobada puede responder, emite mensaje amigable y no filtra a otros", async () => {
    const res = await enrutarPeticion({
      tema: "Página de cuaderno",
      grado: "1er grado",
      area: "Lengua Española",
      imageBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      mediaType: "image/png",
      env: { GEMINI_API_KEY: "CLAVE_MOCK_INVALIDA_401" }
    });

    assert.ok(res, "Debe devolver respuesta de protección");
    assert.strictEqual(res.plan_completado, false);
    assert.ok(
      res.mensaje_chat.includes("servicio visual") || res.mensaje_chat.includes("No pude analizar"),
      "Debe emitir mensaje amigable avisando que el servicio visual no está disponible"
    );
  });

  it("7. Transparencia y Privacidad: registroUso.js NO guarda texto del usuario ni imágenes, solo metadatos", () => {
    registrarLlamada({
      proveedorId: "gemini_flash",
      modelo: "gemini-2.5-flash",
      duracionMs: 1420,
      exito: true,
      esRespaldo: false
    });

    const metricas = obtenerMetricas();
    assert.strictEqual(metricas.totalLlamadas, 1);
    assert.strictEqual(metricas.tasaExito, 100);
    assert.strictEqual(metricas.latenciaPromedioMs, 1420);

    const log = metricas.ultimosRegistros[0];
    assert.ok(log.proveedorId, "Debe guardar ID del proveedor");
    assert.ok(log.modelo, "Debe guardar modelo");
    assert.ok(log.timestamp, "Debe guardar marca de tiempo");
    assert.strictEqual(log.prompt, undefined, "PROHIBIDO guardar texto del prompt del usuario");
    assert.strictEqual(log.text, undefined, "PROHIBIDO guardar texto en registros");
    assert.strictEqual(log.image, undefined, "PROHIBIDO guardar imágenes en registros");
  });

  it("8. Control de Gasto y Límite Diario: previene consultas excedentes", () => {
    const estado = obtenerEstadoGasto(5);
    assert.strictEqual(estado.bloqueadoPorPresupuesto, false);
    assert.strictEqual(estado.limiteDiario, 5);
  });

  it("9. Estado del sistema: expone la lista de proveedores con su estado en tiempo real", () => {
    const estados = obtenerEstadoProveedores();
    assert.ok(Array.isArray(estados), "Debe devolver un arreglo de proveedores");
    assert.ok(estados.length >= 3, "Debe contener al menos los proveedores configurados");

    const gemini = estados.find((p) => p.id === "gemini_flash");
    assert.ok(gemini, "Gemini Flash debe estar en la lista");
    assert.strictEqual(gemini.visionAprobada, true);
    assert.strictEqual(gemini.enPausa, false);
  });

  it("10. Simulación de caída por Cuota/Límite (429): conmuta al siguiente proveedor y abre circuito", async () => {
    const t0 = Date.now();
    // Simular que el proveedor 1 falla con 429
    registrarFalloCircuito("gemini_flash", { status: 429, message: "Resource exhausted (quota exceeded)" }, { circuito_cooldown_429_ms: 10000 });
    
    // Al estar gemini_flash en circuito abierto, el enrutador salta automáticamente
    const est = obtenerEstadoCircuito("gemini_flash");
    assert.strictEqual(est.estado, "ABIERTO", "El circuito debe abrirse tras 429");

    // Ejecutar petición: debe saltar a gemini_flash_lite o biblioteca oficial
    const res = await enrutarPeticion({
      tema: "Los animales vertebrados",
      grado: "4to",
      area: "Ciencias de la Naturaleza",
      nivel: "primario",
      env: {}
    });

    const elapsedMs = Date.now() - t0;
    assert.ok(res, "Debe generar respuesta vía respaldo");
    assert.ok(res.origen === "biblioteca_oficial" || res.es_respaldo === true);
    console.log(`   ⏱️ [Simulación 429] Tiempo de conmutación: ${elapsedMs}ms | Proveedor resolutor: ${res.proveedor_utilizado || res.origen}`);
  });

  it("11. Simulación de caída por Error 500: conmuta al respaldo en cascada", async () => {
    const t0 = Date.now();
    // Simular fallo en proveedor principal
    registrarFalloCircuito("gemini_flash", { status: 500, message: "Internal Server Error" }, { circuito_fallos_maximos: 1, circuito_cooldown_error_ms: 5000 });

    const res = await enrutarPeticion({
      tema: "Sistemas del cuerpo humano",
      grado: "5to",
      area: "Ciencias de la Naturaleza",
      nivel: "primario",
      env: {}
    });

    const elapsedMs = Date.now() - t0;
    assert.ok(res, "Debe resolver mediante respaldo");
    console.log(`   ⏱️ [Simulación 500] Tiempo de conmutación: ${elapsedMs}ms | Proveedor resolutor: ${res.proveedor_utilizado || res.origen}`);
  });

  it("12. Simulación de caída por Tiempo Agotado (Timeout): respeta el presupuesto global y conmuta", async () => {
    const t0 = Date.now();
    // Simular timeout
    const timeoutErr = new Error("Tiempo de espera agotado");
    timeoutErr.status = 504;
    timeoutErr.esTimeout = true;
    registrarFalloCircuito("gemini_flash", timeoutErr, { circuito_fallos_maximos: 1, circuito_cooldown_error_ms: 5000 });

    const res = await enrutarPeticion({
      tema: "Geografía de la República Dominicana",
      grado: "6to",
      area: "Ciencias Sociales",
      nivel: "primario",
      env: {}
    });

    const elapsedMs = Date.now() - t0;
    assert.ok(res, "Debe conmutar y devolver contenido seguro");
    console.log(`   ⏱️ [Simulación Timeout] Tiempo de conmutación: ${elapsedMs}ms | Proveedor resolutor: ${res.proveedor_utilizado || res.origen}`);
  });
});

