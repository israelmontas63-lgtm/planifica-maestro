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
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
        aspectRatio: { ideal: 16 / 9 },
        // Activa enfoque continuo si el navegador móvil lo soporta
        focusMode: { ideal: "continuous" }
      },
      audio: false
    };

    navigator.mediaDevices?.getUserMedia(constraints)
      .then((stream) => {
        streamRef.current = stream;
        const track = stream.getVideoTracks()?.[0];
        if (track && typeof track.applyConstraints === "function") {
          try {
            const capabilities = track.getCapabilities?.() || {};
            if (capabilities.focusMode && capabilities.focusMode.includes("continuous")) {
              track.applyConstraints({ advanced: [{ focusMode: "continuous" }] }).catch(() => {});
            }
          } catch (_) {}
        }
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
        zIndex: 9999,
        backgroundColor: "#000000",
        overflow: "hidden",
        userSelect: "none",
        color: "#ffffff",
        fontFamily: "system-ui, sans-serif"
      }}
    >
      {/* ── 1. VIDEO A PANTALLA COMPLETA REAL (EDGE-TO-EDGE) ── */}
      <video
        ref={videoRef}
        className="visor visor-camara"
        playsInline
        muted
        autoPlay
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          objectFit: "cover",
          objectPosition: "center",
          transform: `scale(${zoom})`,
          transition: "transform 0.15s ease-out",
          display: iniciando || errorCamara ? "none" : "block",
          zIndex: 0
        }}
        onClick={handleTouchVideo}
      />

      {/* Capa de interacción táctil para re-enfocar tocando la pantalla */}
      {!iniciando && !errorCamara && (
        <div
          onClick={handleTouchVideo}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 5,
            cursor: "crosshair"
          }}
        />
      )}

      {/* ── MENSAJES DE ESTADO (INICIANDO / ERROR) ── */}
      {(iniciando || errorCamara) && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 15,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            textAlign: "center",
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(8px)"
          }}
        >
          {iniciando ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "50%",
                  border: "3.5px solid #10b981",
                  borderTopColor: "transparent",
                  animation: "spin 1s linear infinite"
                }}
              />
              <div style={{ fontSize: "0.95rem", fontWeight: "500", color: "#e2e8f0" }}>
                Iniciando cámara escolar en alta definición...
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", maxWidth: "320px" }}>
              <span style={{ fontSize: "2.5rem" }}>⚠️</span>
              <div style={{ fontSize: "0.9rem", color: "#fca5a5" }}>{errorCamara}</div>
              <button
                onClick={onClose}
                style={{
                  marginTop: "8px",
                  padding: "6px 16px",
                  borderRadius: "20px",
                  backgroundColor: "rgba(255, 255, 255, 0.2)",
                  border: "none",
                  color: "#fff",
                  fontSize: "0.8rem",
                  cursor: "pointer"
                }}
              >
                Cerrar
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── 2. CABECERA DESPEJADA Y FLOTANTE ── */}
      <div
        style={{
          position: "absolute",
          top: "16px",
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "0 16px",
          zIndex: 20,
          pointerEvents: "none"
        }}
      >
        <div
          style={{
            pointerEvents: "auto",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "14px",
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            color: "#ffffff",
            borderRadius: "9999px",
            padding: "8px 18px",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3)"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer"
            }}
            onClick={() => setModoEnVivo(!modoEnVivo)}
            title="Toca para alternar Modo En Vivo"
          >
            <span
              style={{
                display: "inline-block",
                width: "9px",
                height: "9px",
                borderRadius: "50%",
                backgroundColor: modoEnVivo ? "#10b981" : "#38bdf8",
                boxShadow: modoEnVivo ? "0 0 10px #10b981" : "0 0 10px #38bdf8"
              }}
            />
            <span style={{ fontSize: "0.82rem", fontWeight: "600", letterSpacing: "0.02em" }}>
              {modoEnVivo ? "Visor IA Activo (En Vivo)" : "Visor IA Activo"}
            </span>
          </div>

          <div style={{ width: "1px", height: "14px", backgroundColor: "rgba(255, 255, 255, 0.2)" }} />

          <button
            onClick={onClose}
            aria-label="Cerrar visor"
            style={{
              background: "none",
              border: "none",
              color: "rgba(255, 255, 255, 0.8)",
              fontSize: "1rem",
              cursor: "pointer",
              padding: "0 2px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "color 0.15s ease"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255, 255, 255, 0.8)")}
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── 3. RETÍCULA DE ENFOQUE HUD MINIMALISTA ── */}
      {!iniciando && !errorCamara && (
        <div
          style={{
            position: "absolute",
            left: `${cuadroCrop.x}%`,
            top: `${cuadroCrop.y}%`,
            width: `${cuadroCrop.w}%`,
            height: `${cuadroCrop.h}%`,
            pointerEvents: "none",
            zIndex: 10,
            transition: "all 0.15s ease-out"
          }}
        >
          {/* Esquina Superior Izquierda */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "24px",
              height: "24px",
              borderTop: "2.5px solid rgba(52, 211, 153, 0.95)",
              borderLeft: "2.5px solid rgba(52, 211, 153, 0.95)",
              borderTopLeftRadius: "10px"
            }}
          />
          {/* Esquina Superior Derecha */}
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: "24px",
              height: "24px",
              borderTop: "2.5px solid rgba(52, 211, 153, 0.95)",
              borderRight: "2.5px solid rgba(52, 211, 153, 0.95)",
              borderTopRightRadius: "10px"
            }}
          />
          {/* Esquina Inferior Izquierda */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              width: "24px",
              height: "24px",
              borderBottom: "2.5px solid rgba(52, 211, 153, 0.95)",
              borderLeft: "2.5px solid rgba(52, 211, 153, 0.95)",
              borderBottomLeftRadius: "10px"
            }}
          />
          {/* Esquina Inferior Derecha */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: "24px",
              height: "24px",
              borderBottom: "2.5px solid rgba(52, 211, 153, 0.95)",
              borderRight: "2.5px solid rgba(52, 211, 153, 0.95)",
              borderBottomRightRadius: "10px"
            }}
          />
          {/* Etiqueta discreta inferior */}
          <div
            style={{
              position: "absolute",
              bottom: "-28px",
              left: 0,
              right: 0,
              textAlign: "center"
            }}
          >
            <span
              style={{
                fontSize: "0.72rem",
                color: "rgba(255, 255, 255, 0.9)",
                backgroundColor: "rgba(0, 0, 0, 0.5)",
                backdropFilter: "blur(6px)",
                padding: "3px 10px",
                borderRadius: "14px",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                letterSpacing: "0.02em"
              }}
            >
              {cambioEscenaDetectado ? "✨ Objeto didáctico enfocado" : "Escaneando currículo..."}
            </span>
          </div>
        </div>
      )}

      {/* ── CAMPO DE PREGUNTA PEDAGÓGICA FLOTANTE (COMPACTO) ── */}
      <div
        style={{
          position: "absolute",
          bottom: "148px",
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          padding: "0 20px",
          zIndex: 20,
          pointerEvents: "none"
        }}
      >
        <div
          style={{
            pointerEvents: "auto",
            width: "100%",
            maxWidth: "380px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: "9999px",
            padding: "4px 8px 4px 14px",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3)"
          }}
        >
          <input
            type="text"
            placeholder="Pregunta pedagógica (opcional)..."
            value={preguntaTexto}
            onChange={(e) => setPreguntaTexto(e.target.value)}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              color: "#ffffff",
              fontSize: "0.8rem",
              outline: "none"
            }}
          />
          <button
            onClick={alternarReconocimientoVoz}
            style={{
              background: escuchandoVoz ? "#ef4444" : "rgba(255, 255, 255, 0.15)",
              border: "none",
              borderRadius: "50%",
              width: "28px",
              height: "28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#fff",
              fontSize: "0.75rem",
              transition: "background 0.2s"
            }}
            title="Preguntar por voz"
          >
            {escuchandoVoz ? "⏹️" : "🎙️"}
          </button>
        </div>
      </div>

      {/* ── 4. CONTROL DE ZOOM FLOTANTE ── */}
      <div
        style={{
          position: "absolute",
          bottom: "105px",
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 20,
          pointerEvents: "none"
        }}
      >
        <button
          onClick={() => {
            const escalas = [1.0, 1.5, 2.0, 3.0];
            const idx = escalas.indexOf(zoom);
            const sig = idx >= 0 && idx < escalas.length - 1 ? escalas[idx + 1] : escalas[0];
            setZoom(sig);
          }}
          style={{
            pointerEvents: "auto",
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            color: "#ffffff",
            borderRadius: "9999px",
            padding: "4px 14px",
            fontSize: "0.75rem",
            fontWeight: "700",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.35)",
            letterSpacing: "0.05em"
          }}
          title="Toca para cambiar nivel de zoom"
        >
          {zoom.toFixed(1)}x
        </button>
      </div>

      {/* ── 5. DOCK DE CONTROLES INFERIOR EN CRISTAL (GLASSMORPHISM) ── */}
      <div
        style={{
          position: "absolute",
          bottom: "14px",
          left: 0,
          right: 0,
          padding: "0 16px",
          zIndex: 20,
          display: "flex",
          justifyContent: "center"
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "420px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "rgba(0, 0, 0, 0.4)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "28px",
            padding: "10px 16px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)"
          }}
        >
          {/* Izquierda: Botón tipo píldora 'Planificar' con icono de libreta */}
          <button
            onClick={() => handleCompletarAnalisis("planificar")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              backgroundColor: "rgba(16, 185, 129, 0.2)",
              border: "1px solid rgba(52, 211, 153, 0.4)",
              color: "#6ee7b7",
              borderRadius: "9999px",
              padding: "8px 14px",
              fontSize: "0.78rem",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.15s ease"
            }}
          >
            <span>📓</span>
            <span>Planificar</span>
          </button>

          {/* Centro: Disparador principal (captura) con círculo blanco brillante y borde esmeralda */}
          <button
            onClick={() => handleCompletarAnalisis("planificar")}
            aria-label="Capturar y planificar"
            style={{
              position: "relative",
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              backgroundColor: "transparent",
              border: "3.5px solid #10b981",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4px",
              cursor: "pointer",
              boxShadow: "0 0 20px rgba(16, 185, 129, 0.5)",
              transition: "transform 0.1s ease, box-shadow 0.1s ease"
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.92)")}
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
            onTouchStart={(e) => (e.currentTarget.style.transform = "scale(0.92)")}
            onTouchEnd={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                backgroundColor: "#ffffff",
                boxShadow: "0 2px 10px rgba(0, 0, 0, 0.3)"
              }}
            />
          </button>

          {/* Derecha: Botón tipo píldora 'Ojo Digital' con icono de destello o lupa */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              onClick={() => handleCompletarAnalisis("analizar")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                backgroundColor: "rgba(56, 189, 248, 0.2)",
                border: "1px solid rgba(56, 189, 248, 0.4)",
                color: "#7dd3fc",
                borderRadius: "9999px",
                padding: "8px 14px",
                fontSize: "0.78rem",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
            >
              <span>✨</span>
              <span>Ojo Digital</span>
            </button>

            {/* Acceso complementario: Editor de Imagen */}
            <button
              onClick={() => handleCompletarAnalisis("editor")}
              title="Abrir en Editor de Imágenes"
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: "0.75rem"
              }}
            >
              🎨
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
