/**
 * client/src/components/OrbeVozVisualizer.jsx
 *
 * ESFERA FLUIDA 3D REACTIVA AL AUDIO (AUDIO VISUALIZER)
 *
 * Características:
 * - Canvas 2D de alto rendimiento simulando shader orgánico 3D con deformación armónica continua.
 * - Paleta esmeralda (#10b981), cian (#06b6d4) y núcleo blanco translúcido con glow y bloom.
 * - Ondas senoidales laterales animadas moduladas en amplitud por AnalyserNode / Web Audio API.
 * - Doble estado:
 *     * Reposo: movimiento lento, respiración de luz tenue (pulsing sutil).
 *     * Activo: expansión de volumen, mayor turbulencia en la superficie y brillo dinámico.
 * - Dock inferior flotante en cristal con:
 *     * Botón izquierdo: "✕ Cancelar" (píldora translúcida).
 *     * Botón central: "Enviar a consulta ➤" (verde esmeralda brillante con sombra difusa).
 *     * Botón derecho: Icono de ajustes/ecualizador en cristal.
 *     * Píldora inferior de advertencia sobre seguridad y privacidad.
 */

import React, { useEffect, useRef, useState } from "react";

export default function OrbeVozVisualizer({
  isOpen,
  transcript = "",
  duracionTexto = "0:00",
  onEnviar,
  onCancelar
}) {
  const canvasRef = useRef(null);
  const animFrameIdRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const mediaStreamRef = useRef(null);

  const [sensibilidad, setSensibilidad] = useState(1.2);
  const [panelAjustesAbierto, setPanelAjustesAbierto] = useState(false);
  const [volumenActual, setVolumenActual] = useState(0);

  // Inicializar captura y analizador Web Audio API
  useEffect(() => {
    if (!isOpen) {
      limpiarAudio();
      return;
    }

    let isMounted = true;

    async function initAudio() {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;

        const ctx = new AudioContextClass();
        audioCtxRef.current = ctx;

        if (ctx.state === "suspended") {
          await ctx.resume().catch(() => {});
        }

        const stream = await navigator.mediaDevices?.getUserMedia({ audio: true });
        if (!isMounted) {
          stream?.getTracks().forEach((t) => t.stop());
          return;
        }

        mediaStreamRef.current = stream;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        analyserRef.current = analyser;
      } catch (err) {
        console.warn("[OrbeVoz] Web Audio directo omitido:", err);
      }
    }

    initAudio();

    return () => {
      isMounted = false;
      limpiarAudio();
    };
  }, [isOpen]);

  const limpiarAudio = () => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  };

  // Loop de Renderizado en Canvas (Shader Orgánico y Ondas Senoidales)
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let tiempo = 0;
    let volumenSuave = 0;
    const dataArray = new Uint8Array(64);

    const render = () => {
      tiempo += 0.025;

      // Leer volumen real del AnalyserNode si está activo
      let vol = 0;
      if (analyserRef.current) {
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        vol = (sum / (dataArray.length * 255)) * sensibilidad;
      } else if (transcript) {
        vol = 0.2 + Math.sin(tiempo * 4) * 0.15;
      }

      // Suavizado exponencial del volumen (lerp)
      volumenSuave += (vol - volumenSuave) * 0.18;
      setVolumenActual(volumenSuave);

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height * 0.44;

      const estaHablando = volumenSuave > 0.08;
      const radioBase = Math.min(width, height) * 0.22 + (volumenSuave * 35);
      const turbulencia = estaHablando ? (10 + volumenSuave * 26) : 5;
      const velocidadOnda = estaHablando ? 4.5 : 1.8;

      // 1. DIBUJAR ONDAS SENOIDALES LATERALES
      const ampOnda = (estaHablando ? 24 : 8) * (1 + volumenSuave * 1.5);
      const numPuntosOnda = 50;

      // Onda izquierda
      ctx.beginPath();
      for (let i = 0; i <= numPuntosOnda; i++) {
        const x = (centerX - radioBase * 1.05) * (i / numPuntosOnda);
        const yOffset = Math.sin(x * 0.04 - tiempo * velocidadOnda) * ampOnda * Math.sin((i / numPuntosOnda) * Math.PI);
        const y = centerY + yOffset;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = estaHablando ? "rgba(6, 182, 212, 0.75)" : "rgba(16, 185, 129, 0.35)";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Onda derecha
      ctx.beginPath();
      for (let i = 0; i <= numPuntosOnda; i++) {
        const frac = i / numPuntosOnda;
        const x = (centerX + radioBase * 1.05) + (width - (centerX + radioBase * 1.05)) * frac;
        const yOffset = Math.cos(x * 0.04 + tiempo * velocidadOnda) * ampOnda * Math.sin(frac * Math.PI);
        const y = centerY + yOffset;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = estaHablando ? "rgba(16, 185, 129, 0.75)" : "rgba(6, 182, 212, 0.35)";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // 2. RESPLANDOR EXTERNO / BLOOM
      const radioBloom = radioBase * (estaHablando ? 1.55 : 1.25);
      const gradBloom = ctx.createRadialGradient(centerX, centerY, radioBase * 0.5, centerX, centerY, radioBloom);
      gradBloom.addColorStop(0, estaHablando ? "rgba(16, 185, 129, 0.45)" : "rgba(16, 185, 129, 0.18)");
      gradBloom.addColorStop(0.5, estaHablando ? "rgba(6, 182, 212, 0.3)" : "rgba(6, 182, 212, 0.08)");
      gradBloom.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.beginPath();
      ctx.arc(centerX, centerY, radioBloom, 0, Math.PI * 2);
      ctx.fillStyle = gradBloom;
      ctx.fill();

      // 3. CAPA DE LA ESFERA ORGÁNICA (Malla polar deformada con armónicos senoidales)
      const puntosEsfera = 90;
      ctx.beginPath();
      for (let i = 0; i <= puntosEsfera; i++) {
        const angulo = (i / puntosEsfera) * Math.PI * 2;
        const deformacion1 = Math.sin(angulo * 3 + tiempo * velocidadOnda) * turbulencia;
        const deformacion2 = Math.cos(angulo * 5 - tiempo * (velocidadOnda * 1.2)) * (turbulencia * 0.6);
        const deformacion3 = Math.sin(angulo * 7 + tiempo * 2.2) * (turbulencia * 0.3);
        const r = radioBase + deformacion1 + deformacion2 + deformacion3;

        const px = centerX + Math.cos(angulo) * r;
        const py = centerY + Math.sin(angulo) * r;

        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();

      // Relleno de la esfera con degradado fluido esmeralda - cian - blanco
      const gradEsfera = ctx.createLinearGradient(
        centerX - radioBase,
        centerY - radioBase,
        centerX + radioBase,
        centerY + radioBase
      );
      gradEsfera.addColorStop(0, "#10b981");
      gradEsfera.addColorStop(0.45, "#06b6d4");
      gradEsfera.addColorStop(0.85, "#34d399");
      gradEsfera.addColorStop(1, "#0284c7");

      ctx.fillStyle = gradEsfera;
      ctx.shadowColor = estaHablando ? "#10b981" : "#06b6d4";
      ctx.shadowBlur = estaHablando ? 30 : 16;
      ctx.fill();
      ctx.shadowBlur = 0;

      // 4. NÚCLEO INTERNO TRASLÚCIDO Y BRILLO
      const gradNucleo = ctx.createRadialGradient(
        centerX - radioBase * 0.25,
        centerY - radioBase * 0.25,
        2,
        centerX,
        centerY,
        radioBase * 0.85
      );
      gradNucleo.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      gradNucleo.addColorStop(0.3, "rgba(255, 255, 255, 0.55)");
      gradNucleo.addColorStop(0.7, "rgba(6, 182, 212, 0.25)");
      gradNucleo.addColorStop(1, "rgba(16, 185, 129, 0)");

      ctx.beginPath();
      ctx.arc(centerX, centerY, radioBase * 0.85, 0, Math.PI * 2);
      ctx.fillStyle = gradNucleo;
      ctx.fill();

      ctx.restore();

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    };
  }, [isOpen, sensibilidad, transcript]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Asistente de Voz Inteligente"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        backgroundColor: "rgba(5, 11, 20, 0.94)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "center",
        color: "#ffffff",
        fontFamily: "system-ui, -apple-system, sans-serif",
        overflow: "hidden",
        userSelect: "none"
      }}
    >
      {/* ── CABECERA FLOTANTE ── */}
      <div
        style={{
          width: "100%",
          padding: "20px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 10
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            backgroundColor: "rgba(255, 255, 255, 0.08)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "9999px",
            padding: "6px 14px",
            backdropFilter: "blur(12px)"
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: volumenActual > 0.08 ? "#10b981" : "#06b6d4",
              boxShadow: volumenActual > 0.08 ? "0 0 10px #10b981" : "0 0 8px #06b6d4",
              animation: "pulse 1.8s infinite"
            }}
          />
          <span style={{ fontSize: "0.82rem", fontWeight: "600", letterSpacing: "0.03em" }}>
            {volumenActual > 0.08 ? "Escuchando voz..." : "Asistente de Voz Activo"}
          </span>
        </div>

        <div
          style={{
            fontSize: "0.8rem",
            color: "rgba(255, 255, 255, 0.7)",
            backgroundColor: "rgba(0, 0, 0, 0.35)",
            padding: "4px 10px",
            borderRadius: "12px",
            fontVariantNumeric: "tabular-nums"
          }}
        >
          ⏱️ {duracionTexto || "0:00"}
        </div>
      </div>

      {/* ── CANVAS CENTRAL CON ESFERA FLUIDA 3D ── */}
      <div
        style={{
          position: "relative",
          width: "100%",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height: "100%",
            display: "block"
          }}
        />

        {/* TRANSCRIPCIÓN EN VIVO CENTRADA */}
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            left: "20px",
            right: "20px",
            textAlign: "center",
            maxHeight: "120px",
            overflowY: "auto",
            padding: "10px 16px",
            borderRadius: "16px",
            backgroundColor: "rgba(0, 0, 0, 0.3)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255, 255, 255, 0.08)"
          }}
        >
          {transcript ? (
            <p
              style={{
                fontSize: "1.05rem",
                lineHeight: "1.45",
                fontWeight: "500",
                color: "#f8fafc",
                margin: 0,
                textShadow: "0 2px 8px rgba(0,0,0,0.5)"
              }}
            >
              {transcript}
            </p>
          ) : (
            <p
              style={{
                fontSize: "0.95rem",
                color: "rgba(255, 255, 255, 0.6)",
                fontStyle: "italic",
                margin: 0
              }}
            >
              Habla con confianza, te escucho...
            </p>
          )}
        </div>
      </div>

      {/* ── PANEL DE AJUSTES RÁPIDOS ── */}
      {panelAjustesAbierto && (
        <div
          style={{
            width: "90%",
            maxWidth: "380px",
            backgroundColor: "rgba(15, 23, 42, 0.95)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: "20px",
            padding: "14px 18px",
            marginBottom: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            zIndex: 20
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: "700" }}>🎛️ Sensibilidad de Micrófono</span>
            <button
              onClick={() => setPanelAjustesAbierto(false)}
              style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Baja</span>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              value={sensibilidad}
              onChange={(e) => setSensibilidad(parseFloat(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Alta ({sensibilidad.toFixed(1)}x)</span>
          </div>
        </div>
      )}

      {/* ── DOCK INFERIOR EN CRISTAL (GLASSMORPHISM) ── */}
      <div
        style={{
          width: "100%",
          padding: "0 20px 20px 20px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
          zIndex: 10
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "440px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "rgba(255, 255, 255, 0.08)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.14)",
            borderRadius: "32px",
            padding: "10px 16px",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.45)"
          }}
        >
          {/* Botón Izquierdo: ✕ Cancelar */}
          <button
            type="button"
            onClick={onCancelar}
            style={{
              padding: "10px 18px",
              borderRadius: "9999px",
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#f1f5f9",
              fontSize: "0.85rem",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.15s ease"
            }}
          >
            ✕ Cancelar
          </button>

          {/* Botón Central: Enviar a consulta ➤ */}
          <button
            type="button"
            onClick={onEnviar}
            disabled={!transcript?.trim()}
            style={{
              padding: "12px 24px",
              borderRadius: "9999px",
              backgroundColor: transcript?.trim() ? "#10b981" : "rgba(16, 185, 129, 0.3)",
              border: "none",
              color: "#ffffff",
              fontSize: "0.92rem",
              fontWeight: "700",
              cursor: transcript?.trim() ? "pointer" : "not-allowed",
              boxShadow: transcript?.trim() ? "0 0 24px rgba(16, 185, 129, 0.6)" : "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s ease"
            }}
          >
            <span>Enviar a consulta</span>
            <span style={{ fontSize: "1rem" }}>➤</span>
          </button>

          {/* Botón Derecho: Ajustes / Ecualizador */}
          <button
            type="button"
            onClick={() => setPanelAjustesAbierto(!panelAjustesAbierto)}
            title="Ajustes de visualizador"
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "50%",
              backgroundColor: panelAjustesAbierto ? "rgba(16, 185, 129, 0.3)" : "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: "1.1rem",
              transition: "all 0.15s ease"
            }}
          >
            🎛️
          </button>
        </div>

        {/* Píldora inferior de advertencia sobre privacidad */}
        <div
          style={{
            fontSize: "0.68rem",
            color: "rgba(255, 255, 255, 0.6)",
            backgroundColor: "rgba(0, 0, 0, 0.35)",
            padding: "4px 14px",
            borderRadius: "14px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            letterSpacing: "0.02em"
          }}
        >
          🔒 Tu voz se procesa de forma segura. No se graban rostros ni datos personales.
        </div>
      </div>
    </div>
  );
}
