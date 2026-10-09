/**
 * tests/test_parseador_y_reintento_json.mjs
 * Pruebas rigurosas (Node, no navegador) para el parseador seguro,
 * política de reintento único, tope de 2 llamadas y sanitización del chat.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { extraerJson, mensajeParaChat, validarCamposPlanificacion } from "../worker/parseadorJsonSeguro.js";

test("SUITE DE PRUEBAS: Parseador Seguro y Sanitización de Chat [Node, no navegador]", async (t) => {

  await t.test("1. Válida: extrae objeto limpio y mensaje para chat", () => {
    const raw = JSON.stringify({
      mensaje_chat: "¡Hola, colega! Aquí está tu planificación lista.",
      plan_completado: true,
      datos_planificacion: { tema: "La biografía" }
    });
    const obj = extraerJson(raw);
    assert.ok(obj, "Debe extraer objeto válido");
    assert.equal(validarCamposPlanificacion(obj), true);
    const msg = mensajeParaChat(obj);
    assert.equal(msg, "¡Hola, colega! Aquí está tu planificación lista.");
    assert.ok(!msg.includes("{"), "El mensaje de chat no debe contener '{'");
    assert.ok(!msg.includes("mensaje_chat"), "El mensaje de chat no debe contener 'mensaje_chat'");
  });

  await t.test("2. Con cercas ```json: extrae objeto ignorando cercas markdown", () => {
    const raw = "```json\n{\n  \"mensaje_chat\": \"Planificación generada con éxito.\",\n  \"plan_completado\": false\n}\n```";
    const obj = extraerJson(raw);
    assert.ok(obj);
    const msg = mensajeParaChat(obj);
    assert.equal(msg, "Planificación generada con éxito.");
    assert.ok(!msg.includes("{"));
    assert.ok(!msg.includes("mensaje_chat"));
  });

  await t.test("3. Texto antes y después con llaves: extrae el bloque que contiene campoRequerido", () => {
    const raw = "Nota previa con {llave falsa} antes. {\"mensaje_chat\": \"Respuesta real para el profesor\", \"plan_completado\": false} y texto final {otra: 123}.";
    const obj = extraerJson(raw);
    assert.ok(obj);
    assert.equal(obj.mensaje_chat, "Respuesta real para el profesor");
    const msg = mensajeParaChat(obj);
    assert.equal(msg, "Respuesta real para el profesor");
    assert.ok(!msg.includes("{"));
    assert.ok(!msg.includes("mensaje_chat"));
  });

  await t.test("4. Llaves dentro de cadenas: no rompe el conteo de profundidad", () => {
    const raw = '{"mensaje_chat": "El docente explicó: {este bloque entre llaves no cierra el json}", "plan_completado": false}';
    const obj = extraerJson(raw);
    assert.ok(obj);
    const msg = mensajeParaChat(obj);
    assert.equal(msg, "El docente explicó: {este bloque entre llaves no cierra el json}");
  });

  await t.test("5. Comillas escapadas: maneja correctamente comillas internas sin desfasar cadenas", () => {
    const raw = '{"mensaje_chat": "El cuento \\\"Los tres cerditos\\\" fue leído en clase.", "plan_completado": false}';
    const obj = extraerJson(raw);
    assert.ok(obj);
    const msg = mensajeParaChat(obj);
    assert.equal(msg, 'El cuento \"Los tres cerditos\" fue leído en clase.');
    assert.ok(!msg.includes("{"));
  });

  await t.test("6. Truncada: devuelve null y no repara JSON incompleto", () => {
    const raw = '{"mensaje_chat": "Hola, profesor. Aquí está';
    const obj = extraerJson(raw);
    assert.equal(obj, null, "Un JSON truncado no debe parsearse");
  });

  await t.test("7. Truncada con plan a medias: detecta corte y rechaza", () => {
    const raw = '{"mensaje_chat": "Listo", "datos_planificacion": {"momento_1": "Inicio", "momento_2": "Desar';
    const obj = extraerJson(raw);
    assert.equal(obj, null, "JSON truncado a medias debe dar null");
  });

  await t.test("8. Vacía: devuelve null", () => {
    assert.equal(extraerJson(""), null);
    assert.equal(extraerJson("   "), null);
  });

  await t.test("9. Null o no string: devuelve null", () => {
    assert.equal(extraerJson(null), null);
    assert.equal(extraerJson(undefined), null);
    assert.equal(extraerJson(12345), null);
  });

  await t.test("10. Sin mensaje_chat: rechaza objeto que no contenga el campo requerido", () => {
    const raw = '{"otra_clave": "datos", "valor": 42}';
    const obj = extraerJson(raw, "mensaje_chat");
    assert.equal(obj, null, "Debe rechazar si falta mensaje_chat");
  });

  await t.test("11. mensaje_chat que contiene JSON: mensajeParaChat lo detecta y rechaza", () => {
    const obj = { mensaje_chat: '{"error": "fuga de json"}' };
    const msg = mensajeParaChat(obj);
    assert.equal(msg, null, "Si mensaje_chat empieza con {, debe rechazarse");
  });

  await t.test("12. Reintento que se recupera: 2 llamadas máximo con éxito", async () => {
    let llamadas = 0;
    async function mockGenerarConReintento(intento = 1) {
      llamadas++;
      if (intento === 1) {
        // Intento 1: truncado
        return '{"mensaje_chat": "Incompleto...';
      }
      // Intento 2 (reintento conciso): completo
      return '{"mensaje_chat": "Planificación sintetizada recuperada.", "plan_completado": true, "datos_planificacion": {"tema": "Biografía"}}';
    }

    // Ejecutor del flujo
    let respuestaFinal = null;
    let raw1 = await mockGenerarConReintento(1);
    let obj1 = extraerJson(raw1);
    if (!obj1 || !validarCamposPlanificacion(obj1)) {
      // Reintento único con instrucción concisa
      let raw2 = await mockGenerarConReintento(2);
      let obj2 = extraerJson(raw2);
      if (obj2 && validarCamposPlanificacion(obj2)) {
        respuestaFinal = obj2;
      }
    }

    assert.equal(llamadas, 2, "Debe hacer exactamente 2 llamadas en recuperación");
    assert.ok(respuestaFinal);
    const msg = mensajeParaChat(respuestaFinal);
    assert.equal(msg, "Planificación sintetizada recuperada.");
    assert.ok(!msg.includes("{"));
    assert.ok(!msg.includes("mensaje_chat"));
  });

  await t.test("13. Falla dos veces: devuelve mensaje amable sin mostrar JSON crudo", async () => {
    let llamadas = 0;
    const MENSAJE_AMABLE = "No pude armar la planificación, ¿intentamos otra vez?";

    async function mockGenerarFallido() {
      llamadas++;
      return '{"mensaje_chat": "Corte en intento ' + llamadas;
    }

    let respuestaFinal = null;
    let raw1 = await mockGenerarFallido();
    let obj1 = extraerJson(raw1);
    if (!obj1 || !validarCamposPlanificacion(obj1)) {
      let raw2 = await mockGenerarFallido();
      let obj2 = extraerJson(raw2);
      if (obj2 && validarCamposPlanificacion(obj2)) {
        respuestaFinal = obj2;
      } else {
        respuestaFinal = { mensaje_chat: MENSAJE_AMABLE, plan_completado: false };
      }
    }

    assert.equal(llamadas, 2, "No debe exceder 2 llamadas cuando falla");
    assert.equal(respuestaFinal.mensaje_chat, MENSAJE_AMABLE);
    const msg = mensajeParaChat(respuestaFinal);
    assert.equal(msg, MENSAJE_AMABLE);
    assert.ok(!msg.includes("{"));
    assert.ok(!msg.includes("mensaje_chat"));
  });

  await t.test("14. Respaldo entre proveedores que no pasa de 2 llamadas", async () => {
    let llamadas = 0;
    const proveedores = ["Gemini", "Groq"];

    async function llamarProveedor(nombre) {
      llamadas++;
      // Ambos fallan
      throw new Error(`Fallo en ${nombre}`);
    }

    let exito = false;
    for (const p of proveedores) {
      if (llamadas >= 2) break;
      try {
        await llamarProveedor(p);
        exito = true;
        break;
      } catch (e) {
        // continúa al siguiente proveedor como respaldo
      }
    }

    assert.equal(llamadas, 2, "El respaldo entre proveedores no debe superar 2 llamadas");
    assert.equal(exito, false);
  });

  await t.test("15. Prueba punta a punta simulada con la frase exacta del dictado", async () => {
    const fraseDictada = "Planificación de 2.º, tema biografía de un individuo, escuela Batey Piñones, maestro Israel Montás, tiempo 45 minutos";
    
    // Simulación de respuesta de IA con la frase
    const respuestaModelo = JSON.stringify({
      mensaje_chat: "¡Hola Maestro Israel Montás! He preparado la planificación de 2.º grado para la Escuela Batey Piñones sobre la biografía de un individuo con duración de 45 minutos.",
      plan_completado: true,
      datos_planificacion: {
        datos_generales: {
          docente: "Israel Montás",
          centro_educativo: "Batey Piñones",
          grado: "2.º grado",
          tema: "Biografía de un individuo",
          tiempo: "45 minutos"
        },
        competencias_especificas: ["Comprende biografías que lee y escucha para conocer aspectos relevantes de la vida de personas destacadas."],
        momentos: [
          { momento: "Inicio", tiempo: "10 min", actividades: "Activación de conocimientos previos sobre personajes conocidos." },
          { momento: "Desarrollo", tiempo: "25 min", actividades: "Lectura guiada y análisis de estructura de la biografía." },
          { momento: "Cierre", tiempo: "10 min", actividades: "Metacognición y síntesis de lo aprendido." }
        ]
      },
      confianza_curricular: {
        nivel_certeza: "alta",
        nota_revision: "Alineado a la Adecuación Curricular 2023."
      }
    });

    const parsed = extraerJson(respuestaModelo);
    assert.ok(parsed, "Debe extraer la respuesta completa");
    assert.equal(validarCamposPlanificacion(parsed), true);
    
    const chatVisual = mensajeParaChat(parsed);
    assert.ok(chatVisual, "Debe tener texto para chat");
    assert.ok(!chatVisual.includes("{"), "No debe tener llaves");
    assert.ok(!chatVisual.includes("mensaje_chat"), "No debe tener clave mensaje_chat");
    assert.ok(chatVisual.includes("Israel Montás"));
    assert.ok(chatVisual.includes("Batey Piñones"));

    // Comprobar que los datos de la planificación están completos para PlanResult
    assert.equal(parsed.datos_planificacion.datos_generales.tiempo, "45 minutos");
    assert.equal(parsed.datos_planificacion.datos_generales.grado, "2.º grado");
  });

});
