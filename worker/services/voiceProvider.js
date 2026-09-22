/**
 * worker/services/voiceProvider.js
 * Proveedor de voz de IA fluida para Planifica Maestro.
 * Soporta cascada: ElevenLabs -> Google Cloud TTS -> Fallback Local
 */

export async function generateVoice(text, env, options = {}) {
  const { gender = "female" } = options;
  
  // 1. ElevenLabs (Voz fluida principal)
  if (env && env.ELEVENLABS_API_KEY) {
    try {
      const voiceId = gender === "male" ? "IKne3meq5aSn9XLyUdCD" : "EXAVITQu4vr4xnSDxMaL"; // Charlie / Sarah (voces gratuitas)
      const elRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "xi-api-key": env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_multilingual_v2",
        })
      });
      if (elRes.ok) {
        return { source: "elevenlabs", audio: await elRes.arrayBuffer() };
      }
      return { fallbackLocal: true, debug: "ElRes not ok", status: elRes.status };
    } catch (e) {
      return { fallbackLocal: true, debug: "El error", error: e.message };
    }
  }

  return { 
    fallbackLocal: true, 
    keys: Object.keys(env), 
    hasKey: !!env.ELEVENLABS_API_KEY, 
    keyType: typeof env.ELEVENLABS_API_KEY,
    keyVal: env.ELEVENLABS_API_KEY
  };
}
