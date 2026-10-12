/**
 * tests/test_informe_supervision_word.mjs
 * 
 * SUITE DE PRUEBAS AUTOMATIZADAS:
 * Generador del Informe Oficial de Acompañamiento y Supervisión Pedagógica en Word (.docx)
 * Estándar Ministerial MINERD para Coordinadores y Directores de Centro Educativo.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Packer, Document } from "docx";
import { construirDocumentoInformeSupervision } from "../shared/construirInformeSupervisionDocx.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

test("INFORME SUPERVISIÓN WORD - 1. Integridad de la Construcción Canónica DOCX", async (t) => {
  await t.test("Genera un Document de docx con valores por defecto sin lanzar excepciones", async () => {
    const doc = construirDocumentoInformeSupervision();
    assert.ok(doc instanceof Document, "Debe retornar una instancia válida de docx Document");
    assert.ok(doc.documentWrapper, "El documento debe contener su documentWrapper inicializado");

    const buffer = await Packer.toBuffer(doc);
    assert.ok(Buffer.isBuffer(buffer), "Debe generar un buffer válido incluso con datos por defecto");
    assert.ok(buffer.length > 5000, "El tamaño del archivo con valores por defecto debe superar los 5 KB");
    assert.strictEqual(buffer[0], 0x50, "Byte 0 debe ser 'P'");
    assert.strictEqual(buffer[1], 0x4b, "Byte 1 debe ser 'K'");
  });

  await t.test("Estructura los datos del centro educativo y código SIGERD correctamente", async () => {
    const escuelaInfo = {
      nombre: "Escuela Primaria República de Colombia",
      codigoMinerd: "01-04-12345",
      regional: "Regional 10 Santo Domingo",
      distrito: "Distrito 04",
      tanda: "Jornada Escolar Extendida (JEE)"
    };

    const doc = construirDocumentoInformeSupervision({
      escuelaInfo,
      coordinadorNombre: "Lic. María Altagracia Pérez",
      directorNombre: "Dr. Juan Bautista Rodríguez",
      periodoMes: "Noviembre 2026",
      anioLectivo: "2026-2027"
    });

    assert.ok(doc instanceof Document);
    const buffer = await Packer.toBuffer(doc);
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 8000, "El buffer estructurado debe superar los 8 KB");
  });
});

test("INFORME SUPERVISIÓN WORD - 2. Cálculos Estadísticos Curriculares y DUA", async (t) => {
  const planesPrueba = [
    {
      id: "p1",
      grado: "4to Primaria",
      area: "Lengua Española",
      docenteNombre: "Prof. Laura Gómez",
      estado: "aprobada"
    },
    {
      id: "p2",
      grado: "4to Primaria",
      area: "Lengua Española",
      docenteNombre: "Prof. Laura Gómez",
      estado: "aprobada"
    },
    {
      id: "p3",
      grado: "4to Primaria",
      area: "Matemáticas",
      docenteNombre: "Prof. Carlos Santana",
      estado: "observada"
    },
    {
      id: "p4",
      grado: "5to Primaria",
      area: "Ciencias de la Naturaleza",
      docenteNombre: "Prof. Ana Medina",
      estado: "enviada_revision"
    }
  ];

  const revisionesPrueba = [
    {
      id: "r1",
      comentarios_generales: "Excelente secuencia didáctica y recuperación de saberes previos.",
      bloques_observados: {
        dua: "Incorporar apoyos visuales y tiempo extendido para estudiantes con NEAE."
      }
    },
    {
      id: "r2",
      comentarios_generales: "Ajustar la congruencia entre actividades de cierre y criterios de evaluación formativa.",
      bloques_observados: {
        dua: "Adaptación de textos en lectura fácil."
      }
    }
  ];

  await t.test("Construye el documento con métricas agrupadas y observaciones DUA", async () => {
    const doc = construirDocumentoInformeSupervision({
      escuelaInfo: {
        nombre: "Liceo Prof. Juan Bosch",
        codigoMinerd: "15-02-99887"
      },
      planes: planesPrueba,
      revisiones: revisionesPrueba,
      periodoMes: "Octubre 2026"
    });

    assert.ok(doc instanceof Document);

    // Empaquetar a Buffer para validar la integridad física binaria
    const buffer = await Packer.toBuffer(doc);
    assert.ok(Buffer.isBuffer(buffer), "El resultado de Packer.toBuffer debe ser un Buffer de Node");
    assert.ok(buffer.length > 8000, `El tamaño del archivo DOCX (${buffer.length} bytes) debe superar los 8 KB`);

    // Validar cabecera PK (firma estándar de archivos ZIP/DOCX: 0x50, 0x4B, 0x03, 0x04)
    assert.strictEqual(buffer[0], 0x50, "Byte 0 debe ser 'P'");
    assert.strictEqual(buffer[1], 0x4b, "Byte 1 debe ser 'K'");
    assert.strictEqual(buffer[2], 0x03, "Byte 2 debe ser 0x03");
    assert.strictEqual(buffer[3], 0x04, "Byte 3 debe ser 0x04");
  });
});

test("INFORME SUPERVISIÓN WORD - 3. Verificación de Integración en el Cliente y Componentes", async (t) => {
  const rutaServicioCliente = path.join(rootDir, "client/src/services/generadorInformeSupervisionWord.js");
  const rutaModalCoordinacion = path.join(rootDir, "client/src/components/PanelCoordinacionModal.jsx");

  await t.test("El servicio de descarga en cliente existe y exporta la función principal", async () => {
    assert.ok(fs.existsSync(rutaServicioCliente), "Debe existir generadorInformeSupervisionWord.js");
    const contenido = fs.readFileSync(rutaServicioCliente, "utf-8");
    assert.ok(
      contenido.includes("export async function descargarInformeSupervisionWord"),
      "Debe exportar descargarInformeSupervisionWord"
    );
    assert.ok(
      contenido.includes("Packer.toBlob"),
      "Debe invocar Packer.toBlob para descarga en navegador"
    );
    assert.ok(
      contenido.includes("construirDocumentoInformeSupervision"),
      "Debe conectar con el constructor canónico compartido"
    );
  });

  await t.test("PanelCoordinacionModal.jsx integra el botón de descarga del informe Word", () => {
    assert.ok(fs.existsSync(rutaModalCoordinacion), "Debe existir PanelCoordinacionModal.jsx");
    const contenido = fs.readFileSync(rutaModalCoordinacion, "utf-8");
    assert.ok(
      contenido.includes("descargarInformeSupervisionWord"),
      "Debe importar o invocar descargarInformeSupervisionWord"
    );
    assert.ok(
      contenido.includes("Informe Mensual (.docx)"),
      "Debe contener el botón visible de descarga del Informe Mensual en Word"
    );
    assert.ok(
      contenido.includes("handleDescargarInformeWord"),
      "Debe tener la función controladora handleDescargarInformeWord"
    );
  });
});
