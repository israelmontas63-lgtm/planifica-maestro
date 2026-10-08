/**
 * client/src/utils/analizadorCalidadImagen.js
 * 
 * Análisis de calidad de imagen en el cliente antes de subir a la red (3C.6a).
 * Calcula en un Canvas:
 * 1. Luminancia media (detecta fotos oscuras o quemadas).
 * 2. Contraste (desviación estándar de luminancia).
 * 3. Nitidez basada en la varianza del Laplaciano (detecta fotos borrosas).
 */

export function calcularMetricasPixeles(data, width, height) {
  const totalPixeles = width * height;
  if (totalPixeles === 0) {
    return {
      esValida: false,
      motivo: "vacia",
      mensaje: "La imagen no contiene datos válidos.",
      metricas: { luminancia: 0, contraste: 0, nitidez: 0 }
    };
  }

  // 1. Convertir a escala de grises y calcular luminancia
  const grises = new Float32Array(totalPixeles);
  let sumaLuminancia = 0;

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Fórmula estándar de luminancia perceptiva (ITU-R BT.601)
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    grises[p] = lum;
    sumaLuminancia += lum;
  }

  const luminanciaMedia = sumaLuminancia / totalPixeles;

  // 2. Contraste: desviación estándar de la luminancia
  let sumaVarianzaLum = 0;
  for (let p = 0; p < totalPixeles; p++) {
    const diff = grises[p] - luminanciaMedia;
    sumaVarianzaLum += diff * diff;
  }
  const contraste = Math.sqrt(sumaVarianzaLum / totalPixeles);

  // 3. Nitidez: Varianza del operador Laplaciano 3x3
  // Kernel: [ 0, 1, 0 ], [ 1, -4, 1 ], [ 0, 1, 0 ]
  let sumaLap = 0;
  let conteoLap = 0;
  const laplacianValues = [];

  // Recorrer píxeles internos (evitando bordes)
  const paso = Math.max(1, Math.floor(Math.min(width, height) / 200)); // Muestreo eficiente para imágenes grandes

  for (let y = 1; y < height - 1; y += paso) {
    const fila = y * width;
    const filaArr = (y - 1) * width;
    const filaAbj = (y + 1) * width;

    for (let x = 1; x < width - 1; x += paso) {
      const centro = grises[fila + x];
      const arriba = grises[filaArr + x];
      const abajo = grises[filaAbj + x];
      const izq = grises[fila + x - 1];
      const der = grises[fila + x + 1];

      const valLap = arriba + abajo + izq + der - 4 * centro;
      laplacianValues.push(valLap);
      sumaLap += valLap;
      conteoLap++;
    }
  }

  let nitidez = 0;
  if (conteoLap > 0) {
    const mediaLap = sumaLap / conteoLap;
    let sumaVarLap = 0;
    for (let i = 0; i < conteoLap; i++) {
      const d = laplacianValues[i] - mediaLap;
      sumaVarLap += d * d;
    }
    nitidez = sumaVarLap / conteoLap;
  }

  // UMBRALES DE CALIDAD:
  // - Luminancia media < 28: foto demasiado oscura / negra.
  // - Luminancia media > 248 con contraste < 8: foto blanca vacía.
  // - Contraste < 12: foto plana uniforme sin texto legible.
  // - Nitidez (Varianza del Laplaciano) < 45: foto desenfocada o borrosa.
  let esValida = true;
  let motivo = "ok";
  let mensaje = null;

  if (luminanciaMedia < 28) {
    esValida = false;
    motivo = "oscura";
    mensaje = "La foto se ve demasiado oscura; toma otra con más luz o escribe el texto.";
  } else if (contraste < 12) {
    esValida = false;
    motivo = "sin_contraste";
    mensaje = "La imagen no tiene suficiente contraste para distinguir el texto; toma otra foto con mejor iluminación.";
  } else if (nitidez < 45 && width >= 40 && height >= 40) {
    esValida = false;
    motivo = "borrosa";
    mensaje = "La foto se ve borrosa o desenfocada; toma otra foto nítida o escribe el texto.";
  }

  return {
    esValida,
    motivo,
    mensaje,
    metricas: {
      luminancia: Math.round(luminanciaMedia * 10) / 10,
      contraste: Math.round(contraste * 10) / 10,
      nitidez: Math.round(nitidez * 10) / 10
    }
  };
}

/**
 * Analiza un elemento Image, Canvas o File/DataURL en el navegador.
 */
export async function analizarCalidadImagenCliente(fuenteImagen) {
  if (typeof document === "undefined") {
    return { esValida: true, motivo: "sin_dom", mensaje: null };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        // Escalar a resolución máxima de 600px para procesamiento ultra rápido (< 15ms)
        const escala = Math.min(1, 600 / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * escala));
        const h = Math.max(1, Math.round(img.height * escala));

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, w, h);

        const imgData = ctx.getImageData(0, 0, w, h);
        const resultado = calcularMetricasPixeles(imgData.data, w, h);
        resolve(resultado);
      } catch (err) {
        // Si hay error en canvas, permitir que el servidor haga su validación
        resolve({ esValida: true, motivo: "error_canvas", mensaje: null });
      }
    };

    img.onerror = () => {
      resolve({
        esValida: false,
        motivo: "error_carga",
        mensaje: "No se pudo leer la imagen seleccionada."
      });
    };

    if (typeof fuenteImagen === "string") {
      img.src = fuenteImagen;
    } else if (fuenteImagen instanceof Blob || fuenteImagen instanceof File) {
      img.src = URL.createObjectURL(fuenteImagen);
    } else {
      resolve({ esValida: false, motivo: "tipo_invalido", mensaje: "Formato de archivo inválido." });
    }
  });
}
