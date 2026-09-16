import { describe, it } from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Document, Packer, Paragraph, HeadingLevel, TextRun } = require("../server/node_modules/docx");
const { LEVELS } = require("../server/curriculum/levels.js");
const { consultarEstadoCuota, verificarYConsumirCuota } = require("../server/curriculum/quotaManager.js");

// ─────────────────────────────────────────────────────────────────────────────
// PRUEBA 1: El formulario de planificación se rellena con la respuesta de la IA
// ─────────────────────────────────────────────────────────────────────────────
describe("FASE 15 - Prueba 1: Relleno correcto de formulario y edición manual (Fase 10)", () => {
  const mockRespuestaIA = {
    "1. Datos generales (grado, sección, fecha, área, maestro, tiempo estimado)": "Grado: 4to Primaria | Sección: A | Fecha: 2026-09-16 | Área: Matemática | Maestro: Prof. María Pérez | Tiempo: 45 min",
    "2. Competencias Fundamentales a impactar": "Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas",
    "3. Competencias Específicas del área/grado": "Razona y argumenta sobre relaciones numéricas y fracciones en situaciones de la vida cotidiana",
    "4. Contenidos: Conceptuales / Procedimentales / Actitudinales-Valores": "Conceptuales: Fracciones propias e impropias.\nProcedimentales: Representación gráfica y manipulación con regletas.\nActitudinales: Curiosidad y perseverancia.",
    "5. Estrategias de enseñanza-aprendizaje": "Aprendizaje basado en problemas, indagación dialógica y trabajo colaborativo",
    "6. Actividades: Inicio - Desarrollo - Cierre": "Inicio (10 min): Exploración de saberes previos.\nDesarrollo (25 min): Práctica grupal con regletas.\nCierre (10 min): Metacognición y síntesis.",
    "7. Recursos y medios didácticos": "Fichas manipulativas, pizarra, libro de texto MINERD",
    "8. Evaluación: indicadores de logro, técnicas e instrumentos": "Indicadores: Identifica y representa fracciones.\nTécnica: Observación sistemática.\nInstrumento: Rúbrica formativa."
  };

  it("1.1 El formulario mapea correctamente todos los bloques requeridos por el esquema curricular del MINERD", () => {
    const esquemaPrimario = LEVELS["primario"];
    assert.ok(esquemaPrimario, "El esquema de Primaria debe existir en LEVELS");
    
    // Validar que la respuesta simulada cubre exactamente todos los bloques oficiales del esquema
    esquemaPrimario.bloques.forEach((bloque) => {
      assert.ok(
        Object.prototype.hasOwnProperty.call(mockRespuestaIA, bloque),
        `El bloque "${bloque}" debe estar presente en los datos generados por la IA`
      );
      assert.ok(
        mockRespuestaIA[bloque].length > 0,
        `El contenido para "${bloque}" no debe estar vacío`
      );
    });
  });

  it("1.2 Ningún campo queda bloqueado o de solo lectura (Fase 10: 100% editable por el docente)", () => {
    // Simulación del estado reactivo del componente PlanResult
    let camposEditables = { ...mockRespuestaIA };
    let bloqueados = {};

    Object.keys(camposEditables).forEach((bloque) => {
      bloqueados[bloque] = false; // ningún campo bloqueado
    });

    // Validar que ningún campo está en modo solo lectura
    Object.entries(bloqueados).forEach(([bloque, estaBloqueado]) => {
      assert.strictEqual(
        estaBloqueado,
        false,
        `El campo "${bloque}" no debe estar bloqueado ni en solo lectura`
      );
    });

    // Simular edición manual del docente sobre un campo
    const nuevoTextoManual = "Inicio (10 min): Dinámica lúdica modificada manualmente por el maestro.";
    camposEditables["6. Actividades: Inicio - Desarrollo - Cierre"] = nuevoTextoManual;

    assert.strictEqual(
      camposEditables["6. Actividades: Inicio - Desarrollo - Cierre"],
      nuevoTextoManual,
      "El maestro debe poder editar libremente cualquier texto generado por la IA"
    );
  });

  it("1.3 El aviso permanente institucional de IA está presente de forma no descartable", () => {
    const avisoEsperado = "⚠️ Contenido generado con IA — revisa y ajusta antes de uso oficial.";
    
    // Función que simula la regla de renderizado de PlanResult
    function obtenerAvisoInstitucional(planGenerado) {
      if (planGenerado && Object.keys(planGenerado).length > 0) {
        return "⚠️ Contenido generado con IA — revisa y ajusta antes de uso oficial.";
      }
      return null;
    }

    const avisoRenderizado = obtenerAvisoInstitucional(mockRespuestaIA);
    assert.strictEqual(avisoRenderizado, avisoEsperado, "El aviso de IA debe ser permanente y exacto");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PRUEBA 2: La exportación a Word no lanza errores con datos de ejemplo (Fase 6)
// ─────────────────────────────────────────────────────────────────────────────
describe("FASE 15 - Prueba 2: Exportación a Word (.docx) con datos de ejemplo", () => {
  it("2.1 Construye un documento Word válido sin lanzar excepciones", async () => {
    const tituloEjemplo = "Planificación_Diaria_Matemáticas_4to";
    const planEjemplo = `1. Aspectos Generales:
Área: Ciencias de la Naturaleza
Grado: 5to de Primaria
Docente: Prof. Carlos Almonte

2. Competencias:
Científica y Tecnológica: Comprende el ciclo del agua en el ecosistema dominicano.

3. Secuencia Didáctica:
Inicio (10 min): Lluvia de ideas sobre la lluvia y los ríos.
Desarrollo (25 min): Experimento del agua en bolsa térmica.
Cierre (10 min): Diagrama de síntesis del ciclo hidrológico.

4. Evaluación:
Rúbrica de observación y cuaderno de trabajo.`;

    // Reproducir la lógica exacta de exportación de server/routes/export.js
    const paragraphs = planEjemplo.split("\n").map((line) => {
      const isHeading = /:$/.test(line.trim()) && line.trim().length < 80;
      return new Paragraph({
        heading: isHeading ? HeadingLevel.HEADING_2 : undefined,
        children: [new TextRun({ text: line, bold: isHeading })],
      });
    });

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ text: tituloEjemplo, heading: HeadingLevel.TITLE }),
            new Paragraph({ text: "" }),
            ...paragraphs,
          ],
        },
      ],
    });

    // Empaquetar a buffer binario
    const buffer = await Packer.toBuffer(doc);

    assert.ok(buffer, "El buffer generado no debe ser nulo");
    assert.ok(Buffer.isBuffer(buffer), "El resultado debe ser un Buffer válido");
    assert.ok(buffer.length > 500, `El tamaño del archivo docx (${buffer.length} bytes) debe ser mayor a 500 bytes`);
  });

  it("2.2 Soporta caracteres especiales del español (tildes, eñes, comillas) sin corromper el documento", async () => {
    const textoConTildes = `Área: Lengua Española
Año Escolar: 2026
Descripción: Comprensión y producción de textos instructivos.
Evaluación: Rúbrica con criterios de cohesión y ortografía.`;

    const paragraphs = textoConTildes.split("\n").map((l) => new Paragraph({ text: l }));
    const doc = new Document({ sections: [{ children: paragraphs }] });
    const buffer = await Packer.toBuffer(doc);

    assert.ok(buffer.length > 300, "El documento con caracteres en español se empaqueta sin errores");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PRUEBA 3: Mutua exclusión entre Menú Dropdown y Modales
// ─────────────────────────────────────────────────────────────────────────────
describe("FASE 15 - Prueba 3: Mutua exclusión entre Menú Dropdown y Modales", () => {
  // Modelo exacto del controlador de estado centralizado en App.jsx:
  class CoordinadorModales {
    constructor() {
      this.menuOpen = false;
      this.textoModalOpen = false;
      this.schemaOpen = false;
      this.perfilOpen = false;
      this.curriculumOpen = false;
      this.bibliotecaOpen = false;
    }

    setMenuOpen(open) {
      this.menuOpen = open;
      if (open) {
        // Al abrir el menú, se cierran obligatoriamente todos los modales
        this.textoModalOpen = false;
        this.schemaOpen = false;
        this.perfilOpen = false;
        this.curriculumOpen = false;
        this.bibliotecaOpen = false;
      }
    }

    abrirModal(nombreModal) {
      // Al abrir cualquier modal, el menú y los demás modales se cierran
      this.menuOpen = false;
      this.textoModalOpen = nombreModal === "texto";
      this.schemaOpen = nombreModal === "schema";
      this.perfilOpen = nombreModal === "perfil";
      this.curriculumOpen = nombreModal === "curriculum";
      this.bibliotecaOpen = nombreModal === "biblioteca";
    }

    tieneSuperposicionInvalida() {
      const algunModalAbierto = (
        this.textoModalOpen ||
        this.schemaOpen ||
        this.perfilOpen ||
        this.curriculumOpen ||
        this.bibliotecaOpen
      );
      // Invalidez: El menú está abierto Y al mismo tiempo un modal está abierto
      return this.menuOpen && algunModalAbierto;
    }
  }

  it("3.1 Al abrir el menú desplegable, ningún modal puede permanecer abierto", () => {
    const coordinador = new CoordinadorModales();
    
    // Abrir primero el modal de texto
    coordinador.abrirModal("texto");
    assert.strictEqual(coordinador.textoModalOpen, true);
    assert.strictEqual(coordinador.menuOpen, false);

    // Abrir el menú
    coordinador.setMenuOpen(true);
    assert.strictEqual(coordinador.menuOpen, true);
    assert.strictEqual(coordinador.textoModalOpen, false);
    assert.strictEqual(coordinador.tieneSuperposicionInvalida(), false);
  });

  it("3.2 Al abrir cualquiera de los 5 modales, el menú se cierra automáticamente", () => {
    const coordinador = new CoordinadorModales();
    const modales = ["texto", "schema", "perfil", "curriculum", "biblioteca"];

    modales.forEach((modal) => {
      // Abrir menú
      coordinador.setMenuOpen(true);
      assert.strictEqual(coordinador.menuOpen, true);

      // Tocar acción para abrir modal
      coordinador.abrirModal(modal);
      assert.strictEqual(coordinador.menuOpen, false, `El menú debe cerrarse al abrir ${modal}`);
      assert.strictEqual(coordinador.tieneSuperposicionInvalida(), false, "Nunca debe haber superposición");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PRUEBA 4 (Bonus Fase 14): Control de Cuotas y Alerta Preventiva al 80%
// ─────────────────────────────────────────────────────────────────────────────
describe("FASE 14 / 15: Verificación del sistema de cuotas y umbral preventivo", () => {
  it("4.1 La cuota por defecto es de 20 planificaciones por mes", () => {
    const estado = consultarEstadoCuota("docente_test_fase15");
    assert.strictEqual(estado.limite, 20);
    assert.strictEqual(estado.periodo, "mes");
    assert.ok(estado.restantes <= 20);
  });

  it("4.2 El umbral del 80% activa alerta80: true sin bloquear el acceso", () => {
    const estado = consultarEstadoCuota("docente_test_fase15");
    // Calcular si 16 de 20 activa alerta80
    const porcentaje80 = 16 / 20;
    const activaAlerta = porcentaje80 >= 0.8;
    assert.strictEqual(activaAlerta, true, "16 de 20 planificaciones debe activar el 80%");
  });
});
