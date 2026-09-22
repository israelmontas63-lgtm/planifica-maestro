function MicIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

function MicPulseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" strokeDasharray="4 2" />
      <circle cx="12" cy="12" r="4" fill="#dc2626" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function KeyboardIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="6" width="20" height="14" rx="3" />
      <line x1="6" y1="10" x2="6" y2="10" strokeWidth="2.5" />
      <line x1="10" y1="10" x2="10" y2="10" strokeWidth="2.5" />
      <line x1="14" y1="10" x2="14" y2="10" strokeWidth="2.5" />
      <line x1="18" y1="10" x2="18" y2="10" strokeWidth="2.5" />
      <line x1="6" y1="14" x2="6" y2="14" strokeWidth="2.5" />
      <line x1="10" y1="14" x2="10" y2="14" strokeWidth="2.5" />
      <line x1="14" y1="14" x2="14" y2="14" strokeWidth="2.5" />
      <line x1="18" y1="14" x2="18" y2="14" strokeWidth="2.5" />
      <line x1="8" y1="18" x2="16" y2="18" strokeWidth="2.5" />
    </svg>
  );
}

function BookOpenIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function ClipboardCheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M9 12h6" />
      <path d="M9 16h6" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

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
            <span className="pm-entry-icon">{listening ? <MicPulseIcon /> : <MicIcon />}</span>
            <span className="pm-entry-pill pill-recomendado">Más Rápido</span>
          </div>
          <h4 className="pm-entry-title">{listening ? "Escuchando..." : "Por Voz"}</h4>
          <p className="pm-entry-desc">
            {listening ? "Habla ahora, la IA está captando tu voz..." : "Dicta tu tema y la IA redactará la clase de inmediato."}
          </p>
          <span className="pm-entry-action-label" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <span>{listening ? "Detener y Enviar" : "Tocar para hablar"}</span>
            <ArrowRightIcon />
          </span>
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
            <span className="pm-entry-icon"><CameraIcon /></span>
            <span className="pm-entry-pill pill-visual">Desde Material</span>
          </div>
          <h4 className="pm-entry-title">Foto o Imagen</h4>
          <p className="pm-entry-desc">
            Sube o fotografía páginas de tu libro, cuaderno o guía docente.
          </p>
          <span className="pm-entry-action-label" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <span>Capturar página</span>
            <ArrowRightIcon />
          </span>
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
            <span className="pm-entry-icon"><KeyboardIcon /></span>
            <span className="pm-entry-pill pill-escrito">Teclado</span>
          </div>
          <h4 className="pm-entry-title">Escribir Tema</h4>
          <p className="pm-entry-desc">
            Escribe tu tema, grado y área curricular directamente con el teclado.
          </p>
          <span className="pm-entry-action-label" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <span>Escribir ahora</span>
            <ArrowRightIcon />
          </span>
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
            <BookOpenIcon />
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
            <ClipboardCheckIcon />
            <span>Cambiar Esquema</span>
          </button>
        )}
      </div>
    </div>
  );
}
