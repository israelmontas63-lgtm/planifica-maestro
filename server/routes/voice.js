const express = require('express');
const router = express.Router();

/**
 * POST /api/voice/generate
 * Recibe un texto y lo convierte a voz usando ElevenLabs.
 */
router.post('/generate', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Se requiere texto para generar voz.' });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'ElevenLabs API key no configurada.' });
    }

    // Usaremos la voz de Rachel o cualquier voz en español (ej. un ID predeterminado de ElevenLabs)
    // ID de voz de ejemplo (Rachel): 21m00Tcm4TlvDq8ikWAM 
    // ID de voz de ejemplo (Matilda - buena para español): XrExE9yKIg1WjnnlVkGX
    const VOICE_ID = 'XrExE9yKIg1WjnnlVkGX'; 
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;

    // Opcional: Acortar el texto si es muy largo, o enviarlo entero
    // Las planificaciones son largas, así que ElevenLabs gastará muchos caracteres.
    // Lo enviamos completo, ElevenLabs lo procesará.
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail?.message || 'Error en ElevenLabs API');
    }

    // Convertimos la respuesta a un buffer y lo enviamos como audio/mpeg
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': buffer.length
    });
    res.send(buffer);

  } catch (err) {
    console.error('Error generando voz:', err);
    res.status(500).json({ error: 'Error generando la voz.', detail: err.message });
  }
});

module.exports = router;
