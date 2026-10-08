/**
 * tests/test_fase2_modelo_oficial.mjs
 * Pruebas automatizadas para validar la FASE 2:
 * 1. Generador Word CON BASE: Orientación A4 horizontal (landscape), azul #CDEEF6, matriz de 17 filas, 3 columnas de momentos, actividades diferenciadas.
 * 2. Perfil Docente Ampliado: tanda, sección, grado, regional, distrito y persistencia aislada por usuario.
 * 3. Selector Multigrado: existencia en esquemasData.js y definición en server/curriculum/levels.js con ciclos articulados.
 * 4. Integración y empaquetado de archivo Word sin errores.
 */

import assert from "node:assert/strict";
import test from "node:test";
import zlib from "node:zlib";
import { ESQUEMAS } from "../client/src/data/esquemasData.js";
import { LEVELS } from "../server/curriculum/levels.js";
import { cargarPerfil, guardarPerfil, obtenerPerfil, limpiarDatosUsuario } from "../client/src/services/perfilStorage.js";
import { construirDocumentoWordOficial } from "../client/src/services/generadorWordConBase.js";
import { Packer } from "docx";

// Función utilitaria para extraer word/document.xml de un buffer DOCX (ZIP) en memoria
function extraerXmlDelDocx(buffer) {
  let pos = 0;
  while (pos < buffer.length - 4) {
    if (buffer.readUInt32LE(pos) === 0x04034b50) {
      const fnLen = buffer.readUInt16LE(pos + 26);
      const extraLen = buffer.readUInt16LE(pos + 28);
      const fn = buffer.toString("utf8", pos + 30, pos + 30 + fnLen);
      const compSize = buffer.readUInt32LE(pos + 18);
      const dataStart = pos + 30 + fnLen + extraLen;
      if (fn === "word/document.xml") {
        const decomp = zlib.inflateRawSync(buffer.slice(dataStart, dataStart + compSize));
        return decomp.toString("utf8");
      }
      pos = dataStart + compSize;
    } else {
      pos++;
    }
  }
  return null;
}

// Mock de localStorage aislado
const mockStorage = new Map();
globalThis.localStorage = {
  getItem: (k) => mockStorage.get(k) || null,
  setItem: (k, v) => mockStorage.set(k, String(v)),
  removeItem: (k) => mockStorage.delete(k),
  clear: () => mockStorage.clear()
};

test("FASE 2 - 1. Matriz Oficial de Planificación Word CON BASE", async (t) => {
  await t.test("Construye el documento con orientación A4 landscape y formato oficial OpenXML", async () => {
    const doc = await construirDocumentoWordOficial({
      titulo: "Planificacion_Matematica_3ro",
      plan: `Centro Educativo: Escuela Batey Piñones
Docente: Israel Montás
Grado: 3ro
Sección: A
Área: Matemática
Secuencia: 4 (¿a qué jugamos?)
Fecha: 2-3-2026
Tanda: Jornada Escolar Extendida
Competencias Fundamentales: Ética y Ciudadana, Comunicativa, Pensamiento Lógico
Competencias Específicas: Representa y lee gráficos de barra
Intención pedagógica del día: Interpretar información sobre análisis de datos
Estrategias de enseñanza: Resolución de problemas
Bloque: 1
Actividad: 1 Presentación
Inicio: Presentación del papelógrafo de aprendizajes. (10 min)
Desarrollo: Recolectar información sobre juegos favoritos. (25 min)
Cierre: Analizar gráfica de barras y preguntas metacognitivas. (10 min)
Evaluación: Preguntas orales y lista de cotejo
Actividades Diferenciadas: Apoyo con material concreto y conteo guiado`
    });

    assert.ok(doc, "El documento debe generarse");

    // Serializar a buffer binario OpenXML
    const buffer = await Packer.toBuffer(doc);
    assert.ok(buffer instanceof Buffer, "Debe generar un buffer binario válido");
    assert.equal(buffer.slice(0, 2).toString(), "PK", "La cabecera debe ser un archivo ZIP/DOCX válido (PK)");
    assert.ok(buffer.length > 5000, `El tamaño del docx (${buffer.length} bytes) debe ser mayor a 5KB`);

    // Inspección profunda de word/document.xml
    const xml = extraerXmlDelDocx(buffer);
    assert.ok(xml, "Debe poder extraerse el XML interno de word/document.xml");

    // Verificaciones formales del estándar OpenXML
    assert.ok(xml.includes("landscape"), "Debe tener orientación landscape (horizontal)");
    assert.ok(xml.includes("16838"), "Debe tener ancho A4 landscape (16,838 dxa)");
    assert.ok(xml.includes("11906"), "Debe tener alto A4 landscape (11,906 dxa)");
    assert.ok(xml.includes("CDEEF6"), "Debe contener sombreado azul claro oficial (#CDEEF6)");
    assert.ok(xml.includes("Planificación de Actividades de la Secuencia Didáctica - Programa CON BASE"), "Debe contener el título oficial de la matriz");
    assert.ok(xml.includes("Centro Educativo"), "Debe contener encabezado de Centro Educativo");
    assert.ok(xml.includes("Docente"), "Debe contener encabezado de Docente");
    assert.ok(xml.includes("Grado"), "Debe contener encabezado de Grado");
    assert.ok(xml.includes("Sección"), "Debe contener encabezado de Sección");
    assert.ok(xml.includes("Momentos de la Clase"), "Debe contener la cabecera de Momentos de la Clase");
    assert.ok(xml.includes("Tiempo"), "Debe contener la columna de Tiempo");
    assert.ok(xml.includes("Recursos"), "Debe contener la columna de Recursos");
    assert.ok(xml.includes("Actividades Diferenciadas (Atención a la Diversidad)"), "Debe contener la fila de Actividades Diferenciadas");
  });

  await t.test("Autocompleta con datos del perfil docente cuando faltan en el plan", async () => {
    const perfilMock = {
      nombre: "Prof. María Pérez",
      escuela: "Escuela República de Panamá",
      tanda: "Matutina",
      seccion: "B",
      grado: "4to Primaria",
      fecha: "2026-10-08"
    };

    const doc = await construirDocumentoWordOficial({
      titulo: "Plan_Ciencias",
      plan: "Área: Ciencias de la Naturaleza\nIntención pedagógica: Comprender el ciclo del agua",
      perfil: perfilMock
    });

    assert.ok(doc);
    const buffer = await Packer.toBuffer(doc);
    assert.ok(buffer.length > 5000);
    const xml = extraerXmlDelDocx(buffer);
    assert.ok(xml.includes("Prof. María Pérez"), "Debe incluir el nombre del docente desde el perfil");
    assert.ok(xml.includes("Escuela República de Panamá"), "Debe incluir la escuela desde el perfil");
    assert.ok(xml.includes("Matutina"), "Debe incluir la tanda desde el perfil");
  });
});

