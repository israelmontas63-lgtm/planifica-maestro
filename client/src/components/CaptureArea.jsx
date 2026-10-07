import { useRef } from "react";
import { comprimirYRedimensionarImagen } from "../services/imageOptimizer.js";

export default function CaptureArea({ imageSrc, onImageSelected, onRemoveImage, procesando }) {
  const fileInputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === "application/pdf") {
      const reader = new FileReader();
      reader.onload = () => onImageSelected(reader.result, "application/pdf", "1/1");
      reader.readAsDataURL(file);
      e.target.value = "";
      return;
    }

    try {
      const optimizada = await comprimirYRedimensionarImagen(file, 1280, 0.8);
      onImageSelected(optimizada.dataUrl, optimizada.mediaType, optimizada.aspectRatio);
    } catch (err) {
      console.warn("Fallo compresión canvas, usando lectura directa:", err);
      const reader = new FileReader();
      reader.onload = () => onImageSelected(reader.result, file.type || "image/jpeg", "4/3");
      reader.readAsDataURL(file);
    }
    // Reset file input so selecting the same file works again if needed
    e.target.value = "";
  };

  return (
    <div className="pm-capture-container">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        style={{ display: "none" }}
        onChange={handleFile}
      />

      {imageSrc && (
        <div className="pm-capture-preview-card">
          {imageSrc.startsWith("data:application/pdf") ? (
            <div
              className="pm-capture-thumbnail"
              style={{
                aspectRatio: "1 / 1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#f1f5f9",
                borderRadius: "8px",
                color: "#e11d48",
                fontWeight: "bold",
                fontSize: "14px"
              }}
            >
              PDF
            </div>
          ) : (
            <img
              src={imageSrc}
              alt="Página capturada"
              className="pm-capture-thumbnail"
              loading="lazy"
              decoding="async"
              style={{ aspectRatio: "1 / 1", objectFit: "cover" }}
            />
          )}
          <div className="pm-capture-preview-info">
            <span className="pm-capture-tag" style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span>{imageSrc.startsWith("data:application/pdf") ? "Documento PDF adjunto" : "Foto adjunta"}</span>
            </span>
            <p className="pm-capture-hint">Se incluirá al dictar o enviar tu solicitud</p>
            <div className="pm-capture-actions">
              <button
                type="button"
                className="pm-capture-btn-change"
                onClick={() => fileInputRef.current?.click()}
                disabled={procesando}
              >
                Cambiar foto
              </button>
              {onRemoveImage && (
                <button
                  type="button"
                  className="pm-capture-btn-remove"
                  onClick={onRemoveImage}
                  disabled={procesando}
                >
                  Quitar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
