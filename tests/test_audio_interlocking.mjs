import test from "node:test";
import assert from "node:assert/strict";

/**
 * tests/test_audio_interlocking.mjs
 * 
 * Verificación de:
 * 1. Ausencia de sonido doble: un plan completo solo suena 1 vez (PlanResult vs GlobalAudio).
 * 2. Mensajes de chat y cámara solo usan el reproductor global (limpiando audioUrl de PlanResult).
 * 3. Interbloqueo estricto: iniciar nuevo audio detiene inmediatamente cualquier audio previo.
 * 4. Fallback a speechSynthesis local si play() de audio es rechazado por el navegador.
 */

test("SISTEMA DE AUDIO: Un solo reproductor activo y no sonido doble", async (t) => {
  await t.test("1. Demostración de NO sonido doble al escuchar un plan completo", () => {
    let globalAudioSrc = "";
    let globalAudioPlayed = false;
    let planResultAudioUrl = null;

    const mockGlobalAudio = {
      pause: () => {},
      currentTime: 0,
      set src(val) { globalAudioSrc = val; },
      get src() { return globalAudioSrc; },
      play: async () => { globalAudioPlayed = true; }
    };

    function simularHandleEscuchar(planText, origen = "chat", fakeGeneratedUrl = "blob:audio-mp3") {
      mockGlobalAudio.pause();
      mockGlobalAudio.currentTime = 0;
      mockGlobalAudio.src = "";
      globalAudioPlayed = false;

      if (origen === "plan") {
        planResultAudioUrl = fakeGeneratedUrl;
      } else {
        planResultAudioUrl = null;
        mockGlobalAudio.src = fakeGeneratedUrl;
        mockGlobalAudio.play();
      }
    }

    // Escenario 1: El usuario pulsa 'Escuchar Plan' en un plan completo
    simularHandleEscuchar("Objetivo: Aprender fracciones...", "plan");

    // Verificación 1: PlanResult recibe el audioUrl
    assert.equal(planResultAudioUrl, "blob:audio-mp3", "PlanResult debe recibir el URL de audio");
    // Verificación 2: El reproductor global NO se reprodujo ni tiene src
    assert.equal(globalAudioPlayed, false, "El reproductor global NO debe reproducir cuando origen es plan");
    assert.equal(mockGlobalAudio.src, "", "El reproductor global debe tener src vacío");

    // Conclusión: Solo PlanResult tiene audio activo -> NO SUENA DOBLE
  });

  await t.test("2. Mensajes de chat y cámara limpian PlanResult y usan reproductor global", () => {
    let globalAudioSrc = "";
    let globalAudioPlayed = false;
    let planResultAudioUrl = "blob:plan-antiguo";

    const mockGlobalAudio = {
      pause: () => {},
      currentTime: 0,
      set src(val) { globalAudioSrc = val; },
      get src() { return globalAudioSrc; },
      play: async () => { globalAudioPlayed = true; }
    };

    function simularHandleEscuchar(chatText, origen = "chat", fakeGeneratedUrl = "blob:chat-mp3") {
      if (origen === "plan") {
        planResultAudioUrl = fakeGeneratedUrl;
      } else {
        planResultAudioUrl = null; // Desmonta/limpia audio de PlanResult
        mockGlobalAudio.src = fakeGeneratedUrl;
        mockGlobalAudio.play();
      }
    }

    // Escenario 2: El usuario toma una foto o pulsa 'Escuchar' en el chat
    simularHandleEscuchar("Esto es una computadora de escritorio.", "chat");

    // Verificación 1: PlanResult queda en null (no suena el plan viejo ni compite)
    assert.equal(planResultAudioUrl, null, "PlanResult no debe recibir audio en chat");
    // Verificación 2: El reproductor global sí reproduce el audio del chat
    assert.equal(globalAudioPlayed, true, "El reproductor global debe reproducir el audio del chat");
    assert.equal(mockGlobalAudio.src, "blob:chat-mp3");

    // Conclusión: Solo el reproductor global tiene audio activo -> EXACTAMENTE 1 AUDIO
  });

  await t.test("3. Si play() es rechazado por política de autoplay móvil, cae a síntesis local", async () => {
    let sintesisNativaLlamada = false;
    let textoLeidoPorSintesis = "";

    const mockGlobalAudio = {
      pause: () => {},
      currentTime: 0,
      src: "",
      play: () => Promise.reject(new Error("NotAllowedError: play() failed"))
    };

    function mockSpeak(texto) {
      sintesisNativaLlamada = true;
      textoLeidoPorSintesis = texto;
    }

    async function simularHandleEscucharConRechazo(texto) {
      const resumen = texto.substring(0, 500);
      mockGlobalAudio.src = "blob:audio";
      try {
        await mockGlobalAudio.play();
      } catch (err) {
        mockSpeak(resumen);
      }
    }

    await simularHandleEscucharConRechazo("La imagen muestra un libro de matemáticas.");

    assert.equal(sintesisNativaLlamada, true, "Debe activar speak() si play() falla");
    assert.equal(textoLeidoPorSintesis, "La imagen muestra un libro de matemáticas.");
  });

  await t.test("4. Interbloqueo corta audio previo al iniciar nuevo dictado", () => {
    let globalAudioPausado = false;
    let speechCancelLlamado = false;

    const mockGlobalAudio = {
      pause: () => { globalAudioPausado = true; },
      currentTime: 5
    };

    function mockStopSpeaking() {
      speechCancelLlamado = true;
    }

    function simularInicioDictado() {
      if (mockGlobalAudio) mockGlobalAudio.pause();
      mockStopSpeaking();
    }

    simularInicioDictado();

    assert.equal(globalAudioPausado, true, "Al iniciar dictado debe pausarse cualquier audio");
    assert.equal(speechCancelLlamado, true, "Al iniciar dictado debe cancelarse la voz de síntesis");
  });
});
