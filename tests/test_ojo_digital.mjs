import test from "node:test";
import assert from "node:assert/strict";
import {
  PROMPT_OJO_DIGITAL,
  generarOpcionesSegunTipoVisual,
  tieneIntencionExplicita,
  identificarImagenConVision
} from "../server/ia/ojoDigital.js";
import {
  PROMPT_OJO_DIGITAL as PROMPT_WORKER,
  generarOpcionesSegunTipoVisual as opcionesWorker,
  tieneIntencionExplicita as intencionWorker
} from "../worker/constantsOjoDigital.js";
import { identificarImagenWorker } from "../worker/ojoDigital.js";

test("ETAPA 1: Ojo Digital - Reglas y discriminación de intención", async (t) => {
  await t.test("1. tieneIntencionExplicita discrimina correctamente entre foto sola y foto con orden", () => {
    // Sin intención explícita -> debe disparar identificación previa
    assert.equal(tieneIntencionExplicita(""), false);
    assert.equal(tieneIntencionExplicita("   "), false);
    assert.equal(tieneIntencionExplicita(null), false);
    assert.equal(tieneIntencionExplicita(undefined), false);

    // Con intención explícita -> debe proceder de inmediato
    assert.equal(tieneIntencionExplicita("planifica con esto"), true);
    assert.equal(tieneIntencionExplicita("dime qué planta es"), true);
    assert.equal(tieneIntencionExplicita("extrae las preguntas de la foto"), true);
    assert.equal(tieneIntencionExplicita("explícame este ejercicio"), true);
    assert.equal(tieneIntencionExplicita("crea una clase de ciencias con esto"), true);

    // En Worker debe ser idéntico
    assert.equal(intencionWorker(""), false);
    assert.equal(intencionWorker("planifica con esto"), true);
  });

  await t.test("2. Generación adaptada de opciones interactivas según tipo visual", () => {
    // Documento o texto
    const opsDoc = generarOpcionesSegunTipoVisual("documento_o_texto", false);
    assert.ok(opsDoc.includes("Leer el texto de la imagen"));
    assert.ok(opsDoc.includes("Buscar en el currículo"));
    assert.ok(opsDoc.includes("Usarla como material de clase"));

    // Objeto o naturaleza
    const opsObj = generarOpcionesSegunTipoVisual("objeto_o_naturaleza", false);
    assert.ok(opsObj.includes("Cuéntame sobre esto"));
    assert.ok(opsObj.includes("Usarla como material de clase"));
    assert.ok(opsObj.includes("Buscar en el currículo"));

    // Mapa o geografía -> Debe incluir mapa interactivo
    const opsMapa = generarOpcionesSegunTipoVisual("mapa_o_geografia", false);
    assert.ok(opsMapa.some(o => o.toLowerCase().includes("mapa")));

    // Pizarra o ejercicio
    const opsPizarra = generarOpcionesSegunTipoVisual("pizarra_o_ejercicio", false);
    assert.ok(opsPizarra.includes("Leer el texto de la imagen"));
    assert.ok(opsPizarra.includes("Usarla como material de clase"));

    // Imagen borrosa o ilegible
    const opsBorrosa = generarOpcionesSegunTipoVisual("ilegible", true);
    assert.ok(opsBorrosa.includes("Tomar otra foto más clara"));

    // Paridad Node y Worker
    assert.deepEqual(opsDoc, opcionesWorker("documento_o_texto", false));
    assert.deepEqual(opsMapa, opcionesWorker("mapa_o_geografia", false));
  });

  await t.test("3. Prompts contienen defensa anti-inyección, advertencia de salud y concisión", () => {
    // Prompt Node
    assert.ok(PROMPT_OJO_DIGITAL.includes("SEGURIDAD ANTE PROMPTS INYECTADOS"), "Debe proteger contra inyecciones");
    assert.ok(PROMPT_OJO_DIGITAL.includes("1 o 2 frases"), "Debe exigir 1 o 2 frases claras");
    assert.ok(PROMPT_OJO_DIGITAL.includes("no debe consumirse ni medicarse"), "Debe prevenir veredictos médicos o consumo");
    assert.ok(PROMPT_OJO_DIGITAL.includes("es_delicado"), "Debe reportar flag de tema delicado");

    // Prompt Worker
    assert.ok(PROMPT_WORKER.includes("SEGURIDAD ANTE PROMPTS INYECTADOS"));
    assert.ok(PROMPT_WORKER.includes("1 o 2 frases"));
  });

  await t.test("4. Manejo honesto de falta de cuota o servicio no disponible en visión", async () => {
    // Si no hay GEMINI_API_KEY en el entorno
    const resNodeSinKey = await identificarImagenConVision({
      imageBase64: "aW1hZ2VuX2ZhY2hh",
      mediaType: "image/jpeg",
      env: { GEMINI_API_KEY: "" }
    });
    assert.equal(resNodeSinKey.exito, false);
    assert.ok(resNodeSinKey.mensaje.toLowerCase().includes("la cámara no está disponible"));

    const resWorkerSinKey = await identificarImagenWorker({
      imageBase64: "aW1hZ2VuX2ZhY2hh",
      mediaType: "image/jpeg",
      env: { GEMINI_API_KEY: "" }
    });
    assert.equal(resWorkerSinKey.exito, false);
    assert.ok(resWorkerSinKey.mensaje.toLowerCase().includes("la cámara no está disponible"));
  });
});
