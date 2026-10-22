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

// Importación ESM para Cloudflare Worker
import {
  clasificarIntencion as clasificarWorker,
  clasificarPorReglas as clasificarReglasWorker
} from "../worker/clasificadorIntencion.js";

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
    assert.strictEqual(res.categoria, "ambigua");
    assert.ok(Array.isArray(res.opciones), "Debe incluir opciones de aclaración");
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

  it("9. Nuevas categorías nítidas: charla, conocimiento_general, planificacion, consulta_curricular, accion_app, ambigua", async () => {
    const rCharla = await clasificarIntencion({ texto: "hola" });
    assert.strictEqual(rCharla.categoria, "charla");
    assert.strictEqual(rCharla.tipo, "charla");
    assert.ok(rCharla.confianza >= 0.9);

    const rConocimiento = await clasificarIntencion({ texto: "qué es un árbol" });
    assert.strictEqual(rConocimiento.categoria, "conocimiento_general");
    assert.strictEqual(rConocimiento.tipo, "web");

    const rPlan = await clasificarIntencion({ texto: "planifica fracciones 3.º" });
    assert.strictEqual(rPlan.categoria, "planificacion");
    assert.strictEqual(rPlan.tipo, "curricular");

    const rConsulta = await clasificarIntencion({ texto: "qué indicadores tiene matemática en 3er grado" });
    assert.strictEqual(rConsulta.categoria, "consulta_curricular");
    assert.strictEqual(rConsulta.tipo, "curricular");

    const rAccion = await clasificarIntencion({ texto: "abre mi biblioteca" });
    assert.strictEqual(rAccion.categoria, "accion_app");
    assert.strictEqual(rAccion.tipo, "accion_app");

    const rAmbigua = await clasificarIntencion({ texto: "lo de ayer" });
    assert.strictEqual(rAmbigua.categoria, "ambigua");
    assert.ok(rAmbigua.confianza < 0.70);
    assert.ok(Array.isArray(rAmbigua.opciones));
  });

  it("10. Saludos y cortesías se resuelven por reglas deterministas sin llamar a IA (0 ms, costo $0)", async () => {
    const saludos = ["hola", "buenos días", "gracias", "cómo estás", "buenas tardes colega", "hasta mañana"];
    for (const s of saludos) {
      const res = clasificarPorReglas(s);
      assert.strictEqual(res.categoria, "charla", `Debe clasificar '${s}' como charla`);
      assert.ok(res.confianza >= 0.90, `Confianza de '${s}' debe ser >= 0.90`);
    }
  });

  it("11. Mensajes mixtos: Saludo + Planificación detecta esMixtoConSaludo = true y categoría 'planificacion'", async () => {
    const res = await clasificarIntencion({ texto: "hola, planifícame fracciones para 3.º" });
    assert.strictEqual(res.categoria, "planificacion");
    assert.strictEqual(res.esMixtoConSaludo, true);
    assert.strictEqual(res.tipo, "curricular");
  });

  it("12. Batería de 36 frases con tabla de verificación de categorías", () => {
    const dataset = [
      // Charla
      { texto: "hola", esperada: "charla" },
      { texto: "buenos días", esperada: "charla" },
      { texto: "gracias", esperada: "charla" },
      { texto: "cómo estás", esperada: "charla" },
      { texto: "muchas gracias profe", esperada: "charla" },
      { texto: "buenas tardes colega", esperada: "charla" },
      { texto: "hasta mañana", esperada: "charla" },
      { texto: "saludos cordiales", esperada: "charla" },

      // Conocimiento general
      { texto: "qué es un árbol", esperada: "conocimiento_general" },
      { texto: "explícame la fotosíntesis", esperada: "conocimiento_general" },
      { texto: "¿por qué el cielo es azul?", esperada: "conocimiento_general" },
      { texto: "¿quién fue Juan Pablo Duarte?", esperada: "conocimiento_general" },
      { texto: "cómo funciona el sistema digestivo", esperada: "conocimiento_general" },
      { texto: "definición de energía cinética", esperada: "conocimiento_general" },

      // Planificación curricular
      { texto: "planifica fracciones 3.º", esperada: "planificacion" },
      { texto: "plan de mañana", esperada: "planificacion" },
      { texto: "diseña una unidad de aprendizaje sobre el cuento para 2do grado", esperada: "planificacion" },
      { texto: "actividad de inicio para multiplicación en 4to grado", esperada: "planificacion" },
      { texto: "secuencia didáctica de lengua española 1er grado", esperada: "planificacion" },
      { texto: "planificación de ciencias de la naturaleza para 5to de primaria", esperada: "planificacion" },
      { texto: "hola, planifícame fracciones", esperada: "planificacion" },

      // Consulta curricular
      { texto: "qué indicadores tiene matemática en 3er grado", esperada: "consulta_curricular" },
      { texto: "qué dice el currículo de la adecuación curricular", esperada: "consulta_curricular" },
      { texto: "cuáles son las competencias fundamentales del MINERD", esperada: "consulta_curricular" },
      { texto: "contenidos conceptuales de lengua española para 2do grado", esperada: "consulta_curricular" },
      { texto: "qué competencias específicas corresponden a 4to en ciencias sociales", esperada: "consulta_curricular" },

      // Acción de la app
      { texto: "abre mi biblioteca", esperada: "accion_app" },
      { texto: "cambia el esquema a conbase", esperada: "accion_app" },
      { texto: "ver mis planificaciones", esperada: "accion_app" },
      { texto: "abre mi perfil", esperada: "accion_app" },
      { texto: "descarga en word", esperada: "accion_app" },

      // Ambiguo
      { texto: "lo de ayer", esperada: "ambigua" },
      { texto: "hazlo ahí", esperada: "ambigua" },
      { texto: "receta de sancocho", esperada: "ambigua" },
      { texto: "reparar carro", esperada: "ambigua" },
      { texto: "números", esperada: "ambigua" }
    ];

    let aciertos = 0;
    for (const item of dataset) {
      const res = clasificarPorReglas(item.texto);
      assert.strictEqual(res.categoria, item.esperada, `Fallo en frase: '${item.texto}' -> Esperaba ${item.esperada}, obtuvo ${res.categoria}`);
      aciertos++;
    }
    assert.strictEqual(aciertos, dataset.length);
  });

  it("13. Módulo Cloudflare Worker (ESM): clasifica idénticamente a Node", async () => {
    const resCharlaWorker = clasificarReglasWorker("hola");
    assert.strictEqual(resCharlaWorker.categoria, "charla");

    const resPlanWorker = clasificarReglasWorker("planifica fracciones 3.º");
    assert.strictEqual(resPlanWorker.categoria, "planificacion");

    const resAsync = await clasificarWorker({ texto: "buenos días colega" });
    assert.strictEqual(resAsync.categoria, "charla");
  });

  it("14. Autorización 020: 'currículo de...' clasifica como consulta_curricular y preserva saludos", () => {
    const consultas = [
      "currículo de 6.º de Matemática sobre potencias",
      "currículo de 4.º de Inglés",
      "currículo de Educación Física de 4.º",
      "currículo de 6.º de Educación Física"
    ];
    for (const c of consultas) {
      const res = clasificarPorReglas(c);
      assert.strictEqual(res.categoria, "consulta_curricular", `Esperaba consulta_curricular para: '${c}', obtuvo: '${res.categoria}'`);
      assert.strictEqual(res.tipo, "curricular");
    }

    const saludos = ["hola", "buenos días", "gracias"];
    for (const s of saludos) {
      const res = clasificarPorReglas(s);
      assert.strictEqual(res.categoria, "charla", `Esperaba charla para: '${s}', obtuvo: '${res.categoria}'`);
    }
  });
});
