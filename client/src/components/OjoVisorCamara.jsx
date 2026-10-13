/**
 * client/src/components/OjoVisorCamara.jsx
 * 
 * OJO VISOR EN VIVO DE CÁMARA
 * 
 * Características:
 * - Modo (1) Foto Puntual (mantiene intacto el flujo existente de Ojo Digital).
 * - Modo (2) "Mirando en Vivo": Detección de cambio de escena en tiempo real con canvas ligero 32x32.
 * - Zoom Digital interactivo (1x a 3x con slider y botones rápidos).
 * - Touch-to-Crop: Selección táctil de región de interés para encuadre pedagógico.
 * - Pregunta por voz o texto vinculada al Currículo MINERD.
 * - Botón directo para enviar la captura al "Editor de Imágenes" o "Planificar Clase".
 */

import React, { useState, useEffect, useRef, useCallback } from "react";

export default function OjoVisorCamara({
  isOpen,
  onClose,
  onFotoCapturada,
  onAbrirEditor,
  onAnalizarDirecto
}) {
  const videoRef = useRef(null);
  const hiddenCanvasRef = useRef(null);
  const streamRef = useRef(null);

  const [modoEnVivo, setModoEnVivo] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [errorCamara, setErrorCamara] = useState(null);
  const [iniciando, setIniciando] = useState(true);
  const [capturaPrevia, setCapturaPrevia] = useState(null);
  const [preguntaTexto, setPreguntaTexto] = useState("");
  const [escuchandoVoz, setEscuchandoVoz] = useState(false);
  const [cambioEscenaDetectado, setCambioEscenaDetectado] = useState(false);

  // Cuadro de recorte Touch-to-Crop (porcentajes de 0 a 100)
  const [cuadroCrop, setCuadroCrop] = useState({ x: 20, y: 20, w: 60, h: 60 });
  const [arrastrandoCrop, setArrastrandoCrop] = useState(false);

  // Historial de frames para comparación de escena
  const ultimoFrameDataRef = useRef(null);

  // Iniciar flujo de cámara
  useEffect(() => {
    if (!isOpen) {
      detenerCamara();
      return;
    }

    setIniciando(true);
    setErrorCamara(null);

    const constraints = {
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };

    navigator.mediaDevices?.getUserMedia(constraints)
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setIniciando(false);
      })
      .catch((err) => {
        console.warn("Fallo cámara trasera, intentando cualquier cámara:", err);
        navigator.mediaDevices?.getUserMedia({ video: true, audio: false })
          .then((fallbackStream) => {
            streamRef.current = fallbackStream;
            if (videoRef.current) {
              videoRef.current.srcObject = fallbackStream;
              videoRef.current.play().catch(() => {});
            }
            setIniciando(false);
          })
          .catch((finalErr) => {
            setErrorCamara("No se pudo acceder a la cámara. Verifica los permisos en tu navegador.");
            setIniciando(false);
          });
      });

    return () => detenerCamara();
  }, [isOpen]);

  const detenerCamara = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  // Detección de cambio de escena en Modo "Mirando en Vivo" (muestreo a baja frecuencia)
  useEffect(() => {
    if (!isOpen || !modoEnVivo) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      const canvas = hiddenCanvasRef.current || document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, 32, 32);
      const imgData = ctx.getImageData(0, 0, 32, 32).data;

      if (ultimoFrameDataRef.current) {
        let sumaDiff = 0;
        const prev = ultimoFrameDataRef.current;
        for (let i = 0; i < imgData.length; i += 4) {
          // Diferencia absoluta en luminancia
          const lumaActual = 0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2];
          const lumaPrev = 0.299 * prev[i] + 0.587 * prev[i + 1] + 0.114 * prev[i + 2];
          sumaDiff += Math.abs(lumaActual - lumaPrev);
        }
        const diffPromedio = sumaDiff / (32 * 32);

        // Si el cambio supera el umbral, avisar al docente
        if (diffPromedio > 28) {
          setCambioEscenaDetectado(true);
          setTimeout(() => setCambioEscenaDetectado(false), 2000);
        }
      }

      ultimoFrameDataRef.current = new Uint8ClampedArray(imgData);
    }, 1800);

    return () => clearInterval(interval);
  }, [isOpen, modoEnVivo]);

  // Touch-to-Crop: centrar cuadro al tocar el video
  const handleTouchVideo = (e) => {
    const video = videoRef.current;
    if (!video) return;

    const rect = video.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY);
    if (!clientX || !clientY) return;

    const posX = ((clientX - rect.left) / rect.width) * 100;
    const posY = ((clientY - rect.top) / rect.height) * 100;

    const tam = cuadroCrop.w;
    const nuevoX = Math.max(0, Math.min(100 - tam, posX - tam / 2));
    const nuevoY = Math.max(0, Math.min(100 - tam, posY - tam / 2));

    setCuadroCrop({ x: Math.round(nuevoX), y: Math.round(nuevoY), w: tam, h: tam });
  };

  // Capturar foto actual (aplicando Touch-to-Crop si está activo)
  const capturarFoto = useCallback((aplicarCrop = true) => {
    const video = videoRef.current;
    if (!video) return null;

    const canvas = document.createElement("canvas");
    const vW = video.videoWidth || 1280;
    const vH = video.videoHeight || 720;

    if (aplicarCrop && cuadroCrop) {
      const srcX = Math.round((cuadroCrop.x / 100) * vW);
      const srcY = Math.round((cuadroCrop.y / 100) * vH);
      const srcW = Math.round((cuadroCrop.w / 100) * vW);
      const srcH = Math.round((cuadroCrop.h / 100) * vH);

      canvas.width = srcW;
      canvas.height = srcH;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);
    } else {
      canvas.width = vW;
      canvas.height = vH;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, vW, vH);
    }

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCapturaPrevia(dataUrl);
    return dataUrl;
  }, [cuadroCrop]);

  // Entrada por voz usando SpeechRecognition nativo
  const alternarReconocimientoVoz = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("El reconocimiento de voz no está soportado en este navegador. Puedes escribir la pregunta.");
      return;
    }

    if (escuchandoVoz) {
      setEscuchandoVoz(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "es-DO";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setEscuchandoVoz(true);
      recognition.onend = () => setEscuchandoVoz(false);
      recognition.onerror = () => setEscuchandoVoz(false);

      recognition.onresult = (evt) => {
        const transcript = evt.results[0][0].transcript;
        setPreguntaTexto(transcript);
        setEscuchandoVoz(false);
      };

      recognition.start();
    } catch (e) {
      setEscuchandoVoz(false);
    }
  };

  const handleCompletarAnalisis = (accion) => {
    const foto = capturaPrevia || capturarFoto(true);
    if (!foto) return;

    if (accion === "editor") {
      onAbrirEditor?.(foto);
      onClose();
    } else if (accion === "planificar") {
      onFotoCapturada?.(foto, preguntaTexto);
      onClose();
    } else if (accion === "analizar") {
      onAnalizarDirecto?.(foto, preguntaTexto);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ojo Visor de Cámara"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.92)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        color: "#ffffff",
        fontFamily: "system-ui, sans-serif"
      }}
    >
      {/* ── BARRA SUPERIOR ── */}
      <div
        style={{
          width: "100%",
          padding: "14px 18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(8px)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "1.4rem" }}>👁️</span>
          <div>
            <div style={{ fontWeight: "700", fontSize: "1rem" }}>Ojo Visor en Vivo</div>
            <div style={{ fontSize: "0.75rem", opacity: 0.8 }}>
              {modoEnVivo ? "🔴 Modo Mirando en Vivo" : "📷 Modo Foto Puntual"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={() => setModoEnVivo(!modoEnVivo)}
            style={{
              padding: "6px 12px",
              borderRadius: "20px",
              border: "1px solid #4ade80",
              backgroundColor: modoEnVivo ? "#15803d" : "transparent",
              color: "#ffffff",
              fontSize: "0.75rem",
              fontWeight: "600",
              cursor: "pointer"
            }}
          >
            {modoEnVivo ? "Mirando Activo" : "Activar Mirando"}
          </button>

          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#fff",
              fontSize: "1.6rem",
              cursor: "pointer",
              padding: "0 6px"
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── ÁREA DE VISOR Y VIDEO ── */}
      <div
        style={{
          position: "relative",
          width: "100%",
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden"
        }}
        onClick={handleTouchVideo}
      >
        {iniciando && (
          <div style={{ textAlign: "center", opacity: 0.8 }}>
            <div style={{ fontSize: "2rem", marginBottom: "8px" }}>⏳</div>
            <div>Iniciando cámara escolar...</div>
          </div>
        )}

        {errorCamara && (
          <div style={{ textAlign: "center", color: "#f87171", padding: "20px", maxWidth: "340px" }}>
            <div style={{ fontSize: "2rem", marginBottom: "8px" }}>⚠️</div>
            <div>{errorCamara}</div>
          </div>
        )}

        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            transform: `scale(${zoom})`,
            transition: "transform 0.15s ease-out",
            display: iniciando || errorCamara ? "none" : "block"
          }}
        />

        {/* Notificación de cambio de escena */}
        {cambioEscenaDetectado && (
          <div
            style={{
              position: "absolute",
              top: "16px",
              backgroundColor: "rgba(16, 185, 129, 0.9)",
              color: "#fff",
              padding: "6px 14px",
              borderRadius: "16px",
              fontSize: "0.8rem",
              fontWeight: "600",
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)"
            }}
          >
            ✨ Nuevo objeto didáctico enfocado
          </div>
        )}

        {/* Cuadro de Enfoque Touch-to-Crop */}
        {!iniciando && !errorCamara && (
          <div
            style={{
              position: "absolute",
              left: `${cuadroCrop.x}%`,
              top: `${cuadroCrop.y}%`,
              width: `${cuadroCrop.w}%`,
              height: `${cuadroCrop.h}%`,
              border: "2px dashed #38bdf8",
              borderRadius: "8px",
              pointerEvents: "none",
              boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.35)",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "flex-end",
              padding: "4px"
            }}
          >
            <span style={{ fontSize: "0.65rem", backgroundColor: "rgba(0,0,0,0.6)", padding: "2px 6px", borderRadius: "4px" }}>
              Enfoque (Toca para mover)
            </span>
          </div>
        )}
      </div>

      {/* ── BARRA DE CONTROLES INFERIOR ── */}
      <div
        style={{
          width: "100%",
          padding: "14px 18px",
          backgroundColor: "rgba(0,0,0,0.85)",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          backdropFilter: "blur(10px)"
        }}
      >
        {/* Controles de Zoom */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
          <button
            onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))}
            style={{ padding: "4px 10px", background: "#334155", color: "#fff", border: "none", borderRadius: "4px" }}
          >
            -
          </button>
          <input
            type="range"
            min="1"
            max="3"
            step="0.1"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            style={{ width: "140px" }}
          />
          <button
            onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
            style={{ padding: "4px 10px", background: "#334155", color: "#fff", border: "none", borderRadius: "4px" }}
          >
            +
          </button>
          <span style={{ fontSize: "0.8rem", width: "35px" }}>{zoom.toFixed(1)}x</span>
        </div>

        {/* Campo de Pregunta o Voz */}
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="text"
            placeholder="Pregunta pedagógica (ej. ¿Qué tema enseñar con esto?)"
            value={preguntaTexto}
            onChange={(e) => setPreguntaTexto(e.target.value)}
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #475569",
              backgroundColor: "#1e293b",
              color: "#fff",
              fontSize: "0.85rem"
            }}
          />
          <button
            onClick={alternarReconocimientoVoz}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: escuchandoVoz ? "#ef4444" : "#3b82f6",
              color: "#fff",
              cursor: "pointer"
            }}
            title="Preguntar por voz"
          >
            {escuchandoVoz ? "⏹️" : "🎙️"}
          </button>
        </div>

        {/* Botones de Acción */}
        <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", gap: "8px" }}>
          <button
            onClick={() => handleCompletarAnalisis("editor")}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #3b82f6",
              backgroundColor: "#1e3a8a",
              color: "#fff",
              fontSize: "0.85rem",
              fontWeight: "600",
              cursor: "pointer"
            }}
          >
            🎨 Editar Foto
          </button>

          <button
            onClick={() => handleCompletarAnalisis("planificar")}
            style={{
              flex: 1.2,
              padding: "12px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "#16a34a",
              color: "#fff",
              fontSize: "0.9rem",
              fontWeight: "700",
              cursor: "pointer"
            }}
          >
            📸 Planificar Clase
          </button>

          <button
            onClick={() => handleCompletarAnalisis("analizar")}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #64748b",
              backgroundColor: "#334155",
              color: "#fff",
              fontSize: "0.85rem",
              fontWeight: "600",
              cursor: "pointer"
            }}
          >
            🔍 Ojo Digital
          </button>
        </div>
      </div>
    </div>
  );
}
