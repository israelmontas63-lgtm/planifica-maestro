/**
 * server/ia/ojoDigital.js
 * Ojo Digital Inteligente para Planifica Maestro (Node.js / Express)
 * 
 * Responsabilidades:
 * 1. Identificar y describir qué hay en la foto en 1-2 frases claras antes de cualquier acción curricular.
 * 2. Adaptar opciones interactivas según el tipo visual (documento, objeto/planta, mapa, pizarra).
 * 3. Proteger contra prompt injections dentro de la imagen.
 * 4. Manejo honesto de incertidumbre, fotos borrosas y advertencias en temas delicados.
 * 5. Consumir exactamente 1 llamada de visión en gestorGasto.
 */

const { enrutarPeticion } = require("./enrutadorIA.js");
const { puedeRealizarConsulta } = require("./gestorGasto.js");
const {
  PROMPT_OJO_DIGITAL,
  generarOpcionesSegunTipoVisual,
  analizarCalidadImagen,
  tieneIntencionExplicita
} = require("../../shared/constantsOjoDigital.js");


async function identificarImagenConVision({
  imageBase64,
  mediaType = "image/jpeg",
  env = process.env,
  signal = null,
  validarCalidad = false
}) {
  if (validarCalidad) {
    const calidad = analizarCalidadImagen(imageBase64);
    if (calidad.ilegible) {
      return {
        exito: true,
        descripcion: "La imagen se ve oscura o ilegible; toma otra foto con más luz o escribe el texto.",
        tipo_visual: "ilegible",
        es_borrosa: true,
        es_delicado: false,
        tema_detectado: null,
        texto_resumen_ocr: null,
        opciones: ["Tomar otra foto con más luz", "Escribir mi consulta"],
        proveedor_utilizado: "defensa_local",
        codigo_http: 200
      };
    }
  }

  const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      exito: false,
      error: "camara_no_disponible",
      mensaje: "La cámara no está disponible ahora (clave de visión no configurada). Por favor, prueba más tarde o escribe tu consulta directamente."
    };
  }

  if (!puedeRealizarConsulta(500)) {
    return {
      exito: false,
      error: "cuota_agotada",
      mensaje: "La cámara no está disponible ahora (límite diario de consultas alcanzado). Por favor, intenta de nuevo mañana o escribe tu consulta."
    };
  }

  try {
    const res = await enrutarPeticion({
      tema: "Identificación de imagen",
      prompt: PROMPT_OJO_DIGITAL,
      imageBase64,
      mediaType,
      env,
      signal
    });

    if (res && !res.error && res.descripcion) {
      const esBorrosa = Boolean(res.es_borrosa);
      const esDelicado = Boolean(res.es_delicado);
      let descripcion = res.descripcion.trim();

      if (esDelicado) {
        descripcion += "\n\n*(⚠️ Aviso importante: La identificación de plantas, hongos o sustancias por fotografía es orientativa. No consumas ni administres nada basándote únicamente en una foto; verifica siempre con guías oficiales o expertos.)*";
      }

      const tipoVisual = res.tipo_visual || (esBorrosa ? "ilegible" : "objeto_o_naturaleza");
      const opciones = generarOpcionesSegunTipoVisual(tipoVisual, esBorrosa);

      return {
        exito: true,
        descripcion,
        tipo_visual: tipoVisual,
        es_borrosa: esBorrosa,
        es_delicado: esDelicado,
        tema_detectado: res.tema_detectado || null,
        texto_resumen_ocr: res.texto_resumen_ocr || null,
        opciones,
        proveedor_utilizado: res.proveedor_utilizado || "gemini_flash"
      };
    }
  } catch (err) {
    if (err.name === "AbortError") throw err;
    console.warn(`⚠️ [Ojo Digital] Error en enrutador de visión: ${err.message}`);
  }

  return {
    exito: false,
    error: "camara_no_disponible",
    mensaje: "La cámara no está disponible ahora (límite de visión alcanzado o sin conexión con el servicio). Por favor, prueba más tarde o escribe tu consulta directamente."
  };
}

module.exports = {
  PROMPT_OJO_DIGITAL,
  generarOpcionesSegunTipoVisual,
  tieneIntencionExplicita,
  identificarImagenConVision,
  analizarCalidadImagen
};
