/**
 * client/src/components/OrbeVozVisualizer.jsx
 *
 * ASISTENTE DE VOZ INTELIGENTE - ORBE 3D VOLUMÉTRICO REACTIVO
 *
 * Características:
 * 1. Orbe 3D Volumétrico (WebGL Shader con fallback Canvas 2D):
 *    - Ray-sphere projection con cálculo de normales 3D en tiempo real.
 *    - Deformación armónica continua con 3D Simplex Noise y Fractal Brownian Motion (FBM).
 *    - Núcleo blanco brillante / cian incandescente en el centro.
 *    - Bordes translúcidos con efecto Fresnel en esmeralda (#10b981).
 *    - Corona exterior de plasma/gas luminiscente con resplandor exponencial suave.
 * 2. Estelas y Ondas Laterales Fluidas:
 *    - Filamentos múltiples superpuestos que se difuminan suavemente hacia los extremos laterales.
 *    - Modulación reactiva al micrófono con AnalyserNode (Web Audio API).
 *    - Polvo de estrellas / partículas tenues flotantes con movimiento browniano orgánico.
 * 3. Controles Limpios y Modernos:
 *    - Texto blanco flotante y nítido directamente sobre el fondo oscuro (sin pastilla negra encajonada).
 *    - Dock inferior en cristal con botón "Enviar a consulta ➤" en degradado esmeralda luminoso con resplandor.
 *    - Icono de ajustes tipo SlidersHorizontal (SVG nítido).
 */

import React, { useEffect, useRef, useState } from "react";

// Shader Vertex de alto rendimiento
const VERTEX_SHADER_SRC = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// Shader Fragment: Orbe 3D Volumétrico con Fresnel y Turbulencia Plasma FBM
const FRAGMENT_SHADER_SRC = `
#ifdef GL_ES
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_volume;
varying vec2 v_uv;

vec4 permute(vec4 x){ return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v){
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; ++i) {
    v += a * snoise(p);
    p = p * 2.04 + vec3(0.12, 0.34, 0.56);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
  uv.y -= 0.055;

  float d = length(uv);
  float radius = 0.25 + u_volume * 0.065;

  // Paleta de color organico
  vec3 cCore = vec3(1.0, 1.0, 1.0);
  vec3 cCyan = vec3(0.024, 0.714, 0.831);    // #06b6d4
  vec3 cEmerald = vec3(0.063, 0.725, 0.506); // #10b981
  vec3 cMint = vec3(0.314, 0.886, 0.686);    // #50e2af

  vec3 finalColor = vec3(0.0);
  float alpha = 0.0;

  float speed = 0.55 + u_volume * 1.4;
  vec3 noiseCoord = vec3(uv * 3.4, u_time * speed);
  float n = fbm(noiseCoord);

  float deformedRadius = radius + n * (0.022 + u_volume * 0.035);

  // Proyeccion de esfera volumetrica 3D con Fresnel
  if (d < deformedRadius) {
    float z = sqrt(max(0.0, deformedRadius * deformedRadius - d * d));
    vec3 N = normalize(vec3(uv, z));

    float fresnel = pow(1.0 - max(0.0, N.z), 2.1);

    vec3 spherePos = N * 2.2 + vec3(sin(u_time * 0.4), cos(u_time * 0.5), u_time * speed);
    float interiorNoise = fbm(spherePos);

    float coreFactor = smoothstep(0.65, 0.05, d / deformedRadius);
    coreFactor *= (0.75 + u_volume * 0.5);

    vec3 plasma = mix(cEmerald, cCyan, interiorNoise * 0.5 + 0.5);
    plasma = mix(plasma, cMint, fresnel * 0.75);

    vec3 sphereColor = mix(plasma, cCore, coreFactor * 0.95);
    sphereColor += cEmerald * fresnel * (1.2 + u_volume * 0.8);

    finalColor = sphereColor;
    alpha = mix(0.85, 0.98, fresnel + coreFactor * 0.3);
  }

  // Corona exterior de gas / plasma luminiscente
  float distFromSurface = max(0.0, d - deformedRadius);
  float glow1 = exp(-distFromSurface * (15.0 - u_volume * 3.5));
  float glow2 = exp(-distFromSurface * (5.5 - u_volume * 1.8));

  vec3 glowColor = mix(cCyan, cEmerald, sin(u_time * 1.2 + d * 10.0) * 0.5 + 0.5);
  finalColor += glowColor * glow1 * (0.8 + u_volume * 0.65);
  finalColor += cEmerald * glow2 * (0.42 + u_volume * 0.45);
  alpha = max(alpha, glow1 * 0.75 + glow2 * 0.35);

  // Onda de expansion reactiva al hablar
  if (u_volume > 0.08) {
    float waveDist = abs(d - (deformedRadius + mod(u_time * 0.8, 0.42)));
    float waveGlow = exp(-waveDist * 38.0) * u_volume * 0.55;
    finalColor += cMint * waveGlow;
    alpha = max(alpha, waveGlow);
  }

  gl_FragColor = vec4(finalColor, min(1.0, alpha));
}
`;

