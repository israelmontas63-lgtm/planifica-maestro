/**
 * client/src/components/EditorImagenModal.jsx
 * 
 * EDITOR DE IMÁGENES EDUCATIVO (Modal Lazy-Loaded)
 * 
 * Características:
 * - 12 Categorías x 40 Operaciones (Catálogo oficial de 480 operaciones).
 * - Motor Local Puro en cliente (Canvas / Pixel Arrays) con latencia cero y privacidad total.
 * - Deshacer (Undo) / Rehacer (Redo) y botón Comparar "Antes vs Después".
 * - Botón "Insertar en Word del Plan" para adjuntar la imagen editada como ilustración didáctica.
 * - Descarga directa en JPG y Compartir mediante Web Share API.
 * - Cumplimiento estricto de la Política de Dignidad.
 */

import React, { useState, useEffect, useRef } from "react";
import {
  CATEGORIAS_EDICION,
  obtenerOperacionesPorCategoria
} from "../../../shared/catalogoEdicionImagen.js";
import {
  cargarImagenElemento,
  imagenAImageData,
  imageDataACanvas,
  imageDataADataUrl,
  SesionEdicionImagen
} from "../services/editorImagenLocal.js";

export default function EditorImagenModal({
  isOpen,
  onClose,
  imagenInicial,
  onInsertarEnPlan
}) {
  const canvasRef = useRef(null);
  const sesionRef = useRef(null);

  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("luz_color");
  const [operacionesCategoria, setOperacionesCategoria] = useState([]);
  const [operacionSeleccionada, setOperacionSeleccionada] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [procesandoOperacion, setProcesandoOperacion] = useState(false);
  const [viendoOriginal, setViendoOriginal] = useState(false);
  const [puedeDeshacer, setPuedeDeshacer] = useState(false);
  const [puedeRehacer, setPuedeRehacer] = useState(false);
  const [mensajeEstado, setMensajeEstado] = useState(null);

  // Inicializar operaciones de la categoría
  useEffect(() => {
    const ops = obtenerOperacionesPorCategoria(categoriaSeleccionada);
    setOperacionesCategoria(ops);
    if (ops.length > 0) setOperacionSeleccionada(ops[0]);
  }, [categoriaSeleccionada]);

  // Cargar imagen en la sesión de edición
  useEffect(() => {
    if (!isOpen || !imagenInicial) return;

    setCargando(true);
    setMensajeEstado(null);

    cargarImagenElemento(imagenInicial)
      .then((imgEl) => {
        const buffer = imagenAImageData(imgEl, 1200);
        sesionRef.current = new SesionEdicionImagen(buffer, 20);
        renderizarCanvas(sesionRef.current.actual);
        actualizarEstadosHistorial();
        setCargando(false);
      })
      .catch((err) => {
        console.error("Error cargando imagen en editor:", err);
        setMensajeEstado("No se pudo cargar la imagen seleccionada.");
        setCargando(false);
      });
  }, [isOpen, imagenInicial]);

  const actualizarEstadosHistorial = () => {
    if (sesionRef.current) {
      setPuedeDeshacer(sesionRef.current.puedeDeshacer);
      setPuedeRehacer(sesionRef.current.puedeRehacer);
    }
  };

  const renderizarCanvas = (buffer) => {
    const canvas = canvasRef.current;
    if (!canvas || !buffer) return;

    canvas.width = buffer.width;
    canvas.height = buffer.height;
    const ctx = canvas.getContext("2d");
    const imgData = new ImageData(new Uint8ClampedArray(buffer.data), buffer.width, buffer.height);
    ctx.putImageData(imgData, 0, 0);
  };

  // Aplicar operación seleccionada
  const handleAplicarOperacion = (op) => {
    if (!sesionRef.current) return;
    setProcesandoOperacion(true);

    setTimeout(() => {
      try {
        const nuevoBuffer = sesionRef.current.aplicarOperacion(op.id, op.parametros || {});
        renderizarCanvas(nuevoBuffer);
        actualizarEstadosHistorial();
        setMensajeEstado(`Aplicado: ${op.nombre}`);
        setTimeout(() => setMensajeEstado(null), 2500);
      } catch (err) {
        console.error("Error aplicando operacion:", err);
        setMensajeEstado("Error al procesar la imagen localmente.");
      } finally {
        setProcesandoOperacion(false);
      }
    }, 20);
  };

  const handleDeshacer = () => {
    if (!sesionRef.current || !sesionRef.current.puedeDeshacer) return;
    const buffer = sesionRef.current.deshacer();
    renderizarCanvas(buffer);
    actualizarEstadosHistorial();
  };

  const handleRehacer = () => {
    if (!sesionRef.current || !sesionRef.current.puedeRehacer) return;
    const buffer = sesionRef.current.rehacer();
    renderizarCanvas(buffer);
    actualizarEstadosHistorial();
  };

  const alternarVerOriginal = (mostrar) => {
    if (!sesionRef.current) return;
    setViendoOriginal(mostrar);
    renderizarCanvas(mostrar ? sesionRef.current.original : sesionRef.current.actual);
  };

  const handleDescargar = () => {
    if (!sesionRef.current) return;
    const dataUrl = imageDataADataUrl(sesionRef.current.actual, "image/jpeg", 0.92);
    const link = document.createElement("a");
    link.download = `material_escolar_editado_${Date.now()}.jpg`;
    link.href = dataUrl;
    link.click();
  };

  const handleCompartir = async () => {
    if (!sesionRef.current) return;
    const dataUrl = imageDataADataUrl(sesionRef.current.actual, "image/jpeg", 0.92);

    if (navigator.share) {
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], "imagen_pedagogica.jpg", { type: "image/jpeg" });
        await navigator.share({
          title: "Material Didáctico - Planifica Maestro",
          text: "Imagen editada para la planificación escolar.",
          files: [file]
        });
      } catch (e) {
        console.log("Compartir cancelado o no soportado");
      }
    } else {
      handleDescargar();
    }
  };

  const handleInsertarEnPlan = () => {
    if (!sesionRef.current) return;
    const dataUrl = imageDataADataUrl(sesionRef.current.actual, "image/jpeg", 0.9);
    onInsertarEnPlan?.(dataUrl);
    setMensajeEstado("✅ Imagen insertada en el plan de clase actual.");
    setTimeout(() => onClose(), 800);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Editor de Imágenes Educativo"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        color: "#f8fafc",
        fontFamily: "system-ui, sans-serif"
      }}
    >
      {/* ── ENCABEZADO ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 18px",
          borderBottom: "1px solid #334155",
          backgroundColor: "#1e293b"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "1.4rem" }}>🎨</span>
          <div>
            <div style={{ fontWeight: "700", fontSize: "1.05rem" }}>Editor de Imágenes Escolares</div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
              Catálogo oficial de 480 operaciones • Motor local seguro
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={handleDeshacer}
            disabled={!puedeDeshacer}
            title="Deshacer"
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid #475569",
              backgroundColor: puedeDeshacer ? "#334155" : "#1e293b",
              color: puedeDeshacer ? "#fff" : "#64748b",
              cursor: puedeDeshacer ? "pointer" : "not-allowed"
            }}
          >
            ↩ Deshacer
          </button>

          <button
            onClick={handleRehacer}
            disabled={!puedeRehacer}
            title="Rehacer"
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid #475569",
              backgroundColor: puedeRehacer ? "#334155" : "#1e293b",
              color: puedeRehacer ? "#fff" : "#64748b",
              cursor: puedeRehacer ? "pointer" : "not-allowed"
            }}
          >
            ↪ Rehacer
          </button>

          <button
            onMouseDown={() => alternarVerOriginal(true)}
            onMouseUp={() => alternarVerOriginal(false)}
            onTouchStart={() => alternarVerOriginal(true)}
            onTouchEnd={() => alternarVerOriginal(false)}
            title="Mantén presionado para ver la foto original"
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid #3b82f6",
              backgroundColor: viendoOriginal ? "#2563eb" : "#1e3a8a",
              color: "#fff",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "0.8rem"
            }}
          >
            👁️ {viendoOriginal ? "Viendo Original" : "Ver Original"}
          </button>

          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              fontSize: "1.5rem",
              cursor: "pointer",
              padding: "0 6px"
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── CUERPO CENTRAL: LIENZO Y PANEL ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "row", overflow: "hidden" }}>
        {/* LIENZO DE IMAGEN */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#090d16",
            padding: "16px",
            position: "relative",
            overflow: "auto"
          }}
        >
          {cargando && <div>Cargando lienzo de edición...</div>}
          <canvas
            ref={canvasRef}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
              borderRadius: "4px",
              display: cargando ? "none" : "block"
            }}
          />

          {mensajeEstado && (
            <div
              style={{
                position: "absolute",
                bottom: "20px",
                backgroundColor: "rgba(30, 41, 59, 0.9)",
                border: "1px solid #3b82f6",
                color: "#fff",
                padding: "8px 16px",
                borderRadius: "20px",
                fontSize: "0.85rem",
                boxShadow: "0 4px 12px rgba(0,0,0,0.4)"
              }}
            >
              {mensajeEstado}
            </div>
          )}
        </div>

        {/* PANEL LATERAL DERECHO: CATEGORÍAS Y OPERACIONES */}
        <div
          style={{
            width: "380px",
            maxWidth: "40%",
            borderLeft: "1px solid #334155",
            backgroundColor: "#1e293b",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }}
        >
          {/* Selector de Categorías (Pestañas horizontales con scroll) */}
          <div
            style={{
              display: "flex",
              overflowX: "auto",
              padding: "8px",
              borderBottom: "1px solid #334155",
              gap: "6px",
              whiteSpace: "nowrap"
            }}
          >
            {CATEGORIAS_EDICION.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoriaSeleccionada(cat.id)}
                style={{
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: categoriaSeleccionada === cat.id ? "#3b82f6" : "#334155",
                  color: "#fff",
                  fontSize: "0.78rem",
                  fontWeight: "600",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                <span>{cat.icono}</span>
                <span>{cat.nombre}</span>
              </button>
            ))}
          </div>

          {/* Lista de Operaciones de la Categoría */}
          <div style={{ flex: 1, overflowY: "auto", padding: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "4px" }}>
              40 Operaciones disponibles en esta sección:
            </div>

            {operacionesCategoria.map((op) => {
              const esActual = operacionSeleccionada?.id === op.id;
              return (
                <div
                  key={op.id}
                  onClick={() => setOperacionSeleccionada(op)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: `1px solid ${esActual ? "#3b82f6" : "#334155"}`,
                    backgroundColor: esActual ? "#1e3a8a" : "#0f172a",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <div style={{ flex: 1, paddingRight: "8px" }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: "600" }}>{op.nombre}</div>
                    <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "2px" }}>
                      {op.descripcion}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAplicarOperacion(op);
                    }}
                    disabled={procesandoOperacion}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "none",
                      backgroundColor: "#16a34a",
                      color: "#fff",
                      fontSize: "0.75rem",
                      fontWeight: "700",
                      cursor: procesandoOperacion ? "wait" : "pointer"
                    }}
                  >
                    Aplicar
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── BARRA INFERIOR DE EXPORTACIÓN Y VINCULACIÓN AL PLAN ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 18px",
          borderTop: "1px solid #334155",
          backgroundColor: "#1e293b",
          gap: "10px"
        }}
      >
        <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
          💡 Esta imagen se procesa en tu dispositivo. Puedes insertarla directo en la planificación o descargarla.
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={handleDescargar}
            style={{
              padding: "8px 14px",
              borderRadius: "6px",
              border: "1px solid #475569",
              backgroundColor: "#334155",
              color: "#fff",
              fontSize: "0.85rem",
              fontWeight: "600",
              cursor: "pointer"
            }}
          >
            💾 Descargar JPG
          </button>

          <button
            onClick={handleCompartir}
            style={{
              padding: "8px 14px",
              borderRadius: "6px",
              border: "1px solid #475569",
              backgroundColor: "#334155",
              color: "#fff",
              fontSize: "0.85rem",
              fontWeight: "600",
              cursor: "pointer"
            }}
          >
            📲 Compartir
          </button>

          <button
            onClick={handleInsertarEnPlan}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "#2563eb",
              color: "#fff",
              fontSize: "0.85rem",
              fontWeight: "700",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(37, 99, 235, 0.4)"
            }}
          >
            📄 Insertar en Word del Plan
          </button>
        </div>
      </div>
    </div>
  );
}
