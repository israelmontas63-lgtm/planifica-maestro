/**
 * worker/services/voiceProvider.js
 * Proveedor de voz de IA fluida para Planifica Maestro.
 * Protege la cuota mensual de ElevenLabs enviando únicamente respuestas cortas (<= 250 caracteres).
 * Para textos largos o lecturas de planificaciones completas, delega directamente al fallback local del navegador.
 */

export class VoiceProvider {
  async synthesize(text) {
    throw new Error("El método synthesize debe ser implementado por una subclase concreta.");
  }
}

export class BrowserNativeVoiceProvider extends VoiceProvider {
  async synthesize(text) {
    throw new Error("BrowserNativeVoiceProvider requiere ejecución en el cliente con window.speechSynthesis.");
  }
}

export async function generateVoice(text, env, options = {}) {
  const { gender = "female" } = options;
  const textoLimpio = (text || "").trim();

  // Protección de cuota ElevenLabs: solo textos cortos y directos
  if (textoLimpio.length > 250) {
    return {
      fallbackLocal: true,
      motivo: "Texto largo reservado para voz local del navegador (ahorro de cuota de ElevenLabs)."
    };
  }

  // 1. ElevenLabs (Solo si la clave está configurada en secretos)
  if (env && env.ELEVENLABS_API_KEY) {
    try {
      const voiceId = gender === "male" ? "IKne3meq5aSn9XLyUdCD" : "EXAVITQu4vr4xnSDxMaL"; // Charlie / Sarah
      const elRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "xi-api-key": env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: textoLimpio,
          model_id: "eleven_multilingual_v2",
        })
      });
      if (elRes.ok) {
        return { source: "elevenlabs", audio: await elRes.arrayBuffer() };
      }
      return { fallbackLocal: true, status: elRes.status };
    } catch (e) {
      return { fallbackLocal: true, error: e.message };
    }
  }

  // Fallback seguro sin exponer credenciales
  return { 
    fallbackLocal: true,
    hasKey: !!(env && env.ELEVENLABS_API_KEY)
  };
}
