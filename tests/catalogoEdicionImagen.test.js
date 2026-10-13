import { describe, it, expect } from "vitest";
import {
  CATEGORIAS_EDICION,
  CATALOGO_OPERACIONES,
  obtenerOperacionPorId,
  obtenerOperacionesPorCategoria,
  estadisticasCatalogo
} from "../shared/catalogoEdicionImagen.js";

describe("Catálogo Oficial de Edición de Imágenes (480 Operaciones)", () => {
  it("contiene exactamente 12 categorías oficiales", () => {
    expect(CATEGORIAS_EDICION).toHaveLength(12);
    const categoriasIds = CATEGORIAS_EDICION.map((c) => c.id);
    const setIds = new Set(categoriasIds);
    expect(setIds.size).toBe(12);
  });

  it("contiene exactamente 480 operaciones en total", () => {
    expect(CATALOGO_OPERACIONES).toHaveLength(480);
  });

  it("cada categoría contiene exactamente 40 operaciones", () => {
    const stats = estadisticasCatalogo();
    expect(stats.total).toBe(480);

    for (const cat of CATEGORIAS_EDICION) {
      const opsDeCat = obtenerOperacionesPorCategoria(cat.id);
      expect(opsDeCat).toHaveLength(40);
      expect(stats.conteoPorCategoria[cat.id]).toBe(40);
    }
  });

  it("todos los IDs de operaciones son únicos, sin colisiones ni duplicados", () => {
    const ids = CATALOGO_OPERACIONES.map((op) => op.id);
    const setIds = new Set(ids);
    expect(setIds.size).toBe(480);
  });

  it("todas las operaciones tienen campos requeridos válidos y no vacíos", () => {
    const motoresValidos = new Set(["local", "ia", "futuro"]);
    const politicasValidas = new Set(["permitido", "confirmar"]);
    const categoriasValidas = new Set(CATEGORIAS_EDICION.map((c) => c.id));

    for (const op of CATALOGO_OPERACIONES) {
      expect(typeof op.id).toBe("string");
      expect(op.id.trim().length).toBeGreaterThan(0);

      expect(typeof op.nombre).toBe("string");
      expect(op.nombre.trim().length).toBeGreaterThan(0);

      expect(typeof op.descripcion).toBe("string");
      expect(op.descripcion.trim().length).toBeGreaterThan(0);

      expect(categoriasValidas.has(op.categoria)).toBe(true);
      expect(motoresValidos.has(op.motor)).toBe(true);
      expect(politicasValidas.has(op.politica)).toBe(true);

      expect(typeof op.pesoCuota).toBe("number");
      expect(op.pesoCuota).toBeGreaterThan(0);
      expect(typeof op.parametros).toBe("object");
      expect(op.parametros).not.toBeNull();
    }
  });

  it("obtenerOperacionPorId recupera correctamente por ID y maneja fallas de forma segura", () => {
    const opBrillo = obtenerOperacionPorId("luz_brillo_mas");
    expect(opBrillo).not.toBeNull();
    expect(opBrillo.nombre).toBe("Aumentar Brillo");
    expect(opBrillo.categoria).toBe("luz_color");

    const opInexistente = obtenerOperacionPorId("operacion_fantasma_xyz");
    expect(opInexistente).toBeNull();

    expect(obtenerOperacionPorId(null)).toBeNull();
    expect(obtenerOperacionPorId("")).toBeNull();
  });

  it("obtenerOperacionesPorCategoria retorna lista vacía para categorías inválidas", () => {
    expect(obtenerOperacionesPorCategoria("inexistente")).toEqual([]);
    expect(obtenerOperacionesPorCategoria(null)).toEqual([]);
    expect(obtenerOperacionesPorCategoria("")).toEqual([]);
  });

  it("estadisticasCatalogo desglosa motores y políticas correctamente", () => {
    const stats = estadisticasCatalogo();
    const sumaMotores = stats.motores.local + stats.motores.ia + stats.motores.futuro;
    expect(sumaMotores).toBe(480);

    const sumaPoliticas = stats.politicas.permitido + stats.politicas.confirmar;
    expect(sumaPoliticas).toBe(480);

    // Debe haber operaciones locales e IA
    expect(stats.motores.local).toBeGreaterThan(50);
    expect(stats.motores.ia).toBeGreaterThan(50);
  });
});
