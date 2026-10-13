import { describe, it, expect } from "vitest";
import {
  crearBufferImagen,
  clonarImagen,
  ajustarBrillo,
  ajustarContraste,
  escalaGrises,
  efectoSepia,
  invertirColores,
  binarizar,
  ajustarSaturacion,
  recortar,
  rotar,
  voltear,
  redimensionar,
  superponerSticker,
  aplicarConvolucion3x3,
  agregarMarcoSolido,
  ejecutarOperacionLocal
} from "../shared/editorImagenLocalPuro.js";

describe("Motor Local Puro de Edición de Imágenes (Pixel Arrays)", () => {
  it("crearBufferImagen inicializa dimensiones y color uniforme", () => {
    const img = crearBufferImagen(10, 10, [100, 150, 200, 255]);
    expect(img.width).toBe(10);
    expect(img.height).toBe(10);
    expect(img.data.length).toBe(10 * 10 * 4);
    expect(img.data[0]).toBe(100);
    expect(img.data[1]).toBe(150);
    expect(img.data[2]).toBe(200);
    expect(img.data[3]).toBe(255);
  });

  it("clonarImagen crea una copia profunda desacoplada", () => {
    const img = crearBufferImagen(4, 4, [10, 20, 30, 255]);
    const copia = clonarImagen(img);
    expect(copia.width).toBe(img.width);
    expect(copia.height).toBe(img.height);
    expect(copia.data).toEqual(img.data);

    copia.data[0] = 99;
    expect(img.data[0]).toBe(10);
  });

  it("ajustarBrillo incrementa y atenúa los píxeles con clamping", () => {
    const img = crearBufferImagen(2, 2, [100, 100, 100, 255]);
    const masBrillo = ajustarBrillo(img, 1.5);
    expect(masBrillo.data[0]).toBe(150);

    const exceso = ajustarBrillo(img, 3.0);
    expect(exceso.data[0]).toBe(255); // clamped

    const menosBrillo = ajustarBrillo(img, 0.5);
    expect(menosBrillo.data[0]).toBe(50);
  });

  it("ajustarContraste aleja los valores del punto medio 128", () => {
    const img = crearBufferImagen(2, 2, [150, 100, 128, 255]);
    const alto = ajustarContraste(img, 2.0);
    // (150 - 128) * 2 + 128 = 44 + 128 = 172
    expect(alto.data[0]).toBe(172);
    // (100 - 128) * 2 + 128 = -56 + 128 = 72
    expect(alto.data[1]).toBe(72);
    // 128 queda en 128
    expect(alto.data[2]).toBe(128);
  });

  it("escalaGrises aplica luminancia ITU-R BT.601", () => {
    // Píxel rojo puro (255, 0, 0) -> gris = round(0.299 * 255) = 76
    const img = crearBufferImagen(1, 1, [255, 0, 0, 255]);
    const gris = escalaGrises(img);
    expect(gris.data[0]).toBe(76);
    expect(gris.data[1]).toBe(76);
    expect(gris.data[2]).toBe(76);
    expect(gris.data[3]).toBe(255);
  });

  it("efectoSepia produce tonos cálidos pedagógicos", () => {
    const img = crearBufferImagen(1, 1, [100, 100, 100, 255]);
    const sepia = efectoSepia(img);
    // r = 0.393*100 + 0.769*100 + 0.189*100 = 135
    expect(sepia.data[0]).toBe(135);
    // g = 0.349*100 + 0.686*100 + 0.168*100 = 120
    expect(sepia.data[1]).toBe(120);
    // b = 0.272*100 + 0.534*100 + 0.131*100 = 94
    expect(sepia.data[2]).toBe(94);
  });

  it("invertirColores invierte cada canal a 255 - x", () => {
    const img = crearBufferImagen(1, 1, [50, 150, 200, 255]);
    const inv = invertirColores(img);
    expect(inv.data[0]).toBe(205);
    expect(inv.data[1]).toBe(105);
    expect(inv.data[2]).toBe(55);
    expect(inv.data[3]).toBe(255);
  });

  it("binarizar divide píxeles en blanco puro (255) o negro puro (0)", () => {
    const img = crearBufferImagen(2, 1, [50, 50, 50, 255]);
    img.data[4] = 200;
    img.data[5] = 200;
    img.data[6] = 200;
    img.data[7] = 255;

    const bin = binarizar(img, 128);
    expect(bin.data[0]).toBe(0); // oscuro -> 0
    expect(bin.data[4]).toBe(255); // claro -> 255

    const binInv = binarizar(img, 128, true);
    expect(binInv.data[0]).toBe(255);
    expect(binInv.data[4]).toBe(0);
  });

  it("ajustarSaturacion modifica viveza de colores", () => {
    const img = crearBufferImagen(1, 1, [200, 50, 50, 255]);
    const desaturada = ajustarSaturacion(img, 0.0);
    // Debe coincidir con su gris
    expect(desaturada.data[0]).toBe(desaturada.data[1]);
    expect(desaturada.data[1]).toBe(desaturada.data[2]);
  });

  it("recortar extrae submatriz exacta", () => {
    const img = crearBufferImagen(4, 4, [0, 0, 0, 255]);
    // Asignar un valor único en (1, 1)
    const idx = (1 * 4 + 1) * 4;
    img.data[idx] = 255;

    const crop = recortar(img, { x: 1, y: 1, width: 2, height: 2 });
    expect(crop.width).toBe(2);
    expect(crop.height).toBe(2);
    expect(crop.data[0]).toBe(255);
  });

  it("rotar efectúa giros de 90, 180 y 270 grados correctamente", () => {
    // 2 ancho x 3 alto
    const img = crearBufferImagen(2, 3, [0, 0, 0, 255]);
    // Punto superior izquierdo (0, 0)
    img.data[0] = 255;

    const rot90 = rotar(img, 90);
    expect(rot90.width).toBe(3);
    expect(rot90.height).toBe(2);
    // (0,0) en 2x3 al girar 90 va a (width - 1, 0) en coordenadas transpuestas: (srcH - 1 - y, x) -> (2, 0)
    const idxRot90 = (0 * 3 + 2) * 4;
    expect(rot90.data[idxRot90]).toBe(255);

    const rot180 = rotar(img, 180);
    expect(rot180.width).toBe(2);
    expect(rot180.height).toBe(3);

    const rot270 = rotar(img, 270);
    expect(rot270.width).toBe(3);
    expect(rot270.height).toBe(2);
  });

  it("voltear efectúa espejo horizontal y vertical", () => {
    const img = crearBufferImagen(2, 2, [0, 0, 0, 255]);
    img.data[0] = 255; // (0, 0)

    const flipH = voltear(img, { horizontal: true });
    // En flipH, (0,0) pasa a (1,0)
    expect(flipH.data[4]).toBe(255);

    const flipV = voltear(img, { vertical: true });
    // En flipV, (0,0) pasa a (0,1)
    expect(flipV.data[8]).toBe(255);
  });

  it("redimensionar cambia resolución preservando canales", () => {
    const img = crearBufferImagen(4, 4, [120, 130, 140, 255]);
    const reducida = redimensionar(img, 2, 2);
    expect(reducida.width).toBe(2);
    expect(reducida.height).toBe(2);
    expect(reducida.data.length).toBe(2 * 2 * 4);
    expect(reducida.data[0]).toBe(120);
  });

  it("superponerSticker combina píxeles usando canal alfa", () => {
    const fondo = crearBufferImagen(4, 4, [255, 255, 255, 255]); // Blanco
    const sticker = crearBufferImagen(2, 2, [255, 0, 0, 255]); // Rojo opaco

    const compuesto = superponerSticker(fondo, sticker, { x: 1, y: 1, opacidad: 1.0 });
    // En (1,1) debe ser rojo
    const idx = (1 * 4 + 1) * 4;
    expect(compuesto.data[idx]).toBe(255);
    expect(compuesto.data[idx + 1]).toBe(0);
    expect(compuesto.data[idx + 2]).toBe(0);

    // En (0,0) sigue siendo blanco
    expect(compuesto.data[0]).toBe(255);
    expect(compuesto.data[1]).toBe(255);
    expect(compuesto.data[2]).toBe(255);
  });

  it("agregarMarcoSolido aplica bordes del color indicado", () => {
    const img = crearBufferImagen(20, 20, [255, 255, 255, 255]);
    const conMarco = agregarMarcoSolido(img, 2, [0, 40, 104, 255]);
    // Borde (0, 0)
    expect(conMarco.data[0]).toBe(0);
    expect(conMarco.data[1]).toBe(40);
    expect(conMarco.data[2]).toBe(104);

    // Centro (10, 10) sigue blanco
    const idxCentro = (10 * 20 + 10) * 4;
    expect(conMarco.data[idxCentro]).toBe(255);
  });

  it("ejecutarOperacionLocal despacha correctamente operaciones del catálogo", () => {
    const img = crearBufferImagen(4, 4, [100, 100, 100, 255]);
    const resBrillo = ejecutarOperacionLocal(img, "luz_brillo_mas");
    expect(resBrillo.data[0]).toBe(125);

    const resGrises = ejecutarOperacionLocal(img, "estilos_escala_grises");
    expect(resGrises.data[0]).toBe(100);

    const resRotar = ejecutarOperacionLocal(img, "salida_rotar_90");
    expect(resRotar.width).toBe(4);
    expect(resRotar.height).toBe(4);
  });

  it("SesionEdicionImagen maneja historial, deshacer, rehacer y restablecer correctamente", async () => {
    const { SesionEdicionImagen } = await import("../client/src/services/editorImagenLocal.js");
    const inicial = crearBufferImagen(4, 4, [100, 100, 100, 255]);
    const sesion = new SesionEdicionImagen(inicial);

    expect(sesion.puedeDeshacer).toBe(false);
    expect(sesion.puedeRehacer).toBe(false);

    // Aplicar paso 1: Brillo
    sesion.aplicarOperacion("luz_brillo_mas");
    expect(sesion.puedeDeshacer).toBe(true);
    expect(sesion.puedeRehacer).toBe(false);
    expect(sesion.actual.data[0]).toBe(125);

    // Aplicar paso 2: Invertir
    sesion.aplicarOperacion("luz_invertir");
    expect(sesion.actual.data[0]).toBe(255 - 125);

    // Deshacer
    sesion.deshacer();
    expect(sesion.actual.data[0]).toBe(125);
    expect(sesion.puedeRehacer).toBe(true);

    // Rehacer
    sesion.rehacer();
    expect(sesion.actual.data[0]).toBe(130);

    // Restablecer al original
    sesion.restablecerOriginal();
    expect(sesion.actual.data[0]).toBe(100);
  });
});

