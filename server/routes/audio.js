const express = require("express");
const router = express.Router();

/**
 * POST /api/audio/transcribe
 * Transcribe un archivo de audio grabado por el cliente (MediaRecorder)
 * Usa Groq Whisper (whisper-large-v3-turbo) con alta velocidad (<500ms).
 */
router.post("/transcribe", async (req, res) => {
  try {
    const { audioBase64, mimeType = "audio/webm", idioma = "es" } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: "Falta audioBase64" });
    }

    const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, "");
    const audioBuffer = Buffer.from(cleanBase64, "base64");

    // 1. Intentar Groq Whisper si GROQ_API_KEY existe
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      try {
        const formData = new FormData();
        const extension = mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "m4a" : "wav";
        const file = new Blob([audioBuffer], { type: mimeType });
        formData.append("file", file, "audio." + extension);
        formData.append("model", "whisper-large-v3-turbo");
        formData.append("language", idioma || "es");
        formData.append("response_format", "json");

        const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + groqKey
          },
          body: formData
        });

        if (groqRes.ok) {
          const data = await groqRes.json();
          if (data && data.text) {
            return res.json({
              ok: true,
              texto: data.text.trim(),
              proveedor: "groq_whisper",
              modelo: "whisper-large-v3-turbo"
            });
          }
        } else {
          console.warn("Fallo Groq Whisper:", groqRes.status, await groqRes.text());
        }
      } catch (errGroq) {
        console.warn("Error en Groq Whisper:", errGroq.message);
      }
    }

    // 2. Respaldo Gemini multimodal si hay GEMINI_API_KEY
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const { GoogleGenAI } = require("@google/genai");
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        const resp = await ai.models.generateContent({
          model: "gemini-3.5-flash-lite",
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType || "audio/webm",
                    data: cleanBase64
                  }
                },
                {
                  text: "Transcribe exactamente las palabras habladas en este audio en español. Devuelve SOLO el texto transcrito sin explicaciones ni comillas adicionales."
                }
              ]
            }
          ]
        });
        const texto = resp.text ? resp.text.trim() : "";
        if (texto) {
          return res.json({
            ok: true,
            texto,
            proveedor: "gemini_transcribe",
            modelo: "gemini-3.5-flash-lite"
          });
        }
      } catch (errGemini) {
        console.warn("Error en Gemini Audio:", errGemini.message);
      }
    }

    return res.status(500).json({ error: "No se pudo transcribir el audio con ningún motor disponible." });
  } catch (err) {
    console.error("Error en /api/audio/transcribe:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
