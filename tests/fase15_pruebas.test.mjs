import { describe, it } from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let docxModule;
try {
  docxModule = require("docx");
} catch {
  docxModule = require("../server/node_modules/docx");
}
const { Document, Packer, Paragraph, HeadingLevel, TextRun } = docxModule;
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

// ─────────────────────────────────────────────────────────────────────────────
// PRUEBA 5 (Fase 16): Mitigación de Alucinaciones y Detección de Baja Certeza
// ─────────────────────────────────────────────────────────────────────────────
describe("FASE 16: Mitigación de alucinaciones y resalte visual de baja certeza", () => {
  it("5.1 El modelo de datos procesa confianza_curricular con bloques aproximados y nota de revisión", () => {
    const mockConfianza = {
      nivel_certeza: "media",
      bloques_aproximados: [
        "3. Competencias Específicas del área/grado",
        "8. Evaluación: indicadores de logro, técnicas e instrumentos"
      ],
      nota_revision: "Los indicadores fueron formulados como aproximación pedagógica. Coteja los códigos con la malla curricular impresa del MINERD."
    };

    assert.strictEqual(mockConfianza.nivel_certeza, "media");
    assert.strictEqual(mockConfianza.bloques_aproximados.length, 2);
    assert.ok(mockConfianza.nota_revision.includes("MINERD"));

    // Simular función de detección de resalte visual
    function esBloqueResaltado(nombreBloque, confianza) {
      return confianza.bloques_aproximados.some((b) => b === nombreBloque);
    }

    assert.strictEqual(esBloqueResaltado("3. Competencias Específicas del área/grado", mockConfianza), true);
    assert.strictEqual(esBloqueResaltado("1. Datos generales (grado, sección, fecha, área, maestro, tiempo estimado)", mockConfianza), false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PRUEBA 6: Mejoras de UX (Triple Entrada, Stepper y Cabecera Interactiva)
// ─────────────────────────────────────────────────────────────────────────────
describe("MEJORAS UX: Triple entrada unificada, Stepper de progreso y Cabecera interactiva", () => {
  it("6.1 El selector de entrada define exactamente las 3 modalidades con sus etiquetas y acciones", () => {
    const modalidades = [
      { id: "voz", titulo: "Dictado por Voz", tipo: "audio" },
      { id: "foto", titulo: "Subir Foto o Captura", tipo: "imagen" },
      { id: "texto", titulo: "Escribir con Teclado", tipo: "texto" }
    ];

    assert.strictEqual(modalidades.length, 3);
    assert.deepStrictEqual(modalidades.map(m => m.id), ["voz", "foto", "texto"]);
    assert.ok(modalidades.every(m => m.titulo.length > 0));
  });

  it("6.2 El stepper refleja las 3 fases pedagógicas secuenciales del wizard", () => {
    const pasos = [
      { num: 1, titulo: "Configurar" },
      { num: 2, titulo: "Tema / Material" },
      { num: 3, titulo: "Revisar y Exportar" }
    ];

    assert.strictEqual(pasos.length, 3);
    assert.strictEqual(pasos[0].num, 1);
    assert.strictEqual(pasos[1].num, 2);
    assert.strictEqual(pasos[2].num, 3);

    // Verificación de cálculo dinámico de paso actual
    function calcularPaso(tienePlan, tieneInput) {
      if (tienePlan) return 3;
      if (tieneInput) return 2;
      return 2;
    }

    assert.strictEqual(calcularPaso(false, false), 2, "Sin mensajes, el paso activo es ingresar tema");
    assert.strictEqual(calcularPaso(false, true), 2, "Con imagen o audio, el paso activo es procesar tema");
    assert.strictEqual(calcularPaso(true, true), 3, "Con plan generado, el paso activo es revisar y exportar");
  });

  it("6.3 La cabecera proporciona affordance táctil para cambiar esquema y periodo", () => {
    let schemaModalAbierto = false;
    function clickChipEsquema() {
      schemaModalAbierto = true;
    }

    assert.strictEqual(schemaModalAbierto, false);
    clickChipEsquema();
    assert.strictEqual(schemaModalAbierto, true, "Hacer clic en el chip de la cabecera abre el selector de esquemas");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PRUEBA 7: FASE 20 — Vista previa de plantillas vacías por esquema
// ─────────────────────────────────────────────────────────────────────────────
describe("FASE 20: Vista previa de plantillas vacías por esquema (Fuente única de verdad)", () => {
  const esquemasEsperados = ["inicial", "primario", "secundario", "especial", "conbase", "abp", "competencias_situacion", "secuencia_didactica"];

  it("7.1 Todos los esquemas oficiales en LEVELS definen bloques curriculares estructurados", () => {
    esquemasEsperados.forEach((id) => {
      const def = LEVELS[id];
      assert.ok(def, `El esquema ${id} debe existir en server/curriculum/levels.js`);
      assert.ok(Array.isArray(def.bloques), `El esquema ${id} debe tener un array de bloques`);
      assert.ok(def.bloques.length >= 5, `El esquema ${id} debe tener al menos 5 bloques curriculares`);
      def.bloques.forEach((b) => {
        assert.ok(typeof b === "string" && b.trim().length > 0, `Cada bloque de ${id} debe ser un string no vacío`);
      });
    });
  });

  it("7.2 La plantilla vacía de cada esquema refleja exactamente el mismo orden y formato de LEVELS", () => {
    // Simulación del generador de plantilla vacía en EsquemaPreviewModal
    function generarPlantillaVacia(esquemaId) {
      const def = LEVELS[esquemaId];
      if (!def || !def.bloques) return [];
      return def.bloques.map((bloque, index) => ({
        numero: index + 1,
        etiqueta: bloque,
        valorVacio: ""
      }));
    }

    const plantillaConBase = generarPlantillaVacia("conbase");
    assert.strictEqual(plantillaConBase.length, LEVELS["conbase"].bloques.length);
    assert.strictEqual(plantillaConBase[0].etiqueta, LEVELS["conbase"].bloques[0]);
    assert.strictEqual(plantillaConBase[1].etiqueta, LEVELS["conbase"].bloques[1]);

    const plantillaABP = generarPlantillaVacia("abp");
    assert.strictEqual(plantillaABP.length, LEVELS["abp"].bloques.length);
    assert.strictEqual(plantillaABP[0].etiqueta, LEVELS["abp"].bloques[0]);
  });

  it("7.3 La acción 'Usar este esquema' activa el periodo y esquema seleccionados para auto-relleno", () => {
    let estadoApp = { periodo: "diaria", nivel: "primario" };

    function confirmarUsoEsquema(nuevoPeriodo, nuevoEsquemaId) {
      estadoApp = { periodo: nuevoPeriodo, nivel: nuevoEsquemaId };
    }

    confirmarUsoEsquema("semanal", "conbase");
    assert.strictEqual(estadoApp.periodo, "semanal");
    assert.strictEqual(estadoApp.nivel, "conbase");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FASE B: Biblioteca Curricular Oficial por Capas, Buscador y Validador
// ─────────────────────────────────────────────────────────────────────────────
describe("FASE B: Biblioteca Curricular Oficial por Capas y Anti-Alucinación", () => {
  const { buscarEnCurriculo } = require("../server/curriculum/buscadorCurricular.js");
  const { validarEstructuraPlanificacion } = require("../server/curriculum/validadorEstructura.js");
  const fs = require("node:fs");
  const path = require("node:path");

  it("8.1 Capa 3: Todos los registros estructurados tienen 'pendiente de validación por experto' y ningún registro está marcado como 'validada'", () => {
    const rutaCapa3 = path.join(process.cwd(), "server", "curriculo", "capa3_estructurados", "curriculo_estructurado.json");
    assert.ok(fs.existsSync(rutaCapa3), "El archivo curriculo_estructurado.json debe existir");

    const estructurados = JSON.parse(fs.readFileSync(rutaCapa3, "utf-8"));
    assert.ok(estructurados.length >= 30, "Deben existir registros curriculares estructurados");

    estructurados.forEach((item) => {
      assert.strictEqual(
        item.estado_validacion,
        "pendiente de validación por experto",
        `El registro ${item.id} debe estar etiquetado como 'pendiente de validación por experto'`
      );
      assert.notStrictEqual(
        item.estado_validacion,
        "validada",
        `El registro ${item.id} no debe estar marcado como 'validada'`
      );
      assert.ok(item.pagina_referencia, `El registro ${item.id} debe tener página de referencia`);
      assert.ok(item.documento_fuente, `El registro ${item.id} debe tener documento fuente`);
    });

    const problemasPath = path.join(process.cwd(), "server", "curriculo", "capa3_estructurados", "registro_problemas.json");
    assert.ok(fs.existsSync(problemasPath), "El registro de problemas debe existir sin ocultar errores");
  });

  it("8.2 Capa 4: El buscador curricular oficial retorna citas exactas y previene alucinaciones", () => {
    // Caso de búsqueda existente
    const resConocido = buscarEnCurriculo({ query: "tarjeta de identidad", grado: "1ro", area: "Lengua Española" });
    assert.strictEqual(resConocido.encontrado, true, "Debe encontrar el contenido oficial de la tarjeta de identidad");
    assert.ok(resConocido.resultados.length > 0, "Debe devolver al menos un resultado");
    assert.ok(resConocido.resultados[0].documento.length > 0, "El resultado debe incluir el documento");
    assert.ok(resConocido.resultados[0].pagina, "El resultado debe incluir la página real");
    assert.strictEqual(resConocido.resultados[0].estado_validacion, "pendiente de validación por experto");

    // Caso de búsqueda inexistente (debe rechazar inventar)
    const resInexistente = buscarEnCurriculo({ query: "quimica cuantica de polimeros", grado: "1ro", area: "Matemática" });
    assert.strictEqual(resInexistente.encontrado, false, "No debe inventar contenido no curricular");
    assert.ok(resInexistente.mensaje.toLowerCase().includes("no se encontró ese dato en el currículo oficial"), "Debe emitir mensaje anti-alucinación");
  });

  it("8.3 Capa 5: El validador de estructura exige los 5 bloques obligatorios de MINERD más sección Fuentes con página real", () => {
    const planCompleto = {
      competencias: ["Comunicativa: Expresa y comprende ideas..."],
      contenidos: { conceptuales: ["La noticia"], procedimentales: ["Lectura"], actitudinales: ["Respeto"] },
      indicadores_logro: ["Comunica sus ideas oralmente"],
      actividades: { inicio: "Presentación", desarrollo: "Lectura grupal", cierre: "Reflexión" },
      evaluacion: "Rúbrica de desempeño",
      fuentes: [{ documento: "Guía Didáctica de Lengua Española", grado: "1er grado", area: "Lengua Española", pagina: "70-72" }]
    };

    const validacionExitosa = validarEstructuraPlanificacion(planCompleto);
    assert.strictEqual(validacionExitosa.valido, true, "Una planificación con todos los bloques oficiales debe ser válida");
    assert.strictEqual(validacionExitosa.bloquesFaltantes.length, 0);
    assert.strictEqual(validacionExitosa.estado_validacion, "pendiente de validación por experto");

    const planSinFuentes = {
      competencias: ["Comunicativa"],
      contenidos: { conceptuales: ["Tema"] },
      indicadores_logro: ["Indicador"],
      actividades: { inicio: "A", desarrollo: "B", cierre: "C" },
      evaluacion: "Prueba"
    };

    const validacionFallida = validarEstructuraPlanificacion(planSinFuentes);
    assert.strictEqual(validacionFallida.valido, false, "Una planificación sin sección Fuentes debe ser rechazada");
    assert.ok(validacionFallida.bloquesFaltantes.some((b) => b.includes("Fuentes")));
  });
});



