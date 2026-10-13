/**
 * shared/editorImagenLocalPuro.js
 * 
 * Motor Local Puro de procesamiento de imágenes sobre matrices planas de píxeles RGBA.
 * Funciona de forma 100% isomórfica (tanto en Node.js para tests/backend como en el navegador).
 * Estructura de entrada/salida: { data: Uint8ClampedArray, width: number, height: number }
 */

/**
 * Crea una nueva imagen vacía o con color de fondo uniforme.
 * @param {number} width 
 * @param {number} height 
 * @param {Array<number>} [color] [r, g, b, a]
 * @returns {{ data: Uint8ClampedArray, width: number, height: number }}
 */
export function crearBufferImagen(width, height, color = [255, 255, 255, 255]) {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const data = new Uint8ClampedArray(w * h * 4);
  const [r, g, b, a] = color;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }

  return { data, width: w, height: h };
}

/**
 * Clona una estructura de imagen plana.
 */
export function clonarImagen(img) {
  if (!img || !img.data) throw new Error("Imagen inválida para clonar");
  return {
    data: new Uint8ClampedArray(img.data),
    width: img.width,
    height: img.height
  };
}

/**
 * Ajusta el brillo de la imagen multiplicando los componentes RGB por un factor.
 * @param {Object} img 
 * @param {number} factor (ej: 1.2 = +20%, 0.8 = -20%)
 */
export function ajustarBrillo(img, factor = 1.0) {
  const res = clonarImagen(img);
  const d = res.data;
  const f = Math.max(0, factor);

  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.min(255, Math.max(0, Math.round(d[i] * f)));
    d[i + 1] = Math.min(255, Math.max(0, Math.round(d[i + 1] * f)));
    d[i + 2] = Math.min(255, Math.max(0, Math.round(d[i + 2] * f)));
  }
  return res;
}

/**
 * Ajusta el contraste de la imagen centrado en 128.
 * @param {Object} img 
 * @param {number} factor (1.0 = sin cambio, >1 más contraste, <1 menos)
 */
export function ajustarContraste(img, factor = 1.0) {
  const res = clonarImagen(img);
  const d = res.data;
  const f = Math.max(0, factor);

  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.min(255, Math.max(0, Math.round((d[i] - 128) * f + 128)));
    d[i + 1] = Math.min(255, Math.max(0, Math.round((d[i + 1] - 128) * f + 128)));
    d[i + 2] = Math.min(255, Math.max(0, Math.round((d[i + 2] - 128) * f + 128)));
  }
  return res;
}

/**
 * Convierte la imagen a escala de grises mediante luminancia ponderada (ITU-R BT.601).
 * @param {Object} img 
 */
export function escalaGrises(img) {
  const res = clonarImagen(img);
  const d = res.data;

  for (let i = 0; i < d.length; i += 4) {
    const gris = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = gris;
    d[i + 1] = gris;
    d[i + 2] = gris;
  }
  return res;
}

/**
 * Aplica el tono cálido sepia pedagógico clásico.
 * @param {Object} img 
 */
export function efectoSepia(img) {
  const res = clonarImagen(img);
  const d = res.data;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];

    const nuevoR = Math.min(255, Math.round(0.393 * r + 0.769 * g + 0.189 * b));
    const nuevoG = Math.min(255, Math.round(0.349 * r + 0.686 * g + 0.168 * b));
    const nuevoB = Math.min(255, Math.round(0.272 * r + 0.534 * g + 0.131 * b));

    d[i] = nuevoR;
    d[i + 1] = nuevoG;
    d[i + 2] = nuevoB;
  }
  return res;
}

/**
 * Invierte los colores (negativo fotográfico).
 * @param {Object} img 
 */
export function invertirColores(img) {
  const res = clonarImagen(img);
  const d = res.data;

  for (let i = 0; i < d.length; i += 4) {
    d[i] = 255 - d[i];
    d[i + 1] = 255 - d[i + 1];
    d[i + 2] = 255 - d[i + 2];
  }
  return res;
}

/**
 * Binariza la imagen en blanco y negro puro según un umbral de luminosidad.
 * Ideal para digitalizar pizarra con tiza o fotocopias de guías.
 * @param {Object} img 
 * @param {number} umbral (0 a 255, defecto 128)
 * @param {boolean} invertir (si true, fondo negro y trazo blanco)
 */
