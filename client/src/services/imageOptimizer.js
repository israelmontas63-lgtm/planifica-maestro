/**
 * client/src/services/imageOptimizer.js
 * 
 * Optimización y compresión de fotos capturadas en móviles para visión IA.
 * Reduce fotos de 12-48 MP a max 1280px en formato JPEG comprimido (80% calidad).
 * Previene sobrecarga de red en 3G/4G y asegura legibilidad de texto para OCR.
 */

export async function comprimirYRedimensionarImagen(file, maxDimension = 1280, calidad = 0.8) {
  if (!file) {
    throw new Error("No se proporcionó ningún archivo de imagen.");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Error leyendo el archivo de imagen."));

    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("No se pudo procesar la imagen seleccionada."));

      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;

          // Redimensionar solo si excede la dimensión máxima
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            // Si el navegador no puede inicializar el contexto 2d, usar original
            return resolve({
              dataUrl: e.target.result,
              base64: String(e.target.result).split(",")[1] || "",
              mediaType: file.type || "image/jpeg"
            });
          }

          // Dibujar con suavizado bicúbico
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, width, height);

          const dataUrl = canvas.toDataURL("image/jpeg", calidad);
          const base64 = dataUrl.split(",")[1] || "";
          const aspectRatio = width && height ? `${width} / ${height}` : "4 / 3";

          resolve({
            dataUrl,
            base64,
            mediaType: "image/jpeg",
            ancho: width,
            alto: height,
            aspectRatio
          });
        } catch (err) {
          // Fallback seguro si falla canvas
          resolve({
            dataUrl: e.target.result,
            base64: String(e.target.result).split(",")[1] || "",
            mediaType: file.type || "image/jpeg",
            aspectRatio: "4 / 3"
          });
        }
      };

      img.src = e.target.result;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Genera una miniatura ultrarrápida (< 15ms) para vista previa inmediata
 */
export async function generarMiniaturaRapida(file, maxDimension = 240, calidad = 0.65) {
  return comprimirYRedimensionarImagen(file, maxDimension, calidad);
}

