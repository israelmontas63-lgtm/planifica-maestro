import { describe, it } from "node:test";
import assert from "node:assert/strict";

const expect = (actual) => ({
  toEqual: (exp) => assert.deepStrictEqual(actual, exp),
  toBeGreaterThan: (n) => assert.ok(actual > n),
  toBeGreaterThanOrEqual: (n) => assert.ok(actual >= n),
  toBe: (exp) => assert.strictEqual(actual, exp),
  toBeDefined: () => assert.ok(actual !== undefined),
  not: {
    toBeNull: () => assert.ok(actual !== null)
  },
  toBeNull: () => assert.strictEqual(actual, null),
  toContain: (str) => assert.ok(typeof actual === "string" && actual.includes(str)),
  toHaveProperty: (prop) => assert.ok(actual && prop in actual)
});
import {
  HERRAMIENTAS_CEREBRO,
  obtenerHerramientasCerebro,
  obtenerHerramientaPorNombre,
  ejecutarHerramientaCerebro
} from "../shared/herramientasCerebro.js";
import proveedoresConfig from "../server/ia/proveedores.json" with { type: "json" };

describe("Herramientas del Cerebro y 7 Capacidades de IA", () => {
  it("proveedores.json registra ordenadamente las 7 capacidades de IA", () => {
    expect(proveedoresConfig.capacidades_registradas).toEqual([
      "texto",
      "vision",
      "imagen_edicion",
      "imagen_generacion",
      "video",
      "audio_voz",
      "audio_transcripcion"
    ]);

    expect(proveedoresConfig.proveedores_texto.length).toBeGreaterThan(0);
    expect(proveedoresConfig.proveedores_vision.length).toBeGreaterThan(0);
    expect(proveedoresConfig.proveedores_imagen_edicion.length).toBeGreaterThanOrEqual(6);
    expect(proveedoresConfig.proveedores_imagen_generacion.length).toBeGreaterThan(0);
    expect(proveedoresConfig.proveedores_video.length).toBeGreaterThan(0);
    expect(proveedoresConfig.proveedores_voz.length).toBeGreaterThan(0);
    expect(proveedoresConfig.proveedores_audio_transcripcion.length).toBeGreaterThan(0);
  });

  it("los modelos de imagen están registrados y apagados por falta de facturación", () => {
    const modelosImagen = proveedoresConfig.proveedores_imagen_edicion;
    const iaModelos = modelosImagen.filter((m) => m.tipo === "imagen_edicion" && m.motor !== "local");
    expect(iaModelos.length).toBe(5);

    for (const m of iaModelos) {
      expect(m.activo).toBe(false);
      expect(m.estado).toBe("apagado_falta_facturacion");
    }

    const motorLocal = modelosImagen.find((m) => m.id === "motor_local_puro");
    expect(motorLocal.activo).toBe(true);
    expect(motorLocal.motor).toBe("local");
  });

  it("las herramientas del cerebro tienen schemas y descripciones completas", () => {
    expect(HERRAMIENTAS_CEREBRO.length).toBeGreaterThanOrEqual(5);

    for (const h of HERRAMIENTAS_CEREBRO) {
      expect(typeof h.name).toBe("string");
      expect(typeof h.description).toBe("string");
      expect(h.parameters.type).toBe("object");
      expect(h.parameters.properties).toBeDefined();
    }
  });

  it("obtenerHerramientasCerebro formatea para function calling de Gemini", () => {
    const tools = obtenerHerramientasCerebro();
    expect(tools.length).toBe(HERRAMIENTAS_CEREBRO.length);
    expect(tools[0]).toHaveProperty("name");
    expect(tools[0]).toHaveProperty("parameters");
  });

  it("obtenerHerramientaPorNombre busca por ID y devuelve null ante desconocidas", () => {
    expect(obtenerHerramientaPorNombre("editar_imagen")).not.toBeNull();
    expect(obtenerHerramientaPorNombre("ojo_visor")).not.toBeNull();
    expect(obtenerHerramientaPorNombre("fantasma")).toBeNull();
  });

  it("ejecutarHerramientaCerebro(editar_imagen) bloquea solicitudes inmorales o denigrantes", async () => {
    const res = await ejecutarHerramientaCerebro("editar_imagen", {
      operacionId: "luz_brillo_mas",
      instruccion: "quítale la camisa al alumno para burlarnos"
    });

    expect(res.ok).toBe(false);
    expect(res.bloqueado).toBe(true);
    expect(res.veredicto).toBe("BLOQUEADO");
  });

  it("ejecutarHerramientaCerebro(identificar_especie_seguridad) diagnostica toxicidad y currículo", async () => {
    const res = await ejecutarHerramientaCerebro("identificar_especie_seguridad", {
      nombreEspecie: "Camila Dieffenbachia",
      descripcion: "Ubicada en una jardinera del patio de Inicial",
      nivelEscolar: "Inicial"
    });

    expect(res.ok).toBe(true);
    expect(res.toxicidad.esPeligrosa).toBe(true);
    expect(res.toxicidad.nivelRiesgo).toBe("ALTO");
    expect(res.toxicidad.advertencia).toContain("ADVERTENCIA DE SEGURIDAD ESCOLAR");
    expect(res.curricular.area).toBe("Ciencias de la Naturaleza");
  });

  it("ejecutarHerramientaCerebro(ojo_visor) parametriza modo y zoom", async () => {
    const res = await ejecutarHerramientaCerebro("ojo_visor", {
      modo: "mirando_en_vivo",
      zoom: 2.2,
      preguntaCurricular: "¿Qué ecosistema representa?"
    });

    expect(res.ok).toBe(true);
    expect(res.modoActivo).toBe("mirando_en_vivo");
    expect(res.zoom).toBe(2.2);
  });

  describe("consultar_base_datos (Capa 2 - Herramientas)", () => {
    it("valida parámetros obligatorios y rechaza incompletos", async () => {
      const res = await ejecutarHerramientaCerebro("consultar_base_datos", {
        nivel: "Primario",
        grado: "2do"
        // Faltan area y tema_o_concepto
      });
      expect(res.ok).toBe(false);
      expect(res.codigo).toBe("PARAMETROS_INVALIDOS");
      expect(res.error).toContain("Faltan parámetros obligatorios");
    });

    it("devuelve estructura de éxito con datos y fuentes oficiales", async () => {
      const fragmentoPrueba = {
        source_id: "sec_mat_2do",
        tema: "Adición con reagrupación",
        fuente_documento: "Guía Didáctica de Matemática MINERD 2023"
      };
      const res = await ejecutarHerramientaCerebro(
        "consultar_base_datos",
        {
          nivel: "Primario",
          grado: "2do",
          area: "Matemática",
          tema_o_concepto: "Adición"
        },
        {
          ejecutor: async () => [fragmentoPrueba]
        }
      );
      expect(res.ok).toBe(true);
      expect(res.filas.length).toBe(1);
      expect(res.fuentes[0]).toContain("MINERD");
    });

    it("devuelve 'sinResultados: true' explícito cuando la lista está vacía", async () => {
      const res = await ejecutarHerramientaCerebro(
        "consultar_base_datos",
        {
          nivel: "Primario",
          grado: "5to",
          area: "Ciencias Sociales",
          tema_o_concepto: "Astrofísica cuántica"
        },
        {
          ejecutor: async () => []
        }
      );
      expect(res.ok).toBe(true);
      expect(res.sinResultados).toBe(true);
      expect(res.filas.length).toBe(0);
      expect(res.aviso).toContain("Sin coincidencias oficiales");
    });

    it("captura errores de Supabase/red y devuelve objeto estructurado sin explotar", async () => {
      const res = await ejecutarHerramientaCerebro(
        "consultar_base_datos",
        {
          nivel: "Primario",
          grado: "3ro",
          area: "Lengua Española",
          tema_o_concepto: "La Noticia"
        },
        {
          ejecutor: async () => {
            throw new Error("Conexión rechazada por base de datos");
          }
        }
      );
      expect(res.ok).toBe(false);
      expect(res.codigo).toBe("ERROR_EJECUTOR");
      expect(res.error).toContain("Conexión rechazada");
    });
  });
});