export function binarizar(img, umbral = 128, invertir = false) {
  const res = clonarImagen(img);
  const d = res.data;

  for (let i = 0; i < d.length; i += 4) {
    const luma = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const val = luma >= umbral ? (invertir ? 0 : 255) : (invertir ? 255 : 0);
    d[i] = val;
    d[i + 1] = val;
    d[i + 2] = val;
  }
  return res;
}

/**
 * Ajusta la saturación de los colores.
 * @param {Object} img 
 * @param {number} factor (0 = escala de grises, 1 = normal, >1 más saturado)
 */
export function ajustarSaturacion(img, factor = 1.0) {
  const res = clonarImagen(img);
  const d = res.data;
  const f = Math.max(0, factor);

  for (let i = 0; i < d.length; i += 4) {
    const gris = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = Math.min(255, Math.max(0, Math.round(gris + (d[i] - gris) * f)));
    d[i + 1] = Math.min(255, Math.max(0, Math.round(gris + (d[i + 1] - gris) * f)));
    d[i + 2] = Math.min(255, Math.max(0, Math.round(gris + (d[i + 2] - gris) * f)));
  }
  return res;
}

/**
 * Recorta una región rectangular de la imagen.
 * @param {Object} img 
 * @param {{ x: number, y: number, width: number, height: number }} region 
 */
export function recortar(img, region) {
  let { x, y, width: w, height: h } = region;
  x = Math.max(0, Math.min(img.width - 1, Math.floor(x)));
  y = Math.max(0, Math.min(img.height - 1, Math.floor(y)));
  w = Math.max(1, Math.min(img.width - x, Math.floor(w)));
  h = Math.max(1, Math.min(img.height - y, Math.floor(h)));

  const salida = crearBufferImagen(w, h);
  const src = img.data;
  const dst = salida.data;

  for (let row = 0; row < h; row++) {
    const srcInicio = ((y + row) * img.width + x) * 4;
    const dstInicio = (row * w) * 4;
    const len = w * 4;
    dst.set(src.subarray(srcInicio, srcInicio + len), dstInicio);
  }

  return salida;
}

/**
 * Rota la imagen 90, 180 o 270 grados en sentido horario.
 * @param {Object} img 
 * @param {number} angulo (90, 180, 270)
 */
export function rotar(img, angulo = 90) {
  const ang = ((Math.round(angulo / 90) * 90) % 360 + 360) % 360;
  if (ang === 0) return clonarImagen(img);

  const srcW = img.width;
  const srcH = img.height;
  const src = img.data;

  if (ang === 180) {
    const salida = crearBufferImagen(srcW, srcH);
    const dst = salida.data;
    for (let y = 0; y < srcH; y++) {
      for (let x = 0; x < srcW; x++) {
        const srcIdx = (y * srcW + x) * 4;
        const dstIdx = ((srcH - 1 - y) * srcW + (srcW - 1 - x)) * 4;
        dst[dstIdx] = src[srcIdx];
        dst[dstIdx + 1] = src[srcIdx + 1];
        dst[dstIdx + 2] = src[srcIdx + 2];
        dst[dstIdx + 3] = src[srcIdx + 3];
      }
    }
    return salida;
  }

  // 90 o 270: las dimensiones se intercambian
  const dstW = srcH;
  const dstH = srcW;
  const salida = crearBufferImagen(dstW, dstH);
  const dst = salida.data;

  if (ang === 90) {
    for (let y = 0; y < srcH; y++) {
      for (let x = 0; x < srcW; x++) {
        const srcIdx = (y * srcW + x) * 4;
        const dstIdx = (x * dstW + (srcH - 1 - y)) * 4;
        dst[dstIdx] = src[srcIdx];
        dst[dstIdx + 1] = src[srcIdx + 1];
        dst[dstIdx + 2] = src[srcIdx + 2];
        dst[dstIdx + 3] = src[srcIdx + 3];
      }
    }
  } else if (ang === 270) {
    for (let y = 0; y < srcH; y++) {
      for (let x = 0; x < srcW; x++) {
        const srcIdx = (y * srcW + x) * 4;
        const dstIdx = ((srcW - 1 - x) * dstW + y) * 4;
        dst[dstIdx] = src[srcIdx];
        dst[dstIdx + 1] = src[srcIdx + 1];
        dst[dstIdx + 2] = src[srcIdx + 2];
        dst[dstIdx + 3] = src[srcIdx + 3];
      }
    }
  }

  return salida;
}

/**
 * Voltea la imagen de manera horizontal o vertical (espejo).
 * @param {Object} img 
 * @param {{ horizontal?: boolean, vertical?: boolean }} opciones 
 */
