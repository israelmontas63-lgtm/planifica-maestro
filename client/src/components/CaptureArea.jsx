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
    <div className="pm-viewfinder" onClick={() => fileInputRef.current?.click()}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={handleFile}
      />
      {imageSrc && (
        <img src={imageSrc} alt="Página capturada" className="pm-viewfinder-img" />
      )}
      {!imageSrc && !procesando && (
        <div className="pm-viewfinder-text">
          📷 Toca aquí para tomar una foto del libro o guía docente.
        </div>
      )}
      {procesando && <div className="pm-viewfinder-text">Leyendo la imagen...</div>}
      
      <span className="pm-corner pm-corner-tl"></span>
      <span className="pm-corner pm-corner-tr"></span>
      <span className="pm-corner pm-corner-bl"></span>
      <span className="pm-corner pm-corner-br"></span>
    </div>
}
