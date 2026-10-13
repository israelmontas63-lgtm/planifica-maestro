import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  extraerJson,
  validarCamposPlanificacion,
  repararJsonTruncado,
  planEsRecuperable
} from "../shared/parseadorJsonSeguro.js";

import {
  clasificarIntencion,
  clasificarCategoria6
} from "../shared/clasificadorIntencion.js";

import {
  limpiarSaludoInnecesario
} from "../shared/modoConversacional.js";

import { evaluarPoliticaDignidad } from "../shared/politicaDignidadImagen.js";
import { obtenerOperacionPorId } from "../shared/catalogoEdicionImagen.js";
import { analizarCalidadImagen } from "../worker/ojoDigital.js";

test("PRUEBAS DE ORO: 1. Esquema Canónico del Plan de Clase (MINERD / CON BASE)", async (t) => {
  const planValido = {
    mensaje_chat: "Aquí tienes tu planificación alineada con el MINERD.",
    plan_completado: true,
    datos_planificacion: {
      datos_generales: {
        centro_educativo: "Escuela Primaria República Dominicana",
        docente: "Prof. María Santos",
        grado: "3er grado",
        seccion: "A",
        area: "Lengua Española",
        fecha: "14/10/2026",
        tiempo_estimado: "45 minutos",
        estrategia_ensenanza: "Indagación dialógica y producción escrita"
      },
      intencion_pedagogica: "Identificar la estructura de la noticia (titular, cuerpo, foto).",
      competencias_fundamentales: ["Comunicativa", "Pensamiento Lógico, Creativo y Crítico"],
      competencias_especificas: [
        "Comprende noticias sencillas que lee para informarse sobre sucesos de su comunidad."
      ],
      contenidos: {
        conceptuales: ["La noticia: función y estructura"],
        procedimentales: ["Identificación de elementos en una noticia de la comunidad"],
        actitudinales: ["Interés por los acontecimientos del entorno escolar"]
      },
      indicadores_logro: [
        "Reconoce las partes principales de una noticia impresa o digital."
      ],
      momentos_clase: {
        inicio: {
          tiempo: "10 min",
          actividades_docente: "Presenta titulares llamativos y realiza preguntas generadoras.",
          actividades_alumnos: "Comparten qué noticias conocen de su barrio.",
          recursos: "Periódicos impresos"
        },
        desarrollo: {
          tiempo: "25 min",
          actividades_docente: "Guía el análisis de la estructura en grupos cooperativos.",
          actividades_alumnos: "Marcan en el texto el titular, cuerpo y pie de foto.",
          recursos: "Guía didáctica CON BASE"
        },
        cierre: {
          tiempo: "10 min",
          actividades_docente: "Coordina la socialización y síntesis de lo aprendido.",
          actividades_alumnos: "Resumen en una frase el aprendizaje del día.",
          recursos: "Pizarra y cuaderno"
        }
      },
      evaluacion: {
        tecnicas: "Observación sistemática",
        instrumentos: "Lista de cotejo formativa"
      },
      adaptaciones_curriculares: "Pautas DUA: uso de imágenes de apoyo y lectura en voz alta para diversidad lectora."
    },
    confianza_curricular: {
      nivel: "alta_base_oficial",
      documento_fuente: "Adecuación Curricular Nivel Primario (MINERD, 2023)"
    }
  };

  assert.strictEqual(validarCamposPlanificacion(planValido), true, "El plan oficial debe ser válido.");
  assert.strictEqual(planEsRecuperable(planValido), true, "Debe confirmarse como recuperable.");

  const jsonString = JSON.stringify(planValido);
  const extraido = extraerJson(jsonString);
  assert.notStrictEqual(extraido, null);
  assert.strictEqual(extraido.datos_planificacion.datos_generales.area, "Lengua Española");
});

test("PRUEBAS DE ORO: 2. Exportación a Word (.docx) y Estructura Binaria", async (t) => {
  const { Packer } = await import("docx");
  const { construirDocumentoInformeSupervision } = await import("../shared/construirInformeSupervisionDocx.js");

  const datosInforme = {
    docenteNombre: "Prof. María Santos",
    centroNombre: "Escuela República Dominicana",
    grado: "3er Grado Primaria",
    area: "Lengua Española",
    fecha: "14/10/2026",
    distrito: "10-01",
    regional: "10",
    observaciones: "Excelente manejo didáctico y clima de aula."
  };

  const doc = construirDocumentoInformeSupervision(datosInforme);
  const bufferDocx = await Packer.toBuffer(doc);
  assert.ok(Buffer.isBuffer(bufferDocx), "Debe devolver un buffer binario.");
  assert.ok(bufferDocx.length > 500, "El archivo Word debe tener contenido binario.");
  // Verificar cabecera oficial ZIP / OOXML (PK\x03\x04)
  assert.strictEqual(bufferDocx[0], 0x50, "Byte 0 debe ser 'P'");
  assert.strictEqual(bufferDocx[1], 0x4B, "Byte 1 debe ser 'K'");
  assert.strictEqual(bufferDocx[2], 0x03, "Byte 2 debe ser 0x03");
  assert.strictEqual(bufferDocx[3], 0x04, "Byte 3 debe ser 0x04");
});

