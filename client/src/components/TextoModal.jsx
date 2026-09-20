import { useState, useEffect, useRef } from "react";

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
                gap: "5px"
              }}
              title="Consultar competencias e indicadores en el currículo oficial"
            >
              📚 Ver en Malla Curricular
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
