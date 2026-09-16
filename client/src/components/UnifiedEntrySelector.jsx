import { useRef } from "react";

export default function UnifiedEntrySelector({
  onDictadoClick,
  onTextoClick,
  onImageSelected,
  listening,
  procesandoImagen
}) {
  const fileInputRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onImageSelected(reader.result, file.type);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="pm-entry-selector-wrapper no-print">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={handleFile}
      />

      <div className="pm-entry-intro">
        <h3 className="pm-entry-heading">¿Cómo deseas iniciar tu planificación?</h3>
        <p className="pm-entry-subheading">
          Selecciona cualquiera de las 3 opciones para proporcionarle el tema al asistente:
        </p>
      </div>

      <div className="pm-entry-grid">
        {/* Opción 1: Dictado por Voz */}
        <button
          type="button"
          className={`pm-entry-card card-voz ${listening ? "escuchando" : ""}`}
          onClick={onDictadoClick}
        >
          <div className="pm-entry-card-header">
            <span className="pm-entry-icon">🎙️</span>
            <span className="pm-entry-pill pill-recomendado">Más rápido</span>
          </div>
          <h4 className="pm-entry-title">
            {listening ? "Escuchando tu voz..." : "Dictado por Voz"}
          </h4>
          <p className="pm-entry-desc">
            {listening 
              ? "Habla ahora. Al pausar, se generará la propuesta."
              : "Habla con naturalidad sobre el tema, grado o actividades que deseas."}
          </p>
          <span className="pm-entry-action-label">
            {listening ? "⏹️ Detener micrófono" : "▶️ Toca para hablar"}
          </span>
        </button>

        {/* Opción 2: Foto de Pizarra o Libro */}
        <button
          type="button"
          className="pm-entry-card card-foto"
          onClick={() => fileInputRef.current?.click()}
          disabled={procesandoImagen}
        >
          <div className="pm-entry-card-header">
            <span className="pm-entry-icon">📷</span>
            <span className="pm-entry-pill pill-visual">Visual</span>
          </div>
          <h4 className="pm-entry-title">Subir Foto o Captura</h4>
          <p className="pm-entry-desc">
            Fotografía una página de tu libro guía, ejercicio o contenido de la pizarra.
          </p>
          <span className="pm-entry-action-label">
            {procesandoImagen ? "⏳ Leyendo imagen..." : "📁 Seleccionar imagen"}
          </span>
        </button>

        {/* Opción 3: Escribir Texto */}
        <button
          type="button"
          className="pm-entry-card card-texto"
          onClick={onTextoClick}
        >
          <div className="pm-entry-card-header">
            <span className="pm-entry-icon">⌨️</span>
            <span className="pm-entry-pill pill-escrito">Escrito</span>
          </div>
          <h4 className="pm-entry-title">Escribir con Teclado</h4>
          <p className="pm-entry-desc">
            Redacta directamente el tema, situación de aprendizaje o indicadores específicos.
          </p>
          <span className="pm-entry-action-label">
            ✏️ Abrir editor de texto
          </span>
        </button>
      </div>
    </div>
  );
}