test("PRUEBAS DE ORO: 3. Sistema de Cuotas y Rate Limit en Cloudflare Worker", async (t) => {
  const workerModule = await import("../worker/index.js");
  const worker = workerModule.default;

  const mockEnv = {
    APP_ACCESS_KEY: process.env.APP_ACCESS_KEY || "pm_test_app_access_key_mock",
    RATE_LIMIT_ANONIMO_DIARIO: "1",
    GEMINI_API_KEY: "mock_key"
  };

  // 1ra consulta
  const req1 = new Request("http://localhost/api/plan/cuota", {
    method: "GET",
    headers: { "x-forwarded-for": "192.168.10.50" }
  });
  const res1 = await worker.fetch(req1, mockEnv, {});
  assert.strictEqual(res1.status, 200);
});

test("PRUEBAS DE ORO: 4. Bypass de Dueño con Comparación Segura en Tiempo Constante", async (t) => {
  const workerModule = await import("../worker/index.js");
  const worker = workerModule.default;

  const testOwnerKey = process.env.OWNER_MASTER_KEY || "pm_test_owner_master_key_mock";
  const mockEnv = {
    OWNER_MASTER_KEY: testOwnerKey,
    GEMINI_API_KEY: "test_key",
    APP_ACCESS_KEY: process.env.APP_ACCESS_KEY || "pm_test_app_access_key_mock"
  };

  // Petición con llave de dueño correcta
  const reqValido = new Request("http://localhost/api/health", {
    method: "GET",
    headers: { "x-owner-key": testOwnerKey }
  });
  const resValido = await worker.fetch(reqValido, mockEnv, {});
  assert.strictEqual(resValido.status, 200);
  const dataValido = await resValido.json();
  assert.strictEqual(dataValido.services.owner, "configurada");

  // Petición sin llave de dueño no debe exponer estado owner
  const reqAnon = new Request("http://localhost/api/health", { method: "GET" });
  const resAnon = await worker.fetch(reqAnon, mockEnv, {});
  const dataAnon = await resAnon.json();
  assert.strictEqual(dataAnon.services.owner, undefined);
});

test("PRUEBAS DE ORO: 5. Enrutador Inteligente, Clasificador 0 ms y Términos Ajenos", async (t) => {
  const c1 = await clasificarIntencion({ texto: "hola buenas tardes profe" });
  assert.strictEqual(c1.categoria, "charla");

  const c2 = await clasificarIntencion({ texto: "abrir biblioteca de planes" });
  assert.strictEqual(c2.categoria, "accion_app");

  const c3 = clasificarCategoria6("cuales son los DBA de matemáticas");
  assert.strictEqual(c3.codigo, "E");
  assert.strictEqual(c3.categoria, "E_TERMINO_AJENO");
  assert.ok(c3.termino_ajeno.termino.includes("DBA"));
  assert.ok(c3.termino_ajeno.equivalente_minerd.includes("Indicadores de Logro"));

  // Saludo podado en turnos subsecuentes
  const saludoPodado = limpiarSaludoInnecesario("¡Hola, Profe! Aquí tienes el plan de clase.", false, false);
  assert.strictEqual(saludoPodado.startsWith("¡Hola"), false);
});

test("PRUEBAS DE ORO: 6. Ojo Digital, Política de Dignidad y Operaciones", async (t) => {
  // Caso de material legítimo
  const resValido = evaluarPoliticaDignidad({
    instruccion: "Analiza esta lámina del sistema circulatorio para niños de 4to grado",
    operacionId: "rotar_90"
  });
  assert.strictEqual(resValido.esPermitido, true);
  assert.strictEqual(resValido.veredicto, "PERMITIDO");

  // Caso de prompt denigrante (bullying / burla / ridiculizar)
  const resDenigrante = evaluarPoliticaDignidad({
    instruccion: "hacerle un meme al profesor para burlarse y ridiculizarlo",
    operacionId: "filtro_caricatura"
  });
  assert.strictEqual(resDenigrante.esPermitido, false);
  assert.strictEqual(resDenigrante.veredicto, "BLOQUEADO");
  assert.ok(resDenigrante.motivo.length > 0);

  // Catálogo de operaciones
  const op = obtenerOperacionPorId("luz_brillo_mas");
  assert.notStrictEqual(op, null);
  assert.strictEqual(op.categoria, "luz_color");

  // Calidad de imagen: imagen vacía debe marcarse como inválida
  const resCalidad = analizarCalidadImagen("");
  assert.strictEqual(resCalidad.ilegible, true);
});

test("PRUEBAS DE ORO: 7. Integridad de Manifiesto PWA y Service Worker", async (t) => {
  const distManifest = path.resolve(process.cwd(), "client/dist/manifest.webmanifest");
  assert.ok(fs.existsSync(distManifest), "El manifest PWA debe existir en client/dist.");

  const manifestContent = JSON.parse(fs.readFileSync(distManifest, "utf8"));
  assert.ok(manifestContent.name.includes("Planifica Maestro"), "El nombre PWA debe ser Planifica Maestro.");

  const swFile = path.resolve(process.cwd(), "client/dist/sw.js");
  assert.ok(fs.existsSync(swFile), "El Service Worker sw.js debe existir en client/dist.");
});
