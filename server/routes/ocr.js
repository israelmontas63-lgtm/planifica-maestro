const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");

const router = express.Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: imageBase64 },
            },
            {
              type: "text",
              text: "Esta es una foto de una pagina de un libro o guia docente. Transcribe fielmente el contenido relevante (temas, destrezas, actividades) que un profesor usaria para armar su planificacion de clase.",
            },
          ],
        },
      ],
    });

    const texto = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    res.json({ texto });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error leyendo la imagen.", detail: err.message });
  }
});

module.exports = router;
