/**
 * client/src/services/editorImagenLocal.js
 * 
 * Envoltura en el cliente para el Motor Local de Edición de Imágenes.
 * Provee:
 * - Conversión bidireccional entre dataUrls/Canvas y matrices planas RGBA.
 * - Pila de Historial para Deshacer (Undo) y Rehacer (Redo).
 * - Comparación visual "Antes vs Después".
 * - Exportación a DataURL (PNG, JPEG, WebP) y Blob.
 */

import {
  crearBufferImagen,
  clonarImagen,
  ejecutarOperacionLocal
} from "../../../shared/editorImagenLocalPuro.js";

/**
 * Carga un dataUrl o URL de imagen en un elemento HTMLImageElement.
 * @param {string} src 
 * @returns {Promise<HTMLImageElement>}
 */
export function cargarImagenElemento(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error("Error al cargar la imagen: " + (err.message || "desconocido")));
    img.src = src;
  });
}

/**
 * Convierte un HTMLImageElement a estructura plana de píxeles { data, width, height }.
 * @param {HTMLImageElement} imgElement 
 * @param {number} [maxDim=1600] - Dimensión máxima para evitar consumo excesivo de memoria en móviles
 * @returns {{ data: Uint8ClampedArray, width: number, height: number }}
 */
export function imagenAImageData(imgElement, maxDim = 1600) {
  let w = imgElement.naturalWidth || imgElement.width || 300;
  let h = imgElement.naturalHeight || imgElement.height || 300;

  if (w > maxDim || h > maxDim) {
    if (w > h) {
      h = Math.round((h * maxDim) / w);
      w = maxDim;
    } else {
      w = Math.round((w * maxDim) / h);
      h = maxDim;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(imgElement, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);

  return {
    data: new Uint8ClampedArray(imgData.data),
    width: w,
    height: h
  };
}

/**
 * Convierte una estructura plana { data, width, height } a un HTMLCanvasElement.
 * @param {{ data: Uint8ClampedArray, width: number, height: number }} buffer 
 * @returns {HTMLCanvasElement}
 */
export function imageDataACanvas(buffer) {
  const canvas = document.createElement("canvas");
  canvas.width = buffer.width;
  canvas.height = buffer.height;
  const ctx = canvas.getContext("2d");
  const imgData = new ImageData(new Uint8ClampedArray(buffer.data), buffer.width, buffer.height);
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Convierte una estructura plana { data, width, height } a DataURL en base64.
 * @param {{ data: Uint8ClampedArray, width: number, height: number }} buffer 
 * @param {string} [tipo="image/jpeg"] 
 * @param {number} [calidad=0.88] 
 * @returns {string}
 */
export function imageDataADataUrl(buffer, tipo = "image/jpeg", calidad = 0.88) {
  const canvas = imageDataACanvas(buffer);
  return canvas.toDataURL(tipo, calidad);
}

/**
 * Convierte una estructura plana a Blob para inserción en documentos Word o descarga.
 * @param {{ data: Uint8ClampedArray, width: number, height: number }} buffer 
 * @param {string} [tipo="image/jpeg"] 
 * @param {number} [calidad=0.88] 
 * @returns {Promise<Blob>}
 */
export function imageDataABlob(buffer, tipo = "image/jpeg", calidad = 0.88) {
  const canvas = imageDataACanvas(buffer);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("No se pudo generar Blob"));
      },
      tipo,
      calidad
    );
  });
}

/**
 * Clase que gestiona una sesión de edición con historial (Deshacer / Rehacer).
 */
export class SesionEdicionImagen {
  constructor(imagenOriginalBuffer, maxHistorial = 15) {
    this.original = clonarImagen(imagenOriginalBuffer);
    this.historial = [clonarImagen(imagenOriginalBuffer)];
    this.indiceActual = 0;
    this.maxHistorial = maxHistorial;
  }

  /**
   * Obtiene la imagen en su estado actual.
   */
  get actual() {
    return this.historial[this.indiceActual];
  }

  /**
   * Indica si se puede deshacer un paso.
   */
  get puedeDeshacer() {
    return this.indiceActual > 0;
  }

  /**
   * Indica si se puede rehacer un paso.
   */
  get puedeRehacer() {
    return this.indiceActual < this.historial.length - 1;
  }

  /**
   * Aplica una operación del catálogo local o función personalizada y la agrega al historial.
   * @param {string} idOperacion 
   * @param {Object} [params] 
   */
  aplicarOperacion(idOperacion, params = {}) {
    const estadoPrevio = this.actual;
    const nuevoEstado = ejecutarOperacionLocal(estadoPrevio, idOperacion, params);

    // Truncar cualquier paso adelante si estábamos a medio historial
    this.historial = this.historial.slice(0, this.indiceActual + 1);
    this.historial.push(nuevoEstado);

    // Limitar tamaño máximo de historial para no saturar memoria
    if (this.historial.length > this.maxHistorial) {
      this.historial.shift();
    } else {
      this.indiceActual++;
    }

    return this.actual;
  }

  /**
   * Establece un nuevo estado directamente (por ejemplo tras procesar con IA).
   * @param {{ data: Uint8ClampedArray, width: number, height: number }} buffer 
   */
  establecerEstado(buffer) {
    this.historial = this.historial.slice(0, this.indiceActual + 1);
    this.historial.push(clonarImagen(buffer));
    if (this.historial.length > this.maxHistorial) {
      this.historial.shift();
    } else {
      this.indiceActual++;
    }
    return this.actual;
  }

  /**
   * Deshace el último cambio.
   */
  deshacer() {
    if (this.puedeDeshacer) {
      this.indiceActual--;
    }
    return this.actual;
  }

  /**
   * Rehace el cambio siguiente.
   */
  rehacer() {
    if (this.puedeRehacer) {
      this.indiceActual++;
    }
    return this.actual;
  }

  /**
   * Restablece la imagen al estado original sin ediciones.
   */
  restablecerOriginal() {
    return this.establecerEstado(this.original);
  }
}
