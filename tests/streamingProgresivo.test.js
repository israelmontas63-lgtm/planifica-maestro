import { describe, it, expect } from "vitest";
import { repararJsonTruncado, extraerBloquesCompletados, planEsRecuperable } from "../shared/parseadorJsonSeguro.js";

describe("repararJsonTruncado", () => {
  it("repara JSON truncado con llaves y comillas abiertas", () => {
    const raw = `{"mensaje_chat": "Plan listo", "plan_completado": true, "datos_planificacion": {"datos_generales": {"grado": "3ro", "area": "Ciencias Sociales"`;
    const res = repararJsonTruncado(raw);
    expect(res).not.toBeNull();
    expect(res.plan_completado).toBe(true);
    expect(res.datos_planificacion?.datos_generales?.grado).toBe("3ro");
  });

  it("repara JSON cortado a mitad de una cadena", () => {
    const raw = `{"mensaje_chat": "Plan listo", "datos_planificacion": {"momentos": {"inicio": "El docente saluda a los alumnos y expli`;
    const res = repararJsonTruncado(raw);
    expect(res).not.toBeNull();
    expect(res.datos_planificacion?.momentos?.inicio).toContain("El docente saluda");
  });

  it("repara JSON con arrays truncados", () => {
    const raw = `{"mensaje_chat": "Ok", "datos_planificacion": {"actividades": [{"nombre": "Lectura guiada"}, {"nombre": "Mapa mental"`;
    const res = repararJsonTruncado(raw);
    expect(res).not.toBeNull();
    expect(Array.isArray(res.datos_planificacion?.actividades)).toBe(true);
    expect(res.datos_planificacion.actividades.length).toBe(2);
  });
});

describe("extraerBloquesCompletados", () => {
  it("extrae bloques a medida que se completan en el stream", () => {
    const bloquesEmitidos = new Set();

    // Chunk 1: solo inicio
    let streamText = `{"mensaje_chat": "Plan generado con éxito", "plan_completado": true, `;
    let nuevos = extraerBloquesCompletados(streamText, bloquesEmitidos);
    expect(nuevos.length).toBe(1);
    expect(nuevos[0].bloque).toBe("mensaje_chat");
    expect(nuevos[0].contenido).toBe("Plan generado con éxito");

    // Chunk 2: se completa datos_generales
    streamText += `"datos_planificacion": {"1. Datos generales (grado, área)": {"grado": "3ro", "area": "Ciencias Sociales"}, `;
    nuevos = extraerBloquesCompletados(streamText, bloquesEmitidos);
    expect(nuevos.length).toBe(1);
    expect(nuevos[0].bloque).toBe("datos_generales");
    expect(nuevos[0].contenido.grado).toBe("3ro");

    // Chunk 3: texto parcial de momentos (no debe emitir todavía)
    streamText += `"momentos": {"inicio": "Presentación del relieve"`;
    nuevos = extraerBloquesCompletados(streamText, bloquesEmitidos);
    expect(nuevos.length).toBe(0);

    // Chunk 4: momentos se completa
    streamText += `, "desarrollo": "Trabajo con mapas", "cierre": "Reflexión"}`;
    nuevos = extraerBloquesCompletados(streamText, bloquesEmitidos);
    expect(nuevos.length).toBe(1);
    expect(nuevos[0].bloque).toBe("momentos");
    expect(nuevos[0].contenido.inicio).toBe("Presentación del relieve");
  });
});

describe("planEsRecuperable", () => {
  it("determina que un plan es recuperable si tiene datos generales y momentos", () => {
    const plan = {
      datos_planificacion: {
        "1. Datos generales": { grado: "3ro", area: "Sociales" },
        "6. Actividades": { inicio: "Presentación", desarrollo: "Mapas", cierre: "Quiz" }
      }
    };
    expect(planEsRecuperable(plan)).toBe(true);
  });

  it("determina que no es recuperable si le faltan las actividades o momentos", () => {
    const planIncompleto = {
      datos_planificacion: {
        "1. Datos generales": { grado: "3ro" }
      }
    };
    expect(planEsRecuperable(planIncompleto)).toBe(false);
  });
});

