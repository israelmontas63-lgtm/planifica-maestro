// client/src/components/VoiceModalInmersive.jsx
import React, { useEffect, useRef, useState } from 'react';

// Componentes de iconos SVG integrados (Pixel-perfect Lucide sin dependencias externas)
function X({ size = 15, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ display: 'inline-block' }}
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function Send({ size = 13, className = '', fill = 'currentColor', stroke = 'none' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={stroke}
      className={className}
      style={{ display: 'inline-block' }}
    >
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

function SlidersHorizontal({ size = 14, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ display: 'inline-block' }}
    >
      <line x1="21" y1="4" x2="14" y2="4" />
      <line x1="10" y1="4" x2="3" y2="4" />
      <line x1="21" y1="12" x2="12" y2="12" />
      <line x1="8" y1="12" x2="3" y2="12" />
      <line x1="21" y1="20" x2="16" y2="20" />
      <line x1="12" y1="20" x2="3" y2="20" />
      <line x1="14" y1="2" x2="14" y2="6" />
      <line x1="8" y1="10" x2="8" y2="14" />
      <line x1="16" y1="18" x2="16" y2="22" />
    </svg>
  );
}

function AlertTriangle({ size = 11, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ display: 'inline-block' }}
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export default function VoiceModalInmersive({
  isOpen = true,
  onClose,
  onSend,
  onOpenSettings,
  audioLevel = 0,
  // Props de compatibilidad con flujo de dictado en App.jsx:
  transcript = '',
  duracionTexto = '0:00',
  onEnviar,
  onCancelar
}) {
  const canvasRef = useRef(null);
  const [internalAudioLevel, setInternalAudioLevel] = useState(0);
  const [mostrarAjustes, setMostrarAjustes] = useState(false);
  const [sensibilidad, setSensibilidad] = useState(1.2);

  const mediaStreamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);

  // Handlers unificados
  const handleCerrar = onClose || onCancelar;
  const handleEnviar = onSend || onEnviar;
  const handleAjustes = onOpenSettings || (() => setMostrarAjustes((prev) => !prev));

  // Captura reactiva de audio automática si no se suministra audioLevel externo
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function initAudio() {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;

        const ctx = new AudioContextClass();
        audioCtxRef.current = ctx;
        if (ctx.state === 'suspended') {
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
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        analyserRef.current = analyser;
      } catch (err) {
        // Fallback transparente a oscilación sintética
      }
    }

    if (audioLevel === 0) {
      initAudio();
    }

    return () => {
      isMounted = false;
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      analyserRef.current = null;
    };
  }, [isOpen, audioLevel]);

  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    let animationFrameId;
    let time = 0;
    const dataArray = new Uint8Array(32);

    // Configuración para ULTRA ALTA RESOLUCIÓN (Retina / OLED displayPixelRatio)
    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3); // Escala nativa nítida
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const render = () => {
      time += 0.038;
      const rect = canvas.parentElement.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      // Calcular nivel de audio efectivo
      let currentAudio = audioLevel;
      if (currentAudio === 0 && analyserRef.current) {
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        currentAudio = (sum / (dataArray.length * 255)) * sensibilidad;
      } else if (currentAudio === 0 && transcript?.trim()) {
        currentAudio = 0.15 + Math.sin(time * 3) * 0.1;
      }
      setInternalAudioLevel(currentAudio);

      ctx.clearRect(0, 0, w, h);

      const centerX = w / 2;
      const centerY = h / 2 - 6;
      // Escala visual calibrada exacta: orbe compacto
      const baseRadius = Math.min(w, h) * 0.23;

      // -------------------------------------------------------------
      // 1. FILAMENTOS SENOIDALES DE ALTA DEFINICIÓN (Ondas que cruzan)
      // -------------------------------------------------------------
      ctx.save();
      const waves = [
        { amp: 14 + currentAudio * 18, freq: 0.014, speed: 1.1, alpha: 0.35, width: 1.2, color: 'rgba(52, 211, 153, ' },
        { amp: 9 + currentAudio * 12, freq: 0.022, speed: -0.9, alpha: 0.25, width: 0.9, color: 'rgba(34, 211, 238, ' },
        { amp: 18 + currentAudio * 22, freq: 0.009, speed: 1.4, alpha: 0.45, width: 1.4, color: 'rgba(16, 185, 129, ' }
      ];

      waves.forEach((wv, idx) => {
        ctx.beginPath();
        ctx.lineWidth = wv.width;

        const waveGrad = ctx.createLinearGradient(0, centerY, w, centerY);
        waveGrad.addColorStop(0, `${wv.color}0)`);
        waveGrad.addColorStop(0.18, `${wv.color}${wv.alpha * 0.4})`);
        waveGrad.addColorStop(0.5, `${wv.color}${wv.alpha})`);
        waveGrad.addColorStop(0.82, `${wv.color}${wv.alpha * 0.4})`);
        waveGrad.addColorStop(1, `${wv.color}0)`);
        ctx.strokeStyle = waveGrad;

        for (let x = 0; x <= w; x += 2) {
          const y = centerY + Math.sin(x * wv.freq + time * wv.speed + idx) * wv.amp * Math.cos(time * 0.4 + idx);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });
      ctx.restore();

      // -------------------------------------------------------------
      // 2. AURA ATMOSFÉRICA FLUIDA (Resplandor volumétrico)
      // -------------------------------------------------------------
      const aura = ctx.createRadialGradient(
        centerX, centerY, baseRadius * 0.1,
        centerX, centerY, baseRadius * 1.85
      );
      aura.addColorStop(0, 'rgba(16, 185, 129, 0.22)');
      aura.addColorStop(0.4, 'rgba(6, 182, 212, 0.09)');
      aura.addColorStop(0.8, 'rgba(16, 185, 129, 0.02)');
      aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 1.85, 0, Math.PI * 2);
      ctx.fill();

      // -------------------------------------------------------------
      // 3. CAPAS DEL ORBE 3D (Cromodinámica: Esmeralda, Cian y Núcleo)
      // -------------------------------------------------------------
      const layers = [
        {
          scale: 1.0,
          rot: 1.1,
          alpha: 0.88,
          c1: '#10b981', // Emerald 500
          c2: '#06b6d4', // Cyan 500
          c3: 'rgba(5, 46, 38, 0.5)'
        },
        {
          scale: 0.86,
          rot: -1.4,
          alpha: 0.72,
          c1: '#34d399', // Emerald 400
          c2: '#22d3ee', // Cyan 400
          c3: 'rgba(6, 78, 59, 0.4)'
        },
        {
          scale: 0.65,
          rot: 2.1,
          alpha: 0.95,
          c1: '#ffffff', // Núcleo de luz cenital blanca pura
          c2: '#6ee7b7', // Emerald 300
          c3: 'rgba(16, 185, 129, 0.2)'
        }
      ];

      layers.forEach((layer) => {
        ctx.save();
        ctx.beginPath();
        const steps = 72; // Polígono suave sin bordes dentados
        const rCurrent = baseRadius * layer.scale * (1 + currentAudio * 0.15);

        for (let i = 0; i <= steps; i++) {
          const angle = (i / steps) * Math.PI * 2;
          // Ecuación de deformación orgánica armónica fluida
          const distortion =
            Math.sin(angle * 3 + time * layer.rot) * 5.5 +
            Math.cos(angle * 5 - time * 0.7) * 3.5;
          const r = rCurrent + distortion;
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();

        // Punto de luz desplazado a 135° (iluminación volumétrica superior izquierda)
        const lightX = centerX - rCurrent * 0.25;
        const lightY = centerY - rCurrent * 0.28;

        const sphereGrad = ctx.createRadialGradient(
          lightX, lightY, rCurrent * 0.04,
          centerX, centerY, rCurrent * 1.12
        );
        sphereGrad.addColorStop(0, layer.c1);
        sphereGrad.addColorStop(0.42, layer.c2);
        sphereGrad.addColorStop(1, layer.c3);

        ctx.fillStyle = sphereGrad;
        ctx.globalAlpha = layer.alpha;
        ctx.shadowColor = 'rgba(16, 185, 129, 0.35)';
        ctx.shadowBlur = 22;
        ctx.fill();
        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, audioLevel, sensibilidad, transcript]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col justify-between p-6 bg-slate-950/80 backdrop-blur-xl select-none animate-in fade-in duration-300"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 120,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '24px',
        backgroundColor: 'rgba(2, 6, 23, 0.88)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        userSelect: 'none',
        color: '#ffffff',
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}
    >
      {/* 1. CABECERA: Píldora translúcida de estado y cierre */}
      <header
        className="w-full flex items-center justify-between pt-2"
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px' }}
      >
        <div className="flex-1" style={{ flex: 1 }} />

        {/* Píldora "Visor IA" con glow esmeralda */}
        <div
          className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.06] border border-white/10 backdrop-blur-md shadow-lg shadow-black/20"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 16px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)'
          }}
        >
          <span
            className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]"
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#34d399',
              boxShadow: '0 0 8px #34d399',
              display: 'inline-block'
            }}
          />
          <span
            className="text-xs font-medium text-white/90 tracking-wide"
            style={{ fontSize: '0.75rem', fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)', letterSpacing: '0.025em' }}
          >
            Visor IA
          </span>
        </div>

        {/* Botón Cerrar (X) */}
        <div className="flex-1 flex justify-end" style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleCerrar}
            className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all active:scale-90"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255, 255, 255, 0.7)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            aria-label="Cerrar modal"
          >
            <X size={15} />
          </button>
        </div>
      </header>

      {/* 2. ÁREA CENTRAL: Canvas del Orbe de Plasma y Tipografía Neón */}
      <div
        className="flex-1 flex flex-col items-center justify-center relative w-full my-auto"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          width: '100%',
          margin: 'auto 0'
        }}
      >
        <div
          className="w-full h-72 sm:h-80 relative flex items-center justify-center"
          style={{ width: '100%', height: '320px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full absolute inset-0 pointer-events-none"
            style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, pointerEvents: 'none' }}
          />
        </div>

        <div className="text-center z-10 -mt-2" style={{ textAlign: 'center', zIndex: 10, marginTop: '-8px', maxWidth: '420px', padding: '0 16px' }}>
          <h2
            className="text-2xl font-semibold text-white tracking-tight drop-shadow-[0_2px_12px_rgba(255,255,255,0.2)]"
            style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              color: '#ffffff',
              letterSpacing: '-0.025em',
              filter: 'drop-shadow(0 2px 12px rgba(255,255,255,0.2))',
              margin: 0
            }}
          >
            {transcript?.trim() ? transcript : 'Te escucho, profe...'}
          </h2>
          <p
            className="text-xs font-normal text-emerald-200/70 tracking-wide mt-1"
            style={{
              fontSize: '0.75rem',
              fontWeight: 400,
              color: 'rgba(167, 243, 208, 0.7)',
              letterSpacing: '0.025em',
              marginTop: '4px',
              marginBottom: 0
            }}
          >
            {transcript?.trim() ? 'Transcribiendo consulta en vivo...' : 'Hable con confianza sobre su clase...'}
          </p>
        </div>
      </div>

      {/* Panel Flotante de Sensibilidad (si se abre ajustes) */}
      {mostrarAjustes && (
        <div
          style={{
            width: '100%',
            maxWidth: '360px',
            alignSelf: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '18px',
            padding: '12px 16px',
            marginBottom: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            zIndex: 130
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Sensibilidad de Micrófono</span>
            <button
              onClick={() => setMostrarAjustes(false)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Baja</span>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              value={sensibilidad}
              onChange={(e) => setSensibilidad(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: '#10b981' }}
            />
            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Alta ({sensibilidad.toFixed(1)}x)</span>
          </div>
        </div>
      )}

      {/* 3. DOCK INFERIOR: Barra de controles en cristal y pastilla de privacidad */}
      <footer
        className="w-full flex flex-col items-center gap-3 pb-4"
        style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', paddingBottom: '16px' }}
      >
        <div
          className="w-full max-w-sm flex items-center justify-between gap-3 px-3 py-2.5 rounded-full bg-slate-900/60 border border-white/10 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
          style={{
            width: '100%',
            maxWidth: '384px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 12px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)'
          }}
        >
          {/* Botón Cancelar */}
          <button
            onClick={handleCerrar}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/5 text-xs font-medium text-white/80 active:scale-95 transition-all"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              fontSize: '0.75rem',
              fontWeight: 500,
              color: 'rgba(255, 255, 255, 0.8)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <X size={13} className="text-white/60" />
            <span>Cancelar</span>
          </button>

          {/* Botón Central: Enviar a consulta */}
          <button
            onClick={handleEnviar}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-slate-950 text-xs font-bold shadow-[0_0_20px_rgba(16,185,129,0.35)] active:scale-95 transition-all"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '9999px',
              background: 'linear-gradient(to right, #10b981, #34d399)',
              color: '#020617',
              fontSize: '0.75rem',
              fontWeight: 700,
              boxShadow: '0 0 20px rgba(16, 185, 129, 0.35)',
              cursor: 'pointer',
              border: 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <span>Enviar a consulta</span>
            <Send size={13} className="fill-slate-950 stroke-none" />
          </button>

          {/* Botón Ajustes */}
          <button
            onClick={handleAjustes}
            className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/5 flex items-center justify-center text-white/70 active:scale-95 transition-all"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255, 255, 255, 0.7)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            aria-label="Ajustes de voz"
          >
            <SlidersHorizontal size={14} />
          </button>
        </div>

        {/* Pastilla de Privacidad */}
        <div
          className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300/90 shadow-sm"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 14px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            fontSize: '10px',
            color: 'rgba(252, 211, 77, 0.9)',
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
          }}
        >
          <AlertTriangle size={11} className="text-amber-400" />
          <span>Privacidad en el aula: No grabe rostros, solo materiales.</span>
        </div>
      </footer>
    </div>
  );
}
