const express = require("express");
const { GoogleGenAI } = require("@google/genai");
const { clasificarIntencion } = require("../ia/clasificadorIntencion");
const { filtrarPrivacidad } = require("../ia/enrutadorIA");
const fs = require("fs");
const path = require("path");

const router = express.Router();

function obtenerProveedorVisionAprobado() {
  try {
    const configPath = path.join(__dirname, "..", "ia", "proveedores.json");
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      const provsVision = cfg.proveedores_vision || [];
      const activoVision = provsVision.find(p => p.vision_aprobada && p.activo);
      if (activoVision) {
        // Enlazar con modelo de texto si tiene proveedor_id
        const provTexto = (cfg.proveedores_texto || []).find(p => p.id === activoVision.proveedor_id);
        return {
          id: activoVision.id,
          modelo: activoVision.modelo || provTexto?.modelo || "gemini-2.5-flash",
          vision_aprobada: true
        };
      }
      const provs = cfg.proveedores_texto || [];
      return provs.find(p => p.vision_aprobada && p.activo) || null;
    }
  } catch (e) {}
  return { id: "gemini_flash", modelo: "gemini-2.5-flash", vision_aprobada: true };
}

/**
 * POST /api/ocr/scan
 * Analiza una imagen de material educativo con visión artificial aprobada.
 * body: { imageBase64: string, mediaType: "image/jpeg" | "image/png" }
 */
router.post("/scan", async (req, res) => {
  try {
    const { imageBase64, mediaType = "image/jpeg" } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "Falta 'imageBase64'." });
    }

    const provVision = obtenerProveedorVisionAprobado();
    const apiKey = process.env.GEMINI_API_KEY;

    // Regla estricta: si no hay proveedor de visión aprobado o no hay clave
    if (!provVision || !provVision.vision_aprobada || !apiKey) {
      return res.status(200).json({
        disponible: false,
        error: "Servicio de análisis visual no disponible.",
        mensaje: "En este momento el servicio de análisis visual no está disponible con proveedores aprobados. Por favor introduce el tema por texto o voz."
      });
    }

    const geminiClient = new GoogleGenAI({ apiKey });
    const model = provVision.modelo || "gemini-2.5-flash";

    const promptVision = `Eres un docente experto del currículo del MINERD de la República Dominicana.
Examina minuciosamente esta imagen (página de libro, cuaderno, pizarra o guía didáctica).
Identifica el contenido pedagógico y responde estrictamente en formato JSON con la siguiente estructura:
{
  "seguro": true | false,
  "tema": "Tema pedagógico específico identificado",
  "grado": "1er grado | 2do grado | 3er grado | 4to grado | 5to grado | 6to grado",
  "area": "Lengua Española | Matemática | Ciencias Sociales | Ciencias de la Naturaleza",
  "transcripcion": "Puntos clave y actividades identificadas en la imagen",
  "confianza": "alta | media | baja"
}
Si la imagen está borrosa, ilegible o no es educativa, coloca "seguro": false y describe brevemente lo visible en "transcripcion".`;

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const response = await geminiClient.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: cleanBase64, mimeType: mediaType } },
            { text: promptVision }
          ]
        }
      ],
      config: {
        temperature: 0.0,
        responseMimeType: "application/json"
      }
    });

    const raw = response.text || "{}";
    let parsed = {};
    try {
      parsed = JSON.parse(raw.replace(/```json/gi, "").replace(/```/g, "").trim());
    } catch (e) {
      parsed = { seguro: false, transcripcion: raw };
    }

    // Aplicar filtro de privacidad al texto extraído y al tema
    const perfilDocente = req.body.perfilDocente || {};
    if (parsed.transcripcion) {
      parsed.transcripcion = filtrarPrivacidad(parsed.transcripcion, perfilDocente);
    }
    if (parsed.tema) {
      parsed.tema = filtrarPrivacidad(parsed.tema, perfilDocente);
    }

    // Clasificar intención del tema identificado
    let clasificacion = null;
    if (parsed.tema) {
      clasificacion = await clasificarIntencion({
        texto: parsed.transcripcion || "",
        temaVision: parsed.tema,
        apiKey
      });
    }

    res.json({
      disponible: true,
      seguro: parsed.seguro !== false,
      tema: parsed.tema || null,
      grado: parsed.grado || null,
      area: parsed.area || null,
      texto: parsed.transcripcion || raw,
      confianza: parsed.confianza || "media",
      clasificacion: clasificacion || { tipo: "curricular", confianza: 0.8 },
      mensaje: parsed.seguro === false
        ? "No estoy completamente seguro del tema en esta imagen. Por favor confirma o ajusta el tema por texto o voz."
        : `Identifiqué el tema: "${parsed.tema || 'Material educativo'}" para ${parsed.grado || 'Primaria'}.`
    });

  } catch (err) {
    console.error("Error en OCR con Gemini Vision:", err);
    // Si la cuota se agotó (429) o falló el servicio visual, responder con mensaje amable
    res.status(200).json({
      disponible: false,
      error: err.message,
      mensaje: "En este momento el servicio de análisis visual no está disponible con proveedores aprobados. Por favor introduce el tema por texto o voz."
    });
  }
});

module.exports = router;
