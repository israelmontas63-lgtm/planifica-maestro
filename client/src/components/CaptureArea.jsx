import { useRef } from "react";

export default function CaptureArea({ imageSrc, onImageSelected, procesando }) {
  const fileInputRef = useRef(null);
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onImageSelected(reader.result, file.type);
    reader.readAsDataURL(file);
  };
  return (
    <div className="capture-area" onClick={() => fileInputRef.current?.click()}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={handleFile}
      />
      {imageSrc ? (
        <img src={imageSrc} alt="Pagina capturada" />
      ) : (
        <div className="capture-placeholder">
          📷 Toca aqui para tomar una foto del libro o guia docente.<br />
          Planifica Maestro leera el contenido automaticamente.
        </div>
      )}
      <div className="grid-overlay" />
      {procesando && <div className="status-text">Leyendo la imagen...</div>}
    </div>
  );
}
