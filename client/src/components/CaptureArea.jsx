import { useRef } from "react";

export default function CaptureArea({ imageSrc, onImageSelected, onRemoveImage, procesando }) {
  const fileInputRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onImageSelected(reader.result, file.type);
    reader.readAsDataURL(file);
    // Reset file input so selecting the same file works again if needed
    e.target.value = "";
  };

  return (
    <div className="pm-capture-container">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={handleFile}
      />

      {imageSrc && (
        <div className="pm-capture-preview-card">
          <img src={imageSrc} alt="Página capturada" className="pm-capture-thumbnail" />
          <div className="pm-capture-preview-info">
            <span className="pm-capture-tag">📷 Foto adjunta</span>
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
