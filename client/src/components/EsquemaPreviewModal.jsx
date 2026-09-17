import { useMemo } from "react";

export default function EsquemaPreviewModal({
  esquemaId,
  esquemaDef,
  periodoActivo = "diaria",
  onConfirmar,
  onCerrar
}) {
  const bloques = useMemo(() => {
    if (esquemaDef?.bloques && Array.isArray(esquemaDef.bloques)) {
      return esquemaDef.bloques;
    }
    return [];
  }, [esquemaDef]);

  const titulo = esquemaDef?.label || "Esquema de Planificación";
  const descripcion = esquemaDef?.descripcion || "";
  const ciclos = esquemaDef?.ciclos ? (Array.isArray(esquemaDef.ciclos) ? esquemaDef.ciclos.join(", ") : esquemaDef.ciclos) : "";
  const notas = esquemaDef?.notas && Array.isArray(esquemaDef.notas) ? esquemaDef.notas[0] : "";

  return (
    <div className="pm-preview-overlay" onClick={onCerrar} style={{ zIndex: 1200 }}>
      <div className="pm-preview-modal" onClick={(e) => e.stopPropagation()}>
        
        {/* Encabezado del modal */}
        <div className="pm-preview-header">
          <div className="pm-preview-badge-row">
            <span className="pm-preview-tag">👁️ Vista Previa de Plantilla</span>
            <span className="pm-preview-periodo-tag">⏱️ Alcance: {periodoActivo.toUpperCase()}</span>
          </div>

          <h2 className="pm-preview-title">{titulo}</h2>
          {descripcion && <p className="pm-preview-desc">{descripcion}</p>}

          {ciclos && (
            <div className="pm-preview-meta">
              <span className="pm-preview-meta-label">🎓 Ciclos / Grados sugeridos:</span>
              <span className="pm-preview-meta-val">{ciclos}</span>
            </div>
          )}

          <button
            type="button"
            className="pm-preview-close-btn"
            onClick={onCerrar}
            title="Cerrar vista previa"
            aria-label="Cerrar vista previa"
          >
            ✕
          </button>
        </div>

        {/* Nota explicativa institucional */}
        <div className="pm-preview-banner">
          <div className="pm-preview-banner-icon">📋</div>
          <div className="pm-preview-banner-text">
            <strong>Estructura oficial sin contenido (formulario en blanco)</strong>
            <p>
              Estos son los <strong>{bloques.length} campos exactos</strong> que la Inteligencia Artificial completará al redactar tu planificación según las normativas del MINERD.
            </p>
          </div>
        </div>

        {/* Cuerpo con los bloques vacíos */}
        <div className="pm-preview-body">
          {bloques.length === 0 ? (
            <div className="pm-preview-empty-state">
              <p>Cargando estructura oficial del esquema...</p>
            </div>
          ) : (
            <div className="pm-preview-fields-list">
              {bloques.map((bloque, index) => (
                <div key={index} className="pm-preview-field-card">
                  <div className="pm-preview-field-header">
                    <span className="pm-preview-field-num">{index + 1}</span>
                    <h4 className="pm-preview-field-title">{bloque}</h4>
                  </div>
                  <div className="pm-preview-field-box">
                    <span className="pm-preview-field-placeholder">
                      [ Campo vacío — Se completará automáticamente con IA o de forma manual ]
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {notas && (
            <div className="pm-preview-footer-note">
              <span>💡 <strong>Criterio Pedagógico:</strong> {notas}</span>
            </div>
          )}
        </div>

        {/* Barra de acciones inferior */}
        <div className="pm-preview-actions">
          <button
            type="button"
            className="pm-preview-btn-cancel"
            onClick={onCerrar}
          >
            ← Volver a los esquemas
          </button>

          <button
            type="button"
            className="pm-preview-btn-confirm"
            onClick={() => {
              onConfirmar?.(periodoActivo, esquemaId);
            }}
          >
            <span>✓ Usar este esquema</span>
          </button>
        </div>
      </div>
    </div>
  );
}
