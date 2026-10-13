import { describe, it, expect } from "vitest";
import {
  HERRAMIENTAS_CEREBRO,
  obtenerHerramientasCerebro,
  obtenerHerramientaPorNombre,
  ejecutarHerramientaCerebro
} from "../shared/herramientasCerebro.js";
import proveedoresConfig from "../server/ia/proveedores.json";

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
});
