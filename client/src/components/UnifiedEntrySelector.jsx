export default function UnifiedEntrySelector({
  onDictadoClick,
  listening,
  onAbrirCamara,
  onAbrirTexto,
  onAbrirCurriculo,
  onAbrirEsquemas
}) {
  return (
    <div className="pm-entry-selector-wrapper no-print">
      <div className="pm-entry-intro">
        <h3 className="pm-entry-heading">¿Cómo deseas iniciar tu planificación?</h3>
        <p className="pm-entry-subheading">Elige tu método favorito para comenzar en segundos:</p>
      </div>

      <div className="pm-entry-grid" style={{ marginTop: "12px" }}>
        {/* Tarjeta 1: Voz */}
        <div 
          className={`pm-entry-card card-voz ${listening ? "escuchando" : ""}`}
          onClick={onDictadoClick}
          role="button"
          tabIndex={0}
          title="Dictar tema de planificación por voz"
        >
          <div className="pm-entry-card-header">
            <span className="pm-entry-icon">{listening ? "🔴" : "🎙️"}</span>
            <span className="pm-entry-pill pill-recomendado">Más Rápido</span>
          </div>
          <h4 className="pm-entry-title">{listening ? "Escuchando..." : "Por Voz"}</h4>
          <p className="pm-entry-desc">
            {listening ? "Habla ahora, la IA está captando tu voz..." : "Dicta tu tema y la IA redactará la clase de inmediato."}
          </p>
          <span className="pm-entry-action-label">{listening ? "Detener y Enviar ➔" : "Tocar para hablar ➔"}</span>
        </div>

        {/* Tarjeta 2: Foto */}
        <div 
          className="pm-entry-card card-foto"
          onClick={onAbrirCamara}
          role="button"
          tabIndex={0}
          title="Tomar o subir foto de cuaderno o guía"
        >
          <div className="pm-entry-card-header">
            <span className="pm-entry-icon">📷</span>
            <span className="pm-entry-pill pill-visual">Desde Material</span>
          </div>
          <h4 className="pm-entry-title">Foto o Imagen</h4>
          <p className="pm-entry-desc">
            Sube o fotografía páginas de tu libro, cuaderno o guía docente.
          </p>
          <span className="pm-entry-action-label">Capturar página ➔</span>
        </div>

        {/* Tarjeta 3: Texto */}
        <div 
          className="pm-entry-card card-texto"
          onClick={() => onAbrirTexto?.()}
          role="button"
          tabIndex={0}
          title="Escribir tema con el teclado"
        >
          <div className="pm-entry-card-header">
            <span className="pm-entry-icon">⌨️</span>
            <span className="pm-entry-pill pill-escrito">Teclado</span>
          </div>
          <h4 className="pm-entry-title">Escribir Tema</h4>
          <p className="pm-entry-desc">
            Escribe tu tema, grado y área curricular directamente con el teclado.
          </p>
          <span className="pm-entry-action-label">Escribir ahora ➔</span>
        </div>
      </div>

      {/* Accesos rápidos curriculares */}
      <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "12px", flexWrap: "wrap" }}>
        {onAbrirCurriculo && (
          <button
            type="button"
            onClick={onAbrirCurriculo}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "20px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              fontSize: "12px",
              fontWeight: "600",
              color: "#1a7d8c",
              cursor: "pointer"
            }}
          >
            <span>📚</span>
            <span>Explorar Currículo MINERD</span>
          </button>
        )}

        {onAbrirEsquemas && (
          <button
            type="button"
            onClick={onAbrirEsquemas}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "20px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              fontSize: "12px",
              fontWeight: "600",
              color: "#12304a",
              cursor: "pointer"
            }}
          >
            <span>📋</span>
            <span>Cambiar Esquema</span>
          </button>
        )}
      </div>
    </div>
  );
}
