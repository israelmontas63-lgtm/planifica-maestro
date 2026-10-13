import { describe, it, expect } from "vitest";
import {
  ESPECIES_PELIGROSAS_RD,
  verificarToxicidadEspecie,
  vincularCurriculoMINERD,
  identificarEspecieConAdaptador
} from "../shared/adaptadorPlantas.js";

describe("Adaptador de Plantas, Fauna y Toxicidad Escolar RD", () => {
  it("contiene catálogo documentado de especies peligrosas de RD", () => {
    expect(ESPECIES_PELIGROSAS_RD.length).toBeGreaterThanOrEqual(9);
    for (const esp of ESPECIES_PELIGROSAS_RD) {
      expect(esp.nombreComun).toBeDefined();
      expect(esp.nivelRiesgo).toBeDefined();
      expect(esp.advertencia).toContain("ADVERTENCIA DE SEGURIDAD ESCOLAR");
      expect(esp.primerosAuxilios).toBeDefined();
    }
  });

  it("detecta correctamente Camila (Dieffenbachia) y genera advertencia roja de toxicidad", () => {
    const res = verificarToxicidadEspecie("Hojas de planta Camila en el pasillo");
    expect(res.esPeligrosa).toBe(true);
    expect(res.nivelRiesgo).toBe("ALTO");
    expect(res.advertencia).toContain("ADVERTENCIA DE SEGURIDAD ESCOLAR");
    expect(res.motivo).toContain("oxalato de calcio");
  });

  it("detecta Guao y emite alerta de dermatitis severa", () => {
    const res = verificarToxicidadEspecie("Guao silvestre", "encontrado en excursión");
    expect(res.esPeligrosa).toBe(true);
    expect(res.nivelRiesgo).toBe("ALTO");
    expect(res.advertencia).toContain("dermatitis severa");
  });

  it("detecta Oruga Peluche y advierte contra contacto físico", () => {
    const res = verificarToxicidadEspecie("Oruga peluche en el tronco del árbol");
    expect(res.esPeligrosa).toBe(true);
    expect(res.advertencia).toContain("espinas altamente venenosas");
  });

  it("clasifica como segura una planta inofensiva común como la Cayena o Maguey", () => {
    const res = verificarToxicidadEspecie("Flor de Cayena roja");
    expect(res.esPeligrosa).toBe(false);
    expect(res.nivelRiesgo).toBe("BAJO");
    expect(res.advertencia).toBeNull();
  });

  it("vincularCurriculoMINERD genera áreas, unidades y preguntas guía curriculares", () => {
    const curArbol = vincularCurriculoMINERD("Caoba dominicana");
    expect(curArbol.area).toBe("Ciencias de la Naturaleza");
    expect(curArbol.tema).toContain("Flora autóctona");
    expect(curArbol.preguntasGuia.length).toBeGreaterThan(0);

    const curFlor = vincularCurriculoMINERD("Trinitaria morada");
    expect(curFlor.tema).toContain("Partes de la flor");
  });

  it("identificarEspecieConAdaptador genera ficha integral con toxicidad y currículo", async () => {
    const ficha = await identificarEspecieConAdaptador({
      nombreDetectado: "Dieffenbachia seguine",
      contexto: "Maceta en el aula de inicial"
    });

    expect(ficha.ok).toBe(true);
    expect(ficha.toxicidad.esPeligrosa).toBe(true);
    expect(ficha.curricular.area).toBe("Ciencias de la Naturaleza");
  });
});