test("FASE 2 - 2. Ampliación y Persistencia del Perfil Docente", async (t) => {
  const userId = "docente_test_fase2_456";

  await t.test("Guarda y recupera tanda, sección, grado, regional y distrito", () => {
    limpiarDatosUsuario(userId);

    const datosPerfil = {
      nombre: "Lic. Carlos Gómez",
      escuela: "Liceo Pedro Henríquez Ureña",
      tanda: "Vespertina",
      seccion: "C",
      grado: "5to de Primaria",
      regional: "10 - Santo Domingo",
      distrito: "10-01",
      fecha: "2026-10-08",
      fechaManual: true
    };

    guardarPerfil(datosPerfil, userId);

    const recuperado = obtenerPerfil(userId);
    assert.ok(recuperado, "El perfil debe recuperarse de localStorage");
    assert.equal(recuperado.nombre, "Lic. Carlos Gómez");
    assert.equal(recuperado.escuela, "Liceo Pedro Henríquez Ureña");
    assert.equal(recuperado.tanda, "Vespertina");
    assert.equal(recuperado.seccion, "C");
    assert.equal(recuperado.grado, "5to de Primaria");
    assert.equal(recuperado.regional, "10 - Santo Domingo");
    assert.equal(recuperado.distrito, "10-01");
  });

  await t.test("Aplica defaults de tanda (JEE) y sección (A) si no fueron configurados", () => {
    const userIdSimple = "docente_simple_789";
    guardarPerfil({ nombre: "Docente Sin Tanda" }, userIdSimple);

    const perfilConDefaults = obtenerPerfil(userIdSimple);
    assert.equal(perfilConDefaults.tanda, "Jornada Escolar Extendida (JEE)");
    assert.equal(perfilConDefaults.seccion, "A");
  });
});

test("FASE 2 - 3. Selector de Modalidad Multigrado", async (t) => {
  await t.test("Esquema 'multigrado' está registrado en esquemasData.js", () => {
    const esquemaMultigrado = ESQUEMAS.find(e => e.id === "multigrado");
    assert.ok(esquemaMultigrado, "Debe existir el esquema multigrado en ESQUEMAS");
    assert.equal(esquemaMultigrado.nombre, "Aulas Multigrado (MINERD)");
    assert.equal(esquemaMultigrado.niveles, "Primaria Multigrado");
  });

  await t.test("Esquema 'multigrado' tiene definición curricular completa en levels.js", () => {
    const def = LEVELS.multigrado;
    assert.ok(def, "Debe existir LEVELS.multigrado");
    assert.ok(Array.isArray(def.ciclos), "Debe definir ciclos articulados");
    assert.ok(def.ciclos.some(c => c.includes("1.º y 2.º")), "Debe articular 1º y 2º");
    assert.ok(def.ciclos.some(c => c.includes("3.º y 4.º")), "Debe articular 3º y 4º");
    assert.ok(def.ciclos.some(c => c.includes("5.º y 6.º")), "Debe articular 5º y 6º");
    assert.ok(Array.isArray(def.bloques), "Debe definir bloques");
    assert.ok(def.bloques.length >= 8, "Debe tener al menos 8 bloques pedagógicos");
  });
});