export function voltear(img, { horizontal = false, vertical = false } = {}) {
  const w = img.width;
  const h = img.height;
  const salida = crearBufferImagen(w, h);
  const src = img.data;
  const dst = salida.data;

  for (let y = 0; y < h; y++) {
    const targetY = vertical ? (h - 1 - y) : y;
    for (let x = 0; x < w; x++) {
      const targetX = horizontal ? (w - 1 - x) : x;
      const srcIdx = (y * w + x) * 4;
      const dstIdx = (targetY * w + targetX) * 4;
      dst[dstIdx] = src[srcIdx];
      dst[dstIdx + 1] = src[srcIdx + 1];
      dst[dstIdx + 2] = src[srcIdx + 2];
      dst[dstIdx + 3] = src[srcIdx + 3];
    }
  }
  return salida;
}

/**
 * Redimensiona la imagen mediante interpolación bilineal o vecino más cercano.
 * @param {Object} img 
 * @param {number} nuevoAncho 
 * @param {number} nuevoAlto 
 */
export function redimensionar(img, nuevoAncho, nuevoAlto) {
  const dstW = Math.max(1, Math.floor(nuevoAncho));
  const dstH = Math.max(1, Math.floor(nuevoAlto));
  const srcW = img.width;
  const srcH = img.height;
  const src = img.data;

  const salida = crearBufferImagen(dstW, dstH);
  const dst = salida.data;

  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  for (let y = 0; y < dstH; y++) {
    const srcY = Math.min(srcH - 1, Math.floor(y * yRatio));
    for (let x = 0; x < dstW; x++) {
      const srcX = Math.min(srcW - 1, Math.floor(x * xRatio));
      const srcIdx = (srcY * srcW + srcX) * 4;
      const dstIdx = (y * dstW + x) * 4;

      dst[dstIdx] = src[srcIdx];
      dst[dstIdx + 1] = src[srcIdx + 1];
      dst[dstIdx + 2] = src[srcIdx + 2];
      dst[dstIdx + 3] = src[srcIdx + 3];
    }
  }

  return salida;
}

/**
 * Superpone un elemento o sticker RGBA con transparencia alfa combinada.
 * @param {Object} fondo 
 * @param {Object} elemento 
 * @param {{ x: number, y: number, opacidad?: number }} opciones 
 */
export function superponerSticker(fondo, elemento, { x = 0, y = 0, opacidad = 1.0 } = {}) {
  const res = clonarImagen(fondo);
  const dst = res.data;
  const src = elemento.data;
  const opac = Math.max(0, Math.min(1, opacidad));

  const inicioX = Math.floor(x);
  const inicioY = Math.floor(y);

  for (let elY = 0; elY < elemento.height; elY++) {
    const targetY = inicioY + elY;
    if (targetY < 0 || targetY >= res.height) continue;

    for (let elX = 0; elX < elemento.width; elX++) {
      const targetX = inicioX + elX;
      if (targetX < 0 || targetX >= res.width) continue;

      const srcIdx = (elY * elemento.width + elX) * 4;
      const dstIdx = (targetY * res.width + targetX) * 4;

      const srcAlpha = (src[srcIdx + 3] / 255) * opac;
      if (srcAlpha <= 0) continue;

      const dstAlpha = dst[dstIdx + 3] / 255;
      const outAlpha = srcAlpha + dstAlpha * (1 - srcAlpha);

      if (outAlpha > 0) {
        dst[dstIdx] = Math.round((src[srcIdx] * srcAlpha + dst[dstIdx] * dstAlpha * (1 - srcAlpha)) / outAlpha);
        dst[dstIdx + 1] = Math.round((src[srcIdx + 1] * srcAlpha + dst[dstIdx + 1] * dstAlpha * (1 - srcAlpha)) / outAlpha);
        dst[dstIdx + 2] = Math.round((src[srcIdx + 2] * srcAlpha + dst[dstIdx + 2] * dstAlpha * (1 - srcAlpha)) / outAlpha);
        dst[dstIdx + 3] = Math.round(outAlpha * 255);
      }
    }
  }

  return res;
}

/**
 * Aplica una matriz de convolución (kernel) 3x3 para enfoque, desenfoque o detección de bordes.
 * @param {Object} img 
 * @param {Array<number>} kernel [k0..k8]
 * @param {number} divisor 
 * @param {number} offset 
 */
