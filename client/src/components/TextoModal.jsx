import { useState, useEffect, useRef } from "react";

function BookOpenIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

export default function TextoModal({ 
  initialValue = "", 
  titulo = "Describe la planificación", 
  onCancel, 
  onConfirm,
  onConsultarCurriculo
}) {
  const [value, setValue] = useState(initialValue);
  const textareaRef = useRef(null);

  useEffect(() => {
    setValue(initialValue);
    if (textareaRef.current) {
      textareaRef.current.focus();
      // Colocar el cursor al final del texto predefinido
      const len = (initialValue || "").length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [initialValue]);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <h3 style={{ margin: 0, fontSize: "17px", color: "var(--pm-navy, #12304a)" }}>{titulo}</h3>
          <button 
            type="button" 
            onClick={onCancel}
            style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#64748b" }}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <textarea
          ref={textareaRef}
          autoFocus
          placeholder="Ej: Planificación de Matemáticas para 5to de Primaria, tema fracciones, competencias de resolución de problemas..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={5}
        />
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          marginTop: "6px",
          fontSize: "12px",
          color: "#475569",
          background: "#f8fafc",
          padding: "6px 10px",
          borderRadius: "6px",
          border: "1px solid #e2e8f0"
        }}>
          <span style={{ fontSize: "13px" }}>🔒</span>
          <span><strong>Privacidad:</strong> Por seguridad de los alumnos, no ingreses nombres de estudiantes ni datos personales sensibles.</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px", flexWrap: "wrap", gap: "8px" }}>
          {onConsultarCurriculo && (
            <button
              type="button"
              onClick={onConsultarCurriculo}
              style={{
                background: "#f0fdf4",
                border: "1px solid #86efac",
                color: "#166534",
                borderRadius: "6px",
                padding: "6px 12px",
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}
              title="Consultar competencias e indicadores en el currículo oficial"
            >
              <BookOpenIcon />
              <span>Ver en Malla Curricular</span>
            </button>
          )}
          <div className="modal-actions" style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
            <button type="button" onClick={onCancel} style={{ background: "#eee" }}>Cancelar</button>
            <button 
              type="button"
              style={{ background: "var(--teal, #1a7d8c)", color: "white" }} 
              onClick={() => onConfirm(value)} 
              disabled={!value.trim()}
            >
              Generar Planificación
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