export default function OrbeVozVisualizer({
  isOpen,
  transcript = "",
  duracionTexto = "0:00",
  onEnviar,
  onCancelar
}) {
  const canvasOrbRef = useRef(null);
  const canvasWavesRef = useRef(null);
  const animFrameIdRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const mediaStreamRef = useRef(null);

  const [sensibilidad, setSensibilidad] = useState(1.2);
  const [panelAjustesAbierto, setPanelAjustesAbierto] = useState(false);
  const [volumenActual, setVolumenActual] = useState(0);

  // Partículas tenues flotantes para el fondo de ondas
  const particlesRef = useRef([]);

  // Inicializar Web Audio API para análisis de volumen
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
        console.warn("[OrbeVoz] Captura Web Audio directa omitida:", err);
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

  // Render Loop: Orbe 3D WebGL (con fallback 2D) + Filamentos y Partículas
  useEffect(() => {
    if (!isOpen) return;

    const orbCanvas = canvasOrbRef.current;
    const wavesCanvas = canvasWavesRef.current;
    if (!orbCanvas || !wavesCanvas) return;

    // Inicializar WebGL en orbCanvas
    let gl = orbCanvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: false }) ||
             orbCanvas.getContext("experimental-webgl", { alpha: true, antialias: true });

    let program = null;
    let uResolutionLoc = null;
    let uTimeLoc = null;
    let uVolumeLoc = null;

    if (gl) {
      const compileShader = (src, type) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          console.warn("[OrbeVoz] Error compilando shader:", gl.getShaderInfoLog(shader));
          gl.deleteShader(shader);
          return null;
        }
        return shader;
      };

      const vs = compileShader(VERTEX_SHADER_SRC, gl.VERTEX_SHADER);
      const fs = compileShader(FRAGMENT_SHADER_SRC, gl.FRAGMENT_SHADER);

      if (vs && fs) {
        program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);

        if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
          gl.useProgram(program);
          const posBuffer = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
          gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([
              -1.0, -1.0,
               1.0, -1.0,
              -1.0,  1.0,
              -1.0,  1.0,
               1.0, -1.0,
               1.0,  1.0
            ]),
            gl.STATIC_DRAW
          );

          const posLoc = gl.getAttribLocation(program, "a_position");
          gl.enableVertexAttribArray(posLoc);
          gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

          uResolutionLoc = gl.getUniformLocation(program, "u_resolution");
          uTimeLoc = gl.getUniformLocation(program, "u_time");
          uVolumeLoc = gl.getUniformLocation(program, "u_volume");
        } else {
          console.warn("[OrbeVoz] Error linkeando WebGL:", gl.getProgramInfoLog(program));
          program = null;
        }
      }
    }

    const wavesCtx = wavesCanvas.getContext("2d");
    const orb2dCtx = !gl ? orbCanvas.getContext("2d") : null;

    // Inicializar partículas flotantes
    if (particlesRef.current.length === 0) {
      particlesRef.current = Array.from({ length: 36 }, () => ({
        x: Math.random(),
        y: Math.random(),
        radius: 0.8 + Math.random() * 2.0,
        speedX: (Math.random() - 0.5) * 0.0008,
        speedY: (Math.random() - 0.5) * 0.0008,
        phase: Math.random() * Math.PI * 2,
        color: Math.random() > 0.45 ? "#10b981" : "#06b6d4"
      }));
    }

    let tiempo = 0;
    let volumenSuave = 0;
    const dataArray = new Uint8Array(64);

    const render = () => {
      tiempo += 0.022;

      // 1. Obtener nivel de volumen del analizador de audio
      let vol = 0;
      if (analyserRef.current) {
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        vol = (sum / (dataArray.length * 255)) * sensibilidad;
      } else if (transcript) {
        vol = 0.16 + Math.sin(tiempo * 4) * 0.12;
      }

      volumenSuave += (vol - volumenSuave) * 0.16;
      setVolumenActual(volumenSuave);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      // Dimensionar canvas
      const width = wavesCanvas.clientWidth;
      const height = wavesCanvas.clientHeight;

      if (wavesCanvas.width !== width * dpr || wavesCanvas.height !== height * dpr) {
        wavesCanvas.width = width * dpr;
        wavesCanvas.height = height * dpr;
      }

      if (orbCanvas.width !== width * dpr || orbCanvas.height !== height * dpr) {
        orbCanvas.width = width * dpr;
        orbCanvas.height = height * dpr;
      }

      const centerY = height * 0.44;

      // 2. DIBUJAR ONDAS LATERALES Y FILAMENTOS FLUIDOS EN WAVES CANVAS
      wavesCtx.save();
      wavesCtx.scale(dpr, dpr);
      wavesCtx.clearRect(0, 0, width, height);

      // Dibujar partículas flotantes (polvo de plasma cósmico)
      const estaHablando = volumenSuave > 0.08;
      particlesRef.current.forEach((p) => {
        p.x += p.speedX * (estaHablando ? 2.0 : 1.0);
        p.y += p.speedY * (estaHablando ? 2.0 : 1.0);
        if (p.x < 0) p.x = 1;
        if (p.x > 1) p.x = 0;
        if (p.y < 0) p.y = 1;
        if (p.y > 1) p.y = 0;

        const px = p.x * width;
        const py = p.y * height;
        const alpha = (0.2 + Math.sin(tiempo * 2 + p.phase) * 0.15) * (estaHablando ? 1.4 : 0.8);

        wavesCtx.beginPath();
        wavesCtx.arc(px, py, p.radius, 0, Math.PI * 2);
        wavesCtx.fillStyle = p.color === "#10b981"
          ? `rgba(16, 185, 129, ${Math.min(0.85, alpha)})`
          : `rgba(6, 182, 212, ${Math.min(0.85, alpha)})`;
        wavesCtx.shadowColor = p.color;
        wavesCtx.shadowBlur = 6;
        wavesCtx.fill();
      });
      wavesCtx.shadowBlur = 0;

      // Filamentos armónicos tenues superpuestos con envelope gaussiano (se difuminan en los bordes)
      const numFilamentos = 4;
      const step = 4;
      const ampBase = (estaHablando ? 22 : 9) * (1 + volumenSuave * 1.8);

      for (let f = 0; f < numFilamentos; f++) {
        const freq = 0.008 + f * 0.004;
        const vel = (2.2 + f * 0.8) * (estaHablando ? 1.6 : 1.0);
        const phase = f * 1.4;
        const amp = ampBase * (1 - f * 0.18);

        wavesCtx.beginPath();
        for (let x = 0; x <= width; x += step) {
          // Envelope sinusoidal para desvanecer suavemente a 0 en x=0 y x=width
          const normX = x / width;
          const envelope = Math.sin(normX * Math.PI);
          const yOffset = Math.sin(x * freq - tiempo * vel + phase) * amp * Math.pow(envelope, 1.4);
          const y = centerY + yOffset;

          if (x === 0) wavesCtx.moveTo(x, y);
          else wavesCtx.lineTo(x, y);
        }

        const grad = wavesCtx.createLinearGradient(0, 0, width, 0);
        const cPrimary = f % 2 === 0 ? "16, 185, 129" : "6, 182, 212";
        grad.addColorStop(0, `rgba(${cPrimary}, 0)`);
        grad.addColorStop(0.2, `rgba(${cPrimary}, ${estaHablando ? 0.25 : 0.12})`);
        grad.addColorStop(0.5, `rgba(${cPrimary}, ${estaHablando ? 0.65 : 0.35})`);
        grad.addColorStop(0.8, `rgba(${cPrimary}, ${estaHablando ? 0.25 : 0.12})`);
        grad.addColorStop(1, `rgba(${cPrimary}, 0)`);

        wavesCtx.strokeStyle = grad;
        wavesCtx.lineWidth = 1.8;
        wavesCtx.stroke();
      }
      wavesCtx.restore();

      // 3. RENDERIZAR ORBE 3D VOLUMÉTRICO EN ORB CANVAS (WebGL o Fallback 2D)
      if (gl && program) {
        gl.viewport(0, 0, orbCanvas.width, orbCanvas.height);
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(program);
        gl.uniform2f(uResolutionLoc, orbCanvas.width, orbCanvas.height);
        gl.uniform1f(uTimeLoc, tiempo);
        gl.uniform1f(uVolumeLoc, volumenSuave);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
      } else if (orb2dCtx) {
        // Fallback 2D volumétrico con capas radiales multicapa
        orb2dCtx.save();
        orb2dCtx.scale(dpr, dpr);
        orb2dCtx.clearRect(0, 0, width, height);

        const centerX = width / 2;
        const radius = Math.min(width, height) * 0.24 + volumenSuave * 35;

        // Capa 1: Resplandor volumétrico exterior
        const haloGrad = orb2dCtx.createRadialGradient(centerX, centerY, radius * 0.4, centerX, centerY, radius * 1.5);
        haloGrad.addColorStop(0, "rgba(16, 185, 129, 0.35)");
        haloGrad.addColorStop(0.6, "rgba(6, 182, 212, 0.18)");
        haloGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
        orb2dCtx.fillStyle = haloGrad;
        orb2dCtx.beginPath();
        orb2dCtx.arc(centerX, centerY, radius * 1.5, 0, Math.PI * 2);
        orb2dCtx.fill();

        // Capa 2: Esfera base con Fresnel
        const baseGrad = orb2dCtx.createRadialGradient(centerX - radius * 0.2, centerY - radius * 0.2, 5, centerX, centerY, radius);
        baseGrad.addColorStop(0, "#ffffff");
        baseGrad.addColorStop(0.35, "#06b6d4");
        baseGrad.addColorStop(0.75, "#10b981");
        baseGrad.addColorStop(1, "rgba(16, 185, 129, 0.15)");

        orb2dCtx.fillStyle = baseGrad;
        orb2dCtx.shadowColor = "#10b981";
        orb2dCtx.shadowBlur = estaHablando ? 35 : 18;
        orb2dCtx.beginPath();
        orb2dCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        orb2dCtx.fill();
        orb2dCtx.shadowBlur = 0;
        orb2dCtx.restore();
      }

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
        backdropFilter: "blur(28px)",
        WebkitBackdropFilter: "blur(28px)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "center",
        color: "#ffffff",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
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
              transition: "all 0.2s ease"
            }}
          />
          <span style={{ fontSize: "0.82rem", fontWeight: "600", letterSpacing: "0.03em" }}>
            {volumenActual > 0.08 ? "Escuchando voz..." : "Asistente de Voz Activo"}
          </span>
        </div>

        <div
          style={{
            fontSize: "0.8rem",
            color: "rgba(255, 255, 255, 0.75)",
            backgroundColor: "rgba(0, 0, 0, 0.35)",
            padding: "4px 10px",
            borderRadius: "12px",
            fontVariantNumeric: "tabular-nums"
          }}
        >
          ⏱️ {duracionTexto || "0:00"}
        </div>
      </div>

      {/* ── ÁREA CENTRAL: ORBE 3D VOLUMÉTRICO Y FILAMENTOS ── */}
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
        {/* Canvas de Ondas Laterales y Partículas (Capa Inferior) */}
        <canvas
          ref={canvasWavesRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            display: "block",
            pointerEvents: "none",
            zIndex: 1
          }}
        />

        {/* Canvas de Orbe 3D Volumétrico WebGL (Capa Superior) */}
        <canvas
          ref={canvasOrbRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            display: "block",
            pointerEvents: "none",
            zIndex: 2
          }}
        />

        {/* TEXTO FLOTANTE NÍTIDO DIRECTAMENTE SOBRE EL FONDO OSCURO (SIN PASTILLA NEGRA ENCAJONADA) */}
        <div
          style={{
            position: "absolute",
            bottom: "28px",
            left: "24px",
            right: "24px",
            textAlign: "center",
            maxHeight: "140px",
            overflowY: "auto",
            zIndex: 10,
            pointerEvents: "none"
          }}
        >
          {transcript ? (
            <p
              style={{
                fontSize: "1.15rem",
                lineHeight: "1.5",
                fontWeight: "500",
                color: "#ffffff",
                margin: 0,
                textShadow: "0 2px 14px rgba(0, 0, 0, 0.85), 0 0 20px rgba(6, 182, 212, 0.35)"
              }}
            >
              {transcript}
            </p>
          ) : (
            <p
              style={{
                fontSize: "1.05rem",
                color: "rgba(255, 255, 255, 0.88)",
                fontWeight: "400",
                letterSpacing: "0.01em",
                margin: 0,
                textShadow: "0 2px 12px rgba(0, 0, 0, 0.85)"
              }}
            >
              Habla con confianza, te escucho...
            </p>
          )}
        </div>
      </div>

      {/* ── PANEL DE AJUSTES RÁPIDOS (SENSIBILIDAD) ── */}
      {panelAjustesAbierto && (
        <div
          style={{
            width: "90%",
            maxWidth: "380px",
            backgroundColor: "rgba(15, 23, 42, 0.95)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: "20px",
            padding: "14px 18px",
            marginBottom: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            boxShadow: "0 10px 32px rgba(0, 0, 0, 0.55)",
            zIndex: 20
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: "700" }}>Sensibilidad de Micrófono</span>
            <button
              type="button"
              onClick={() => setPanelAjustesAbierto(false)}
              style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "1rem" }}
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
              style={{ flex: 1, accentColor: "#10b981" }}
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

          {/* Botón Central: Enviar a consulta ➤ (Degradado esmeralda luminoso con resplandor) */}
          <button
            type="button"
            onClick={onEnviar}
            disabled={!transcript?.trim()}
            style={{
              padding: "12px 24px",
              borderRadius: "9999px",
              background: transcript?.trim()
                ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                : "linear-gradient(135deg, rgba(16, 185, 129, 0.35) 0%, rgba(5, 150, 105, 0.25) 100%)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              color: "#ffffff",
              fontSize: "0.92rem",
              fontWeight: "700",
              cursor: transcript?.trim() ? "pointer" : "not-allowed",
              boxShadow: transcript?.trim()
                ? "0 0 20px rgba(16, 185, 129, 0.35), 0 4px 16px rgba(0, 0, 0, 0.3)"
                : "0 0 10px rgba(16, 185, 129, 0.15)",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s ease",
              opacity: transcript?.trim() ? 1 : 0.65
            }}
          >
            <span>Enviar a consulta</span>
            <span style={{ fontSize: "1rem" }}>➤</span>
          </button>

          {/* Botón Derecho: Icono SlidersHorizontal / Ajustes */}
          <button
            type="button"
            onClick={() => setPanelAjustesAbierto(!panelAjustesAbierto)}
            title="Ajustes de sensibilidad"
            aria-label="Ajustes de sensibilidad"
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              backgroundColor: panelAjustesAbierto ? "rgba(16, 185, 129, 0.3)" : "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.16)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.15s ease"
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ display: "block" }}
            >
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
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