export function aplicarConvolucion3x3(img, kernel, divisor = 1, offset = 0) {
  const w = img.width;
  const h = img.height;
  const src = img.data;
  const salida = crearBufferImagen(w, h);
  const dst = salida.data;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let r = 0, g = 0, b = 0;
      let kIdx = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * w + (x + kx)) * 4;
          const kVal = kernel[kIdx++];
          r += src[idx] * kVal;
          g += src[idx + 1] * kVal;
          b += src[idx + 2] * kVal;
        }
      }

      const dstIdx = (y * w + x) * 4;
      dst[dstIdx] = Math.min(255, Math.max(0, Math.round(r / divisor + offset)));
      dst[dstIdx + 1] = Math.min(255, Math.max(0, Math.round(g / divisor + offset)));
      dst[dstIdx + 2] = Math.min(255, Math.max(0, Math.round(b / divisor + offset)));
      dst[dstIdx + 3] = src[dstIdx + 3];
    }
  }

  return salida;
}

/**
 * Añade un marco escolar decorativo en los bordes de la imagen.
 * @param {Object} img 
 * @param {number} grosor 
 * @param {Array<number>} color [r, g, b, a]
 */
export function agregarMarcoSolido(img, grosor = 8, color = [0, 40, 104, 255]) {
  const res = clonarImagen(img);
  const d = res.data;
  const w = res.width;
  const h = res.height;
  const [r, g, b, a] = color;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < grosor || x >= w - grosor || y < grosor || y >= h - grosor) {
        const idx = (y * w + x) * 4;
        d[idx] = r;
        d[idx + 1] = g;
        d[idx + 2] = b;
        d[idx + 3] = a;
      }
    }
  }
  return res;
}

/**
 * Despachador principal de operaciones locales por ID del catálogo.
 * Permite ejecutar cualquiera de las transformaciones locales de forma declarativa.
 * @param {Object} img - { data, width, height }
 * @param {string} idOperacion - ID de la operación del catálogo
 * @param {Object} [params] - Parámetros personalizados que sobreescriben los por defecto
 */
export function ejecutarOperacionLocal(img, idOperacion, params = {}) {
  switch (idOperacion) {
    case "luz_brillo_mas":
      return ajustarBrillo(img, params.factor || 1.25);
    case "luz_brillo_menos":
      return ajustarBrillo(img, params.factor || 0.8);
    case "luz_contraste_alto":
    case "nitidez_contraste_pizarra":
      return ajustarContraste(img, params.factor || params.contraste || 1.4);
    case "luz_contraste_suave":
      return ajustarContraste(img, params.factor || params.contraste || 0.85);
    case "luz_blanco_negro":
    case "estilos_escala_grises":
      return escalaGrises(img);
    case "luz_sepia_pedagogico":
    case "estilos_sepia_historico":
      return efectoSepia(img);
    case "luz_invertir":
    case "material_invertir_blanco_negro":
      return invertirColores(img);
    case "luz_saturacion_alta":
      return ajustarSaturacion(img, params.factor || 1.4);
    case "luz_saturacion_baja":
      return ajustarSaturacion(img, params.factor || 0.6);
    case "luz_binarizar_pizarra":
    case "material_alto_contraste_fotocopia":
      return binarizar(img, params.umbral || 135, false);
    case "nitidez_enfoque_suave":
      // Kernel de enfoque sutil
      return aplicarConvolucion3x3(img, [0, -1, 0, -1, 5, -1, 0, -1, 0], 1, 0);
    case "nitidez_desenfoque_suave":
      // Kernel de desenfoque caja 3x3
      return aplicarConvolucion3x3(img, [1, 1, 1, 1, 1, 1, 1, 1, 1], 9, 0);
    case "salida_rotar_90":
      return rotar(img, 90);
    case "salida_rotar_180":
      return rotar(img, 180);
    case "salida_rotar_270":
      return rotar(img, 270);
    case "salida_voltear_h":
      return voltear(img, { horizontal: true });
    case "salida_voltear_v":
      return voltear(img, { vertical: true });
    case "salida_redimensionar_cuota":
      return redimensionar(img, params.width || Math.round(img.width * 0.75), params.height || Math.round(img.height * 0.75));
    case "adornos_marco_azul_minerd":
      return agregarMarcoSolido(img, params.grosor || 10, [0, 40, 104, 255]); // Azul institucional
    case "adornos_marco_rojo_patrio":
      return agregarMarcoSolido(img, params.grosor || 10, [206, 17, 38, 255]); // Rojo patrio RD
    case "fondos_fondo_blanco_puro":
      // Reemplaza píxeles casi blancos o transparentes
      return binarizar(img, 200, false);
    default:
      // Si la operación no tiene algoritmo puro específico, retornar clon intacto
      return clonarImagen(img);
  }
}
