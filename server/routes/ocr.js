const express = require("express");
const { GoogleGenAI } = require("@google/genai");

const router = express.Router();
const geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * POST /api/ocr/scan
 * body: { imageBase64: string, mediaType: "image/jpeg" | "image/png" }
 */
router.post("/scan", async (req, res) => {
  try {
    const { imageBase64, mediaType = "image/jpeg" } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "Falta 'imageBase64'." });
    }

    const response = await geminiClient.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: imageBase64, mimeType: mediaType } },
            { text: "Esta es una foto de una página de un libro de texto, pizarra o guía docente del MINERD. Transcribe fielmente y de manera estructurada el contenido relevante (título, temas, destrezas, ejercicios, actividades) para que un docente arme su planificación curricular." }
          ]
        }
      ]
    });

    const texto = response.text || "";
    res.json({ texto });
  } catch (err) {
    console.error("Error en OCR con Gemini:", err);
    res.status(500).json({ error: "Error leyendo la imagen con visión artificial.", detail: err.message });
  }
});

module.exports = router;
