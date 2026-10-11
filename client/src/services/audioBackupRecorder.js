/**
 * Grabador de audio de respaldo para Planifica Maestro.
 * Utiliza MediaRecorder nativo (hasta 30 segundos) y convierte a WAV PCM 16-bit 16kHz mono.
 * Formato 100% compatible con Google Gemini sin almacenar datos en el dispositivo.
 */

let mediaRecorderInstance = null;
let mediaStreamInstance = null;
let audioChunks = [];
let timeoutTimer = null;

/**
 * Codifica muestras Float32Array PCM en un ArrayBuffer con encabezado estándar RIFF WAV (16-bit mono).
 */
function pcmToWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // RIFF Chunk Descriptor
  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");

  // "fmt " Subchunk
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // Tamaño de Subchunk1 (16 para PCM)
  view.setUint16(20, 1, true); // AudioFormat = 1 (PCM lineal)
  view.setUint16(22, 1, true); // NumChannels = 1 (Mono)
  view.setUint32(24, sampleRate, true); // SampleRate (ej. 16000)
  view.setUint32(28, sampleRate * 2, true); // ByteRate = SampleRate * 1 canal * 2 bytes
  view.setUint16(32, 2, true); // BlockAlign = 1 canal * 2 bytes
  view.setUint16(34, 16, true); // BitsPerSample = 16

  // "data" Subchunk
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  // Muestras PCM de 16-bit con recorte
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return buffer;
}

/**
 * Convierte un Blob de audio grabado en WAV 16kHz mono usando AudioContext nativo.
 */
async function decodificarYConvertirAWav(blob) {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return { blob, mimeType: blob.type || "audio/webm" };
    }

    const audioCtx = new AudioContextClass({ sampleRate: 16000 });
    const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const monoChannel = decodedBuffer.getChannelData(0);
    const wavBuffer = pcmToWav(monoChannel, decodedBuffer.sampleRate);
    await audioCtx.close();

    return {
      blob: new Blob([wavBuffer], { type: "audio/wav" }),
      mimeType: "audio/wav",
    };
  } catch (err) {
    console.warn("⚠️ No se pudo transcodificar a WAV, usando formato original:", err);
    return { blob, mimeType: blob.type || "audio/webm" };
  }
}

/**
 * Convierte un Blob en cadena Base64 pura (sin prefijo data:).
 */
function blobABase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === "string") {
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        resolve(base64);
      } else {
        reject(new Error("Error leyendo audio como base64."));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Inicia la grabación del micrófono (hasta maxSegundos, por defecto 30).
 */
export async function iniciarGrabacionRespaldo({ maxSegundos = 30, onAutoStop = null } = {}) {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("Tu navegador no soporta grabación de micrófono.");
  }

  audioChunks = [];
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaStreamInstance = stream;

  let mimeType = "audio/webm";
  if (typeof MediaRecorder !== "undefined") {
    if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
      mimeType = "audio/webm;codecs=opus";
    } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
      mimeType = "audio/mp4";
    } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
      mimeType = "audio/ogg";
    } else if (MediaRecorder.isTypeSupported("audio/wav")) {
      mimeType = "audio/wav";
    }
  }

  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  mediaRecorderInstance = recorder;

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      audioChunks.push(event.data);
    }
  };

  recorder.start(500); // Fragmentos cada 500ms

  if (timeoutTimer) clearTimeout(timeoutTimer);
  timeoutTimer = setTimeout(async () => {
    if (mediaRecorderInstance && mediaRecorderInstance.state === "recording") {
      try {
        const resultado = await detenerGrabacionRespaldo();
        onAutoStop?.(resultado);
      } catch (e) {
        console.warn("Fallo al autodetener grabación por límite de tiempo:", e);
      }
    }
  }, maxSegundos * 1000);

  return true;
}

/**
 * Detiene la grabación, libera el micrófono y devuelve { audioBase64, mimeType, tamanoBytes }.
 */
export async function detenerGrabacionRespaldo() {
  if (timeoutTimer) {
    clearTimeout(timeoutTimer);
    timeoutTimer = null;
  }

  return new Promise((resolve, reject) => {
    if (!mediaRecorderInstance) {
      reject(new Error("No hay grabación activa."));
      return;
    }

    mediaRecorderInstance.onstop = async () => {
      try {
        // Detener y liberar pistas de micrófono
        if (mediaStreamInstance) {
          mediaStreamInstance.getTracks().forEach((track) => track.stop());
          mediaStreamInstance = null;
        }

        const rawBlob = new Blob(audioChunks, {
          type: mediaRecorderInstance.mimeType || "audio/webm",
        });
        audioChunks = [];
        mediaRecorderInstance = null;

        // Convertir a WAV 16kHz mono (optimizado para Gemini)
        const { blob: finalBlob, mimeType: finalMime } = await decodificarYConvertirAWav(rawBlob);
        const base64 = await blobABase64(finalBlob);

        resolve({
          audioBase64: base64,
          mimeType: finalMime,
          tamanoBytes: finalBlob.size,
        });
      } catch (err) {
        reject(err);
      }
    };

    if (mediaRecorderInstance.state !== "inactive") {
      mediaRecorderInstance.stop();
    } else {
      mediaRecorderInstance.onstop();
    }
  });
}
